# Vacances J-X — Installation

Cadeau rigolo pour tes collègues : compte à rebours plein écran jusqu'aux vacances,
alimenté par les phrases, blagues, devinettes et photos ajoutées par tout le monde.

Comme pour tes autres applis (EPS Pro, Muscu Pro...), il faut : un dépôt GitHub,
un projet Vercel, et un projet Firebase (Firestore + Storage). Aucune installation
sur ordinateur n'est nécessaire, tout se fait depuis le téléphone ou un navigateur.

---

## 1. Créer le dépôt GitHub

1. Va sur [github.com](https://github.com), connecte-toi avec ton compte **Estawa**.
2. Crée un nouveau dépôt (bouton **New**), nomme-le par exemple `vacances-jx`.
3. Laisse-le **public** (ou privé, peu importe pour Vercel).
4. Ne coche aucune case d'initialisation (pas de README, pas de .gitignore).
5. Sur la page qui s'affiche, utilise **"uploading an existing file"** et glisse
   TOUT le contenu du zip fourni (dézippé au préalable) — attention à bien
   respecter l'arborescence (dossier `src/`, dossier `public/`, etc.).
6. Valide le commit ("Commit changes").

---

## 2. Créer le projet Firebase

1. Va sur [console.firebase.google.com](https://console.firebase.google.com).
2. **Ajouter un projet**, nomme-le par exemple `vacances-jx`, continue (tu peux
   désactiver Google Analytics, inutile ici).
3. Dans le menu de gauche : **Compilation > Firestore Database** → **Créer une
   base de données** → choisis une région proche (ex. `eur3 (europe-west)`) →
   démarre en **mode test** (on ajustera les règles juste après).
4. Toujours dans le menu de gauche : **Compilation > Storage** → **Commencer** →
   même région → mode test également.
5. Dans le menu de gauche : **Paramètres du projet** (icône roue crantée en
   haut) > onglet **Général** > section **Vos applications** > clique sur
   l'icône **Web `</>`** pour ajouter une application web.
6. Donne-lui un nom (ex. `vacances-jx-web`), **ne coche pas** "Configurer
   Firebase Hosting".
7. Firebase affiche un bloc de code `firebaseConfig` avec des valeurs
   (`apiKey`, `authDomain`, `projectId`...). **Copie ces valeurs.**

### Coller la configuration dans le projet

1. Sur GitHub, ouvre le fichier `src/firebase.js`, clique sur le crayon
   (éditer).
2. Remplace les six lignes `"REMPLACE_MOI"` par les vraies valeurs copiées
   à l'étape précédente.
3. Commit directement sur la branche principale.

### Règles de sécurité (ouvertes, sans compte — comme sur tes autres applis)

Puisqu'il n'y a pas de connexion/mot de passe (juste le lien partagé entre
collègues), les règles doivent autoriser la lecture/écriture à tous ceux qui
ont le lien. C'est le même principe que sur EPS Pro.

**Firestore** (menu Firestore Database > onglet **Règles**), remplace tout par :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

Clique sur **Publier**.

**Storage** (menu Storage > onglet **Règles**), remplace tout par :

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

Clique sur **Publier**.

> ⚠️ Ces règles ouvertes conviennent à un usage entre collègues de confiance
> avec un lien non public. Ne partage pas le lien de l'appli sur les réseaux
> sociaux.

---

## 3. Déployer sur Vercel

1. Va sur [vercel.com](https://vercel.com), connecte-toi avec ton compte
   GitHub (Estawa).
2. **Add New... > Project**, choisis le dépôt `vacances-jx`.
3. Vercel détecte automatiquement Vite : laisse les réglages par défaut
   (Build command `vite build`, Output directory `dist`).
4. Clique sur **Deploy**. Après une minute, l'appli est en ligne à une
   adresse du style `https://vacances-jx.vercel.app`.
5. À chaque fois que tu modifies un fichier sur GitHub (via l'éditeur en
   ligne, comme pour tes autres applis), Vercel redéploie automatiquement.

---

## 4. Premier lancement

1. Ouvre le lien Vercel sur ton téléphone.
2. Remplis ton prénom, ton rythme de travail et ta zone scolaire.
3. Tu peux ensuite l'ajouter à l'écran d'accueil de ton téléphone (comme une
   vraie appli) via le menu de partage du navigateur ("Ajouter à l'écran
   d'accueil" / "Ajouter à l'écran principal").
4. Envoie le lien à tes collègues (bouton **Partager** dans les Réglages) —
   chacun règle son propre prénom/rythme, mais tout le monde partage la même
   bibliothèque de phrases, blagues, devinettes et photos, et le même
   calendrier de vacances.

---

## 5. Chaque rentrée scolaire

Les dates de vacances sont pré-remplies pour 2026-2027. L'an prochain :

1. Ouvre `src/donnees.js` sur GitHub, mets à jour les dates dans `ZONES` (et
   `FERIES_COMMUNS`) avec le nouveau calendrier officiel — Vercel redéploiera
   automatiquement.
2. Dans l'appli, va dans **Réglages > Calendrier**, et clique sur le bouton
   de la zone scolaire concernée (**"Recharger" la zone A/B/C**) : ça
   remplace les anciennes dates par les nouvelles pour tout le monde.
3. Tu peux aussi corriger une date ponctuellement sans tout recharger, en
   modifiant/ajoutant/supprimant directement une période dans ce même écran.
