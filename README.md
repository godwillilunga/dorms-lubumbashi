# The Dorms Lubumbashi — site web

Site officiel : **https://dormslubumbashi.com/**
Espace admin : **https://dormslubumbashi.com/admin/**

Le site est publié gratuitement par GitHub Pages. **Vous n'avez rien à installer** : toutes les modifications courantes se font
directement sur github.com, et le site se met à jour tout seul en 1 à 2 minutes (onglet **Actions** pour suivre).

> ⚠️ Ce dépôt est **public**. N'y ajoutez jamais de contrat, pièce d'identité, reçu, nom de locataire ou numéro personnel d'un client.

---

## 1. Modifier un fichier sur github.com (la méthode pour tout)

1. Ouvrez le fichier (ex. `src/donnees/site.json`).
2. Cliquez sur l'icône **crayon** ✏️ (Edit this file).
3. Faites la modification **en gardant les guillemets `"` et les virgules** exactement comme avant.
4. Cliquez sur **Commit changes…** puis **Commit changes**.
5. Attendez 1 à 2 minutes, puis rechargez le site. Si le site ne change pas : onglet **Actions** → une croix rouge ❌ signifie
   une faute de frappe (souvent une virgule ou un guillemet oublié). Ouvrez le fichier, corrigez, recommencez.

## 2. Changer les prix

Fichier **`src/donnees/site.json`**, section `"types"` :

```json
{ "id": "dortoir", "mois": 80, "mois_court": 100, "trimestre": 240, "nuit": 15, ... }
```

- `mois` = prix par mois pour un séjour étudiant de 3 mois ou plus, `mois_court` = prix par mois pour un étudiant qui reste moins de 3 mois (justificatif étudiant obligatoire ; `null` = pas de tarif court), `trimestre` = prix pour 3 mois, `nuit` = prix par nuit (`null` = pas de location à la nuit).
- `"bientot": true` = affiché comme « Bientôt » et non réservable. Mettez `false` quand la nouvelle maison ouvre.
- Le texte d'accueil « Dès 80 $ / mois · 15 $ la nuit » se trouve dans `src/donnees/fr.json` et `en.json` (`"faits"`), ainsi que la note de la page Prix (`"note_court"`) et la FAQ « Combien coûte un lit ? » : changez-les aussi.
- Quand la base Supabase sera active : changez aussi les prix dans **Admin › Lits & prix** (ils servent au calcul des demandes).

## 3. Changer un texte (FAQ, règlement, équipements…)

- Textes français : **`src/donnees/fr.json`** — textes anglais : **`src/donnees/en.json`**.
- Chaque page a sa section (`"faq"`, `"reglement_page"`, `"equipements"`…). Modifiez le texte entre guillemets.
- Pour ajouter une question à la FAQ, copiez une ligne `{ "q": "…", "r": "…" },` et changez le texte (dans les deux langues).
- Adresse, téléphone, distances (`"reperes"`) : dans `src/donnees/site.json`.

## 4. Ajouter des photos

Les photos du site doivent être **converties** (petites, sans données GPS). Deux possibilités :

**A. Avec Claude Code (le plus simple)** : mettez les photos dans votre dossier « Dossier Logement » et demandez
« ajoute ces photos au site des Dorms ».

**B. À la main sur votre ordinateur (Python installé)** :
1. Ajoutez une ligne dans `outils/photos.json` : `{"nom": "chambre-6", "source": "Dorms/ma-photo.jpg"}` (`nom` sans espaces ni accents).
2. Lancez : `python outils/photos.py "C:/Users/ilung/Documents/Dossier Logement"` — les versions converties (sans EXIF/GPS)
   sont créées dans `src/static/img/photos/`.
