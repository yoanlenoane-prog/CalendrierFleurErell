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
/* Étapes de suivi. L'étape 3 (retour du client sur le moodboard) a deux choix : accepté ou à modifier. */
const ETAPES = [
  { id: 'rdv', nom: 'Premier rendez-vous', fait: 'Rendez-vous fait le' },
  { id: 'moodboard', nom: 'Moodboard envoyé', fait: 'Moodboard envoyé le' },
  { id: 'avis', nom: 'Moodboard accepté ou à modifier', avis: true },
  { id: 'devis', nom: 'Devis envoyé', fait: 'Devis envoyé le' },
  { id: 'validation', nom: 'Devis validé par le client', fait: 'Devis validé le' },
];
const ETAPES_SIMPLES = ETAPES.filter((e) => !e.avis);
const ETAPES_VIDES = { rdv: '', moodboard: '', moodboardAccepte: '', moodboardAModifier: '', devis: '', validation: '' };
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
  return `${JOURS[d.getDay()].slice(0, 3)}. ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
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
    type: 'mariage', typePrecision: '', date: date || cleDate(new Date()), heure: '', dateInstallation: '', heureInstallation: '', lieu: '', mode: 'livraison',
    description: '', fleurs: '', couleurs: '', compositions: [], fleursCommande: [],
    inspirations: [], moodboard: [], moodboardNotes: '',
    statut: 'devis', prix: '', acompte: '', notesInternes: '',
    etapes: { ...ETAPES_VIDES },
  };
}

const CHAMPS_TEXTE = ['nom', 'prenom', 'telephone', 'email', 'type', 'typePrecision', 'date', 'heure', 'dateInstallation', 'heureInstallation', 'lieu',
  'description', 'fleurs', 'couleurs', 'moodboardNotes', 'statut', 'prix', 'acompte', 'notesInternes'];

function ouvrirFiche(commande) {
  brouillon = structuredClone(commande);
  brouillon.compositions ||= [];
  brouillon.fleursCommande ||= [];
  brouillon.inspirations ||= [];
  brouillon.moodboard ||= [];
  brouillon.etapes = { ...ETAPES_VIDES, ...(brouillon.etapes || {}) };
  const f = formulaire();
  afficherEtapes(brouillon.etapes);
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
  afficherOnglet('demande');
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
  c.etapes = lireEtapes();
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

function estPdf(nom) { return /\.pdf$/i.test(nom); }
function titrePdf(nom) {
  const m = /^doc_[a-z0-9]+_[a-z0-9]+_(.+)\.pdf$/i.exec(nom);
  return (m ? m[1].replace(/-/g, ' ') : 'Document') + '.pdf';
}
const ICONE_PDF = '<svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>';

function afficherGaleries() {
  for (const galerie of ['inspirations', 'moodboard']) {
    const conteneur = $(`#galerie-${galerie}`);
    conteneur.innerHTML = brouillon[galerie].map((nom, i) => `
      <div class="vignette${estPdf(nom) ? ' vignette-pdf' : ''}">
        ${estPdf(nom)
    ? `<a href="${Stockage.urlImage(nom)}" target="_blank" rel="noopener" title="Ouvrir le PDF" data-pdf>${ICONE_PDF}<span class="pdf-marque">PDF</span><span class="pdf-nom">${echapper(titrePdf(nom))}</span><span class="pdf-ouvrir">Ouvrir</span></a>`
    : `<img src="${Stockage.urlImage(nom)}" alt="" data-galerie="${galerie}" data-index="${i}">`}
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
      const nom = await Stockage.ajouterImage(blob, fichier.name);
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
  if (manque) { afficherOnglet('demande'); messageFlottant('Merci de remplir le nom du client et la date.'); return; }
  c.id ||= nouvelId();
  const bouton = $('#fiche-enregistrer');
  bouton.disabled = true;
  try {
    await Stockage.enregistrerCommande(c);
    await chargerCommandes();
    fermerFiche(true);
    allerAuMois(dateDepuisCle(c.date), { alerte: !tachesOuvertes() && cleMois(dateDepuisCle(c.date)) !== cleMois(moisAffiche) });
    if (tachesOuvertes()) afficherTaches();
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
    if (tachesOuvertes()) afficherTaches();
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
  const synchro = Drive.connecte() && Drive.derniereSynchro() && Date.now() - new Date(Drive.derniereSynchro()).getTime() < 3 * 864e5;
  const besoin = commandes.length > 0 && (jours === null || jours >= 14) && !synchro;
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

/* ---------- Google Drive ---------- */

function quand(iso) {
  const d = new Date(iso);
  const memeJour = cleDate(d) === cleDate(new Date());
  const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return memeJour ? `aujourd'hui à ${heure}` : `le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} à ${heure}`;
}

