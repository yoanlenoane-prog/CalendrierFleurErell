'use strict';
/* Calendrier des commandes – Arrosé, La cave fleurie */

/* Types d'évènements par défaut. La fleuriste peut les renommer, changer leur couleur et en ajouter. */
const TYPES_PAR_DEFAUT = [
  { id: 'mariage', nom: 'Mariage', couleur: '#B5486B' },
  { id: 'bapteme', nom: 'Baptême', couleur: '#4D7BA6' },
  { id: 'communion', nom: 'Communion', couleur: '#7864A3' },
  { id: 'anniversaire', nom: 'Anniversaire', couleur: '#C47A35' },
  { id: 'deuil', nom: 'Deuil', couleur: '#5E6773' },
  { id: 'entreprise', nom: 'Entreprise', couleur: '#5A8758' },
  { id: 'autre', nom: 'Autre', couleur: '#8C7A58' },
];
let types = structuredClone(TYPES_PAR_DEFAUT);
const UNITES = ['tiges', 'bottes', 'pots'];
const STATUTS = { devis: 'Devis', confirmee: 'Confirmée', preparation: 'En préparation', livree: 'Livrée', annulee: 'Annulée' };
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

let commandes = [];
let moisAffiche = debutDuMois(new Date());
let brouillon = null;        // commande en cours d'édition dans la fiche
let instantane = '';         // pour savoir si la fiche a été modifiée
let envoisEnCours = 0;

/* ---------- Outils ---------- */

