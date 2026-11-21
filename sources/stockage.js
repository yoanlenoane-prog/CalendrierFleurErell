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
  const CLES_REGLAGES = ['types', 'derniereSauvegarde', 'initialise', 'delaiRelance', 'joursALivrer', 'supprimees', 'partagesModifieLe'];
  const CLES_PARTAGEES = ['types', 'delaiRelance', 'joursALivrer']; // réglages recopiés dans Google Drive
  const TYPES_MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', pdf: 'application/pdf' };

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
  let ecouteur = null;      // prévenu après chaque modification (sauvegarde Google Drive)

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
  function signaler() { if (ecouteur) { try { ecouteur(); } catch (e) { /* rien */ } } }

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
    reglages = {};
    for (const cle of CLES_REGLAGES) reglages[cle] = await idbLire('reglages', cle);
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
          for (const cle of CLES_REGLAGES) tx.objectStore('reglages').put(reglages[cle] ?? null, cle);
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

  /* Mode « navigateur » : tout reste dans IndexedDB (navigateur sans accès aux dossiers, ou choix de la fleuriste). */
  async function ouvrirNavigateur() {
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
  }

  /* Fusion avec Google Drive : pour chaque commande, la version la plus récente l'emporte ;
     une commande supprimée (date dans « supprimees ») ne revient pas. */
  function fusionner(locales, supLocales, distantes, supDistantes) {
    const sup = { ...(supLocales || {}) };
    for (const [id, d] of Object.entries(supDistantes || {})) if (!sup[id] || d > sup[id]) sup[id] = d;
    const limite = new Date(Date.now() - 365 * 864e5).toISOString();
    for (const id of Object.keys(sup)) if (sup[id] < limite) delete sup[id];
    const parId = new Map();
    for (const c of [...locales, ...distantes]) {
      const a = parId.get(c.id);
      if (!a || (c.modifieLe || '') > (a.modifieLe || '')) parId.set(c.id, c);
    }
    return { commandes: [...parId.values()].filter((c) => !(sup[c.id] && sup[c.id] >= (c.modifieLe || ''))), supprimees: sup };
  }
  const signature = (liste) => JSON.stringify(liste.map((c) => c.id + '@' + (c.modifieLe || '')).sort());

  /* Traduit les erreurs du navigateur en explications simples (avec le nom technique entre parenthèses). */
  function erreurClaire(e) {
    if (e && e.name === 'AbortError') return e;
    const nom = (e && e.name) || 'Erreur';
    let texte;
    if (nom === 'SecurityError') {
      texte = 'Le navigateur refuse d’ouvrir ce dossier depuis ce fichier. Vérifiez que le calendrier est ouvert avec Microsoft Edge ou Google Chrome, en double-cliquant sur le fichier (et non depuis GitHub).';
    } else if (nom === 'NotAllowedError') {
      texte = 'L’autorisation n’a pas été donnée. Cliquez à nouveau et choisissez « Modifier les fichiers » ou « Autoriser ».';
    } else if (nom === 'NotFoundError') {
      texte = 'Le dossier est introuvable (il a peut-être été déplacé ou renommé). Choisissez-le à nouveau.';
    } else if (nom === 'TypeError') {
      texte = 'Ce dossier ne peut pas être utilisé (dossier système ou protégé). Choisissez un dossier que vous avez créé, par exemple « Calendrier Arrosé » dans Documents.';
    } else {
      texte = 'Le dossier n’a pas pu être ouvert. Essayez un autre dossier, ou continuez sans dossier.';
    }
    const err = new Error(`${texte} (détail technique : ${nom}${e && e.message ? ' – ' + e.message : ''})`);
    err.name = nom;
    return err;
  }

  return {
    /* Renvoie 'pret', 'choisir' (aucun dossier encore choisi) ou 'reconnecter' (autoriser à nouveau l'accès). */
    async demarrer() {
      base = await ouvrirBase();
      if (typeof window.showDirectoryPicker !== 'function' || (await idbLire('reglages', 'modeNavigateur'))) {
        await ouvrirNavigateur();
        return 'pret';
      }
      poignee = await idbLire('reglages', 'dossier');
      if (!poignee) {
        // Version en ligne : pas de dossier à choisir, les commandes vont dans Google Drive.
        if (location.protocol !== 'file:') { await ouvrirNavigateur(); return 'pret'; }
        return 'choisir';
      }
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
      try {
        let h = poignee;
        if (nouveau || !h) {
          h = await window.showDirectoryPicker({ id: 'calendrier-arrose', mode: 'readwrite', startIn: 'documents' });
        }
        let etat = await h.queryPermission({ mode: 'readwrite' });
        if (etat !== 'granted') etat = await h.requestPermission({ mode: 'readwrite' });
        if (etat !== 'granted') {
          const e = new Error('permission ' + etat); e.name = 'NotAllowedError'; throw e;
        }
        poignee = h;
        await brancherDossier(h);
        await idbEcrire('reglages', h, 'dossier');
        await idbEcrire('reglages', false, 'modeNavigateur');
      } catch (e) {
        throw erreurClaire(e);
      }
    },

    /* « Continuer sans dossier » : enregistrement dans le navigateur, retenu pour les prochaines ouvertures. */
    async utiliserNavigateur() {
      await ouvrirNavigateur();
      await idbEcrire('reglages', true, 'modeNavigateur');
    },

    dossierPossible() { return typeof window.showDirectoryPicker === 'function'; },
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
      signaler();
      return copie(nouvelle);
    },

    async supprimerCommande(c) {
      const avant = commandes.find((x) => x.id === c.id);
      commandes = commandes.filter((x) => x.id !== c.id);
      reglages.supprimees = { ...(reglages.supprimees || {}), [c.id]: new Date().toISOString() };
      await persisterCommandes();
      await persisterReglages();
      const utilisees = new Set(commandes.flatMap(imagesDe));
      if (avant) await retirerImages(imagesDe(avant).filter((n) => !utilisees.has(n)));
      signaler();
    },

    /* Image ou document PDF. Pour un PDF, le nom d'origine est gardé dans le nom du fichier. */
    async ajouterImage(blob, nomOrigine = '') {
      const estPdf = blob.type === 'application/pdf' || /\.pdf$/i.test(nomOrigine);
      const ext = estPdf ? 'pdf' : { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' }[blob.type];
      if (!ext) throw new Error('format non pris en charge (utilisez JPG, PNG ou PDF)');
      if (estPdf && blob.type !== 'application/pdf') blob = new Blob([blob], { type: 'application/pdf' });
      const titre = estPdf ? '_' + String(nomOrigine).replace(/\.pdf$/i, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) : '';
      const nom = `${estPdf ? 'doc' : 'img'}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}${titre === '_' ? '' : titre}.${ext}`;
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
      // La sauvegarde restaurée devient la version la plus récente (aussi pour Google Drive).
      const maintenant = new Date().toISOString();
      const restaurees = new Set(donnees.commandes.map((c) => c.id));
      const sup = { ...(reglages.supprimees || {}) };
      for (const c of commandes) if (!restaurees.has(c.id)) sup[c.id] = maintenant;
      for (const id of restaurees) delete sup[id];
      reglages.supprimees = sup;
      commandes = copie(donnees.commandes).map((c) => ({ ...c, modifieLe: maintenant }));
      await persisterCommandes();
      if (Array.isArray(donnees.types) && donnees.types.length) { reglages.types = donnees.types; reglages.partagesModifieLe = maintenant; }
      await persisterReglages();
      await this.nettoyerImages();
      signaler();
      return commandes.length;
    },

    async derniereSauvegarde() { return reglages.derniereSauvegarde || null; },
    lireReglage(cle) { return reglages[cle] ?? null; },
    async ecrireReglage(cle, valeur) {
      reglages[cle] = valeur;
      if (CLES_PARTAGEES.includes(cle)) reglages.partagesModifieLe = new Date().toISOString();
      await persisterReglages();
      if (CLES_PARTAGEES.includes(cle)) signaler();
    },
    async lireTypes() { return reglages.types || null; },
    async ecrireTypes(types) {
      reglages.types = copie(types);
      reglages.partagesModifieLe = new Date().toISOString();
      await persisterReglages();
      signaler();
    },

    /* ---------- Pour la sauvegarde Google Drive ---------- */

    surModification(f) { ecouteur = f; },
    imagesUtilisees() { return [...new Set(commandes.flatMap(imagesDe))]; },
    blobImage(nom) { return images.has(nom) ? images.get(nom).blob : null; },
    seulementExemples() { return commandes.every((c) => String(c.id).startsWith('exemple-')); },

    pourDrive() {
      const partages = {};
      for (const cle of CLES_PARTAGEES) partages[cle] = reglages[cle] ?? null;
      return {
        application: 'calendrier-arrose', version: 1, enregistreLe: new Date().toISOString(),
        commandes: copie(commandes), supprimees: reglages.supprimees || {},
        reglages: partages, reglagesModifieLe: reglages.partagesModifieLe || '',
      };
    },

    /* Intègre la version du Drive. remplacerTout : premier branchement d'un ordinateur qui n'a que les exemples.
       Renvoie true si quelque chose a changé sur cet ordinateur. */
    async integrerDistant(d, remplacerTout) {
      if (!d || d.application !== 'calendrier-arrose' || !Array.isArray(d.commandes)) return false;
      const avant = signature(commandes);
      const r = remplacerTout
        ? { commandes: d.commandes, supprimees: d.supprimees || {} }
        : fusionner(commandes, reglages.supprimees, d.commandes, d.supprimees);
      let change = signature(r.commandes) !== avant;
      commandes = copie(r.commandes);
      reglages.supprimees = r.supprimees;
      const distants = d.reglages || {};
      if ((d.reglagesModifieLe || '') > (reglages.partagesModifieLe || '') || (remplacerTout && d.reglagesModifieLe)) {
        for (const cle of CLES_PARTAGEES) if (distants[cle] !== undefined && JSON.stringify(distants[cle]) !== JSON.stringify(reglages[cle] ?? null)) { reglages[cle] = distants[cle]; change = true; }
        reglages.partagesModifieLe = d.reglagesModifieLe;
      }
      if (change) await persisterCommandes();
      await persisterReglages();
      return change;
    },

    async ajouterImageDistante(nom, blob) {
      if (!/^[A-Za-z0-9_.-]+$/.test(nom)) return;
      const type = TYPES_MIME[(nom.split('.').pop() || '').toLowerCase()];
      if (type && blob.type !== type) blob = new Blob([blob], { type });
      await persisterImage(nom, blob);
      memoriserImage(nom, blob);
    },
  };
})();
