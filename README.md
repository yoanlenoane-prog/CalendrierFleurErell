# Calendrier des commandes – Arrosé, La cave fleurie

Un calendrier pour suivre les commandes de fleurs pour les mariages, baptêmes et autres évènements :
fiches clients, compositions, photos d'inspiration, moodboard, suivi des prix et de l'acompte.

Les commandes et les photos sont enregistrées sur l'ordinateur du magasin, dans le dossier `donnees`.
La tablette affiche les mêmes commandes tant que l'ordinateur est allumé et que le calendrier y est lancé.

---

## Mode d'emploi

### 1. Installation (une seule fois)

1. Installez **Node.js** : allez sur <https://nodejs.org/fr/download>, téléchargez la version **LTS** pour Windows,
   ouvrez le fichier téléchargé et cliquez sur « Suivant » jusqu'à la fin (gardez les choix proposés).
2. Placez le dossier du calendrier où vous voulez, par exemple dans **Documents**.
   Ne le mettez pas dans « Téléchargements » pour ne pas le supprimer par erreur.

### 2. Lancer le calendrier (chaque jour)

1. Ouvrez le dossier du calendrier.
2. Double-cliquez sur **Lancer le calendrier**.
3. Une fenêtre noire s'ouvre, puis le calendrier apparaît dans votre navigateur.
   **Laissez la fenêtre noire ouverte** (vous pouvez la réduire) : c'est elle qui fait fonctionner le calendrier.
   Si vous la fermez, le calendrier s'arrête, mais vos commandes restent enregistrées.

La première fois, Windows peut afficher :
- « Windows a protégé votre ordinateur » : cliquez sur **Informations complémentaires** puis **Exécuter quand même** ;
- une fenêtre du **pare-feu** : cochez **Réseaux privés** et cliquez sur **Autoriser** (indispensable pour la tablette).

Astuce : faites un clic droit sur « Lancer le calendrier » → **Afficher plus d'options** → **Envoyer vers** →
**Bureau (créer un raccourci)** pour l'avoir sur le bureau.

### 3. Utiliser le calendrier sur la tablette

1. Lancez le calendrier sur l'ordinateur (étape 2).
2. Sur l'ordinateur, cliquez sur **💾 Sauvegarde** : l'adresse pour la tablette est écrite en bas
   (elle ressemble à `http://192.168.1.25:8080`). Elle est aussi écrite dans la fenêtre noire.
3. Sur la tablette, connectée au **même wifi**, tapez cette adresse dans le navigateur (Safari, Chrome…).
4. Ajoutez la page à l'écran d'accueil pour la retrouver facilement.

### 4. Faire une sauvegarde (à faire régulièrement, par exemple chaque semaine)

1. Cliquez sur **💾 Sauvegarde** puis **Télécharger la sauvegarde**.
2. Un fichier `sauvegarde-calendrier-AAAA-MM-JJ.json` arrive dans vos Téléchargements :
   il contient toutes les commandes **et toutes les photos**.
3. Copiez-le sur une clé USB ou dans OneDrive.

Pour **restaurer** : **💾 Sauvegarde** → **Choisir un fichier de sauvegarde…** → choisissez le fichier.
Les commandes actuelles sont remplacées (une copie de sécurité est gardée dans `donnees/sauvegardes-auto`).

En plus, le calendrier garde tout seul une copie des commandes de chaque jour (les 30 derniers jours)
dans `donnees/sauvegardes-auto`.

### 5. Changer d'ordinateur

Installez le calendrier sur le nouvel ordinateur, puis restaurez votre dernière sauvegarde (étape 4),
ou copiez simplement le dossier `donnees` de l'ancien ordinateur dans le dossier du calendrier.

---

## Fonctionnement

- **Calendrier** : vue du mois, semaine du lundi au dimanche, flèches ‹ › pour changer de mois, bouton « Aujourd'hui ».
  Couleurs : rose = mariage, bleu = baptême, vert = autre. Une commande annulée apparaît barrée.
- **Nouvelle commande** : cliquez sur un jour, ou sur « + Nouvelle commande ».
- **Fiche** : cliquez sur une commande. Cliquez sur une photo pour l'agrandir (flèches pour passer à la suivante).
- **Commandes du mois** : s'affiche quand vous arrivez sur un mois qui a des commandes, et à tout moment avec le bouton.
- **Recherche** : tapez le nom ou le prénom du client en haut.
- Les commandes d'exemple (Le Gall, Morvan, Riou) peuvent être supprimées depuis leur fiche.

## Pour information (technique)

- `serveur.js` : petit serveur Node.js sans dépendance (port 8080, variable `PORT` pour le changer).
- `public/` : l'interface (HTML, CSS, JavaScript).
- `donnees/` : vos données (`commandes.json`, `images/`, `sauvegardes-auto/`). Ce dossier n'est pas envoyé sur GitHub.
- `exemples/` : commandes d'exemple installées au tout premier lancement.
