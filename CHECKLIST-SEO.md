# Checklist SEO : être n°1 sur « dortoir Lubumbashi »

Le site est déjà optimisé : titre et description uniques par page, un seul H1, textes alternatifs sur toutes les photos,
URL propres, français + anglais (hreflang), `sitemap.xml`, `robots.txt`, liens canoniques, image d'aperçu WhatsApp/Facebook,
données structurées Google (Hostel + FAQ), pages légères pour téléphones.

**Ce qui reste dépend de vous.** Faites les étapes dans l'ordre. Règle d'or, partout sur Internet, écrivez **exactement** :

> **The Dorms Lubumbashi**
> **24, avenue Mungunzi prolongé, Quartier Industriel, Lubumbashi**
> **+243 863 472 047**
> **contact@dormslubumbashi.com** · **https://dormslubumbashi.com**

(c'est le « NAP » : Nom, Adresse, Téléphone — Google compare ces informations entre les sites ; elles doivent être identiques.)

---

## 1. Google Business Profile ⭐ (le plus important pour « Lubumbashi »)

Votre fiche existe déjà mais **n'est pas encore validée**. Sans validation, elle n'apparaît presque pas sur Google Maps.

1. Ouvrez https://business.google.com avec le compte Google de la fiche.
2. Cliquez sur **Valider** (Get verified). Choisissez la **vidéo** : filmez en une seule prise, sans couper :
   la rue et un repère (route de la British International School), l'entrée/portail avec le numéro 24, l'intérieur
   (salon, chambres), et une preuve que vous êtes le gérant (clés qui ouvrent le portail, document au nom des Dorms).
3. Après validation, vérifiez :
   - **Site web** : `https://dormslubumbashi.com/` (remplace le Google Site).
   - **Catégorie principale** : *Auberge de jeunesse* (Hostel) ; catégories secondaires : *Résidence étudiante*, *Hébergement*.
   - **Horaires** : ouvert 24 h/24.
   - **Attributs** : Wi-Fi, cuisine, parking (si oui), etc.
   - **Photos** : au moins 10 récentes (chambres, salon, cuisine, douche, façade). Ajoutez-en 2 ou 3 chaque mois.
   - **Description** : reprenez le texte d'accueil du site.
4. Publiez un **post** Google (« Places disponibles pour la rentrée ») une fois par mois.

## 2. Google Search Console

Déjà vérifié pour l'ancien site. Il faut ajouter le nouveau :
1. https://search.google.com/search-console → **Ajouter une propriété** → **Préfixe d'URL** :
   `https://dormslubumbashi.com/`
2. Méthode de validation : **Google Analytics** (même compte) ou **Balise HTML** (envoyez-moi la balise, je l'ajoute au site).
3. Menu **Sitemaps** → saisir `sitemap.xml` → **Envoyer**.
4. Menu **Inspection de l'URL** → collez l'adresse de l'accueil → **Demander une indexation**. Faites-le aussi pour `/prix/` et `/chambres/`.
5. Revenez dans 2 semaines : onglet **Performances** pour voir les recherches qui amènent des visiteurs.

## 3. Bing Webmaster Tools (5 minutes, gratuit)

1. https://www.bing.com/webmasters → connexion avec Microsoft ou Google.
2. **Importer depuis Google Search Console** (le plus rapide) → choisissez la propriété des Dorms.
3. Vérifiez que `sitemap.xml` est bien listé.

## 4. Nom de domaine ✅ fait le 23/11/2026 (dormslubumbashi.com, Cloudflare, renouvellement auto 11,17 $/an)

Une adresse comme **dormslubumbashi.com** inspire confiance et se retient mieux.

1. Achetez le domaine chez un registraire (ex. Namecheap, Porkbun, Cloudflare — environ 10 $/an).
2. Chez le registraire, dans la zone DNS, créez :
   - 4 enregistrements **A** pour `@` : `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - 1 enregistrement **CNAME** pour `www` → `godwillilunga.github.io`
3. Sur GitHub : dépôt **dorms-lubumbashi** › **Settings** › **Pages** › *Custom domain* : `dormslubumbashi.com` → **Save**.
   Attendez que le contrôle DNS soit vert, puis cochez **Enforce HTTPS**.
4. Dans `src/donnees/site.json` : `"url": "https://dormslubumbashi.com"` et `"domaine": "dormslubumbashi.com"`.
5. Mettez à jour l'adresse du site dans Google Business Profile, Search Console (nouvelle propriété), Facebook, Airbnb.

## 5. Avis Google (très important pour le classement)

- Demandez un avis à **chaque** client satisfait, au moment du départ (ou à la fin du trimestre pour les étudiants).
- Dans Google Business Profile › **Demander des avis** : copiez le lien court et envoyez-le sur WhatsApp :
  > « Merci pour votre séjour aux Dorms ! Si vous avez aimé, un petit avis nous aiderait beaucoup : [lien] »
- **Répondez à tous les avis**, positifs comme négatifs, poliment, en citant « The Dorms Lubumbashi ».
- N'achetez jamais d'avis et n'écrivez pas de faux avis (Google les supprime et peut suspendre la fiche).
- Ajoutez les meilleurs avis au site (§ 6 du README), avec l'accord de la personne.

## 6. Annuaires et réseaux (même NAP partout)

| Où | Quoi faire |
|---|---|
| **Facebook** | Page « The Dorms Lubumbashi » : catégorie *Auberge*, adresse, téléphone, lien du site, photos. Publiez dans les groupes d'étudiants de Lubumbashi. |
| **Instagram / TikTok** | Courtes vidéos de visite, lien du site dans la bio. |
| **WhatsApp Business** | Profil professionnel : adresse, horaires 24h/24, lien du site, catalogue des lits. |
| **Airbnb** | Annonce existante : même nom et même quartier. (Pas de lien Airbnb sur le site, comme demandé.) |
| **LinkedIn** | Page entreprise déjà créée : remplacez le lien par le nouveau site. |
| **Annuaires** | Bing Places (importer depuis Google), Apple Business Connect (Apple Plans), et les annuaires locaux de la RDC / Lubumbashi que vous trouvez. Même NAP à chaque fois. |
| **Universités** | Affiches avec un **QR code** vers le site aux valves ; demandez aux services étudiants de partager le lien. |

## 7. Chaque mois (15 minutes)

- [ ] 2–3 nouvelles photos sur Google Business Profile.
- [ ] 1 post Google + 1 publication Facebook.
- [ ] Répondre aux nouveaux avis.
- [ ] Search Console › Performances : quelles recherches amènent des visiteurs ? (Dites-le-moi, j'adapterai les textes.)
- [ ] Sauvegarde CSV depuis l'admin.

## Mots-clés visés par le site

dortoir Lubumbashi · logement étudiant Lubumbashi · chambre à louer Lubumbashi · hébergement pas cher Lubumbashi ·
auberge Lubumbashi · hostel Lubumbashi · student housing Lubumbashi · cheap accommodation Lubumbashi.
Les noms des universités proches seront ajoutés plus tard (page Accès, `reperes` dans `site.json`).
