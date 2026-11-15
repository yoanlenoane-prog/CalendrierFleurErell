# Calendrier des commandes – Arrosé, La cave fleurie

Un calendrier pour suivre les commandes de fleurs pour les mariages, baptêmes et autres évènements :
fiches clients, compositions, photos d'inspiration, moodboard, suivi des prix et de l'acompte.

Il fonctionne sur un seul ordinateur, sans Internet et sans rien installer : il s'ouvre dans le navigateur
(Microsoft Edge ou Google Chrome) d'un simple double-clic.

---

## Mode d'emploi

### 1. Installation (une seule fois)

1. Allez sur <https://github.com/yoanlenoane-prog/CalendrierFleurErell> (connectez-vous à GitHub si on vous le demande,
   car le dépôt est privé).
2. Cliquez sur le bouton vert **< > Code**, puis sur **Download ZIP** (tout en bas de la petite fenêtre).
3. Ouvrez votre dossier **Téléchargements**, faites un clic droit sur le fichier `CalendrierFleurErell-main.zip`,
   puis **Extraire tout…** → **Extraire**.
4. Déplacez le dossier obtenu `CalendrierFleurErell-main` dans **Documents** (vous pouvez le renommer, par exemple
   « Calendrier Arrosé »).

Astuce : dans ce dossier, faites un clic droit sur **Ouvrir le calendrier** → **Afficher plus d'options** →
**Envoyer vers** → **Bureau (créer un raccourci)**. Vous l'aurez ainsi sur le bureau.

### 2. Ouvrir le calendrier (chaque jour)

Double-cliquez sur **Ouvrir le calendrier** (ou sur son raccourci du bureau). Le calendrier s'ouvre dans votre navigateur.

Ouvrez-le **toujours avec le même navigateur** (par exemple toujours Edge) : c'est lui qui garde vos commandes.
Si le fichier s'ouvre avec un autre navigateur : clic droit sur **Ouvrir le calendrier** → **Ouvrir avec** → choisissez
**Microsoft Edge** (ou Chrome) et cochez « Toujours utiliser cette application ».

### 3. Où sont enregistrées mes commandes ?

Les commandes et les photos sont enregistrées **dans le navigateur, sur cet ordinateur**. Elles restent quand vous
fermez le calendrier, le navigateur ou l'ordinateur.

⚠️ Elles seraient effacées si vous videz les « données de navigation » / « cookies et données de site » du navigateur,
ou si vous changez d'ordinateur. **C'est pour cela qu'il faut faire des sauvegardes.** Le calendrier vous le rappelle
par un bandeau jaune si votre dernière sauvegarde a plus de 7 jours.

### 4. Faire une sauvegarde (chaque semaine par exemple)

1. Cliquez sur **💾 Sauvegarde** puis **Télécharger la sauvegarde**.
2. Un fichier `sauvegarde-calendrier-AAAA-MM-JJ.json` arrive dans vos **Téléchargements** :
   il contient toutes les commandes **et toutes les photos**.
3. Copiez-le sur une clé USB ou dans OneDrive.

### 5. Restaurer une sauvegarde (après un problème ou un changement d'ordinateur)

1. Installez le calendrier (étape 1) si besoin, et ouvrez-le.
2. Cliquez sur **💾 Sauvegarde** → **Choisir un fichier de sauvegarde…** → choisissez votre dernier fichier de sauvegarde.
3. Toutes les commandes et les photos reviennent. (Les commandes présentes avant sont remplacées.)

### 6. Installer une nouvelle version

Si je modifie le calendrier, refaites l'étape 1 et remplacez l'ancien dossier par le nouveau.
Vos commandes ne sont pas dans le dossier mais dans le navigateur : elles restent. Par sécurité, faites quand même
une sauvegarde avant.

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

- `Ouvrir le calendrier.html` : la page de l'application.
- `fichiers/` : style, logo, code (`app.js`), enregistrement dans le navigateur avec IndexedDB (`stockage.js`)
  et commandes d'exemple installées au tout premier lancement (`exemples.js`).
- Aucune dépendance, aucun serveur, aucune donnée envoyée sur Internet.