function pad(n) { return String(n).padStart(2, '0'); }
function cleDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function debutDuMois(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function dateDepuisCle(cle) { const [a, m, j] = cle.split('-').map(Number); return new Date(a, m - 1, j); }
function cleMois(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
function echapper(t) {
  return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function nomClient(c) { return [c.prenom, c.nom].filter(Boolean).join(' ') || 'Sans nom'; }
function typeInfo(id) { return types.find((t) => t.id === id) || types.find((t) => t.id === 'autre') || TYPES_PAR_DEFAUT[TYPES_PAR_DEFAUT.length - 1]; }
function typeDe(c) { return typeInfo(c.type).id; }
function libelleType(c) {
  const p = (c.typePrecision || '').trim();
  const nom = typeInfo(c.type).nom;
  if (!p) return nom;
  return typeDe(c) === 'autre' ? p : `${nom} · ${p}`;
}
/* Couleur pâle (fond) obtenue en mélangeant la couleur du type avec du blanc. */
function couleurPale(hex, part = 0.2) {
  const n = parseInt(String(hex).replace('#', ''), 16) || 0;
  const m = (v) => Math.round(255 - (255 - v) * part);
  return `rgb(${m((n >> 16) & 255)}, ${m((n >> 8) & 255)}, ${m(n & 255)})`;
}
function dateLongue(cle) {
  const d = dateDepuisCle(cle);
  return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}
function dateCourte(cle) {
  const d = dateDepuisCle(cle);
  return `${JOURS[d.getDay()].slice(0, 3)}. ${d.getDate()} ${MOIS[d.getMonth()]}`;
}
function euros(n) { return Number(n).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }); }
function trier(liste) {
  return [...liste].sort((a, b) => (a.date + (a.heure || '99:99')).localeCompare(b.date + (b.heure || '99:99')));
}
function nouvelId() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

function messageFlottant(texte) {
  const el = $('#message-flottant');
  el.textContent = texte;
  el.hidden = false;
  clearTimeout(messageFlottant.minuteur);
  messageFlottant.minuteur = setTimeout(() => { el.hidden = true; }, 2600);
}


/* ---------- Données ---------- */

async function chargerCommandes() {
  commandes = await Stockage.lireCommandes();
}

/* ---------- Calendrier ---------- */

function commandesDuMois(d) {
  const cle = cleMois(d);
  return trier(commandes.filter((c) => c.date && c.date.startsWith(cle)));
}

function afficherCalendrier() {
  $('#titre-mois').textContent = `${MOIS[moisAffiche.getMonth()]} ${moisAffiche.getFullYear()}`;
  const grille = $('#grille');
  const premier = moisAffiche;
  const decalage = (premier.getDay() + 6) % 7; // lundi = 0
  const nbJours = new Date(premier.getFullYear(), premier.getMonth() + 1, 0).getDate();
  const nbCases = Math.ceil((decalage + nbJours) / 7) * 7;
  const aujourdhui = cleDate(new Date());

  const parJour = {};
  for (const c of trier(commandes)) (parJour[c.date] ||= []).push(c);

  let html = '';
  for (let i = 0; i < nbCases; i++) {
    const d = new Date(premier.getFullYear(), premier.getMonth(), 1 - decalage + i);
    const cle = cleDate(d);
    const classes = ['jour'];
    if (d.getMonth() !== premier.getMonth()) classes.push('hors-mois');
    if (cle === aujourdhui) classes.push('aujourdhui');
    const puces = (parJour[cle] || []).map((c) => `
      <button type="button" class="puce t-${typeDe(c)}${c.statut === 'annulee' ? ' annulee' : ''}" data-id="${echapper(c.id)}"
        title="${echapper(nomClient(c) + ' – ' + libelleType(c) + ' – ' + (STATUTS[c.statut] || ''))}">${c.heure ? `<span class="heure">${echapper(c.heure)}</span>` : ''}<strong>${echapper(nomClient(c))}</strong><span class="type-texte"> · ${echapper(libelleType(c))}</span></button>`).join('');
    html += `<div class="${classes.join(' ')}" data-date="${cle}">
      <div class="numero"><b>${d.getDate()}</b><span class="ajout" aria-hidden="true">+</span></div>
      <div class="puces">${puces}<button type="button" class="plus" hidden></button></div>
    </div>`;
  }
  grille.style.setProperty('--semaines', nbCases / 7);
  grille.innerHTML = html;
  ajusterDebordements();
}

/* Quand un jour a trop de commandes pour sa case, on affiche « + N autres ». */
function ajusterDebordements() {
  for (const zone of $$('#grille .puces')) {
    const puces = $$('.puce', zone);
    const plus = $('.plus', zone);
    puces.forEach((p) => { p.hidden = false; });
    plus.hidden = true;
    if (zone.scrollHeight <= zone.clientHeight + 1) continue;
    plus.hidden = false;
    let visibles = puces.length;
    while (visibles > 0 && zone.scrollHeight > zone.clientHeight + 1) {
      puces[--visibles].hidden = true;
      plus.textContent = `+ ${puces.length - visibles} autre${puces.length - visibles > 1 ? 's' : ''}`;
    }
  }
}

function allerAuMois(d, { alerte = true } = {}) {
  moisAffiche = debutDuMois(d);
  afficherCalendrier();
  if (alerte) afficherAlerteMois(false);
}

/* ---------- Alerte mensuelle ---------- */

function afficherListe(titre, resume, liste, dateJour) {
  $('#titre-alerte').textContent = titre;
  $('#resume-alerte').textContent = resume;
  $('#liste-alerte').innerHTML = liste.map((c) => `
    <tr data-id="${echapper(c.id)}" tabindex="0">
      <td>${echapper(dateCourte(c.date))}${c.heure ? `<br><small>${echapper(c.heure)}</small>` : ''}</td>
      <td><strong>${echapper(nomClient(c))}</strong></td>
      <td><span class="type-etiquette t-${typeDe(c)}"><i class="pastille"></i>${echapper(libelleType(c))}</span></td>
      <td><span class="statut statut-${echapper(c.statut)}">${echapper(STATUTS[c.statut] || '')}</span></td>
    </tr>`).join('');
  const bouton = $('#liste-nouvelle');
  bouton.hidden = !dateJour;
  bouton.dataset.date = dateJour || '';
  $('#fenetre-mois').hidden = false;
}

function afficherAlerteMois(meme_si_vide) {
  const liste = commandesDuMois(moisAffiche);
  if (!liste.length && !meme_si_vide) { $('#fenetre-mois').hidden = true; return; }
  const nomMois = `${MOIS[moisAffiche.getMonth()]} ${moisAffiche.getFullYear()}`;
  const annulees = liste.filter((c) => c.statut === 'annulee').length;
  const resume = liste.length
    ? `${liste.length} commande${liste.length > 1 ? 's' : ''} ce mois-ci${annulees ? ` (dont ${annulees} annulée${annulees > 1 ? 's' : ''})` : ''}. Cliquez sur une ligne pour ouvrir la fiche.`
    : 'Aucune commande ce mois-ci.';
  afficherListe(`Commandes de ${nomMois}`, resume, liste);
}

function afficherJour(cle) {
  const liste = trier(commandes.filter((c) => c.date === cle));
  afficherListe(dateLongue(cle).replace(/^./, (l) => l.toUpperCase()), `${liste.length} commandes ce jour-là.`, liste, cle);
}

/* ---------- Fiche commande ---------- */

const formulaire = () => $('#fiche');

function commandeVide(date) {
  return {
    id: null, nom: '', prenom: '', telephone: '', email: '',
    type: 'mariage', typePrecision: '', date: date || cleDate(new Date()), heure: '', lieu: '', mode: 'livraison',
    description: '', fleurs: '', couleurs: '', compositions: [], fleursCommande: [],
    inspirations: [], moodboard: [], moodboardNotes: '',
    statut: 'devis', prix: '', acompte: '', notesInternes: '',
  };
}

const CHAMPS_TEXTE = ['nom', 'prenom', 'telephone', 'email', 'type', 'typePrecision', 'date', 'heure', 'lieu',
  'description', 'fleurs', 'couleurs', 'moodboardNotes', 'statut', 'prix', 'acompte', 'notesInternes'];

function ouvrirFiche(commande) {
  brouillon = structuredClone(commande);
  brouillon.compositions ||= [];
  brouillon.fleursCommande ||= [];
  brouillon.inspirations ||= [];
  brouillon.moodboard ||= [];
  const f = formulaire();
  for (const nom of CHAMPS_TEXTE) f.elements[nom].value = brouillon[nom] ?? '';
  for (const r of f.querySelectorAll('input[name=mode]')) r.checked = r.value === (brouillon.mode || 'livraison');
  $$('input.erreur', f).forEach((el) => el.classList.remove('erreur'));
  $('#titre-fiche').textContent = brouillon.id ? nomClient(brouillon) : 'Nouvelle commande';
  $('#fiche-supprimer').hidden = !brouillon.id;
  afficherCompositions();
  $('#liste-fleurs').innerHTML = '';
  for (const fl of brouillon.fleursCommande) ajouterLigneFleur(fl);
  afficherGaleries();
  majReste();
  $('#fenetre-mois').hidden = true;
  $('#fenetre-fiche').hidden = false;
  $('.fiche-corps').scrollTop = 0;
  instantane = JSON.stringify(lireFormulaire());
  if (!brouillon.id) f.elements.nom.focus();
}

function ouvrirFicheParId(id) {
  const c = commandes.find((x) => x.id === id);
  if (c) ouvrirFiche(c);
}

function lireFormulaire() {
  const f = formulaire();
  const c = { ...brouillon };
  for (const nom of CHAMPS_TEXTE) c[nom] = f.elements[nom].value.trim();
  c.mode = (f.querySelector('input[name=mode]:checked') || {}).value || 'livraison';
  c.compositions = $$('#liste-compositions .ligne-composition', f)
    .map((l) => ({ nom: l.querySelector('[data-nom]').value.trim(), quantite: l.querySelector('[data-quantite]').value.trim() }))
    .filter((x) => x.nom || x.quantite);
  c.fleursCommande = $$('.ligne-fleur', f)
    .map((l) => ({
      fleur: l.querySelector('[data-fleur]').value.trim(), couleur: l.querySelector('[data-couleur]').value.trim(),
      quantite: l.querySelector('[data-quantite]').value.trim(), unite: l.querySelector('[data-unite]').value,
    }))
    .filter((x) => x.fleur || x.quantite);
  return c;
}

function ficheModifiee() {
  return !$('#fenetre-fiche').hidden && JSON.stringify(lireFormulaire()) !== instantane;
}

function fermerFiche(forcer) {
  if (!forcer && ficheModifiee() && !confirm('Vous avez des modifications non enregistrées. Fermer quand même ?')) return;
  $('#fenetre-fiche').hidden = true;
  brouillon = null;
}


function majReste() {
  const f = formulaire();
  const prix = parseFloat(f.elements.prix.value);
  const acompte = parseFloat(f.elements.acompte.value) || 0;
  $('#reste-a-payer').textContent = isNaN(prix) ? '–' : euros(prix - acompte);
}

function afficherCompositions() {
  const liste = $('#liste-compositions');
  liste.innerHTML = '';
  for (const comp of brouillon.compositions) ajouterLigneComposition(comp);
}

function ajouterLigneComposition(comp = { nom: '', quantite: '' }) {
  const ligne = document.createElement('div');
  ligne.className = 'ligne-composition';
  ligne.innerHTML = `
    <input data-nom list="suggestions-compositions" placeholder="Bouquet, centre de table, arche…" aria-label="Composition">
    <input data-quantite type="number" min="0" step="1" inputmode="numeric" placeholder="Qté" aria-label="Quantité">
    <button type="button" aria-label="Retirer cette composition" title="Retirer"><svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
  ligne.querySelector('[data-nom]').value = comp.nom || '';
  ligne.querySelector('[data-quantite]').value = comp.quantite || '';
  ligne.querySelector('button').onclick = () => ligne.remove();
  $('#liste-compositions').appendChild(ligne);
  return ligne;
}

function ajouterLigneFleur(fl = { fleur: '', couleur: '', quantite: '', unite: 'tiges' }) {
  const ligne = document.createElement('div');
  ligne.className = 'ligne-composition ligne-fleur';
  ligne.innerHTML = `
    <input data-fleur list="suggestions-fleurs" placeholder="Fleur ou feuillage" aria-label="Fleur">
    <input data-couleur placeholder="Couleur" aria-label="Couleur">
    <input data-quantite type="number" min="0" step="1" inputmode="numeric" placeholder="Qté" aria-label="Quantité">
    <select data-unite aria-label="Unité">${UNITES.map((u) => `<option>${u}</option>`).join('')}</select>
    <button type="button" aria-label="Retirer cette fleur" title="Retirer">${'<svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'}</button>`;
  ligne.querySelector('[data-fleur]').value = fl.fleur || '';
  ligne.querySelector('[data-couleur]').value = fl.couleur || '';
  ligne.querySelector('[data-quantite]').value = fl.quantite || '';
  ligne.querySelector('[data-unite]').value = UNITES.includes(fl.unite) ? fl.unite : 'tiges';
  ligne.querySelector('button').onclick = () => ligne.remove();
  $('#liste-fleurs').appendChild(ligne);
  return ligne;
}

function afficherGaleries() {
  for (const galerie of ['inspirations', 'moodboard']) {
    const conteneur = $(`#galerie-${galerie}`);
    conteneur.innerHTML = brouillon[galerie].map((nom, i) => `
      <div class="vignette">
        <img src="${Stockage.urlImage(nom)}" alt="" loading="lazy" data-galerie="${galerie}" data-index="${i}">
        <button type="button" class="retirer" data-galerie="${galerie}" data-index="${i}" title="Retirer cette image" aria-label="Retirer cette image"><svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>`).join('');
  }
}

