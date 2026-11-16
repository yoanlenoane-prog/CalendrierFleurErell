# Calendrier des commandes – Arrosé, La cave fleurie

Un calendrier pour suivre les commandes de fleurs pour les mariages, baptêmes et autres évènements :
fiches clients, compositions, photos d'inspiration, moodboard, suivi des prix et de l'acompte.

Il fonctionne sur un seul ordinateur, sans Internet et sans rien installer : il s'ouvre dans le navigateur
(Microsoft Edge ou Google Chrome) d'un simple double-clic. Les commandes et les photos sont enregistrées en fichiers
dans le dossier du calendrier.

---

## Mode d'emploi

### 1. Installation (une seule fois)

1. Dans **Documents**, créez un dossier **Calendrier Arrosé** (clic droit → Nouveau → Dossier).
2. Ouvrez ce lien (connectez-vous à GitHub si on vous le demande, car le dépôt est privé) :
   <https://github.com/yoanlenoane-prog/CalendrierFleurErell/blob/main/Calendrier%20Arrose.html>
3. En haut à droite du contenu du fichier, cliquez sur le bouton **Download raw file** (la petite flèche ⤓).
4. Le fichier `Calendrier Arrose.html` arrive dans vos **Téléchargements** : déplacez-le dans le dossier
   **Calendrier Arrosé** créé à l'étape 1.
5. Double-cliquez dessus. Le calendrier demande **où enregistrer vos commandes** : cliquez sur « Choisir le dossier »,
   sélectionnez le dossier **Calendrier Arrosé**, cliquez sur **Sélectionner le dossier**, puis acceptez que le navigateur
   **modifie les fichiers**. Un dossier `donnees-calendrier` est créé à côté du fichier.

Si, après avoir cliqué sur « Sélectionner le dossier », vous revenez sur cet écran sans que rien ne se passe :
le navigateur a sans doute affiché une question « Autoriser le site à modifier les fichiers ? » à laquelle il faut
répondre **Modifier les fichiers**. Si cela ne fonctionne toujours pas, cliquez sur **Continuer sans dossier** :
les commandes sont alors enregistrées dans le navigateur, et vous pourrez choisir un dossier plus tard
(Menu → Sauvegarde → Choisir un dossier).

Astuce : clic droit sur le fichier → **Afficher plus d'options** → **Envoyer vers** → **Bureau (créer un raccourci)**.

### 2. Ouvrir le calendrier (chaque jour)

Double-cliquez sur **Calendrier Arrose** (ou sur son raccourci du bureau).

Pour votre sécurité, le navigateur peut demander votre accord pour ouvrir le dossier : cliquez sur
**Ouvrir mes commandes** puis **Autoriser**. S'il propose « Autoriser à chaque visite », choisissez-le pour ne plus avoir
à le faire.

Utilisez **Microsoft Edge** ou **Google Chrome**. Si le fichier s'ouvre avec un autre navigateur : clic droit sur le
fichier → **Ouvrir avec** → **Microsoft Edge** et cochez « Toujours utiliser cette application ».

### 3. Où sont enregistrées mes commandes ?

Dans le dossier `donnees-calendrier`, à côté du fichier du calendrier :

- `commandes.json` : toutes les commandes ;
- `images/` : les photos d'inspiration et les images des moodboards ;
- `reglages.json` : vos types d'évènements et leurs couleurs ;
- `sauvegardes-auto/` : une copie des commandes de chaque jour (les 30 derniers jours).

Ne modifiez pas ces fichiers à la main. Vous pouvez en revanche copier tout le dossier pour le mettre à l'abri.

### 4. Faire une sauvegarde (le calendrier vous le rappelle toutes les deux semaines)

Si l'ordinateur tombe en panne ou est perdu, les fichiers qu'il contient le sont aussi. Gardez donc une copie ailleurs :

1. Cliquez sur **Menu** → **Sauvegarde**, puis **Télécharger la sauvegarde**.
2. Un fichier `sauvegarde-calendrier-AAAA-MM-JJ.json` arrive dans vos **Téléchargements** :
   il contient toutes les commandes **et toutes les photos**.
3. Copiez-le sur une clé USB ou dans OneDrive.

(Vous pouvez aussi simplement copier tout le dossier **Calendrier Arrosé** sur une clé USB.)

### 5. Restaurer une sauvegarde

Menu → **Sauvegarde** → **Choisir un fichier de sauvegarde** → choisissez votre dernier fichier.
Toutes les commandes et les photos reviennent (les commandes présentes avant sont remplacées).

### 6. Changer d'ordinateur

Copiez tout le dossier **Calendrier Arrosé** (avec `donnees-calendrier`) sur le nouvel ordinateur, ouvrez le calendrier
et choisissez ce dossier quand il le demande : tout est là.

