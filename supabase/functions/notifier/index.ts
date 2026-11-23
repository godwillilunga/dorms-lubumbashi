// Fonction Edge « notifier » : envoie un e-mail au propriétaire pour chaque nouvelle demande pas encore signalée.
// Secrets à définir dans Supabase > Edge Functions > Secrets :
//   RESEND_API_KEY  (clé gratuite sur resend.com)
//   NOTIF_EMAIL     (votre adresse e-mail = celle de votre compte Resend)
//   ADMIN_URL       (facultatif) lien vers votre page admin, ex. https://…/admin/
// Elle peut être appelée par n'importe qui sans danger : elle n'envoie que les demandes pas encore signalées, et seulement à vous.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const echap = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

Deno.serve(async () => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const cle = Deno.env.get("RESEND_API_KEY"), dest = Deno.env.get("NOTIF_EMAIL");
  if (!cle || !dest) return new Response(JSON.stringify({ erreur: "RESEND_API_KEY ou NOTIF_EMAIL manquant" }), { status: 500 });

  const { data, error } = await sb.from("reservations")
    .select("id, client, formule, lit_id, debut, fin, nom, telephone, email, universite, message, montant, created_at")
    .eq("source", "site").is("notifie_le", null).order("id").limit(20);
  if (error) return new Response(JSON.stringify({ erreur: error.message }), { status: 500 });

  let envoyes = 0;
  for (const r of data ?? []) {
    let lit = "N'importe quel lit libre";
    if (r.lit_id) { const { data: l } = await sb.rpc("libelle_lit", { p_lit: r.lit_id }); if (l) lit = l; }
    const ref = "DL-" + String(r.id).padStart(4, "0");
    let tel = String(r.telephone).replace(/\D/g, "");
    if (tel.startsWith("00")) tel = tel.slice(2);
    if (tel.startsWith("0")) tel = "243" + tel.slice(1);
    if (tel.length === 9) tel = "243" + tel;
    const lignes: [string, unknown][] = [
      ["Client", r.client === "etudiant" ? "Étudiant" : "Voyageur"], ["Formule", r.formule], ["Lit", lit],
      ["Du", r.debut], ["Au (départ)", r.fin], ["Montant estimé", r.montant != null ? r.montant + " $" : "—"],
      ["Nom", r.nom], ["Téléphone", r.telephone], ["E-mail", r.email], ["Université", r.universite], ["Message", r.message],
    ];
    const html = `<h2>Nouvelle demande ${ref}</h2><table cellpadding="6" style="border-collapse:collapse">${
      lignes.filter(([, v]) => v).map(([k, v]) => `<tr><td style="color:#59636F">${k}</td><td><b>${echap(v)}</b></td></tr>`).join("")
    }</table><p><a href="https://wa.me/${tel}">Ouvrir WhatsApp avec ${echap(r.nom)}</a>${
      Deno.env.get("ADMIN_URL") ? ` · <a href="${echap(Deno.env.get("ADMIN_URL"))}">Ouvrir l'admin</a>` : ""}</p>`;

    const rep = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "The Dorms <onboarding@resend.dev>", to: [dest], subject: `Nouvelle demande ${ref} — ${r.nom}`, html }),
    });
    if (rep.ok) {
      await sb.from("reservations").update({ notifie_le: new Date().toISOString() }).eq("id", r.id);
      envoyes++;
    } else {
      console.error("Resend", rep.status, await rep.text());
    }
  }
  return new Response(JSON.stringify({ envoyes }), { headers: { "Content-Type": "application/json" } });
});