/* Réduit les photos trop grandes (photos de téléphone) pour gagner de la place. */
function preparerImage(fichier) {
  return new Promise((resolve) => {
    if (!/^image\/(jpeg|png|webp)$/.test(fichier.type)) return resolve(fichier);
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const max = 2000;
      const ratio = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      if (ratio === 1 && fichier.size < 1.5e6) return resolve(fichier);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * ratio);
      canvas.height = Math.round(img.naturalHeight * ratio);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob || fichier), 'image/jpeg', 0.86);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(fichier); };
    img.src = url;
  });
}

async function ajouterImages(galerie, fichiers) {
  const conteneur = $(`#galerie-${galerie}`);
  for (const fichier of fichiers) {
    const attente = document.createElement('div');
    attente.className = 'vignette envoi';
    attente.textContent = 'Envoi…';
    conteneur.appendChild(attente);
    envoisEnCours++;
    try {
      const blob = await preparerImage(fichier);
      const nom = await Stockage.ajouterImage(blob);
      if (brouillon) brouillon[galerie].push(nom);
    } catch (e) {
      alert(`L'image « ${fichier.name} » n'a pas pu être ajoutée : ${e.message}`);
    } finally {
      envoisEnCours--;
      attente.remove();
    }
  }
  if (brouillon) afficherGaleries();
}