function majDrive() {
  const e = Drive.etat();
  const derniere = Drive.derniereSynchro();
  const pastille = $('#pastille-drive');
  const libelles = { synchro: 'Envoi vers Drive…', ok: 'Enregistré dans Drive', horsligne: 'Hors connexion', reconnecter: 'Reconnecter Google Drive', erreur: 'Problème Google Drive' };
  pastille.hidden = !libelles[e];
  pastille.className = 'pastille-drive etat-' + e;
  $('.pastille-texte', pastille).textContent = libelles[e] || '';
  pastille.title = e === 'ok' && derniere ? `Dernier envoi ${quand(derniere)}` : (e === 'erreur' ? Drive.detail() : (libelles[e] || ''));

  const textes = {
    indisponible: 'La sauvegarde dans Google Drive fonctionne avec la version en ligne du calendrier (adresse internet), pas avec le fichier ouvert depuis l’ordinateur.',
    deconnecte: `Connectez le compte Google de la boutique : vos commandes, réglages, photos et PDF seront recopiés automatiquement dans le dossier <strong>${echapper(Drive.nomDossier())}</strong> de son Google Drive, quelques secondes après chaque modification.`,
    reconnecter: 'Google demande de vous reconnecter. Vos modifications sont gardées sur cet ordinateur : cliquez sur « Se reconnecter » pour les envoyer.',
    horsligne: 'Pas de connexion internet. Vos modifications sont gardées sur cet ordinateur et partiront dans Google Drive au retour du réseau.',
    synchro: `Envoi en cours vers le dossier <strong>${echapper(Drive.nomDossier())}</strong> de Google Drive…`,
    ok: `Tout est enregistré dans le dossier <strong>${echapper(Drive.nomDossier())}</strong> de Google Drive${derniere ? ` (dernier envoi ${quand(derniere)})` : ''}. Chaque modification y est envoyée automatiquement.`,
    erreur: `L’envoi vers Google Drive n’a pas abouti : ${echapper(Drive.detail())}. Vos modifications sont gardées sur cet ordinateur ; un nouvel essai aura lieu dans quelques minutes.`,
  };
  $('#info-drive').innerHTML = textes[e] || '';
  const connecter = $('#btn-drive-connecter');
  connecter.hidden = !(e === 'deconnecte' || e === 'reconnecter');
  connecter.textContent = e === 'reconnecter' ? 'Se reconnecter' : 'Se connecter avec Google';
  $('#btn-drive-synchro').hidden = !(e === 'ok' || e === 'erreur' || e === 'horsligne');
  $('#btn-drive-deconnecter').hidden = !Drive.connecte() || e === 'indisponible';
}

async function connecterDrive() {
  const bouton = $('#btn-drive-connecter');
  bouton.disabled = true;
  try {
    await Drive.connecter();
    if (Drive.etat() === 'ok') messageFlottant('Commandes enregistrées dans Google Drive');
  } catch (e) {
    alert('La connexion à Google n’a pas abouti. Réessayez, et acceptez l’accès dans la fenêtre Google.\n(détail : ' + e.message + ')');
  } finally {
    bouton.disabled = false;
  }
}

function deconnecterDrive() {
  if (!confirm('Arrêter l’envoi automatique vers Google Drive ?\nLes commandes restent sur cet ordinateur et le dossier du Drive n’est pas effacé.')) return;
  Drive.deconnecter();
  majRappelSauvegarde();
}

/* Des commandes ont été modifiées sur un autre ordinateur : on rafraîchit l'affichage. */
async function apresChangementDistant() {
  await chargerTypes();
  await chargerCommandes();
  if (!$('#page-taches').hidden) afficherTaches();
  allerAuMois(moisAffiche, { alerte: false });
  majRappelSauvegarde();
}

