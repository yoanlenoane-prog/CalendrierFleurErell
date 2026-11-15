'use strict';
/*
 * Calendrier des commandes – Arrosé, La cave fleurie
 * Petit serveur local, sans aucune dépendance : il suffit d'avoir Node.js.
 * Les données sont enregistrées dans le dossier « donnees » à côté de ce fichier.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { exec } = require('child_process');

const PORT = Number(process.env.PORT) || 8080;
const RACINE = __dirname;
const PUBLIC = path.join(RACINE, 'public');
const EXEMPLES = path.join(RACINE, 'exemples');
const DONNEES = process.env.DOSSIER_DONNEES ? path.resolve(process.env.DOSSIER_DONNEES) : path.join(RACINE, 'donnees');
const IMAGES = path.join(DONNEES, 'images');
const FICHIER = path.join(DONNEES, 'commandes.json');
const AUTO = path.join(DONNEES, 'sauvegardes-auto');
const NB_SAUVEGARDES_AUTO = 30;

const TYPES_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};
const EXT_PAR_MIME = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg' };
const NOM_IMAGE_VALIDE = /^[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp|gif|svg)$/;

/* ---------- Stockage ---------- */

function aujourdhui() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function ecrireAtomique(fichier, contenu) {
  const tmp = fichier + '.tmp';
  fs.writeFileSync(tmp, contenu);
  fs.renameSync(tmp, fichier);
}

