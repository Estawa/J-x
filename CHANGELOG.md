# Vacances J-X — Journal des changements

Voir INSTALLATION.md pour la mise en ligne (GitHub / Firebase / Vercel).

## v1.1.0 — 16/09/2026
- **Écran d'ouverture surprise** : à chaque lancement de l'appli, avant d'apercevoir les
  compteurs, un élément est tiré au hasard dans la bibliothèque (une phrase, une blague,
  une devinette avec réponse à révéler, ou une photo souvenir avec son auteur) et
  s'affiche plein écran. Un bouton « Voir mes compteurs → » permet de passer à l'accueil.
  Si la bibliothèque est encore vide ou inaccessible après quelques secondes, l'appli
  passe directement aux compteurs sans bloquer

## v1.0.0 — 16/09/2026
Première version.

- Réglages initiaux : prénom, jours de travail/semaine, heures effectives/semaine, zone scolaire
- Accueil plein écran : gros compteur (jours de travail restants, jours calendaires
  restants, heures de travail restantes) pour la prochaine période de vacances ET pour
  les vacances d'été, avec bascule entre les deux
- Compte à rebours en temps réel (jours/heures/minutes/secondes)
- Barre de progression de la période en cours
- Phrase punchy selon le palier de jours restants (5 paliers)
- Confettis automatiques le jour J (premier jour de vacances ou jour férié)
- Fond d'écran photo aléatoire (tiré de la bibliothèque partagée) derrière le compteur
- Boutons « Blague surprise » et « Devinette » à la demande
- Réglages (icône roue crantée) :
  - Profil (prénom, rythme de travail, thème jour/nuit/auto)
  - Calendrier : zone scolaire, rechargement des dates officielles par zone,
    ajout/modification/suppression de chaque période de vacances et de chaque jour férié
  - Bibliothèques Phrases / Blagues / Devinettes : ajout, modification, suppression —
    partagées en temps réel entre tous les collègues via Firestore
  - Photos : ajout depuis la galerie ou l'appareil photo, suppression — stockées sur
    Firebase Storage, partagées entre tous les collègues
  - Partage : bouton pour partager le lien de l'appli
- Contenu de départ : 100 phrases punchy, 130 blagues, 100 devinettes (peuplées
  automatiquement à la première ouverture si la bibliothèque est vide)
- Dates de vacances 2026-2027 pré-remplies pour les zones A, B et C (calendrier
  officiel du ministère de l'Éducation nationale)
- PWA installable (icône, mode plein écran, fonctionne hors connexion pour l'app shell)