3. Ajoutez la photo dans `src/donnees/site.json`, liste `"photos"`, avec sa catégorie (`chambres`, `salon`, `cuisine`, `douche`,
   `exterieur`) et une **description** en français et en anglais (important pour Google et l'accessibilité).
4. Publiez (voir § 9).

## 5. Ajouter une chambre ou une maison

- **Affichage sur le site** : `src/donnees/site.json`, section `"maisons"` (nom FR/EN, type, nombre de lits).
- **Réservations** (quand Supabase est actif) : **Admin › Lits & prix** → « + Maison », « + Chambre », « + Lit ».
  - Dortoir / chambre double : une chambre avec plusieurs lits.
  - **Chambre individuelle louée entière** : une chambre avec **un seul « lit »** nommé « Chambre entière ».
  - Décochez « actif » pour cacher temporairement une maison, une chambre ou un lit.
- Aucun changement de code n'est nécessaire.

## 6. Vidéo YouTube et témoignages

- **Vidéo** : dans `src/donnees/site.json`, `"youtube_id": "XXXXXXXXXXX"` — c'est la partie après `v=` dans le lien YouTube
  (ex. `https://www.youtube.com/watch?v=dQw4w9WgXcQ` → `dQw4w9WgXcQ`). La section vidéo apparaît automatiquement.
- **Témoignages** : `"temoignages"` dans `site.json`. Seulement de **vrais** avis, avec l'accord de la personne :
  `{"nom": "Prénom", "texte_fr": "…", "texte_en": "…"}`. Liste vide = section cachée.

## 7. Utiliser l'espace admin

> L'admin fonctionne dès que la base Supabase est complètement configurée (voir § 10).

Ouvrez `/admin/`, connectez-vous avec votre e-mail et mot de passe Supabase.

| Onglet | À quoi il sert |
|---|---|
| **Tableau de bord** | Encaissé du mois, taux d'occupation, demandes en attente, alertes (retards, conflits Airbnb). |
| **Demandes** | Nouvelles demandes. **Approuver** : choisissez le lit → WhatsApp s'ouvre avec le message d'acceptation et vos instructions de paiement. **Refuser** : message poli. |
| **Calendrier** | Tous les lits, jour par jour. Touchez une case pour voir la réservation. |
| **Réservations** | Liste, recherche, ajout manuel (client venu sur place), modification, export CSV. |
| **Paiements** | Enregistrer un paiement (espèces, M-Pesa, Orange Money, Airtel Money + référence). Cochez « Confirmée » pour valider la place. |
| **Étudiants** | Échéances de chaque trimestre, retards en rouge, bouton **Rappel** WhatsApp. |
| **Lits & prix** | Tarifs, maisons, chambres, lits. |
| **Airbnb** | Liens iCal pour bloquer les mêmes dates des deux côtés. |
| **Réglages** | Texte des instructions de paiement (FR/EN), sauvegardes CSV. |

**Parcours d'une réservation** : demande en ligne (*en attente*) → vous approuvez (*approuvée*, message WhatsApp) →
le client paie → **Marquer payé** (*confirmée*). La base de données **interdit deux séjours approuvés sur le même lit aux mêmes dates**.

## 8. Sauvegarder vos données

- Une fois par mois : **Admin › Réglages › Réservations (CSV)** et **Paiements (CSV)**. Rangez les fichiers sur votre ordinateur
  ou Google Drive (**pas** dans ce dépôt public).
- Le code du site est déjà sauvegardé par GitHub.

## 9. Publier une modification faite sur l'ordinateur (avancé)

```
cd C:\Users\ilung\Documents\dorms-lubumbashi
git add -A
git commit -m "Nouvelles photos"
git push
```

Pour voir le site sur votre ordinateur avant de publier : `pip install jinja2`, puis `python build.py --apercu`
et ouvrez `_site/index.html`.

## 10. Base de données Supabase (réservations en ligne, admin, e-mails, Airbnb)

Projet Supabase : `dorms-lubumbashi` (organisation « The Dorms Lubumbashi »). Déjà fait : tables, sécurité RLS,
anti-double réservation, fonctions `notifier` et `ical`, synchro Airbnb toutes les 30 min, inscriptions publiques désactivées.

**Reste à faire (une seule fois) :**
1. Supabase › Settings › API Keys › *Legacy API keys* : copiez la clé **anon public** et collez-la dans `site.json`
   (`"supabase_anon_key"`). Cette clé est publique par conception. **Ne collez jamais la clé `service_role`.**
2. Authentication › Users › **Add user** (votre e-mail + mot de passe, « Auto Confirm »), puis dans SQL Editor :
   `insert into admins select id from auth.users where email = 'VOTRE-EMAIL';`
3. resend.com (gratuit, même e-mail) › API Keys › Create. Puis Supabase › Edge Functions › **Secrets** :
   `RESEND_API_KEY` = la clé Resend, `NOTIF_EMAIL` = votre e-mail,
   `ADMIN_URL` = `https://dormslubumbashi.com/admin/`.
4. Admin › Réglages : indiquez vos numéros M-Pesa / Orange Money / Airtel Money.

**Pause du plan gratuit** : Supabase met en pause un projet sans activité pendant 7 jours. La tâche GitHub
« Garder Supabase actif » interroge la base tous les 3 jours pour l'éviter. Si le projet est quand même en pause :
tableau de bord Supabase › **Restore project**.

Le schéma complet est dans `supabase/schema.sql` (peut être relancé sans perte de données) et les fonctions dans `supabase/functions/`.

## 11. Nom de domaine (ex. dormslubumbashi.com)

Voir **CHECKLIST-SEO.md**, étape 4.

---

### Organisation des fichiers

```
src/donnees/      site.json (prix, contact, photos…), fr.json, en.json (textes)
src/templates/    gabarits des pages (HTML)
src/static/       CSS, JavaScript, police, images converties
src/admin/        espace administrateur
supabase/         schéma de la base + fonctions serveur
outils/           scripts photos et logo
build.py          construit le site dans _site/ (fait automatiquement par GitHub)
```