async function enregistrerFiche(ev) {
  ev.preventDefault();
  if (envoisEnCours) { messageFlottant('Patientez, les images sont en cours d’envoi…'); return; }
  const f = formulaire();
  const c = lireFormulaire();
  let manque = false;
  for (const nom of ['nom', 'date']) {
    const ok = !!c[nom];
    f.elements[nom].classList.toggle('erreur', !ok);
    if (!ok) manque = true;
  }
  if (manque) { messageFlottant('Merci de remplir le nom du client et la date.'); return; }
  c.id ||= nouvelId();
  const bouton = $('#fiche-enregistrer');
  bouton.disabled = true;
  try {
    await Stockage.enregistrerCommande(c);
    await chargerCommandes();
    fermerFiche(true);
    allerAuMois(dateDepuisCle(c.date), { alerte: cleMois(dateDepuisCle(c.date)) !== cleMois(moisAffiche) });
    messageFlottant('Commande enregistrée');
  } catch (e) {
    alert(e.message);
  } finally {
    bouton.disabled = false;
  }
}

async function supprimerFiche() {
  if (!brouillon || !brouillon.id) return;
  if (!confirm(`Supprimer définitivement la commande de ${nomClient(brouillon)} ?\nCette action ne peut pas être annulée.`)) return;
  try {
    await Stockage.supprimerCommande(brouillon);
    await chargerCommandes();
    fermerFiche(true);
    afficherCalendrier();
    messageFlottant('Commande supprimée');
  } catch (e) {
    alert(e.message);
  }
}

/* ---------- Visionneuse ---------- */

const visionneuse = { liste: [], index: 0 };

function ouvrirVisionneuse(liste, index) {
  visionneuse.liste = liste;
  visionneuse.index = index;
  majVisionneuse();
  $('#visionneuse').hidden = false;
}
function majVisionneuse() {
  const v = $('#visionneuse');
  const n = visionneuse.liste.length;
  $('img', v).src = Stockage.urlImage(visionneuse.liste[visionneuse.index]);
  $('.compteur', v).textContent = n > 1 ? `${visionneuse.index + 1} / ${n}` : '';
  $$('.fleche', v).forEach((b) => { b.hidden = n < 2; });
}
function deplacerVisionneuse(pas) {
  const n = visionneuse.liste.length;
  visionneuse.index = (visionneuse.index + pas + n) % n;
  majVisionneuse();
}

/* ---------- Recherche ---------- */

function sansAccents(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

function rechercher() {
  const q = sansAccents($('#recherche').value.trim());
  const boite = $('#resultats');
  if (!q) { boite.hidden = true; return; }
  const trouves = trier(commandes.filter((c) => sansAccents(`${c.nom} ${c.prenom} ${c.prenom} ${c.nom}`).includes(q))).slice(0, 30);
  boite.innerHTML = trouves.length
    ? trouves.map((c) => `
      <button type="button" class="resultat" data-id="${echapper(c.id)}">
        <i class="pastille t-${typeDe(c)}"></i>
        <span><strong>${echapper(nomClient(c))}</strong> · ${echapper(libelleType(c))}</span>
        <small>${echapper(dateDepuisCle(c.date).toLocaleDateString('fr-FR'))}</small>
      </button>`).join('')
    : '<div class="vide">Aucun client trouvé.</div>';
  boite.hidden = false;
}

/* ---------- Sauvegarde ---------- */

function ouvrirSauvegarde() {
  $('#fenetre-sauvegarde').hidden = false;
}

async function exporter() {
  const bouton = $('#btn-exporter');
  bouton.disabled = true;
  try {
    const donnees = await Stockage.exporter();
    const blob = new Blob([JSON.stringify(donnees)], { type: 'application/json' });
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(blob);
    lien.download = `sauvegarde-calendrier-${cleDate(new Date())}.json`;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(lien.href), 60000);
    messageFlottant('Sauvegarde téléchargée dans le dossier Téléchargements');
    majRappelSauvegarde();
  } catch (e) {
    alert('La sauvegarde a échoué : ' + e.message);
  } finally {
    bouton.disabled = false;
  }
}

async function majRappelSauvegarde() {
  const derniere = await Stockage.derniereSauvegarde();
  const jours = derniere ? Math.floor((Date.now() - new Date(derniere).getTime()) / 86400000) : null;
  $('#etat-sauvegarde').textContent = derniere
    ? `Dernière sauvegarde le ${new Date(derniere).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}.`
    : 'Aucune sauvegarde pour le moment.';
  const besoin = commandes.length > 0 && (jours === null || jours >= 7);
  $('#rappel-sauvegarde').hidden = !besoin;
  $('#point-sauvegarde').hidden = !besoin;
  $('#point-menu').hidden = !besoin;
  $('#rappel-sauvegarde').textContent = jours === null ? 'Aucune sauvegarde : en faire une' : `Dernière sauvegarde il y a ${jours} jours`;
}