function lireCommandes() {
  try {
    const liste = JSON.parse(fs.readFileSync(FICHIER, 'utf8'));
    return Array.isArray(liste) ? liste : [];
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

function sauvegardeDuJour() {
  if (!fs.existsSync(FICHIER)) return;
  const cible = path.join(AUTO, `commandes-${aujourdhui()}.json`);
  if (!fs.existsSync(cible)) fs.copyFileSync(FICHIER, cible);
  const fichiers = fs.readdirSync(AUTO).filter((f) => /^commandes-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  while (fichiers.length > NB_SAUVEGARDES_AUTO) fs.unlinkSync(path.join(AUTO, fichiers.shift()));
}

function ecrireCommandes(liste) {
  sauvegardeDuJour();
  ecrireAtomique(FICHIER, JSON.stringify(liste, null, 2));
}

function imagesDe(c) {
  return [...(c.inspirations || []), ...(c.moodboard || [])];
}

function supprimerImagesOrphelines(candidates, liste) {
  const utilisees = new Set(liste.flatMap(imagesDe));
  for (const nom of candidates) {
    if (!utilisees.has(nom) && NOM_IMAGE_VALIDE.test(nom)) {
      fs.rm(path.join(IMAGES, nom), { force: true }, () => {});
    }
  }
}

/* Images envoyées puis jamais enregistrées dans une commande (fiche fermée sans enregistrer) */
function nettoyerImagesAbandonnees() {
  const utilisees = new Set(lireCommandes().flatMap(imagesDe));
  const limite = Date.now() - 24 * 3600 * 1000;
  for (const nom of fs.readdirSync(IMAGES)) {
    if (utilisees.has(nom)) continue;
    const f = path.join(IMAGES, nom);
    try { if (fs.statSync(f).mtimeMs < limite) fs.unlinkSync(f); } catch (e) { /* rien */ }
  }
}

function initialiser() {
  fs.mkdirSync(IMAGES, { recursive: true });
  fs.mkdirSync(AUTO, { recursive: true });
  if (!fs.existsSync(FICHIER)) {
    // Premier lancement : on installe les commandes d'exemple.
    const exemple = path.join(EXEMPLES, 'commandes.json');
    if (fs.existsSync(exemple)) {
      const dossierImg = path.join(EXEMPLES, 'images');
      if (fs.existsSync(dossierImg)) {
        for (const f of fs.readdirSync(dossierImg)) fs.copyFileSync(path.join(dossierImg, f), path.join(IMAGES, f));
      }
      fs.copyFileSync(exemple, FICHIER);
    } else {
      ecrireAtomique(FICHIER, '[]');
    }
  }
  sauvegardeDuJour();
  nettoyerImagesAbandonnees();
}

/* ---------- Outils HTTP ---------- */

function envoyerJSON(res, code, obj) {
  const corps = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(corps);
}

function lireCorps(req, max) {
  return new Promise((resolve, reject) => {
    const morceaux = [];
    let taille = 0;
    req.on('data', (m) => {
      taille += m.length;
      if (taille > max) { reject(Object.assign(new Error('Fichier trop volumineux'), { code: 413 })); req.destroy(); return; }
      morceaux.push(m);
    });
    req.on('end', () => resolve(Buffer.concat(morceaux)));
    req.on('error', reject);
  });
}

function servirFichier(res, fichier, cache) {
  fs.stat(fichier, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Introuvable'); return; }
    res.writeHead(200, {
      'Content-Type': TYPES_MIME[path.extname(fichier).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': cache ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    fs.createReadStream(fichier).pipe(res);
  });
}

function adressesReseau() {
  const liste = [];
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const i of interfaces || []) {
      if (i.family === 'IPv4' && !i.internal) liste.push(`http://${i.address}:${PORT}`);
    }
  }
  return liste;
}

/* ---------- Routes ---------- */

async function api(req, res, url) {
  const m = url.pathname.match(/^\/api\/commandes\/([A-Za-z0-9_-]+)$/);

  if (req.method === 'GET' && url.pathname === '/api/commandes') {
    return envoyerJSON(res, 200, lireCommandes());
  }

  if (m && req.method === 'PUT') {
    const c = JSON.parse((await lireCorps(req, 5e6)).toString('utf8'));
    c.id = m[1];
    const liste = lireCommandes();
    const i = liste.findIndex((x) => x.id === c.id);
    const avant = i >= 0 ? imagesDe(liste[i]) : [];
    c.modifieLe = new Date().toISOString();
    if (i >= 0) { c.creeLe = liste[i].creeLe; liste[i] = c; } else { c.creeLe = c.modifieLe; liste.push(c); }
    ecrireCommandes(liste);
    supprimerImagesOrphelines(avant, liste);
    return envoyerJSON(res, 200, c);
  }

  if (m && req.method === 'DELETE') {
    const liste = lireCommandes();
    const c = liste.find((x) => x.id === m[1]);
    if (!c) return envoyerJSON(res, 404, { erreur: 'Commande introuvable' });
    const reste = liste.filter((x) => x.id !== m[1]);
    ecrireCommandes(reste);
    supprimerImagesOrphelines(imagesDe(c), reste);
    return envoyerJSON(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/images') {
    const type = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    const ext = EXT_PAR_MIME[type];
    if (!ext) return envoyerJSON(res, 415, { erreur: "Format d'image non pris en charge" });
    const donnees = await lireCorps(req, 30e6);
    const nom = `img_${Date.now().toString(36)}_${crypto.randomBytes(5).toString('hex')}${ext}`;
    fs.writeFileSync(path.join(IMAGES, nom), donnees);
    return envoyerJSON(res, 200, { nom });
  }

  if (req.method === 'GET' && url.pathname === '/api/export') {
    const commandes = lireCommandes();
    const images = {};
    for (const nom of new Set(commandes.flatMap(imagesDe))) {
      try { images[nom] = fs.readFileSync(path.join(IMAGES, nom)).toString('base64'); } catch (e) { /* image manquante */ }
    }
    const corps = JSON.stringify({ application: 'calendrier-arrose', version: 1, exporteLe: new Date().toISOString(), commandes, images });
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="sauvegarde-calendrier-${aujourdhui()}.json"`,
      'Cache-Control': 'no-store',
    });
    return res.end(corps);
  }

  if (req.method === 'POST' && url.pathname === '/api/import') {
    let donnees;
    try { donnees = JSON.parse((await lireCorps(req, 2e9)).toString('utf8')); } catch (e) {
      return envoyerJSON(res, 400, { erreur: "Ce fichier n'est pas une sauvegarde valide." });
    }
    if (!donnees || donnees.application !== 'calendrier-arrose' || !Array.isArray(donnees.commandes)) {
      return envoyerJSON(res, 400, { erreur: "Ce fichier n'est pas une sauvegarde du calendrier." });
    }
    // Par prudence, on garde une copie des commandes actuelles avant de les remplacer.
    if (fs.existsSync(FICHIER)) {
      const horodatage = new Date().toISOString().replace(/[:.]/g, '-');
      fs.copyFileSync(FICHIER, path.join(AUTO, `avant-import-${horodatage}.json`));
    }
    for (const [nom, b64] of Object.entries(donnees.images || {})) {
      if (NOM_IMAGE_VALIDE.test(nom)) fs.writeFileSync(path.join(IMAGES, nom), Buffer.from(b64, 'base64'));
    }
    ecrireAtomique(FICHIER, JSON.stringify(donnees.commandes, null, 2));
    return envoyerJSON(res, 200, { ok: true, nombre: donnees.commandes.length });
  }

  if (req.method === 'GET' && url.pathname === '/api/info') {
    return envoyerJSON(res, 200, { adresses: adressesReseau(), dossier: DONNEES });
  }

  return envoyerJSON(res, 404, { erreur: 'Route inconnue' });
}

const serveur = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);

    if (url.pathname.startsWith('/images/')) {
      const nom = decodeURIComponent(url.pathname.slice(8));
      if (!NOM_IMAGE_VALIDE.test(nom)) { res.writeHead(404); return res.end(); }
      return servirFichier(res, path.join(IMAGES, nom), true);
    }

    const chemin = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
    const fichier = path.normalize(path.join(PUBLIC, chemin));
    if (!fichier.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
    return servirFichier(res, fichier, false);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) envoyerJSON(res, e.code === 413 ? 413 : 500, { erreur: e.message || 'Erreur' });
    else res.end();
  }
});

function ouvrirNavigateur(adresse) {
  if (process.env.PAS_DE_NAVIGATEUR) return;
  const cmd = process.platform === 'win32' ? `start "" "${adresse}"` : process.platform === 'darwin' ? `open "${adresse}"` : `xdg-open "${adresse}"`;
  exec(cmd, () => {});
}

serveur.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log("\n  Le calendrier est deja ouvert. J'ouvre simplement la page dans le navigateur.\n");
    ouvrirNavigateur(`http://localhost:${PORT}`);
    setTimeout(() => process.exit(0), 1500);
  } else {
    console.error(e);
    process.exit(1);
  }
});

initialiser();
serveur.listen(PORT, '0.0.0.0', () => {
  const ligne = '  ' + '-'.repeat(60);
  console.log('\n' + ligne);
  console.log('   Calendrier des commandes - Arrose, La cave fleurie');
  console.log(ligne);
  console.log(`   Sur cet ordinateur :  http://localhost:${PORT}`);
  for (const a of adressesReseau()) console.log(`   Sur la tablette    :  ${a}`);
  console.log(`   Donnees enregistrees dans : ${DONNEES}`);
  console.log(ligne);
  console.log('   Laissez cette fenetre ouverte (vous pouvez la reduire).');
  console.log("   Pour arreter le calendrier, fermez cette fenetre.");
  console.log(ligne + '\n');
  ouvrirNavigateur(`http://localhost:${PORT}`);
});
