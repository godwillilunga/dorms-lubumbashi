"""Construit le site statique dans le dossier _site/.

    python build.py            -> version normale (GitHub Pages)
    python build.py --apercu   -> liens vers .../index.html (pour ouvrir les fichiers sans serveur)

Vous n'avez normalement pas besoin de lancer ce script : GitHub le fait tout seul à chaque modification.
"""
import argparse, datetime, hashlib, json, os, shutil, urllib.parse
from jinja2 import Environment, FileSystemLoader, StrictUndefined

ICI = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ICI, "src")
OUT = os.path.join(ICI, "_site")
PAGES = ["accueil", "chambres", "equipements", "prix", "acces", "reglement", "faq", "contact", "reserver"]
LANGUES = ["fr", "en"]


def lire(nom):
    with open(os.path.join(SRC, "donnees", nom), encoding="utf-8") as f:
        return json.load(f)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--apercu", action="store_true")
    apercu = ap.parse_args().apercu

    S = lire("site.json"); T = {l: lire(l + ".json") for l in LANGUES}; TAILLES = lire("photos_tailles.json")
    S["url"] = S["url"].rstrip("/")

    os.makedirs(OUT, exist_ok=True)
    for nom in os.listdir(OUT):  # vide _site/ sans supprimer le dossier lui-même
        chemin_ = os.path.join(OUT, nom)
        shutil.rmtree(chemin_) if os.path.isdir(chemin_) else os.remove(chemin_)
    shutil.copytree(os.path.join(SRC, "static"), os.path.join(OUT, "static"))
    if os.path.isdir(os.path.join(SRC, "admin")):
        shutil.copytree(os.path.join(SRC, "admin"), os.path.join(OUT, "admin"))
        with open(os.path.join(OUT, "admin", "config.js"), "w", encoding="utf-8") as f:
            f.write("window.DORMS_ADMIN = " + json.dumps({"url": S["supabase_url"].rstrip("/"), "key": S["supabase_anon_key"]}) + ";\n")

    def empreinte(chemin):  # ?v=xxxx pour forcer la mise à jour du cache quand un fichier change
        with open(os.path.join(SRC, "static", chemin), "rb") as f:
            return hashlib.md5(f.read()).hexdigest()[:8]

    def chemin(cle, lang):
        slug = T[lang]["pages"][cle]["slug"]
        return "/".join(([] if lang == "fr" else ["en"]) + ([slug] if slug else []))

    env = Environment(loader=FileSystemLoader(os.path.join(SRC, "templates")), autoescape=True,
                      undefined=StrictUndefined, trim_blocks=True, lstrip_blocks=True)
    env.policies["json.dumps_kwargs"] = {"ensure_ascii": False}

    pages_generees = []
    for lang in LANGUES:
        t = T[lang]; autre = T["en" if lang == "fr" else "fr"]
        for cle in PAGES:
            cur = chemin(cle, lang)
            racine = "../" * (len(cur.split("/")) if cur else 0)

            def url(k, l=None, _racine=racine):
                c = chemin(k, l or lang)
                r = _racine + (c + "/" if c else "")
                if apercu:
                    r += "index.html"
                return r or "./"

            def static(p, _racine=racine):
                v = "?v=" + empreinte(p) if p.endswith((".css", ".js")) else ""
                return _racine + "static/" + p + v

            def absolu(k, l):
                c = chemin(k, l)
                return S["url"] + "/" + (c + "/" if c else "")

            def photo_alt(nom, _lang=lang):
                return next((p[_lang] for p in S["photos"] if p["nom"] == nom), "")

            def wa(texte):
                return "https://wa.me/" + S["whatsapp"] + "?text=" + urllib.parse.quote(texte)

            p = dict(t["pages"][cle]); p.setdefault("h1", t["accueil"]["h1"])
            config = {
                "lang": lang, "whatsapp": S["whatsapp"],
                "types": [{k: ty[k] for k in ("id", "mois", "mois_court", "trimestre", "nuit")} for ty in S["types"]],
                "sb": {"url": S["supabase_url"], "key": S["supabase_anon_key"]},
                "t": {**{k: v for k, v in t["reserver_page"].items() if isinstance(v, str)},
                      **{k: v for k, v in t["chambres_page"].items() if k.startswith("dispo")},
                      "detail_mois": t["prix_page"]["calc_detail_mois"], "detail_court": t["prix_page"]["calc_detail_court"], "detail_nuits": t["prix_page"]["calc_detail_nuits"]},
            }
            ctx = dict(s=S, t=t, autre=autre, lang=lang, page=cle, p=p, tailles=TAILLES, racine=racine,
                       url=url, static=static, abs=absolu, photo_alt=photo_alt, wa=wa,
                       annee=datetime.date.today().year,
                       config_js=json.dumps(config, ensure_ascii=False).replace("</", "<\\/"),
                       jsonld=jsonld(S, t, lang, cle, absolu))
            html = env.get_template("pages/" + cle + ".html").render(**ctx)
            dossier = os.path.join(OUT, *cur.split("/")) if cur else OUT
            os.makedirs(dossier, exist_ok=True)
            with open(os.path.join(dossier, "index.html"), "w", encoding="utf-8") as f:
                f.write(html)
            pages_generees.append((cle, lang))

    # Fichiers techniques : sitemap, robots, 404, manifeste, domaine
    auj = datetime.date.today().isoformat()
    lignes = ['<?xml version="1.0" encoding="UTF-8"?>',
              '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for cle, lang in pages_generees:
        u = S["url"] + "/" + (chemin(cle, lang) + "/" if chemin(cle, lang) else "")
        alt = "".join(f'<xhtml:link rel="alternate" hreflang="{l}" href="{S["url"]}/{chemin(cle, l) + "/" if chemin(cle, l) else ""}"/>' for l in LANGUES)
        prio = "1.0" if cle == "accueil" else ("0.9" if cle in ("reserver", "prix", "chambres") else "0.7")
        lignes.append(f"<url><loc>{u}</loc>{alt}<lastmod>{auj}</lastmod><priority>{prio}</priority></url>")
    lignes.append("</urlset>")
    ecrire("sitemap.xml", "\n".join(lignes))
    ecrire("robots.txt", f"User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: {S['url']}/sitemap.xml\n")
    ecrire(".nojekyll", "")
    ecrire("site.webmanifest", json.dumps({
        "name": S["nom"], "short_name": "The Dorms", "start_url": "./", "display": "browser",
        "background_color": "#FFFFFF", "theme_color": "#3E4958", "lang": "fr",
        "icons": [{"src": "static/img/brand/icon-192.png", "sizes": "192x192", "type": "image/png"},
                  {"src": "static/img/brand/icon-512.png", "sizes": "512x512", "type": "image/png"}]}, ensure_ascii=False))
    shutil.copy(os.path.join(SRC, "static", "img", "brand", "favicon.ico"), os.path.join(OUT, "favicon.ico"))
    base = S["url"].split("//", 1)[-1].split("/", 1)
    prefixe = "/" + base[1] + "/" if len(base) > 1 else "/"
    ecrire("404.html", f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Page introuvable | The Dorms Lubumbashi</title><meta name="robots" content="noindex"><link rel="stylesheet" href="{prefixe}static/css/site.css"></head><body><main class="col" style="padding-block:4rem;display:grid;gap:1rem"><h1>Page introuvable</h1><p>Cette page n'existe pas ou a été déplacée. <span lang="en">This page does not exist.</span></p><p><a class="btn btn-or" href="{prefixe}">Accueil · Home</a></p></main></body></html>""")
    if S.get("domaine"):
        ecrire("CNAME", S["domaine"] + "\n")
    print(f"{len(pages_generees)} pages -> {OUT}" + (" (aperçu)" if apercu else ""))


def ecrire(nom, contenu):
    with open(os.path.join(OUT, nom), "w", encoding="utf-8") as f:
        f.write(contenu)


def jsonld(S, t, lang, cle, absolu):
    """Données structurées schema.org (Google) pour la page."""
    a = S["adresse"]; dortoir = S["types"][0]
    hostel = {
        "@type": ["Hostel", "LodgingBusiness"], "@id": S["url"] + "/#hostel",
        "name": S["nom"], "url": absolu("accueil", lang), "telephone": S["telephone"].replace(" ", ""), **({"email": S["email"]} if S.get("email") else {}),
        "description": t["pages"]["accueil"]["description"],
        "image": [S["url"] + "/static/img/brand/apercu.jpg"] + [S["url"] + f"/static/img/photos/{n}-960.webp" for n in ("chambre-1", "cuisine-1", "exterieur-1")],
        "logo": S["url"] + "/static/img/brand/icon-512.png",
        "priceRange": f"${dortoir['nuit']} - ${dortoir['mois']}",
        "currenciesAccepted": "USD, CDF", "paymentAccepted": "Cash, M-Pesa, Orange Money, Airtel Money",
        "address": {"@type": "PostalAddress", "streetAddress": a["rue"], "addressLocality": a["ville"],
                    "addressRegion": a["province"], "addressCountry": a["pays"]},
        "geo": {"@type": "GeoCoordinates", "latitude": S["geo"]["lat"], "longitude": S["geo"]["lng"]},
        "hasMap": f"https://www.google.com/maps?q={S['geo']['lat']},{S['geo']['lng']}",
        "openingHoursSpecification": [{"@type": "OpeningHoursSpecification",
                                       "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
                                       "opens": "00:00", "closes": "23:59"}],
        "amenityFeature": [{"@type": "LocationFeatureSpecification", "name": e["titre"], "value": True} for e in t["equipements"]],
        "numberOfRooms": sum(len(m["chambres"]) for m in S["maisons"] if not m["bientot"]),
        "availableLanguage": ["French", "English"],
        "sameAs": [r["url"] for r in S.get("reseaux", [])],
    }
    graphe = []
    if cle in ("accueil", "contact", "acces", "prix"):
        graphe.append(hostel)
    if cle == "faq":
        graphe.append({"@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": f["q"], "acceptedAnswer": {"@type": "Answer", "text": f["r"]}} for f in t["faq"]]})
    if cle != "accueil":
        graphe.append({"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": t["pages"]["accueil"]["nav"], "item": absolu("accueil", lang)},
            {"@type": "ListItem", "position": 2, "name": t["pages"][cle]["nav"], "item": absolu(cle, lang)}]})
    if not graphe:
        return ""
    return json.dumps({"@context": "https://schema.org", "@graph": graphe}, ensure_ascii=False).replace("</", "<\\/")


if __name__ == "__main__":
    main()
