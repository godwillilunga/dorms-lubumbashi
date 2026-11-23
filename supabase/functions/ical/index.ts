// Fonction Edge « ical » (à déployer SANS vérification JWT, car Airbnb ne peut pas envoyer de clé).
//   GET  …/functions/v1/ical?jeton=XXXX   -> calendrier iCal des dates occupées du lit (à donner à Airbnb)
//   POST …/functions/v1/ical?sync=1       -> importe les calendriers Airbnb (appelé toutes les 30 min par pg_cron)
// L'export ne contient aucune donnée personnelle : seulement « Réservé » et des dates.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const sb = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const jour = (d: string) => d.replaceAll("-", "");
const versIso = (v: string) => `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;

async function exporter(jeton: string) {
  const db = sb();
  if (!/^[0-9a-f-]{36}$/i.test(jeton)) return new Response("Introuvable", { status: 404 });
  const { data: src } = await db.from("sources_ical").select("id, lit_id").eq("jeton_export", jeton).maybeSingle();
  if (!src) return new Response("Introuvable", { status: 404 });
  const depuis = new Date(Date.now() - 31 * 864e5).toISOString().slice(0, 10);
  const { data: rs } = await db.from("reservations").select("id, debut, fin, source_ical_id")
    .eq("lit_id", src.lit_id).in("statut", ["approuvee", "confirmee", "conflit"]).gte("fin", depuis);
  const maintenant = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const ev = (rs ?? []).filter((r) => r.source_ical_id !== src.id)   // ne pas renvoyer à Airbnb ses propres dates
    .map((r) => ["BEGIN:VEVENT", `UID:dorms-${r.id}@thedormslubumbashi`, `DTSTAMP:${maintenant}`,
      `DTSTART;VALUE=DATE:${jour(r.debut)}`, `DTEND;VALUE=DATE:${jour(r.fin)}`, "SUMMARY:Réservé - The Dorms", "END:VEVENT"].join("\r\n"));
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//The Dorms Lubumbashi//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", ...ev, "END:VCALENDAR", ""].join("\r\n");
  return new Response(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" } });
}

function lireIcs(txt: string) {
  const plat = txt.replace(/\r?\n[ \t]/g, "");           // lignes repliées
  const evs: { uid: string; debut: string; fin: string }[] = [];
  for (const bloc of plat.split("BEGIN:VEVENT").slice(1)) {
    const champ = (n: string) => (bloc.match(new RegExp(`^${n}(?:;[^:\\r\\n]*)?:(.*)$`, "m")) || [])[1]?.trim();
    const d = champ("DTSTART"), f = champ("DTEND"), uid = champ("UID");
    if (!d || !uid) continue;
    const debut = versIso(d.slice(0, 8));
    let fin = f ? versIso(f.slice(0, 8)) : debut;
    if (fin <= debut) fin = new Date(Date.parse(debut) + 864e5).toISOString().slice(0, 10);
    evs.push({ uid, debut, fin });
  }
  return evs;
}

async function synchroniser() {
  const db = sb();
  const { data: sources } = await db.from("sources_ical").select("*").not("url_import", "is", null);
  const bilan: Record<string, string> = {};
  const auj = new Date().toISOString().slice(0, 10);
  for (const s of sources ?? []) {
    let res = "";
    try {
      const rep = await fetch(s.url_import, { headers: { "User-Agent": "TheDorms-iCal/1.0" } });
      if (!rep.ok) throw new Error("HTTP " + rep.status);
      const evs = lireIcs(await rep.text()).filter((e) => e.fin >= auj);
      let ajoutes = 0, conflits = 0;
      for (const e of evs) {
        const { data: exist } = await db.from("reservations").select("id, debut, fin, statut")
          .eq("source_ical_id", s.id).eq("uid_externe", e.uid).maybeSingle();
        if (exist && exist.debut === e.debut && exist.fin === e.fin) continue;
        const ligne = { client: "voyageur", formule: "dortoir", lit_id: s.lit_id, debut: e.debut, fin: e.fin,
          nom: s.nom || "Airbnb", telephone: "airbnb", source: "airbnb", source_ical_id: s.id, uid_externe: e.uid,
          statut: "confirmee", notes: "Importé automatiquement depuis " + (s.nom || "Airbnb") };
        let { error } = exist
          ? await db.from("reservations").update({ debut: e.debut, fin: e.fin, statut: "confirmee" }).eq("id", exist.id)
          : await db.from("reservations").insert(ligne);
        if (error && (error.code === "23P01" || /double_reservation/.test(error.message))) {
          // Chevauchement avec une réservation du site : on garde la trace en « conflit » pour que l'admin le voie.
          ({ error } = exist
            ? await db.from("reservations").update({ debut: e.debut, fin: e.fin, statut: "conflit" }).eq("id", exist.id)
            : await db.from("reservations").insert({ ...ligne, statut: "conflit" }));
          conflits++;
        }
        if (error) throw error;
        ajoutes++;
      }
      // Dates libérées sur Airbnb : on supprime les blocages futurs qui ne sont plus dans le flux
      const uids = evs.map((e) => e.uid);
      const { data: anciens } = await db.from("reservations").select("id, uid_externe").eq("source_ical_id", s.id).gte("fin", auj);
      const aSupprimer = (anciens ?? []).filter((a) => !uids.includes(a.uid_externe)).map((a) => a.id);
      if (aSupprimer.length) await db.from("reservations").delete().in("id", aSupprimer);
      res = `OK : ${evs.length} dates, ${ajoutes} mises à jour, ${conflits} conflit(s), ${aSupprimer.length} retirées`;
    } catch (err) {
      res = "Erreur : " + ((err as Error).message || String(err));
    }
    await db.from("sources_ical").update({ derniere_synchro: new Date().toISOString(), dernier_resultat: res }).eq("id", s.id);
    bilan[s.nom + " #" + s.id] = res;
  }
  return new Response(JSON.stringify(bilan), { headers: { "Content-Type": "application/json" } });
}

Deno.serve((req) => {
  const u = new URL(req.url);
  if (u.searchParams.get("sync")) return synchroniser();
  const jeton = u.searchParams.get("jeton");
  if (jeton) return exporter(jeton.replace(/\.ics$/, ""));
  return new Response("The Dorms iCal", { status: 400 });
});
