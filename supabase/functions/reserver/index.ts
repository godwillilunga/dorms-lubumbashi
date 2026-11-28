// Fonction Edge « reserver » (déployée SANS vérification JWT) : reçoit le formulaire « Réserver » du site,
// vérifie le jeton anti-robot Cloudflare Turnstile, puis crée la demande avec demander_reservation().
// Le public ne peut plus appeler demander_reservation directement : il passe obligatoirement par ici.
// Secret à définir dans Supabase > Edge Functions > Secrets :
//   TURNSTILE_SECRET  (Cloudflare > Turnstile > widget « The Dorms - reservation » > Secret key)
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SITES = ["https://dormslubumbashi.com", "https://www.dormslubumbashi.com"];
const CHAMPS = ["p_client", "p_formule", "p_debut", "p_fin", "p_lit", "p_nom", "p_telephone",
  "p_email", "p_universite", "p_message", "p_langue"];

function cors(req: Request): Record<string, string> {
  const o = req.headers.get("Origin") || "";
  if (!SITES.includes(o)) return {};
  return { "Access-Control-Allow-Origin": o, "Vary": "Origin", "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  const h = { "Content-Type": "application/json", ...cors(req) };
  const reponse = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: h });
  if (req.method !== "POST") return reponse({ message: "METHODE" }, 405);

  const secret = Deno.env.get("TURNSTILE_SECRET");
  if (!secret) return reponse({ message: "CONFIG" }, 500);

  let d: Record<string, unknown>;
  try { d = await req.json(); } catch { return reponse({ message: "JSON" }, 400); }
  const jeton = typeof d.jeton === "string" ? d.jeton : "";
  if (!jeton || jeton.length > 2048) return reponse({ message: "TURNSTILE" }, 400);

  // 1) Vérification anti-robot auprès de Cloudflare (le jeton ne sert qu'une fois)
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", jeton);
  const ip = req.headers.get("cf-connecting-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  if (ip) form.append("remoteip", ip);
  try {
    const v = await (await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form })).json();
    if (!v.success) return reponse({ message: "TURNSTILE", detail: v["error-codes"] }, 400);
  } catch {
    return reponse({ message: "TURNSTILE_INDISPONIBLE" }, 502);
  }

  // 2) Création de la demande (mêmes contrôles qu'avant : dates, champs, limites, lit déjà pris…)
  const args: Record<string, unknown> = {};
  for (const k of CHAMPS) args[k] = d[k] ?? null;
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await sb.rpc("demander_reservation", args);
  if (error) return reponse({ code: error.code, message: error.message }, 400);
  return reponse(data);
});