async function importer(fichier) {
  if (!fichier) return;
  if (!confirm(`Restaurer la sauvegarde « ${fichier.name} » ?\nToutes les commandes actuelles seront remplacées par celles de ce fichier.`)) return;
  try {
    const nombre = await Stockage.importer(await fichier.text());
    await chargerCommandes();
    await chargerTypes();
    $('#fenetre-sauvegarde').hidden = true;
    allerAuMois(moisAffiche, { alerte: false });
    messageFlottant(`Sauvegarde restaurée : ${nombre} commande${nombre > 1 ? 's' : ''}`);
  } catch (e) {
    alert(e.message);
  }
}

/* ---------- Évènements ---------- */

function appliquerTypes() {
  let style = $('#styles-types');
  if (!style) { style = document.createElement('style'); style.id = 'styles-types'; document.head.appendChild(style); }
  style.textContent = types.map((t) => `.t-${t.id}{--fond:${couleurPale(t.couleur)};--trait-type:${t.couleur};}`).join('\n');
  const select = $('#choix-type');
  const valeur = select.value;
  select.innerHTML = types.map((t) => `<option value="${echapper(t.id)}">${echapper(t.nom)}</option>`).join('');
  if (valeur && types.some((t) => t.id === valeur)) select.value = valeur;
  $('#legende').innerHTML = types.map((t) => `<span class="t-${t.id}"><i class="pastille"></i>${echapper(t.nom)}</span>`).join('');
}

async function chargerTypes() {
  const enregistres = await Stockage.lireTypes();
  if (Array.isArray(enregistres) && enregistres.length) {
    types = enregistres;
  } else {
    // Anciennes versions : « Fiançailles » n'existe plus ; on garde les types par défaut.
    types = structuredClone(TYPES_PAR_DEFAUT);
  }
  if (!types.some((t) => t.id === 'autre')) types.push(structuredClone(TYPES_PAR_DEFAUT.find((t) => t.id === 'autre')));
  appliquerTypes();
}

async function enregistrerTypes() {
  await Stockage.ecrireTypes(types);
  appliquerTypes();
  afficherCalendrier();
}

function afficherGestionTypes() {
  $('#liste-types').innerHTML = types.map((t) => {
    const nb = commandes.filter((c) => typeDe(c) === t.id).length;
    return `
    <div class="ligne-type" data-id="${echapper(t.id)}">
      <input type="color" value="${echapper(t.couleur)}" data-champ="couleur" aria-label="Couleur de ${echapper(t.nom)}">
      <input value="${echapper(t.nom)}" data-champ="nom" aria-label="Nom du type">
      <span class="nb-type">${nb} commande${nb > 1 ? 's' : ''}</span>
      ${t.id === 'autre' ? '<span class="supprimer-type"></span>' : `<button type="button" class="supprimer-type" title="Supprimer ce type" aria-label="Supprimer ce type">${'<svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'}</button>`}
    </div>`;
  }).join('');
}

async function supprimerType(id) {
  const t = types.find((x) => x.id === id);
  if (!t) return;
  const concernees = commandes.filter((c) => c.type === id);
  const msg = concernees.length
    ? `Supprimer le type « ${t.nom} » ?\nLes ${concernees.length} commande(s) de ce type passeront en « Autre » (le nom « ${t.nom} » sera gardé en précision).`
    : `Supprimer le type « ${t.nom} » ?`;
  if (!confirm(msg)) return;
  for (const c of concernees) {
    await Stockage.enregistrerCommande({ ...c, type: 'autre', typePrecision: c.typePrecision ? `${t.nom} · ${c.typePrecision}` : t.nom });
  }
  types = types.filter((x) => x.id !== id);
  await chargerCommandes();
  await enregistrerTypes();
  afficherGestionTypes();
}

/* ---------- Menu latéral ---------- */

function ouvrirMenu() {
  $('#menu').hidden = false;
  $('#fond-menu').hidden = false;
  $('#btn-menu').setAttribute('aria-expanded', 'true');
}
function fermerMenu() {
  $('#menu').hidden = true;
  $('#fond-menu').hidden = true;
  $('#btn-menu').setAttribute('aria-expanded', 'false');
}

/* ---------- Impression ---------- */

function imprimer(html) {
  const zone = $('#zone-impression');
  zone.innerHTML = html;
  const images = $$('img', zone);
  Promise.all(images.map((i) => (i.complete ? null : new Promise((r) => { i.onload = r; i.onerror = r; })))).then(() => {
    window.print();
  });
}
window.addEventListener('afterprint', () => { $('#zone-impression').innerHTML = ''; });

function enteteImpression(titre, sousTitre) {
  return `<div class="imp-entete">
      <div><div class="imp-marque">ARROSÉ</div><div class="imp-sous-marque">La cave fleurie</div></div>
      <div class="imp-titre"><h1>${echapper(titre)}</h1>${sousTitre ? `<p>${echapper(sousTitre)}</p>` : ''}</div>
    </div>`;
}

function texteMultiligne(t) { return echapper(t).replace(/\n/g, '<br>'); }