let driveDemarre = false;
function demarrerDrive() {
  if (driveDemarre) return;
  driveDemarre = true;
  Drive.surEtat(() => { majDrive(); majRappelSauvegarde(); });
  Drive.surChangementDistant(apresChangementDistant);
  Stockage.surModification(() => Drive.planifier());
  $('#btn-drive-connecter').onclick = connecterDrive;
  $('#btn-drive-synchro').onclick = () => Drive.synchroniserMaintenant();
  $('#btn-drive-deconnecter').onclick = deconnecterDrive;
  $('#pastille-drive').onclick = () => (Drive.etat() === 'reconnecter' ? connecterDrive() : ouvrirSauvegarde());
  Drive.demarrer();
  majDrive();
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
  $('#liste-types').innerHTML = types.map((t) => `
    <div class="ligne-type" data-id="${echapper(t.id)}">
      <input type="color" value="${echapper(t.couleur)}" data-champ="couleur" aria-label="Couleur de ${echapper(t.nom)}">
      <input value="${echapper(t.nom)}" data-champ="nom" aria-label="Nom du type">
      ${t.id === 'autre' ? '<span class="supprimer-type"></span>' : '<button type="button" class="supprimer-type" title="Supprimer ce type" aria-label="Supprimer ce type"><svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>'}
    </div>`).join('');
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

/* Date d'installation : celle saisie, sinon le jour de l'évènement. */
function dateInstallation(c) { return c.dateInstallation || c.date; }
function heureInstallation(c) { return c.dateInstallation ? c.heureInstallation : (c.heureInstallation || c.heure); }
function texteInstallation(c) {
  const h = heureInstallation(c);
  return dateInstallation(c) ? `${dateLongue(dateInstallation(c))}${h ? ' à ' + h : ''}` : '';
}

function enTeteClient(c) {
  return `<div class="imp-client">${echapper(nomClient(c))}</div>
    <div class="imp-evenement"><span class="imp-type t-${typeDe(c)}">${echapper(libelleType(c))}</span>
      ${echapper(c.date ? dateLongue(c.date) : '')}${c.heure ? ` à ${echapper(c.heure)}` : ''}${c.lieu ? ` · ${echapper(c.lieu)}` : ''}</div>`;
}
const ligneInfo = (libelle, valeur) => (valeur ? `<tr><th>${libelle}</th><td>${valeur}</td></tr>` : '');
const dateImpression = () => `Imprimée le ${new Date().toLocaleDateString('fr-FR')}`;

function tableauCompositions(c) {
  return c.compositions.length
    ? `<table class="imp-tableau"><thead><tr><th>Composition</th><th class="nb">Quantité</th></tr></thead><tbody>${c.compositions.map((x) => `<tr><td>${echapper(x.nom)}</td><td class="nb">${echapper(x.quantite)}</td></tr>`).join('')}</tbody></table>`
    : '<p class="imp-vide">Aucune composition renseignée.</p>';
}

function imprimerDemande(c) {
  const reste = parseFloat(c.prix) ? euros((parseFloat(c.prix) || 0) - (parseFloat(c.acompte) || 0)) : '';
  const inspirations = c.inspirations.slice(0, 6);
  return `<div class="imp-page">
    ${enteteImpression('Demande client', dateImpression())}
    ${enTeteClient(c)}
    <div class="imp-colonnes">
      <table class="imp-infos">
        ${ligneInfo('Téléphone', echapper(c.telephone))}
        ${ligneInfo('E-mail', echapper(c.email))}
        ${ligneInfo('Lieu', echapper(c.lieu))}
        ${ligneInfo('Installation', echapper(texteInstallation(c)))}
        ${ligneInfo('Remise', c.mode === 'retrait' ? 'Retrait en magasin' : 'Livraison')}
      </table>
      <table class="imp-infos">
        ${ligneInfo('Statut', echapper(STATUTS[c.statut] || ''))}
        ${ETAPES.map((e, i) => ligneInfo(`${i + 1}. ${e.avis ? 'Retour sur le moodboard' : e.nom}`, echapper(texteEtape(e, c.etapes || {})))).join('')}
        ${ligneInfo('Prix', c.prix ? euros(c.prix) : '')}
        ${ligneInfo('Acompte', c.acompte ? euros(c.acompte) : '')}
        ${ligneInfo('Reste à payer', reste)}
      </table>
    </div>
    <h2>Demande</h2>
    <table class="imp-infos">
      ${ligneInfo('Description', texteMultiligne(c.description))}
      ${ligneInfo('Fleurs', echapper(c.fleurs))}
      ${ligneInfo('Couleurs', echapper(c.couleurs))}
    </table>
    <h2>Compositions</h2>${tableauCompositions(c)}
    ${inspirations.length ? `<h2>Photos d'inspiration</h2><div class="imp-galerie imp-galerie-petite">${inspirations.map((n) => `<img src="${Stockage.urlImage(n)}" alt="">`).join('')}</div>` : ''}
    ${c.notesInternes ? `<h2>Notes internes</h2><p>${texteMultiligne(c.notesInternes)}</p>` : ''}
  </div>`;
}

function imprimerMoodboard(c) {
  const images = c.moodboard.filter((n) => !estPdf(n));
  const pdfs = c.moodboard.filter(estPdf);
  return `<div class="imp-page">
    ${enteteImpression('Moodboard', dateImpression())}
    ${enTeteClient(c)}
    ${images.length ? `<div class="imp-galerie imp-galerie-grande">${images.slice(0, 9).map((n) => `<img src="${Stockage.urlImage(n)}" alt="">`).join('')}</div>` : (pdfs.length ? '' : '<p class="imp-vide">Aucune image dans le moodboard.</p>')}
    ${pdfs.length ? `<h2>Documents PDF joints</h2><ul>${pdfs.map((n) => `<li>${echapper(titrePdf(n))}</li>`).join('')}</ul>` : ''}
    ${c.moodboardNotes ? `<h2>Notes</h2><p>${texteMultiligne(c.moodboardNotes)}</p>` : ''}
  </div>`;
}

function imprimerCommande(c) {
  const fleurs = c.fleursCommande.length
    ? `<table class="imp-tableau"><thead><tr><th>Fleur</th><th>Couleur</th><th class="nb">Quantité</th></tr></thead><tbody>${c.fleursCommande.map((x) => `<tr><td>${echapper(majuscule(x.fleur))}</td><td>${echapper(majuscule(x.couleur))}</td><td class="nb">${echapper(x.quantite)} ${echapper(x.unite)}</td></tr>`).join('')}</tbody></table>`
    : '<p class="imp-vide">Aucune fleur renseignée.</p>';
  return `<div class="imp-page">
    ${enteteImpression('Commande fleuriste', dateImpression())}
    ${enTeteClient(c)}
    <h2>Fleurs à commander</h2>${fleurs}
    <h2>Compositions à réaliser</h2>${tableauCompositions(c)}
    ${c.fleurs || c.couleurs ? `<h2>Souhaits du client</h2><table class="imp-infos">${ligneInfo('Fleurs', echapper(c.fleurs))}${ligneInfo('Couleurs', echapper(c.couleurs))}</table>` : ''}
  </div>`;
}

function imprimerFiche() {
  const c = lireFormulaire();
  const html = { demande: imprimerDemande, moodboard: imprimerMoodboard, commande: imprimerCommande }[ongletActif](c);
  imprimer(html);
}

/* ---------- Onglets de la fiche ---------- */

let ongletActif = 'demande';
const LIBELLES_IMPRESSION = { demande: 'Imprimer la demande', moodboard: 'Imprimer le moodboard', commande: 'Imprimer la commande' };

function afficherOnglet(nom) {
  ongletActif = nom;
  for (const b of $$('#fiche .onglet')) {
    const actif = b.dataset.onglet === nom;
    b.classList.toggle('actif', actif);
    b.setAttribute('aria-selected', String(actif));
  }
  for (const p of $$('#fiche .panneau')) p.hidden = p.dataset.panneau !== nom;
  $('#texte-imprimer').textContent = LIBELLES_IMPRESSION[nom];
  $('.fiche-corps').scrollTop = 0;
  if (nom === 'commande') majRappelCommande();
}

function majRappelCommande() {
  const c = lireFormulaire();
  const comp = c.compositions.length
    ? `<ul>${c.compositions.map((x) => `<li><strong>${echapper(x.quantite || '–')}</strong> × ${echapper(x.nom)}</li>`).join('')}</ul>`
    : '<p class="aide">Aucune composition saisie dans la demande client.</p>';
  $('#rappel-commande').innerHTML = `
    <p><span class="etiquette-rappel">Évènement</span>${echapper(libelleType(c))}${c.date ? ` · ${echapper(dateLongue(c.date))}` : ''}</p>
    ${c.fleurs ? `<p><span class="etiquette-rappel">Fleurs souhaitées</span>${echapper(c.fleurs)}</p>` : ''}
    ${c.couleurs ? `<p><span class="etiquette-rappel">Couleurs</span>${echapper(c.couleurs)}</p>` : ''}
    <p><span class="etiquette-rappel">Compositions</span></p>${comp}`;
}

/* ---------- Étapes de suivi (colonne de gauche de la fiche) ---------- */

function texteEtape(e, et) {
  if (e.avis) {
    if (et.moodboardAccepte) return 'Accepté le ' + dateCourte(et.moodboardAccepte);
    if (et.moodboardAModifier) return 'À modifier (demandé le ' + dateCourte(et.moodboardAModifier) + ')';
    return 'À faire';
  }
  return et[e.id] ? 'Fait le ' + dateCourte(et[e.id]) : 'À faire';
}

function afficherEtapes(et) {
  $('#etapes').innerHTML = ETAPES.map((e, i) => e.avis ? `
    <div class="etape etape-avis" data-etape="avis">
      <div class="etape-titre"><span class="case-vide" aria-hidden="true"></span><span class="etape-nom"><span class="etape-num">${i + 1}.</span> Retour du client sur le moodboard</span></div>
      <div class="options-avis">
        <label class="etape-case option-avis"><input type="checkbox" data-avis="accepte"><span>Accepté</span></label>
        <label class="etape-case option-avis"><input type="checkbox" data-avis="modifier"><span>À modifier</span></label>
      </div>
      <div class="etape-etat">
        <span class="etat-a-faire">À faire</span>
        <span class="etat-fait"><span class="etat-mot"></span> le <input type="date" aria-label="Date du retour du client"></span>
        <button type="button" class="btn btn-contour btn-petit" id="moodboard-renvoye">Moodboard renvoyé</button>
      </div>
    </div>` : `
    <div class="etape" data-etape="${e.id}">
      <label class="etape-case"><input type="checkbox"><span class="etape-nom"><span class="etape-num">${i + 1}.</span> ${e.nom}</span></label>
      <div class="etape-etat"><span class="etat-a-faire">À faire</span><span class="etat-fait">Fait le <input type="date" aria-label="Date : ${e.nom}"></span></div>
    </div>`).join('');
  for (const e of ETAPES_SIMPLES) {
    const bloc = $(`#etapes [data-etape=${e.id}]`);
    bloc.querySelector('input[type=checkbox]').checked = !!et[e.id];
    bloc.querySelector('input[type=date]').value = et[e.id] || '';
    majEtape(bloc);
  }
  const avis = $('#etapes [data-etape=avis]');
  avis.querySelector('[data-avis=accepte]').checked = !!et.moodboardAccepte;
  avis.querySelector('[data-avis=modifier]').checked = !et.moodboardAccepte && !!et.moodboardAModifier;
  avis.querySelector('input[type=date]').value = et.moodboardAccepte || et.moodboardAModifier || '';
  majEtape(avis);
}

