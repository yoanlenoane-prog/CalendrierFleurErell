# Calendrier des commandes – Arrosé, La cave fleurie

Un calendrier pour suivre les commandes de fleurs pour les mariages, baptêmes et autres évènements :
fiches clients, compositions, photos d'inspiration, moodboard, suivi des prix et de l'acompte.

Il fonctionne sur un seul ordinateur, sans Internet et sans rien installer : il s'ouvre dans le navigateur
(Microsoft Edge ou Google Chrome) d'un simple double-clic.

---

## Mode d'emploi

### 1. Installation (une seule fois)

Tout le calendrier tient dans **un seul fichier** : `Calendrier Arrose.html`.

1. Ouvrez ce lien (connectez-vous à GitHub si on vous le demande, car le dépôt est privé) :
   <https://github.com/yoanlenoane-prog/CalendrierFleurErell/blob/main/Calendrier%20Arrose.html>
2. En haut à droite du contenu du fichier, cliquez sur le bouton **Download raw file**
   (la petite flèche vers le bas ⤓).
3. Le fichier `Calendrier Arrose.html` arrive dans vos **Téléchargements**. Déplacez-le dans **Documents**.

Astuce : faites un clic droit sur le fichier → **Afficher plus d'options** → **Envoyer vers** →
**Bureau (créer un raccourci)**. Vous l'aurez ainsi sur le bureau.

### 2. Ouvrir le calendrier (chaque jour)

Double-cliquez sur **Calendrier Arrose** (ou sur son raccourci du bureau). Le calendrier s'ouvre dans votre navigateur.

Ouvrez-le **toujours avec le même navigateur** (par exemple toujours Edge) : c'est lui qui garde vos commandes.
Si le fichier s'ouvre avec un autre navigateur : clic droit sur le fichier → **Ouvrir avec** → choisissez
**Microsoft Edge** (ou Chrome) et cochez « Toujours utiliser cette application ».

### 3. Où sont enregistrées mes commandes ?

Les commandes et les photos sont enregistrées **dans le navigateur, sur cet ordinateur**. Elles restent quand vous
fermez le calendrier, le navigateur ou l'ordinateur.

Elles seraient effacées si vous videz les « données de navigation » / « cookies et données de site » du navigateur,
ou si vous changez d'ordinateur. **C'est pour cela qu'il faut faire des sauvegardes.** Le calendrier vous le rappelle
par un bandeau jaune si votre dernière sauvegarde a plus de 7 jours.

### 4. Faire une sauvegarde (chaque semaine par exemple)

1. Cliquez sur **Menu** → **Sauvegarde**, puis **Télécharger la sauvegarde**.
2. Un fichier `sauvegarde-calendrier-AAAA-MM-JJ.json` arrive dans vos **Téléchargements** :
   il contient toutes les commandes **et toutes les photos**.
3. Copiez-le sur une clé USB ou dans OneDrive.

### 5. Restaurer une sauvegarde (après un problème ou un changement d'ordinateur)

1. Installez le calendrier (étape 1) si besoin, et ouvrez-le.
2. Cliquez sur **Menu** → **Sauvegarde** → **Choisir un fichier de sauvegarde** → choisissez votre dernier fichier de sauvegarde.
3. Toutes les commandes et les photos reviennent. (Les commandes présentes avant sont remplacées.)

### 6. Installer une nouvelle version

Si je modifie le calendrier, refaites l'étape 1 et remplacez l'ancien fichier par le nouveau.
Vos commandes ne sont pas dans le fichier mais dans le navigateur : elles restent. Par sécurité, faites quand même
une sauvegarde avant.

---

## Fonctionnement

- **Menu** (en haut à gauche) : nouvelle commande, commandes du mois, fleurs à commander, types d'évènements,
  sauvegarde, et le rappel des couleurs des évènements.
- **Calendrier** : vue du mois, semaine du lundi au dimanche, flèches ‹ › pour changer de mois, bouton « Aujourd'hui ».
  Le mois tient sur un seul écran : si un jour a trop de commandes, cliquez sur « + N autres ».
  Une commande annulée apparaît barrée.
- **Nouvelle commande** : cliquez sur un jour, ou Menu → « Nouvelle commande ».
- **Fiche** : cliquez sur une commande. Elle a trois onglets :
  - **Demande client** : coordonnées, évènement, demande, compositions, photos d'inspiration, suivi et prix ;
  - **Moodboard** : vos images (cliquez pour agrandir) et vos notes ;
  - **Commande fleuriste** : les fleurs à commander chez le grossiste (fleur, couleur, quantité en tiges, bottes ou pots),
    avec un rappel de la demande.
  Le bouton **Imprimer** imprime l'onglet affiché (page A4).
- **Fleurs à commander** : Menu → « Fleurs à commander » additionne les fleurs de toutes les commandes de la semaine
  (flèches pour changer de semaine) et peut s'imprimer. Les commandes sans liste détaillée sont signalées « à préciser ».
- **Types d'évènements** : Menu → « Types d'évènements » pour changer un nom ou une couleur, ou ajouter vos propres types.
  Si vous supprimez un type, ses commandes passent en « Autre » en gardant le nom en précision.
- **Commandes du mois** : s'affiche quand vous arrivez sur un mois qui a des commandes, et à tout moment par le menu.
- **Recherche** : tapez le nom ou le prénom du client en haut.
- Les commandes d'exemple (Le Gall, Morvan, Riou) peuvent être supprimées depuis leur fiche.

## Pour information (technique)

- `Calendrier Arrose.html` : l'application complète, autonome (styles, code, logo et exemples inclus).
  **Ne pas modifier à la main** : ce fichier est fabriqué par `node assembler.js` à partir du dossier `sources/`.
- `sources/` : `page.html`, `style.css`, `app.js`, `stockage.js` (enregistrement dans le navigateur avec IndexedDB),
  `exemples.js` (commandes d'exemple installées au tout premier lancement) et `polices/` (Jost, Cormorant Garamond,
  Caveat, sous licence SIL Open Font License).
- Aucune dépendance, aucun serveur, aucune donnée envoyée sur Internet.
