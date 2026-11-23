"""Prépare les photos du site : redimensionne, convertit en AVIF + WebP, supprime EXIF/GPS.

Usage : python outils/photos.py "C:/chemin/vers/Dossier Logement"
La liste des photos (source -> nom publié) est dans outils/photos.json.
Les originaux ne sont JAMAIS copiés dans le dépôt : seules les versions converties le sont.
"""
import json, sys, os
from PIL import Image, ImageOps
try:
    import pillow_heif; pillow_heif.register_heif_opener()
except ImportError:
    pass

ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(ICI, "..", "src", "static", "img", "photos")
LARGEURS = [480, 960, 1600]

def main(source_dir):
    liste = json.load(open(os.path.join(ICI, "photos.json"), encoding="utf-8"))
    os.makedirs(SORTIE, exist_ok=True)
    meta = {}
    for p in liste:
        im = Image.open(os.path.join(source_dir, p["source"]))
        im = ImageOps.exif_transpose(im).convert("RGB")   # applique la rotation puis oublie l'EXIF
        clean = Image.new("RGB", im.size); clean.paste(im)  # image neuve : aucune métadonnée
        tailles = []
        largeurs = sorted({w for w in LARGEURS if w < clean.width} | {min(clean.width, LARGEURS[-1])})
        for w in largeurs:
            r = clean if clean.width == w else clean.resize((w, round(clean.height * w / clean.width)), Image.LANCZOS)
            base = os.path.join(SORTIE, f"{p['nom']}-{w}")
            r.save(base + ".webp", "WEBP", quality=72, method=6)
            r.save(base + ".avif", "AVIF", quality=50)
            tailles.append(w)
        meta[p["nom"]] = {"w": clean.width, "h": clean.height, "tailles": tailles}
        print(p["nom"], clean.size, tailles)
    json.dump(meta, open(os.path.join(ICI, "..", "src", "donnees", "photos_tailles.json"), "w"), indent=1)

if __name__ == "__main__":
    main(sys.argv[1])