function majEtape(bloc) {
  if (bloc.dataset.etape === 'avis') {
    const accepte = bloc.querySelector('[data-avis=accepte]').checked;
    const modifier = bloc.querySelector('[data-avis=modifier]').checked;
    bloc.classList.toggle('faite', accepte);
    bloc.classList.toggle('a-modifier', modifier);
    bloc.querySelector('.etat-mot').textContent = accepte ? 'Accepté' : 'À modifier depuis';
    bloc.querySelector('#moodboard-renvoye').hidden = !modifier;
    return;
  }
  bloc.classList.toggle('faite', bloc.querySelector('input[type=checkbox]').checked);
}

function changerEtape(e) {
  const bloc = e.target.closest('.etape');
  if (!bloc || e.target.type !== 'checkbox') return majEtape(bloc);
  const date = bloc.querySelector('input[type=date]');
  if (bloc.dataset.etape === 'avis') {
    // Accepté et À modifier ne peuvent pas être cochés ensemble.
    if (e.target.checked) for (const autre of bloc.querySelectorAll('[data-avis]')) if (autre !== e.target) autre.checked = false;
    date.value = e.target.checked ? cleDate(new Date()) : '';
  } else {
    date.value = e.target.checked ? (date.value || cleDate(new Date())) : '';
    // Devis validé par le client : la commande passe de « Devis » à « Confirmée ».
    const statut = formulaire().elements.statut;
    if (bloc.dataset.etape === 'validation' && e.target.checked && statut.value === 'devis') statut.value = 'confirmee';
  }
  majEtape(bloc);
}