### 7. Installer une nouvelle version

Téléchargez le nouveau `Calendrier Arrose.html` (étapes 2 à 4) et remplacez l'ancien fichier dans le dossier
**Calendrier Arrosé**. Le dossier `donnees-calendrier` n'est pas touché : vos commandes restent.

---

## Fonctionnement

- **Menu** (en haut à gauche) : nouvelle commande, commandes du mois, liste de tâches, fleurs à commander, types d'évènements,
  sauvegarde, et le rappel des couleurs des évènements.
- **Calendrier** : vue du mois, semaine du lundi au dimanche, flèches ‹ › pour changer de mois, bouton « Aujourd'hui ».
  Le mois tient sur un seul écran : si un jour a trop de commandes, cliquez sur « + N autres ».
  Une commande annulée apparaît barrée.
- **Nouvelle commande** : cliquez sur un jour, ou Menu → « Nouvelle commande ».
- **Fiche** : cliquez sur une commande. Elle a trois onglets :
  - **Demande client** : coordonnées, évènement, demande, compositions, photos d'inspiration, suivi et prix ;
  - **Moodboard** : vos images et vos PDF (cliquez pour agrandir ou ouvrir) et vos notes ;
  - **Commande fleuriste** : les fleurs à commander chez le grossiste (fleur, couleur, quantité en tiges, bottes ou pots),
    avec un rappel de la demande.
  Le bouton **Imprimer** imprime l'onglet affiché (page A4).
- **Suivi** (colonne de gauche de chaque fiche) : cochez au fur et à mesure **1. Premier rendez-vous**,
  **2. Moodboard envoyé**, **3. Devis envoyé** et **4. Validation client**. Une étape cochée affiche « Fait le » et la date
  du jour, que vous pouvez modifier ; une étape non cochée affiche « À faire ». Quand vous cochez « Validation client »,
  une commande au statut « Devis » passe en « Confirmée ».
  Cochez **Le client a répondu** quand le client vous répond (vous pouvez noter ce qu'il demande) : la commande passe
  « En attente de ma part ». Elle se décoche toute seule quand vous cochez l'envoi suivant.
- **Liste de tâches** : Menu → « Liste de tâches » s'affiche en pleine page, en quatre colonnes :
  **Nouvelles demandes** (aucune étape cochée : rendez-vous à fixer), **En attente de ma part** (moodboard à envoyer,
  ou le client a répondu), **En attente du client** (moodboard ou devis envoyé) et **Validés**.
  Un envoi sans réponse depuis 7 jours passe en rouge « à relancer » (nombre de jours réglable en haut de la page).
  Le choix « Évènements » n'affiche qu'un type, par exemple les mariages. Cliquez sur une carte pour ouvrir la fiche.
  La liste peut s'imprimer. « Retour au calendrier » ramène au calendrier.
- **PDF dans le moodboard** : le bouton « Ajouter des images ou des PDF » accepte aussi les PDF. Cliquez sur un PDF
  pour l'ouvrir dans un nouvel onglet. Les PDF sont inclus dans les sauvegardes.
- **Fleurs à commander** : Menu → « Fleurs à commander » additionne les fleurs de toutes les commandes de la semaine
  (flèches pour changer de semaine) et peut s'imprimer. Les commandes sans liste détaillée sont signalées « à préciser ».
- **Types d'évènements** : Menu → « Types d'évènements » pour changer un nom ou une couleur, ou ajouter vos propres types.
  Si vous supprimez un type, ses commandes passent en « Autre » en gardant le nom en précision.
- **Commandes du mois** : s'affiche quand vous arrivez sur un mois qui a des commandes, et à tout moment par le menu.
- **Recherche** : tapez le nom ou le prénom du client en haut.
- Les commandes d'exemple (Le Gall, Morvan, Riou) peuvent être supprimées depuis leur fiche.

## Pour information (technique)

- `Calendrier Arrose.html` : l'application complète, autonome (styles, code, polices et exemples inclus).
  **Ne pas modifier à la main** : ce fichier est fabriqué par `node assembler.js` à partir du dossier `sources/`.
- `sources/` : `page.html`, `style.css`, `app.js`, `stockage.js` (enregistrement en fichiers via l'API File System Access
  d'Edge/Chrome ; le navigateur ne garde que le lien vers le dossier, en IndexedDB ; repli sur IndexedDB si l'API
  n'existe pas), `exemples.js` (commandes d'exemple du premier lancement) et `polices/` (Jost, Cormorant Garamond,
  Caveat, sous licence SIL Open Font License).
- Aucune dépendance, aucun serveur, aucune donnée envoyée sur Internet.
