"""Génère favicon, icônes et image d'aperçu (WhatsApp/Facebook) à partir du logo et d'une photo.
Usage : python outils/marque.py "C:/chemin/vers/Dossier Logement" """
import sys, os
from PIL import Image, ImageDraw, ImageFont, ImageOps
src = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "static", "img", "brand")
os.makedirs(OUT, exist_ok=True)
def propre(im):  # copie sans aucune métadonnée
    n = Image.new(im.mode, im.size); n.paste(im); return n
logo = propre(Image.open(os.path.join(src, "Dorms", "The dorms logo carre.png")).convert("RGB"))
for s, nom in [(512, "icon-512.png"), (192, "icon-192.png"), (180, "apple-touch-icon.png")]:
    logo.resize((s, s), Image.LANCZOS).save(os.path.join(OUT, nom), optimize=True)
# favicon : seulement le toit (lisible en 32 px)
toit = propre(Image.open(os.path.join(src, "Dorms", "The dorms Lubum.png")).convert("RGB"))
w, h = toit.size; c = Image.new("RGB", (max(w, h),) * 2, toit.getpixel((2, 2))); c.paste(toit, ((c.width - w) // 2, (c.height - h) // 2))
c.resize((48, 48), Image.LANCZOS).save(os.path.join(OUT, "favicon.png"), optimize=True)
c.resize((32, 32), Image.LANCZOS).save(os.path.join(OUT, "favicon.ico"))
# image d'aperçu 1200x630 : photo du salon + bandeau avec le logo
photo = ImageOps.exif_transpose(Image.open(os.path.join(src, "Dorms", "new photos january", "ph3.jpeg"))).convert("RGB")
og = ImageOps.fit(propre(photo), (1200, 630), Image.LANCZOS)
d = ImageDraw.Draw(og, "RGBA")
d.rectangle([0, 470, 1200, 630], fill=(62, 73, 88, 235))
bandeau = propre(Image.open(os.path.join(src, "Dorms", "The dorms.png")).convert("RGB"))
bandeau = bandeau.resize((round(bandeau.width * 150 / bandeau.height), 150), Image.LANCZOS)
og.paste(bandeau, (30, 475))
try:
    f1 = ImageFont.truetype("arialbd.ttf", 40); f2 = ImageFont.truetype("arial.ttf", 30)
except OSError:
    f1 = f2 = ImageFont.load_default()
d.text((380, 500), "Dortoir meublé · Lubumbashi", font=f1, fill="white")
d.text((380, 560), "Dès 80 $/mois · 15 $/nuit · +243 863 472 047", font=f2, fill=(233, 181, 38))
og.save(os.path.join(OUT, "apercu.jpg"), quality=82, optimize=True, progressive=True)
print(sorted(os.listdir(OUT)))