/* « Moodboard renvoyé » : nouvelle date d'envoi, on attend à nouveau le retour du client. */
function moodboardRenvoye() {
  const envoi = $('#etapes [data-etape=moodboard]');
  envoi.querySelector('input[type=checkbox]').checked = true;
  envoi.querySelector('input[type=date]').value = cleDate(new Date());
  majEtape(envoi);
  const avis = $('#etapes [data-etape=avis]');
  for (const c of avis.querySelectorAll('[data-avis]')) c.checked = false;
  avis.querySelector('input[type=date]').value = '';
  majEtape(avis);
  messageFlottant('Moodboard renvoyé aujourd’hui : pensez à enregistrer');
}

function lireEtapes() {
  const et = { ...ETAPES_VIDES };
  for (const e of ETAPES_SIMPLES) {
    const bloc = $(`#etapes [data-etape=${e.id}]`);
    et[e.id] = bloc.querySelector('input[type=checkbox]').checked ? (bloc.querySelector('input[type=date]').value || cleDate(new Date())) : '';
  }
  const avis = $('#etapes [data-etape=avis]');
  const date = avis.querySelector('input[type=date]').value || cleDate(new Date());
  if (avis.querySelector('[data-avis=accepte]').checked) et.moodboardAccepte = date;
  else if (avis.querySelector('[data-avis=modifier]').checked) et.moodboardAModifier = date;
  return et;
}

/* ---------- Liste de tâches (pleine page, en colonnes) ---------- */

const COLONNES_TACHES = [
  { id: 'nouvelles', titre: 'Nouvelles demandes', aide: 'Rendez-vous à fixer avec le client' },
  { id: 'moi', titre: 'À faire', aide: "L'étape suivante est pour vous" },
  { id: 'client', titre: 'En attente du client', aide: 'Vous avez envoyé, le client doit répondre' },
  { id: 'valide', titre: 'Validés', aide: 'Le client a dit oui' },
  { id: 'livrer', titre: 'À livrer', aide: 'Installation dans les 14 prochains jours' },
];
const JOURS_A_LIVRER_DEFAUT = 14;
function joursALivrer() { return Number(Stockage.lireReglage('joursALivrer')) || JOURS_A_LIVRER_DEFAUT; }
const DELAI_RELANCE_DEFAUT = 7;