function imprimerFiche() {
  const c = lireFormulaire();
  const ligne = (libelle, valeur) => (valeur ? `<tr><th>${libelle}</th><td>${valeur}</td></tr>` : '');
  const compositions = c.compositions.length
    ? `<table class="imp-tableau"><thead><tr><th>Composition</th><th class="nb">Quantité</th></tr></thead><tbody>${c.compositions.map((x) => `<tr><td>${echapper(x.nom)}</td><td class="nb">${echapper(x.quantite)}</td></tr>`).join('')}</tbody></table>`
    : '<p class="imp-vide">Aucune composition renseignée.</p>';
  const fleurs = c.fleursCommande.length
    ? `<table class="imp-tableau"><thead><tr><th>Fleur</th><th>Couleur</th><th class="nb">Quantité</th></tr></thead><tbody>${c.fleursCommande.map((x) => `<tr><td>${echapper(x.fleur)}</td><td>${echapper(x.couleur)}</td><td class="nb">${echapper(x.quantite)} ${echapper(x.unite)}</td></tr>`).join('')}</tbody></table>`
    : '';
  const images = c.moodboard.slice(0, 6);
  const html = `<div class="imp-page">
    ${enteteImpression('Fiche atelier', `Imprimée le ${new Date().toLocaleDateString('fr-FR')}`)}
    <div class="imp-client">${echapper(nomClient(c))}</div>
    <div class="imp-evenement"><span class="imp-type t-${typeDe(c)}">${echapper(libelleType(c))}</span>
      ${echapper(c.date ? dateLongue(c.date) : '')}${c.heure ? ` à ${echapper(c.heure)}` : ''}</div>
    <div class="imp-colonnes">
      <table class="imp-infos">
        ${ligne('Téléphone', echapper(c.telephone))}
        ${ligne('E-mail', echapper(c.email))}
        ${ligne('Lieu', echapper(c.lieu))}
        ${ligne('Remise', c.mode === 'retrait' ? 'Retrait en magasin' : 'Livraison')}
        ${ligne('Statut', echapper(STATUTS[c.statut] || ''))}
      </table>
      <table class="imp-infos">
        ${ligne('Fleurs', echapper(c.fleurs))}
        ${ligne('Couleurs', echapper(c.couleurs))}
        ${ligne('Demande', texteMultiligne(c.description))}
      </table>
    </div>
    <h2>Compositions</h2>${compositions}
    ${fleurs ? `<h2>Fleurs à commander</h2>${fleurs}` : ''}
    ${images.length ? `<h2>Moodboard</h2><div class="imp-galerie">${images.map((n) => `<img src="${Stockage.urlImage(n)}" alt="">`).join('')}</div>` : ''}
    ${c.moodboardNotes ? `<h2>Notes du moodboard</h2><p>${texteMultiligne(c.moodboardNotes)}</p>` : ''}
    ${c.notesInternes ? `<h2>Notes internes</h2><p>${texteMultiligne(c.notesInternes)}</p>` : ''}
  </div>`;
  imprimer(html);
}

/* ---------- Fleurs à commander pour la semaine ---------- */

let debutSemaine = null;

