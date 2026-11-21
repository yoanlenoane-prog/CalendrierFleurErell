'use strict';
/*
 * Sauvegarde automatique dans Google Drive (version en ligne du calendrier).
 *
 * Après la connexion avec le compte Google de la boutique, tout est recopié dans le dossier déjà
 * existant « FLEURS › DOSSIER CALENDRIER EVENEMENT » du Drive (CHEMIN ci-dessous) :
 *   commandes.json         les commandes, les types d'évènements et les réglages
 *   images/                les photos et PDF des fiches
 *   sauvegardes/           une copie par jour (30 derniers jours)
 * L'envoi se fait quelques secondes après chaque modification, toutes les 5 minutes,
 * au retour du réseau et à chaque ouverture. Les données restent aussi sur l'ordinateur (hors connexion).
 *
 * Portée « drive » : nécessaire pour retrouver un dossier créé à la main dans le Drive.
 * Aucun serveur : le navigateur obtient un jeton Google et parle directement à Google Drive.
 */
const Drive = (() => {
  const CLIENT_ID = '822058356046-leo1560gm79g6vbv193973s39328ilfe.apps.googleusercontent.com';
  const PORTEE = 'https://www.googleapis.com/auth/drive';
  const VERSION_PORTEE = 2;  // à augmenter si PORTEE ou CHEMIN changent : la fleuriste devra se reconnecter
  const CHEMIN = ['FLEURS', 'DOSSIER CALENDRIER EVENEMENT']; // majuscules, accents et « s » final ignorés
  const NOM_FICHIER = 'commandes.json';
  const NB_COPIES = 30;
  const CLE = 'calendrier-arrose.drive';
  const API = 'https://www.googleapis.com/drive/v3/files';
  const ENVOI = 'https://www.googleapis.com/upload/drive/v3/files';
  const DOSSIER_MIME = 'application/vnd.google-apps.folder';

  let memo = lireMemo();     // jeton, identifiants des dossiers, dernière synchro…
  if (memo.connecte && memo.versionPortee !== VERSION_PORTEE) {
    // Ancienne version (dossier « Calendrier Arrosé ») : nouvel accord Google et nouveau dossier.
    memo = { connecte: true, besoinAccord: true, derniereSynchro: memo.derniereSynchro };
    ecrireMemo();
  }
  let etat = 'deconnecte';   // deconnecte | synchro | ok | horsligne | reconnecter | erreur | indisponible
  let detail = '';
  let enCours = false;
  let relancer = false;
  let minuterie = null;
  let clientJeton = null;
  let attente = null;
  const ecouteursEtat = [];
  const ecouteursDistant = [];

  /* ---------- Mémoire locale ---------- */

  function lireMemo() {
    try { return JSON.parse(localStorage.getItem(CLE) || '{}') || {}; } catch (e) { return {}; }
  }
  function ecrireMemo() {
    try { localStorage.setItem(CLE, JSON.stringify(memo)); } catch (e) { /* rien */ }
  }
  function changerEtat(e, d = '') {
    etat = e; detail = d;
    for (const f of ecouteursEtat) { try { f(etat, detail); } catch (x) { /* rien */ } }
  }
  function possible() { return location.protocol === 'https:' || location.hostname === 'localhost'; }
  function jeton() { return memo.jeton && memo.expire > Date.now() + 60000 ? memo.jeton : null; }
  function empreinte(t) { // petite empreinte d'un texte, pour savoir s'il a changé
    let h = 5381;
    for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
    return t.length + '-' + h.toString(36);
  }
  function aujourdhui() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  /* ---------- Connexion Google ---------- */

  function chargerScriptGoogle() {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Le service de connexion Google ne répond pas (pas de connexion internet ?).'));
      document.head.appendChild(s);
    });
  }

  async function demanderJeton(interactif) {
    await chargerScriptGoogle();
    if (!clientJeton) {
      clientJeton = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: PORTEE,
        callback: (r) => {
          const a = attente; attente = null;
          if (!a) return;
          if (r.error) return a.reject(new Error(r.error_description || r.error));
          if (!window.google.accounts.oauth2.hasGrantedAllScopes(r, PORTEE)) {
            return a.reject(new Error('l’accès à Google Drive n’a pas été coché dans la fenêtre Google'));
          }
          memo.versionPortee = VERSION_PORTEE;
          memo.besoinAccord = false;
          memo.jeton = r.access_token;
          memo.expire = Date.now() + Number(r.expires_in || 3600) * 1000;
          memo.connecte = true;
          ecrireMemo();
          a.resolve(r.access_token);
        },
        error_callback: (err) => {
          const a = attente; attente = null;
          if (a) a.reject(new Error((err && (err.message || err.type)) || 'Connexion Google annulée'));
        },
      });
    }
    return new Promise((resolve, reject) => {
      attente = { resolve, reject };
      clientJeton.requestAccessToken({ prompt: interactif && (!memo.connecte || memo.besoinAccord) ? 'consent' : '' });
      if (!interactif) setTimeout(() => { if (attente) { attente = null; reject(new Error('silence')); } }, 15000);
    });
  }

  /* ---------- API Google Drive ---------- */

  async function appel(methode, url, { corps, entetes = {}, reponse = 'json' } = {}) {
    const t = jeton();
    if (!t) { const e = new Error('jeton'); e.code = 401; throw e; }
    const r = await fetch(url, { method: methode, body: corps, headers: { Authorization: 'Bearer ' + t, ...entetes } });
    if (r.status === 401) { memo.jeton = null; ecrireMemo(); const e = new Error('jeton'); e.code = 401; throw e; }
    if (r.status === 404) return null;
    if (!r.ok) {
      let texte = '';
      try { texte = (await r.json()).error.message; } catch (x) { /* rien */ }
      const e = new Error(r.status === 403 && /quota|storage/i.test(texte) ? 'Le Google Drive est plein.' : `Google Drive a répondu ${r.status}${texte ? ' : ' + texte : ''}`);
      e.code = r.status; throw e;
    }
    if (reponse === 'blob') return r.blob();
    if (reponse === 'texte') return r.text();
    return r.status === 204 ? null : r.json();
  }

  async function lister(parent) { // nom -> { id, modifiedTime, createdTime }
    const res = {};
    let page = '';
    do {
      const q = encodeURIComponent(`'${parent}' in parents and trashed=false`);
      const r = await appel('GET', `${API}?q=${q}&fields=nextPageToken,files(id,name,mimeType,modifiedTime,createdTime)&pageSize=1000${page ? '&pageToken=' + page : ''}`);
      for (const f of r.files) res[f.name] = f;
      page = r.nextPageToken || '';
    } while (page);
    return res;
  }

  async function creerDossier(nom, parent) {
    return (await appel('POST', `${API}?fields=id`, {
      corps: JSON.stringify({ name: nom, mimeType: DOSSIER_MIME, parents: [parent] }),
      entetes: { 'Content-Type': 'application/json' },
    })).id;
  }

  async function existe(id) {
    if (!id) return false;
    const f = await appel('GET', `${API}/${id}?fields=id,trashed`);
    return !!(f && !f.trashed);
  }

  async function envoyerNouveau(nom, parent, blob, type) {
    const limite = 'arrose' + Math.random().toString(36).slice(2);
    const corps = new Blob([
      `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: nom, parents: [parent] })}\r\n`,
      `--${limite}\r\nContent-Type: ${type}\r\n\r\n`, blob, `\r\n--${limite}--`,
    ]);
    return appel('POST', `${ENVOI}?uploadType=multipart&fields=id,modifiedTime`, { corps, entetes: { 'Content-Type': `multipart/related; boundary=${limite}` } });
  }

  async function remplacer(id, blob, type) {
    return appel('PATCH', `${ENVOI}/${id}?uploadType=media&fields=id,modifiedTime`, { corps: blob, entetes: { 'Content-Type': type } });
  }

  async function corbeille(id) {
    return appel('PATCH', `${API}/${id}`, { corps: JSON.stringify({ trashed: true }), entetes: { 'Content-Type': 'application/json' } });
  }

  function normaliser(t) { // « Évènements » = « EVENEMENT »
    return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ').trim().split(' ').map((m) => m.replace(/s$/, '')).join(' ');
  }
  function nomDossier() { return CHEMIN.join(' › '); }

  /* Retrouve le dossier existant « FLEURS › DOSSIER CALENDRIER EVENEMENT » (où qu'il soit dans le Drive). */
  async function trouverDossier() {
    const dossiers = [];
    let page = '';
    do {
      const q = encodeURIComponent(`mimeType='${DOSSIER_MIME}' and trashed=false`);
      const r = await appel('GET', `${API}?q=${q}&fields=nextPageToken,files(id,name,parents)&pageSize=1000${page ? '&pageToken=' + page : ''}`);
      dossiers.push(...r.files);
      page = r.nextPageToken || '';
    } while (page);
    const parId = new Map(dossiers.map((d) => [d.id, d]));
    const correspond = (d, i) => {
      if (i < 0) return true;
      if (!d || normaliser(d.name) !== normaliser(CHEMIN[i])) return false;
      return i === 0 || (d.parents || []).some((p) => correspond(parId.get(p), i - 1));
    };
    const trouve = dossiers.find((d) => correspond(d, CHEMIN.length - 1));
    if (!trouve) {
      const e = new Error(`le dossier « ${nomDossier()} » est introuvable dans le Google Drive de ce compte`);
      e.code = 'introuvable'; throw e;
    }
    return trouve.id;
  }

  /* Prépare le dossier de destination et ses sous-dossiers « images » et « sauvegardes ». */
  async function preparerDossiers() {
    if (!(await existe(memo.dossier))) {
      memo.dossier = await trouverDossier();
      memo.images = memo.copies = memo.fichier = memo.versionDistante = null;
      ecrireMemo();
    }
    if (!memo.images || !memo.copies) {
      const contenu = await lister(memo.dossier);
      memo.images = contenu.images ? contenu.images.id : await creerDossier('images', memo.dossier);
      memo.copies = contenu.sauvegardes ? contenu.sauvegardes.id : await creerDossier('sauvegardes', memo.dossier);
      ecrireMemo();
    }
  }

  /* ---------- Synchronisation ---------- */

  async function synchroniser() {
    if (!possible() || !memo.connecte) return;
    if (enCours) { relancer = true; return; }
    enCours = true;
    try {
      if (memo.besoinAccord) { changerEtat('reconnecter'); return; }
      if (!jeton()) {
        try { await demanderJeton(false); } catch (e) { changerEtat('reconnecter'); return; }
      }
      if (!navigator.onLine) { changerEtat('horsligne'); return; }
      changerEtat('synchro');
      await preparerDossiers();
      let distantChange = false;

      // 1. Récupérer ce qui a été modifié ailleurs (autre ordinateur, téléphone)
      const contenu = await lister(memo.dossier);
      const fichier = contenu[NOM_FICHIER];
      if (fichier && fichier.modifiedTime !== memo.versionDistante) {
        const texte = await appel('GET', `${API}/${fichier.id}?alt=media`, { reponse: 'texte' });
        if (texte) {
          const remplacerTout = !memo.derniereSynchro && Stockage.seulementExemples();
          if (await Stockage.integrerDistant(JSON.parse(texte), remplacerTout)) distantChange = true;
        }
      }

      // 2. Photos et PDF : envoyer les nouveaux, récupérer ceux qui manquent sur cet ordinateur
      const distantes = await lister(memo.images);
      const utilisees = new Set(Stockage.imagesUtilisees());
      for (const nom of utilisees) {
        const blob = Stockage.blobImage(nom);
        if (!distantes[nom] && blob) {
          await envoyerNouveau(nom, memo.images, blob, blob.type || 'application/octet-stream');
        } else if (distantes[nom] && !blob) {
          const b = await appel('GET', `${API}/${distantes[nom].id}?alt=media`, { reponse: 'blob' });
          if (b) { await Stockage.ajouterImageDistante(nom, b); distantChange = true; }
        }
      }
      const unJour = Date.now() - 864e5;
      for (const [nom, f] of Object.entries(distantes)) { // images retirées des fiches (gardées un jour par prudence)
        if (!utilisees.has(nom) && new Date(f.createdTime).getTime() < unJour) await corbeille(f.id);
      }

      // 3. Envoyer les commandes si elles ont changé
      const texte = JSON.stringify(Stockage.pourDrive(), null, 1);
      const blob = new Blob([texte], { type: 'application/json' });
      if (!fichier || empreinte(texte) !== memo.empreinte || fichier.modifiedTime !== memo.versionDistante) {
        const r = fichier ? await remplacer(fichier.id, blob, 'application/json') : await envoyerNouveau(NOM_FICHIER, memo.dossier, blob, 'application/json');
        memo.versionDistante = r.modifiedTime;
        memo.empreinte = empreinte(texte);
      }

      // 4. Une copie par jour dans « sauvegardes »
      if (memo.copieDuJour !== aujourdhui()) {
        const copies = await lister(memo.copies);
        const nom = `commandes-${aujourdhui()}.json`;
        if (!copies[nom]) await envoyerNouveau(nom, memo.copies, blob, 'application/json');
        const anciennes = Object.keys(copies).filter((n) => /^commandes-\d{4}-\d{2}-\d{2}\.json$/.test(n)).concat(copies[nom] ? [] : [nom]).sort();
        while (anciennes.length > NB_COPIES) { const n = anciennes.shift(); if (copies[n]) await corbeille(copies[n].id); }
        memo.copieDuJour = aujourdhui();
      }

      memo.derniereSynchro = new Date().toISOString();
      ecrireMemo();
      changerEtat('ok');
      if (distantChange) for (const f of ecouteursDistant) { try { await f(); } catch (x) { /* rien */ } }
    } catch (e) {
      if (e.code === 401) changerEtat('reconnecter');
      else if (!navigator.onLine || e instanceof TypeError) changerEtat('horsligne');
      else changerEtat('erreur', e.message);
    } finally {
      enCours = false;
      if (relancer) { relancer = false; planifier(1000); }
    }
  }

  function planifier(delai = 3000) {
    if (!memo.connecte) return;
    clearTimeout(minuterie);
    minuterie = setTimeout(synchroniser, delai);
  }

  return {
    possible,
    nomDossier,
    etat() { return etat; },
    detail() { return detail; },
    connecte() { return !!memo.connecte; },
    derniereSynchro() { return memo.derniereSynchro || null; },
    surEtat(f) { ecouteursEtat.push(f); },
    surChangementDistant(f) { ecouteursDistant.push(f); },
    planifier,

    /* Au lancement du calendrier. */
    demarrer() {
      if (!possible()) { changerEtat('indisponible'); return; }
      if (!memo.connecte) { changerEtat('deconnecte'); return; }
      changerEtat(jeton() ? 'synchro' : 'reconnecter');
      synchroniser();
      setInterval(() => planifier(0), 5 * 60000);
      window.addEventListener('online', () => planifier(500));
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') planifier(500); });
    },

    /* À appeler depuis un clic (la fenêtre Google peut alors s'ouvrir). */
    async connecter() {
      const premiere = !memo.connecte;
      await demanderJeton(true);
      if (premiere) {
        setInterval(() => planifier(0), 5 * 60000);
        window.addEventListener('online', () => planifier(500));
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') planifier(500); });
      }
      await synchroniser();
    },

    synchroniserMaintenant() { return synchroniser(); },

    deconnecter() {
      const t = memo.jeton;
      memo = {};
      ecrireMemo();
      try { if (t && window.google) window.google.accounts.oauth2.revoke(t, () => {}); } catch (e) { /* rien */ }
      changerEtat('deconnecte');
    },
  };
})();