function delaiRelance() { return Number(Stockage.lireReglage('delaiRelance')) || DELAI_RELANCE_DEFAUT; }

function joursDepuis(cle) { return Math.round((dateDepuisCle(cleDate(new Date())) - dateDepuisCle(cle)) / 864e5); }
function depuis(cle) {
  const n = joursDepuis(cle);
  if (n <= 0) return "aujourd'hui";
  if (n === 1) return 'hier';
  return `il y a ${n} jours`;
}

/* Où se trouve la commande : colonne, étiquette (l'étape suivante), texte de suivi, relance. */
function etatTache(c) {
  const et = c.etapes || {};
  const aucune = !Object.values(et).some(Boolean);
  const attente = (texte, date) => {
    const relance = joursDepuis(date) >= delaiRelance();
    return { colonne: 'client', texte: `${texte} ${dateCourte(date)} · ${depuis(date)}${relance ? ', à relancer' : ''}`, relance };
  };
  if (et.validation || (aucune && ['confirmee', 'preparation', 'livree'].includes(c.statut))) {
    const jours = -joursDepuis(dateInstallation(c));
    if (jours <= joursALivrer()) {
      const h = heureInstallation(c);
      return { colonne: 'livrer', installation: true,
        texte: `<strong>Installation le ${dateCourte(dateInstallation(c))}${h ? ' à ' + echapper(h) : ''}</strong> · ${jours <= 0 ? "aujourd'hui" : jours === 1 ? 'demain' : `dans ${jours} jours`}` };
    }
    return { colonne: 'valide', texte: et.validation ? `Devis validé le ${dateCourte(et.validation)}` : 'Commande confirmée' };
  }
  if (aucune) return { colonne: 'nouvelles', etiquette: 'Rendez-vous à fixer', classe: 'm-nouveau', texte: c.creeLe ? `Demande saisie le ${dateCourte(c.creeLe.slice(0, 10))}` : 'Nouvelle demande' };
  if (et.devis) return attente('Devis envoyé le', et.devis);
  if (et.moodboardAccepte) return { colonne: 'moi', etiquette: 'Devis à envoyer', classe: 'm-moi', texte: `Moodboard accepté le ${dateCourte(et.moodboardAccepte)}` };
  if (et.moodboardAModifier) return { colonne: 'moi', etiquette: 'Moodboard à modifier', classe: 'm-modif', texte: `Demandé le ${dateCourte(et.moodboardAModifier)}` };
  if (et.moodboard) return attente('Moodboard envoyé le', et.moodboard);
  return { colonne: 'moi', etiquette: 'Moodboard à envoyer', classe: 'm-moi', texte: `Rendez-vous fait le ${dateCourte(et.rdv)}` };
}

let filtreTaches = '';

function calculerTaches() {
  const auj = cleDate(new Date());
  const liste = trier(commandes.filter((c) => c.date >= auj && c.statut !== 'annulee' && c.statut !== 'livree'
    && (!filtreTaches || typeDe(c) === filtreTaches)));
  const cle = (c) => dateInstallation(c) + ' ' + (heureInstallation(c) || '99:99');
  return COLONNES_TACHES.map((col) => {
    const l = liste.map((c) => ({ c, e: etatTache(c) })).filter((x) => x.e.colonne === col.id);
    // À livrer : par ordre chronologique d'installation.
    if (col.id === 'livrer') l.sort((a, b) => cle(a.c).localeCompare(cle(b.c)));
    return { ...col, liste: l };
  });
}

function carteTache({ c, e }) {
  return `<button type="button" class="carte-tache t-${typeDe(c)}${e.relance ? ' relance' : ''}" data-id="${echapper(c.id)}">
    ${e.etiquette ? `<span class="etiquette-tache ${e.classe}">${e.etiquette}</span>` : ''}
    <span class="carte-ligne"><strong>${echapper(nomClient(c))}</strong><span class="carte-date">${echapper(dateCourte(c.date))}</span></span>
    <span class="carte-type">${echapper(libelleType(c))}</span>
    <span class="carte-etat">${e.texte}</span>
  </button>`;
}

function afficherTaches() {
  $('#contenu-taches').innerHTML = calculerTaches().map((col) => `
    <section class="colonne-tache colonne-${col.id}">
      <h2>${col.titre} <span class="compte">${col.liste.length}</span></h2>
      <p class="aide-colonne">${col.id === 'livrer' ? `Installation dans les ${joursALivrer()} prochains jours` : col.aide}</p>
      <div class="cartes">${col.liste.length ? col.liste.map(carteTache).join('') : '<p class="vide-groupe">Aucun évènement.</p>'}</div>
    </section>`).join('');
}

