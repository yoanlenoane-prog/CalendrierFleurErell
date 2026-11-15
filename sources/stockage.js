'use strict';
/*
 * Enregistrement des commandes et des images.
 *
 * Mode « dossier » (Edge, Chrome) : tout est enregistré en fichiers dans un dossier de l'ordinateur
 * choisi une fois par la fleuriste (de préférence le dossier de l'application) :
 *   donnees-calendrier/commandes.json      les commandes
 *   donnees-calendrier/reglages.json       types d'évènements, date de la dernière sauvegarde…
 *   donnees-calendrier/images/             les photos et images du moodboard
 *   donnees-calendrier/sauvegardes-auto/   une copie des commandes par jour (30 derniers jours)
 * Le navigateur ne garde que le « lien » vers ce dossier.
 *
 * Mode « navigateur » (secours, si le navigateur ne sait pas écrire dans un dossier) : IndexedDB.
 */
const Stockage = (() => {
  const NOM_BASE = 'calendrier-arrose';
  const SOUS_DOSSIER = 'donnees-calendrier';
  const NB_SAUVEGARDES_AUTO = 30;
  const TYPES_MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' };

  let base = null;          // IndexedDB
  let mode = null;          // 'dossier' | 'navigateur'
  let poignee = null;       // dossier choisi par la fleuriste
  let dossier = null;       // dossier des données
  let dossierImages = null;
  let dossierAuto = null;
  let commandes = [];
  let reglages = {};
  const images = new Map(); // nom -> { blob, url }
  let file = Promise.resolve();

  /* ---------- Outils ---------- */

  function enFile(travail) { // les écritures se font l'une après l'autre
    const p = file.then(travail);
    file = p.catch(() => {});
    return p;
  }
  function aujourdhui() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  function imagesDe(c) { return [...(c.inspirations || []), ...(c.moodboard || [])]; }
  function copie(o) { return JSON.parse(JSON.stringify(o)); }

  function base64VersBlob(b64, nom) {
    const binaire = atob(b64);
    const octets = new Uint8Array(binaire.length);
    for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
    return new Blob([octets], { type: TYPES_MIME[(nom.split('.').pop() || '').toLowerCase()] || 'application/octet-stream' });
  }
  function blobVersBase64(blob) {
    return new Promise((resolve, reject) => {
      const lecteur = new FileReader();
      lecteur.onload = () => resolve(String(lecteur.result).split(',')[1] || '');
      lecteur.onerror = () => reject(lecteur.error);
      lecteur.readAsDataURL(blob);
    });
  }
  function memoriserImage(nom, blob) {
    if (images.has(nom)) URL.revokeObjectURL(images.get(nom).url);
    images.set(nom, { blob, url: URL.createObjectURL(blob) });
  }
  function oublierImage(nom) {
    if (!images.has(nom)) return;
    URL.revokeObjectURL(images.get(nom).url);
    images.delete(nom);
  }

  /* ---------- IndexedDB ---------- */

  function ouvrirBase() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('Ce navigateur ne peut pas être utilisé. Utilisez Microsoft Edge ou Google Chrome.'));
      const req = indexedDB.open(NOM_BASE, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('commandes', { keyPath: 'id' });
        db.createObjectStore('images');
        db.createObjectStore('reglages');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new Error('Impossible d’ouvrir les données du calendrier : ' + (req.error && req.error.message)));
    });
  }
  function transaction(magasins, modeTx, travail) {
    return new Promise((resolve, reject) => {
      const tx = base.transaction(magasins, modeTx);
      let resultat;
      tx.oncomplete = () => resolve(resultat);
      tx.onerror = () => reject(tx.error || new Error('Erreur d’enregistrement'));
      tx.onabort = () => reject(tx.error || new Error('Enregistrement annulé (disque plein ?)'));
      const r = travail(tx);
      if (r && 'onsuccess' in r) r.onsuccess = () => { resultat = r.result; };
    });
  }
  const idbLire = (magasin, cle) => transaction([magasin], 'readonly', (tx) => tx.objectStore(magasin).get(cle));
  const idbEcrire = (magasin, valeur, cle) => transaction([magasin], 'readwrite', (tx) => tx.objectStore(magasin).put(valeur, cle));

  async function chargerDepuisNavigateur() {
    commandes = await transaction(['commandes'], 'readonly', (tx) => tx.objectStore('commandes').getAll());
    reglages = {
      types: await idbLire('reglages', 'types'),
      derniereSauvegarde: await idbLire('reglages', 'derniereSauvegarde'),
      initialise: await idbLire('reglages', 'initialise'),
    };
    images.clear();
    await new Promise((resolve, reject) => {
      const tx = base.transaction(['images'], 'readonly');
      const req = tx.objectStore('images').openCursor();
      req.onsuccess = () => {
        const curseur = req.result;
        if (!curseur) return;
        memoriserImage(curseur.key, curseur.value);
        curseur.continue();
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  /* ---------- Fichiers ---------- */

  async function lireTexte(dir, nom) {
    try {
      const f = await (await dir.getFileHandle(nom)).getFile();
      return await f.text();
    } catch (e) {
      if (e.name === 'NotFoundError') return null;
      throw e;
    }
  }
  async function ecrireFichier(dir, nom, contenu) {
    const fh = await dir.getFileHandle(nom, { create: true });
    const w = await fh.createWritable();
    await w.write(contenu);
    await w.close();
  }
  async function supprimerFichier(dir, nom) {
    try { await dir.removeEntry(nom); } catch (e) { if (e.name !== 'NotFoundError') throw e; }
  }

  async function sauvegardeDuJour() {
    if (mode !== 'dossier') return;
    const nom = `commandes-${aujourdhui()}.json`;
    if ((await lireTexte(dossierAuto, nom)) === null) await ecrireFichier(dossierAuto, nom, JSON.stringify(commandes, null, 2));
    const noms = [];
    for await (const [n, h] of dossierAuto.entries()) if (h.kind === 'file' && /^commandes-\d{4}-\d{2}-\d{2}\.json$/.test(n)) noms.push(n);
    noms.sort();
    while (noms.length > NB_SAUVEGARDES_AUTO) await supprimerFichier(dossierAuto, noms.shift());
  }

  /* ---------- Persistance (selon le mode) ---------- */

  function persisterCommandes() {
    return enFile(async () => {
      if (mode === 'dossier') {
        await ecrireFichier(dossier, 'commandes.json', JSON.stringify(commandes, null, 2));
        await sauvegardeDuJour();
      } else {
        await transaction(['commandes'], 'readwrite', (tx) => {
          const s = tx.objectStore('commandes');
          s.clear();
          for (const c of commandes) s.put(c);
        });
      }
    });
  }
  function persisterReglages() {
    return enFile(async () => {
      if (mode === 'dossier') {
        await ecrireFichier(dossier, 'reglages.json', JSON.stringify(reglages, null, 2));
      } else {
        await transaction(['reglages'], 'readwrite', (tx) => {
          for (const cle of ['types', 'derniereSauvegarde', 'initialise']) tx.objectStore('reglages').put(reglages[cle] ?? null, cle);
        });
      }
    });
  }
  function persisterImage(nom, blob) {
    return enFile(() => (mode === 'dossier'
      ? ecrireFichier(dossierImages, nom, blob)
      : idbEcrire('images', blob, nom)));
  }
  function retirerImages(noms) {
    if (!noms.length) return Promise.resolve();
    for (const n of noms) oublierImage(n);
    return enFile(async () => {
      if (mode === 'dossier') { for (const n of noms) await supprimerFichier(dossierImages, n); }
      else await transaction(['images'], 'readwrite', (tx) => { for (const n of noms) tx.objectStore('images').delete(n); });
    });
  }

  function installerExemples() {
    if (!window.EXEMPLES) return;
    commandes = copie(window.EXEMPLES.commandes);
    for (const [nom, b64] of Object.entries(window.EXEMPLES.images || {})) memoriserImage(nom, base64VersBlob(b64, nom));
  }

  /* Ouvre le dossier choisi ; la première fois, y recopie les données déjà présentes dans le navigateur. */
  async function brancherDossier(h) {
    const changement = mode === 'dossier'; // on passe d'un dossier à un autre : on garde les données en cours
    let d = h;
    if (h.name !== SOUS_DOSSIER && (await lireTexte(h, 'commandes.json')) === null) {
      d = await h.getDirectoryHandle(SOUS_DOSSIER, { create: true });
    }
    const texte = await lireTexte(d, 'commandes.json');
    dossier = d;
    dossierImages = await d.getDirectoryHandle('images', { create: true });
    dossierAuto = await d.getDirectoryHandle('sauvegardes-auto', { create: true });
    mode = 'dossier';
    if (texte === null) {
      // Dossier neuf : on reprend les commandes du navigateur, ou les exemples au tout premier lancement.
      if (!changement) {
        await chargerDepuisNavigateur();
        if (!commandes.length && !reglages.initialise) installerExemples();
      }
      reglages.initialise = true;
      for (const [nom, im] of images) await ecrireFichier(dossierImages, nom, im.blob);
      await persisterReglages();
      await persisterCommandes();
    } else {
      commandes = JSON.parse(texte);
      reglages = JSON.parse((await lireTexte(d, 'reglages.json')) || '{}');
      images.clear();
      for await (const [nom, fh] of dossierImages.entries()) {
        if (fh.kind === 'file') memoriserImage(nom, await fh.getFile());
      }
      await sauvegardeDuJour();
    }
  }

  return {
    /* Renvoie 'pret', 'choisir' (aucun dossier encore choisi) ou 'reconnecter' (autoriser à nouveau l'accès). */
    async demarrer() {
      base = await ouvrirBase();
      if (typeof window.showDirectoryPicker !== 'function') {
        mode = 'navigateur';
        try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { /* rien */ }
        await chargerDepuisNavigateur();
        if (!reglages.initialise) {
          installerExemples();
          reglages.initialise = true;
          for (const [nom, im] of images) await idbEcrire('images', im.blob, nom);
          await persisterCommandes();
          await persisterReglages();
        }
        return 'pret';
      }
      poignee = await idbLire('reglages', 'dossier');
      if (!poignee) return 'choisir';
      try {
        if ((await poignee.queryPermission({ mode: 'readwrite' })) === 'granted') {
          await brancherDossier(poignee);
          return 'pret';
        }
      } catch (e) {
        return 'choisir';
      }
      return 'reconnecter';
    },

    /* À appeler depuis un clic. nouveau = true pour choisir (ou changer) le dossier. */
    async connecter(nouveau) {
      if (nouveau || !poignee) {
        poignee = await window.showDirectoryPicker({ id: 'calendrier-arrose', mode: 'readwrite', startIn: 'documents' });
      } else if ((await poignee.requestPermission({ mode: 'readwrite' })) !== 'granted') {
        throw new Error('Le navigateur n’a pas reçu l’autorisation d’ouvrir le dossier. Cliquez à nouveau et choisissez « Autoriser ».');
      }
      if ((await poignee.queryPermission({ mode: 'readwrite' })) !== 'granted'
        && (await poignee.requestPermission({ mode: 'readwrite' })) !== 'granted') {
        throw new Error('Le navigateur n’a pas reçu l’autorisation d’écrire dans ce dossier.');
      }
      await brancherDossier(poignee);
      await idbEcrire('reglages', poignee, 'dossier');
    },

    mode() { return mode; },
    nomDossier() { return mode === 'dossier' ? `${poignee.name === dossier.name ? '' : poignee.name + ' › '}${dossier.name}` : ''; },
    nomDossierChoisi() { return poignee ? poignee.name : ''; },

    urlImage(nom) { return images.has(nom) ? images.get(nom).url : ''; },

    async lireCommandes() { return copie(commandes); },

    async enregistrerCommande(c) {
      const maintenant = new Date().toISOString();
      const i = commandes.findIndex((x) => x.id === c.id);
      const avant = i >= 0 ? commandes[i] : null;
      const nouvelle = copie({ ...c, modifieLe: maintenant, creeLe: (avant && avant.creeLe) || maintenant });
      if (i >= 0) commandes[i] = nouvelle; else commandes.push(nouvelle);
      await persisterCommandes();
      const utilisees = new Set(commandes.flatMap(imagesDe));
      if (avant) await retirerImages(imagesDe(avant).filter((n) => !utilisees.has(n)));
      return copie(nouvelle);
    },

    async supprimerCommande(c) {
      const avant = commandes.find((x) => x.id === c.id);
      commandes = commandes.filter((x) => x.id !== c.id);
      await persisterCommandes();
      const utilisees = new Set(commandes.flatMap(imagesDe));
      if (avant) await retirerImages(imagesDe(avant).filter((n) => !utilisees.has(n)));
    },

    async ajouterImage(blob) {
      const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' }[blob.type];
      if (!ext) throw new Error('format d’image non pris en charge (utilisez JPG ou PNG)');
      const nom = `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}.${ext}`;
      await persisterImage(nom, blob);
      memoriserImage(nom, blob);
      return nom;
    },

    /* Images ajoutées puis abandonnées (fiche fermée sans enregistrer) */
    async nettoyerImages() {
      const utilisees = new Set(commandes.flatMap(imagesDe));
      await retirerImages([...images.keys()].filter((n) => !utilisees.has(n)));
    },

    async exporter() {
      const contenu = {};
      for (const nom of new Set(commandes.flatMap(imagesDe))) {
        if (images.has(nom)) contenu[nom] = await blobVersBase64(images.get(nom).blob);
      }
      reglages.derniereSauvegarde = new Date().toISOString();
      await persisterReglages();
      return { application: 'calendrier-arrose', version: 2, exporteLe: new Date().toISOString(), commandes: copie(commandes), images: contenu, types: reglages.types || null };
    },

    async importer(texte) {
      let donnees;
      try { donnees = JSON.parse(texte); } catch (e) { throw new Error('Ce fichier n’est pas une sauvegarde valide.'); }
      if (!donnees || donnees.application !== 'calendrier-arrose' || !Array.isArray(donnees.commandes)) {
        throw new Error('Ce fichier n’est pas une sauvegarde du calendrier.');
      }
      for (const [nom, b64] of Object.entries(donnees.images || {})) {
        if (!/^[A-Za-z0-9_.-]+$/.test(nom)) continue;
        const blob = base64VersBlob(b64, nom);
        await persisterImage(nom, blob);
        memoriserImage(nom, blob);
      }
      commandes = copie(donnees.commandes);
      await persisterCommandes();
      if (Array.isArray(donnees.types) && donnees.types.length) { reglages.types = donnees.types; await persisterReglages(); }
      await this.nettoyerImages();
      return commandes.length;
    },

    async derniereSauvegarde() { return reglages.derniereSauvegarde || null; },
    async lireTypes() { return reglages.types || null; },
    async ecrireTypes(types) { reglages.types = copie(types); await persisterReglages(); },
  };
})();