function lundiDe(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
function ajouterJours(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function majuscule(t) { t = String(t || '').trim(); return t.charAt(0).toUpperCase() + t.slice(1); }
function normaliser(t) { return sansAccents(t).replace(/\s+/g, ' ').trim(); }

function calculerFleursSemaine() {
  const fin = ajouterJours(debutSemaine, 6);
  const de = cleDate(debutSemaine), a = cleDate(fin);
  const liste = trier(commandes.filter((c) => c.date >= de && c.date <= a && c.statut !== 'annulee' && c.statut !== 'livree'));
  const groupes = new Map();
  const sansDetail = [];
  for (const c of liste) {
    const fl = (c.fleursCommande || []).filter((x) => x.fleur);
    if (!fl.length) { sansDetail.push(c); continue; }
    for (const x of fl) {
      const unite = UNITES.includes(x.unite) ? x.unite : 'tiges';
      const cle = `${normaliser(x.fleur)}|${normaliser(x.couleur)}|${unite}`;
      if (!groupes.has(cle)) groupes.set(cle, { fleur: majuscule(x.fleur), couleur: majuscule(x.couleur), unite, total: 0, pour: [] });
      const g = groupes.get(cle);
      const q = parseFloat(String(x.quantite).replace(',', '.')) || 0;
      g.total += q;
      g.pour.push(`${nomClient(c)} (${q}${c.statut === 'devis' ? ', devis' : ''})`);
    }
  }
  const lignes = [...groupes.values()].sort((x, y) => normaliser(x.fleur).localeCompare(normaliser(y.fleur)) || normaliser(x.couleur).localeCompare(normaliser(y.couleur)));
  return { liste, lignes, sansDetail, fin };
}

function htmlFleursSemaine(r) {
  const tableau = r.lignes.length
    ? `<table class="tableau tableau-simple"><thead><tr><th>Fleur</th><th>Couleur</th><th class="nb">Total</th><th>Pour</th></tr></thead><tbody>
        ${r.lignes.map((g) => `<tr><td><strong>${echapper(g.fleur)}</strong></td><td>${echapper(g.couleur)}</td><td class="nb"><strong>${g.total}</strong> ${g.unite}</td><td class="pour">${echapper(g.pour.join(', '))}</td></tr>`).join('')}
      </tbody></table>`
    : '<p class="vide-liste">Aucune fleur détaillée pour cette semaine.</p>';
  const sans = r.sansDetail.length
    ? `<h3 class="titre-section">À préciser (pas de liste de fleurs dans la fiche)</h3>
       <ul class="liste-simple">${r.sansDetail.map((c) => `<li data-id="${echapper(c.id)}"><strong>${echapper(nomClient(c))}</strong> · ${echapper(dateCourte(c.date))} · ${echapper(libelleType(c))}${c.fleurs ? ` — <em>${echapper(c.fleurs)}</em>` : ''}</li>`).join('')}</ul>`
    : '';
  return tableau + sans;
}

function afficherFleurs() {
  const r = calculerFleursSemaine();
  const titre = `Semaine du ${dateLongue(cleDate(debutSemaine))} au ${dateLongue(cleDate(r.fin))}`;
  $('#semaine-fleurs').textContent = `${titre} · ${r.liste.length} commande${r.liste.length > 1 ? 's' : ''} (hors annulées et livrées)`;
  $('#contenu-fleurs').innerHTML = r.liste.length ? htmlFleursSemaine(r) : '<p class="vide-liste">Aucune commande cette semaine.</p>';
  $('#fenetre-fleurs').hidden = false;
}

function ouvrirFleurs() {
  // Par défaut : la semaine prochaine (c'est celle qu'on commande chez le grossiste).
  const auj = new Date();
  debutSemaine = lundiDe(auj.getDay() >= 1 && auj.getDay() <= 3 ? auj : ajouterJours(lundiDe(auj), 7));
  afficherFleurs();
}

function imprimerFleurs() {
  const r = calculerFleursSemaine();
  imprimer(`<div class="imp-page">
    ${enteteImpression('Fleurs à commander', `Semaine du ${dateLongue(cleDate(debutSemaine))} au ${dateLongue(cleDate(r.fin))}`)}
    ${r.liste.length ? htmlFleursSemaine(r) : '<p>Aucune commande cette semaine.</p>'}
  </div>`);
}

function brancher() {
  appliquerTypes();
  $('#btn-menu').onclick = ouvrirMenu;
  $('#menu-fermer').onclick = fermerMenu;
  $('#fond-menu').onclick = fermerMenu;
  $('#menu').addEventListener('click', (e) => { if (e.target.closest('.menu-lien')) fermerMenu(); });
  $('#btn-types').onclick = () => { afficherGestionTypes(); $('#fenetre-types').hidden = false; };
  $('#btn-fleurs').onclick = ouvrirFleurs;
  $('#semaine-precedente').onclick = () => { debutSemaine = ajouterJours(debutSemaine, -7); afficherFleurs(); };
  $('#semaine-suivante').onclick = () => { debutSemaine = ajouterJours(debutSemaine, 7); afficherFleurs(); };
  $('#imprimer-fleurs').onclick = imprimerFleurs;
  $('#contenu-fleurs').addEventListener('click', (e) => {
    const li = e.target.closest('li[data-id]');
    if (li) { $('#fenetre-fleurs').hidden = true; ouvrirFicheParId(li.dataset.id); }
  });
  $('#fiche-imprimer').onclick = imprimerFiche;
  $('#ajouter-fleur').onclick = () => ajouterLigneFleur().querySelector('input').focus();
  $('#liste-types').addEventListener('change', async (e) => {
    const ligne = e.target.closest('.ligne-type');
    const t = ligne && types.find((x) => x.id === ligne.dataset.id);
    if (!t) return;
    const valeur = e.target.value.trim();
    if (e.target.dataset.champ === 'nom') { if (!valeur) { e.target.value = t.nom; return; } t.nom = valeur; }
    if (e.target.dataset.champ === 'couleur') t.couleur = valeur;
    await enregistrerTypes();
    messageFlottant('Type enregistré');
  });
  $('#liste-types').addEventListener('click', (e) => {
    const b = e.target.closest('button.supprimer-type');
    if (b) supprimerType(b.closest('.ligne-type').dataset.id);
  });
  $('#form-type').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nom = $('#nouveau-type-nom').value.trim();
    if (!nom) { $('#nouveau-type-nom').focus(); return; }
    if (types.some((t) => normaliser(t.nom) === normaliser(nom))) { messageFlottant('Ce type existe déjà'); return; }
    const autre = types.findIndex((t) => t.id === 'autre');
    types.splice(autre >= 0 ? autre : types.length, 0, { id: 't' + Date.now().toString(36), nom, couleur: $('#nouveau-type-couleur').value });
    await enregistrerTypes();
    $('#nouveau-type-nom').value = '';
    afficherGestionTypes();
    messageFlottant(`Type « ${nom} » ajouté`);
  });
  $('#mois-precedent').onclick = () => allerAuMois(new Date(moisAffiche.getFullYear(), moisAffiche.getMonth() - 1, 1));
  $('#mois-suivant').onclick = () => allerAuMois(new Date(moisAffiche.getFullYear(), moisAffiche.getMonth() + 1, 1));
  $('#btn-aujourdhui').onclick = () => {
    const meme = cleMois(moisAffiche) === cleMois(new Date());
    allerAuMois(new Date(), { alerte: !meme });
  };
  $('#btn-commandes-mois').onclick = () => afficherAlerteMois(true);
  $('#btn-nouvelle').onclick = () => {
    const auj = new Date();
    const date = cleMois(auj) === cleMois(moisAffiche) ? cleDate(auj) : cleDate(moisAffiche);
    ouvrirFiche(commandeVide(date));
  };
  $('#btn-reglages').onclick = ouvrirSauvegarde;
  $('#btn-exporter').onclick = exporter;
  $('#rappel-sauvegarde').onclick = ouvrirSauvegarde;
  $('#liste-nouvelle').onclick = () => ouvrirFiche(commandeVide($('#liste-nouvelle').dataset.date));
  let minuteurTaille;
  window.addEventListener('resize', () => { clearTimeout(minuteurTaille); minuteurTaille = setTimeout(ajusterDebordements, 120); });

  $('#grille').addEventListener('click', (e) => {
    const puce = e.target.closest('.puce');
    if (puce) return ouvrirFicheParId(puce.dataset.id);
    const plus = e.target.closest('.plus');
    if (plus) return afficherJour(plus.closest('.jour').dataset.date);
    const jour = e.target.closest('.jour');
    if (jour) ouvrirFiche(commandeVide(jour.dataset.date));
  });

  // Fenêtres simples : fermeture par le bouton, par un clic à côté
  for (const id of ['fenetre-mois', 'fenetre-sauvegarde', 'fenetre-types', 'fenetre-fleurs']) {
    const fond = $('#' + id);
    fond.addEventListener('click', (e) => { if (e.target === fond || e.target.closest('[data-fermer]')) fond.hidden = true; });
  }
  $('#liste-alerte').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (tr) ouvrirFicheParId(tr.dataset.id);
  });
  $('#liste-alerte').addEventListener('keydown', (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (tr && e.key === 'Enter') ouvrirFicheParId(tr.dataset.id);
  });

  // Fiche
  const f = formulaire();
  f.addEventListener('submit', enregistrerFiche);
  $('#fiche-fermer').onclick = () => fermerFiche(false);
  $('#fiche-annuler').onclick = () => fermerFiche(false);
  $('#fiche-supprimer').onclick = supprimerFiche;
  $('#fenetre-fiche').addEventListener('mousedown', (e) => { if (e.target.id === 'fenetre-fiche') fermerFiche(false); });
  f.elements.prix.addEventListener('input', majReste);
  f.elements.acompte.addEventListener('input', majReste);
  $('#ajouter-composition').onclick = () => ajouterLigneComposition().querySelector('input').focus();
  for (const input of $$('input[type=file][data-galerie]', f)) {
    input.addEventListener('change', () => {
      ajouterImages(input.dataset.galerie, [...input.files]);
      input.value = '';
    });
  }
  f.addEventListener('click', (e) => {
    const img = e.target.closest('.vignette img');
    if (img) return ouvrirVisionneuse(brouillon[img.dataset.galerie], Number(img.dataset.index));
    const retirer = e.target.closest('.retirer');
    if (retirer) {
      brouillon[retirer.dataset.galerie].splice(Number(retirer.dataset.index), 1);
      afficherGaleries();
    }
  });

  // Visionneuse
  const v = $('#visionneuse');
  v.addEventListener('click', (e) => {
    if (e.target.closest('.fleche-gauche')) return deplacerVisionneuse(-1);
    if (e.target.closest('.fleche-droite')) return deplacerVisionneuse(1);
    if (e.target.tagName !== 'IMG') v.hidden = true;
  });
  let departX = null;
  v.addEventListener('touchstart', (e) => { departX = e.touches[0].clientX; }, { passive: true });
  v.addEventListener('touchend', (e) => {
    if (departX === null) return;
    const dx = e.changedTouches[0].clientX - departX;
    if (Math.abs(dx) > 50) deplacerVisionneuse(dx < 0 ? 1 : -1);
    departX = null;
  });

  // Recherche
  const r = $('#recherche');
  r.addEventListener('input', rechercher);
  r.addEventListener('focus', rechercher);
  $('#resultats').addEventListener('click', (e) => {
    const b = e.target.closest('.resultat');
    if (!b) return;
    const c = commandes.find((x) => x.id === b.dataset.id);
    $('#resultats').hidden = true;
    r.value = '';
    if (c) { allerAuMois(dateDepuisCle(c.date), { alerte: false }); ouvrirFiche(c); }
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.recherche')) $('#resultats').hidden = true; });

  // Import
  $('#fichier-import').addEventListener('change', (e) => { importer(e.target.files[0]); e.target.value = ''; });

  // Clavier
  document.addEventListener('keydown', (e) => {
    if (!v.hidden) {
      if (e.key === 'Escape') v.hidden = true;
      if (e.key === 'ArrowLeft') deplacerVisionneuse(-1);
      if (e.key === 'ArrowRight') deplacerVisionneuse(1);
      return;
    }
    if (e.key !== 'Escape') return;
    if (!$('#menu').hidden) return fermerMenu();
    if (!$('#fenetre-fiche').hidden) return fermerFiche(false);
    for (const id of ['fenetre-mois', 'fenetre-sauvegarde', 'fenetre-types', 'fenetre-fleurs']) $('#' + id).hidden = true;
    $('#resultats').hidden = true;
  });

  window.addEventListener('beforeunload', (e) => { if (ficheModifiee()) { e.preventDefault(); e.returnValue = ''; } });
}

/* Complète les commandes d'exemple déjà installées par une version précédente. */
async function mettreAJourExemples() {
  if (!window.EXEMPLES) return;
  let modifie = false;
  for (const ex of window.EXEMPLES.commandes) {
    const c = commandes.find((x) => x.id === ex.id);
    if (!c) continue;
    const maj = { ...c };
    if (!c.fleursCommande && ex.fleursCommande) maj.fleursCommande = ex.fleursCommande;
    if (c.id === 'exemple-anniversaire' && c.type === 'autre') { maj.type = ex.type; maj.typePrecision = ex.typePrecision; }
    if (JSON.stringify(maj) !== JSON.stringify(c)) { await Stockage.enregistrerCommande(maj); modifie = true; }
  }
  if (modifie) await chargerCommandes();
}

async function demarrer() {
  brancher();
  try {
    await Stockage.demarrer();
    await chargerTypes();
    await chargerCommandes();
    await mettreAJourExemples();
    await Stockage.nettoyerImages(commandes);
  } catch (e) {
    alert(e.message);
  }
  allerAuMois(new Date());
  majRappelSauvegarde();
}

demarrer();