function ouvrirTaches() {
  $('#filtre-taches').innerHTML = '<option value="">Tous</option>' + types.map((t) => `<option value="${echapper(t.id)}">${echapper(t.nom)}</option>`).join('');
  if (!types.some((t) => t.id === filtreTaches)) filtreTaches = '';
  $('#filtre-taches').value = filtreTaches;
  $('#delai-relance').value = delaiRelance();
  $('#jours-a-livrer').value = joursALivrer();
  afficherTaches();
  $('.principal').hidden = true;
  $('#page-taches').hidden = false;
}
function fermerTaches() {
  $('#page-taches').hidden = true;
  $('.principal').hidden = false;
  ajusterDebordements();
}
function tachesOuvertes() { return !$('#page-taches').hidden; }

function imprimerTaches() {
  imprimer(`<div class="imp-page">
    ${enteteImpression('Liste de tâches', dateImpression() + (filtreTaches ? ' · ' + echapper(typeInfo(filtreTaches).nom) : ''))}
    ${calculerTaches().map((col) => `
      <section class="groupe-taches"><h3>${col.titre} (${col.liste.length})</h3>
      ${col.liste.length ? `<table class="imp-tableau tableau-taches"><tbody>${col.liste.map(({ c, e }) => `<tr>
        <td>${echapper(dateCourte(c.date))}</td><td><strong>${echapper(nomClient(c))}</strong></td><td>${echapper(libelleType(c))}</td>
        <td>${e.etiquette ? e.etiquette + ' · ' : ''}${e.texte}</td></tr>`).join('')}</tbody></table>` : '<p class="vide-groupe">Aucun évènement.</p>'}
      </section>`).join('')}
  </div>`);
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
  $('#btn-taches').onclick = ouvrirTaches;
  $('#taches-retour').onclick = fermerTaches;
  $('#filtre-taches').onchange = (e) => { filtreTaches = e.target.value; afficherTaches(); };
  $('#delai-relance').onchange = async (e) => {
    const n = Math.max(1, Math.min(90, parseInt(e.target.value, 10) || DELAI_RELANCE_DEFAUT));
    e.target.value = n;
    await Stockage.ecrireReglage('delaiRelance', n);
    afficherTaches();
  };
  $('#jours-a-livrer').onchange = async (e) => {
    const n = Math.max(1, Math.min(90, parseInt(e.target.value, 10) || JOURS_A_LIVRER_DEFAUT));
    e.target.value = n;
    await Stockage.ecrireReglage('joursALivrer', n);
    afficherTaches();
  };
  $('#imprimer-taches').onclick = imprimerTaches;
  $('#contenu-taches').addEventListener('click', (e) => {
    const carte = e.target.closest('.carte-tache');
    if (carte) ouvrirFicheParId(carte.dataset.id);
  });
  $('#etapes').addEventListener('click', (e) => { if (e.target.closest('#moodboard-renvoye')) moodboardRenvoye(); });
  $('#etapes').addEventListener('change', changerEtape);
  $('#semaine-precedente').onclick = () => { debutSemaine = ajouterJours(debutSemaine, -7); afficherFleurs(); };
  $('#semaine-suivante').onclick = () => { debutSemaine = ajouterJours(debutSemaine, 7); afficherFleurs(); };
  $('#imprimer-fleurs').onclick = imprimerFleurs;
  $('#contenu-fleurs').addEventListener('click', (e) => {
    const li = e.target.closest('li[data-id]');
    if (li) { $('#fenetre-fleurs').hidden = true; ouvrirFicheParId(li.dataset.id); }
  });
  $('#fiche-imprimer').onclick = imprimerFiche;
  $('#fiche').addEventListener('click', (e) => { const o = e.target.closest('.onglet'); if (o) afficherOnglet(o.dataset.onglet); });
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
    if (img) {
      const liste = brouillon[img.dataset.galerie];
      const seulesImages = liste.filter((n) => !estPdf(n));
      return ouvrirVisionneuse(seulesImages, seulesImages.indexOf(liste[Number(img.dataset.index)]));
    }
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
    if (!c.etapes && ex.etapes) maj.etapes = ex.etapes;
    if (c.id === 'exemple-anniversaire' && c.type === 'autre') { maj.type = ex.type; maj.typePrecision = ex.typePrecision; }
    if (JSON.stringify(maj) !== JSON.stringify(c)) { await Stockage.enregistrerCommande(maj); modifie = true; }
  }
  if (modifie) await chargerCommandes();
}

/* ---------- Dossier des données ---------- */

