'use strict';
/*
 * Enregistrement durable des commandes et des images dans le navigateur (IndexedDB),
 * sur cet ordinateur uniquement. Rien n'est envoyé sur Internet.
 */
const Stockage = (() => {
  const NOM_BASE = 'calendrier-arrose';
  let base = null;
  const urls = new Map(); // nom d'image -> adresse affichable

  function ouvrir() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('Ce navigateur ne permet pas d’enregistrer les données. Utilisez Microsoft Edge ou Google Chrome.'));
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

  function transaction(magasins, mode, travail) {
    return new Promise((resolve, reject) => {
      const tx = base.transaction(magasins, mode);
      let resultat;
      tx.oncomplete = () => resolve(resultat);
      tx.onerror = () => reject(tx.error || new Error('Erreur d’enregistrement'));
      tx.onabort = () => reject(tx.error || new Error('Enregistrement annulé (disque plein ?)'));
      const r = travail(tx);
      if (r && 'onsuccess' in r) r.onsuccess = () => { resultat = r.result; };
    });
  }

  const lireReglage = (cle) => transaction(['reglages'], 'readonly', (tx) => tx.objectStore('reglages').get(cle));
  const ecrireReglage = (cle, valeur) => transaction(['reglages'], 'readwrite', (tx) => tx.objectStore('reglages').put(valeur, cle));

  function imagesDe(c) { return [...(c.inspirations || []), ...(c.moodboard || [])]; }

  function base64VersBlob(b64, nom) {
    const binaire = atob(b64);
    const octets = new Uint8Array(binaire.length);
    for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
    const ext = (nom.split('.').pop() || '').toLowerCase();
    const type = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' }[ext] || 'application/octet-stream';
    return new Blob([octets], { type });
  }

  function blobVersBase64(blob) {
    return new Promise((resolve, reject) => {
      const lecteur = new FileReader();
      lecteur.onload = () => resolve(String(lecteur.result).split(',')[1] || '');
      lecteur.onerror = () => reject(lecteur.error);
      lecteur.readAsDataURL(blob);
    });
  }

  async function chargerUrlsImages() {
    for (const u of urls.values()) URL.revokeObjectURL(u);
    urls.clear();
    await new Promise((resolve, reject) => {
      const tx = base.transaction(['images'], 'readonly');
      const req = tx.objectStore('images').openCursor();
      req.onsuccess = () => {
        const curseur = req.result;
        if (!curseur) return;
        urls.set(curseur.key, URL.createObjectURL(curseur.value));
        curseur.continue();
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async function remplacerTout(commandes, images) {
    await transaction(['commandes', 'images'], 'readwrite', (tx) => {
      const sc = tx.objectStore('commandes');
      const si = tx.objectStore('images');
      sc.clear();
      si.clear();
      for (const c of commandes) sc.put(c);
      for (const [nom, b64] of Object.entries(images || {})) si.put(base64VersBlob(b64, nom), nom);
    });
    await chargerUrlsImages();
  }

  return {
    async demarrer() {
      base = await ouvrir();
      // Demande au navigateur de ne jamais effacer ces données automatiquement.
      try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { /* rien */ }
      if (!(await lireReglage('initialise'))) {
        if (window.EXEMPLES) await remplacerTout(window.EXEMPLES.commandes, window.EXEMPLES.images);
        await ecrireReglage('initialise', true);
      }
      await chargerUrlsImages();
    },

    urlImage(nom) { return urls.get(nom) || ''; },

    lireCommandes() {
      return transaction(['commandes'], 'readonly', (tx) => tx.objectStore('commandes').getAll());
    },

    async enregistrerCommande(c) {
      const maintenant = new Date().toISOString();
      let avant = null;
      await transaction(['commandes'], 'readonly', (tx) => {
        const r = tx.objectStore('commandes').get(c.id);
        r.onsuccess = () => { avant = r.result || null; };
      });
      c.modifieLe = maintenant;
      c.creeLe = (avant && avant.creeLe) || maintenant;
      const retirees = avant ? imagesDe(avant).filter((n) => !imagesDe(c).includes(n)) : [];
      await transaction(['commandes', 'images'], 'readwrite', (tx) => {
        tx.objectStore('commandes').put(c);
        for (const n of retirees) tx.objectStore('images').delete(n);
      });
      for (const n of retirees) { if (urls.has(n)) { URL.revokeObjectURL(urls.get(n)); urls.delete(n); } }
      return c;
    },

    async supprimerCommande(c) {
      await transaction(['commandes', 'images'], 'readwrite', (tx) => {
        tx.objectStore('commandes').delete(c.id);
        for (const n of imagesDe(c)) tx.objectStore('images').delete(n);
      });
      for (const n of imagesDe(c)) { if (urls.has(n)) { URL.revokeObjectURL(urls.get(n)); urls.delete(n); } }
    },

    async ajouterImage(blob) {
      const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' }[blob.type];
      if (!ext) throw new Error('format d’image non pris en charge (utilisez JPG ou PNG)');
      const nom = `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}.${ext}`;
      await transaction(['images'], 'readwrite', (tx) => tx.objectStore('images').put(blob, nom));
      urls.set(nom, URL.createObjectURL(blob));
      return nom;
    },

    /* Images ajoutées puis abandonnées (fiche fermée sans enregistrer) */
    async nettoyerImages(commandes) {
      const utilisees = new Set(commandes.flatMap(imagesDe));
      const inutiles = [...urls.keys()].filter((n) => !utilisees.has(n));
      if (!inutiles.length) return;
      await transaction(['images'], 'readwrite', (tx) => { for (const n of inutiles) tx.objectStore('images').delete(n); });
      for (const n of inutiles) { URL.revokeObjectURL(urls.get(n)); urls.delete(n); }
    },

    async exporter() {
      const commandes = await this.lireCommandes();
      const images = {};
      for (const nom of new Set(commandes.flatMap(imagesDe))) {
        const blob = await transaction(['images'], 'readonly', (tx) => tx.objectStore('images').get(nom));
        if (blob) images[nom] = await blobVersBase64(blob);
      }
      await ecrireReglage('derniereSauvegarde', new Date().toISOString());
      return { application: 'calendrier-arrose', version: 1, exporteLe: new Date().toISOString(), commandes, images };
    },

    async importer(texte) {
      let donnees;
      try { donnees = JSON.parse(texte); } catch (e) { throw new Error('Ce fichier n’est pas une sauvegarde valide.'); }
      if (!donnees || donnees.application !== 'calendrier-arrose' || !Array.isArray(donnees.commandes)) {
        throw new Error('Ce fichier n’est pas une sauvegarde du calendrier.');
      }
      await remplacerTout(donnees.commandes, donnees.images);
      return donnees.commandes.length;
    },

    derniereSauvegarde() { return lireReglage('derniereSauvegarde'); },
  };
})();