function majInfoDossier() {
  const enDossier = Stockage.mode() === 'dossier';
  $('#info-dossier').innerHTML = enDossier
    ? `Vos commandes et vos photos sont enregistrées en fichiers sur cet ordinateur, dans le dossier <strong>${echapper(Stockage.nomDossier())}</strong>.`
    : Stockage.dossierPossible()
      ? 'Vos commandes et vos photos sont enregistrées dans ce navigateur. Vous pouvez les enregistrer plutôt en fichiers, dans un dossier de votre ordinateur : elles y seront recopiées.'
      : 'Vos commandes et vos photos sont enregistrées dans ce navigateur. Pour les enregistrer dans un dossier, ouvrez le calendrier avec Microsoft Edge ou Google Chrome.';
  $('#changer-dossier').hidden = !Stockage.dossierPossible();
  $('#changer-dossier').textContent = enDossier ? 'Changer de dossier' : 'Choisir un dossier';
}

function afficherEcranDossier(etat, erreur) {
  const reconnecter = etat === 'reconnecter';
  $('#ecran-titre').textContent = reconnecter ? 'Bonjour !' : 'Où enregistrer vos commandes ?';
  $('#ecran-texte').innerHTML = reconnecter
    ? `<p>Pour votre sécurité, le navigateur demande votre accord avant d'ouvrir le dossier <strong>${echapper(Stockage.nomDossierChoisi())}</strong> où sont enregistrées vos commandes.</p>
       <p>Cliquez sur « Ouvrir mes commandes », puis sur <strong>Autoriser</strong>. Si le navigateur propose « Autoriser à chaque visite », choisissez-le : vous n'aurez plus à le faire.</p>`
    : `<p>Le calendrier enregistre vos commandes et vos photos en fichiers, dans un dossier de votre ordinateur. Le plus simple est de choisir le dossier où se trouve ce fichier <code>Calendrier Arrose</code>.</p>
       <ol><li>Cliquez sur « Choisir le dossier ».</li>
       <li>Sélectionnez le dossier du calendrier, puis cliquez sur <strong>Sélectionner le dossier</strong>.</li>
       <li>Acceptez quand le navigateur demande l'autorisation de modifier les fichiers.</li></ol>
       <p>Un dossier <code>donnees-calendrier</code> y sera créé. Les commandes déjà saisies y seront recopiées.</p>`;
  $('#ecran-principal').textContent = reconnecter ? 'Ouvrir mes commandes' : 'Choisir le dossier';
  $('#ecran-principal').dataset.nouveau = reconnecter ? '' : '1';
  $('#ecran-autre').hidden = !reconnecter;
  $('#ecran-erreur').hidden = !erreur;
  $('#ecran-erreur').textContent = erreur || '';
  $('#ecran-dossier').hidden = false;
}

async function connecterDossier(nouveau) {
  try {
    await Stockage.connecter(nouveau);
    await lancerCalendrier();
  } catch (e) {
    const msg = e.name === 'AbortError'
      ? 'Aucun dossier n’a été ouvert. Après « Sélectionner le dossier », le navigateur demande s’il peut modifier les fichiers : cliquez sur « Modifier les fichiers » (et non sur « Annuler »). Si cela ne fonctionne toujours pas, cliquez sur « Continuer sans dossier » ci-dessous.'
      : e.message;
    afficherEcranDossier(Stockage.nomDossierChoisi() ? 'reconnecter' : 'choisir', msg);
  }
}

async function changerDossier() {
  if (Stockage.mode() === 'dossier' && !confirm('Choisir un autre dossier pour les données ?\nSi ce dossier est vide, vos commandes actuelles y seront copiées. S’il contient déjà des données du calendrier, ce sont elles qui seront ouvertes.')) return;
  try {
    await Stockage.connecter(true);
    await lancerCalendrier();
    messageFlottant('Commandes enregistrées dans le dossier ' + Stockage.nomDossier());
  } catch (e) {
    if (e.name !== 'AbortError') alert(e.message);
  }
}

async function lancerCalendrier() {
  await chargerTypes();
  await chargerCommandes();
  await mettreAJourExemples();
  await Stockage.nettoyerImages();
  $('#ecran-dossier').hidden = true;
  allerAuMois(new Date());
  majRappelSauvegarde();
  majInfoDossier();
  demarrerDrive();
}

async function demarrer() {
  brancher();
  $('#ecran-principal').onclick = () => connecterDossier(!!$('#ecran-principal').dataset.nouveau);
  $('#ecran-autre').onclick = () => connecterDossier(true);
  $('#ecran-navigateur').onclick = async () => {
    try { await Stockage.utiliserNavigateur(); await lancerCalendrier(); } catch (e) { alert(e.message); }
  };
  $('#changer-dossier').onclick = changerDossier;
  let etat;
  try {
    etat = await Stockage.demarrer();
  } catch (e) {
    alert(e.message);
    return;
  }
  if (etat === 'pret') await lancerCalendrier();
  else afficherEcranDossier(etat);
}

demarrer();

// Version en ligne : permet l'installation sur le bureau et l'ouverture sans internet.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => { /* rien */ });
}
