'use strict';
/* Calendrier des commandes – Arrosé, La cave fleurie */

const TYPES = { mariage: 'Mariage', bapteme: 'Baptême', autre: 'Autre' };
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
function libelleType(c) { return c.type === 'autre' && c.typePrecision ? c.typePrecision : TYPES[c.type] || 'Autre'; }
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
    if (i % 7 >= 5) classes.push('weekend');
    const puces = (parJour[cle] || []).map((c) => `
      <button type="button" class="puce type-${echapper(c.type)}${c.statut === 'annulee' ? ' annulee' : ''}" data-id="${echapper(c.id)}"
        title="${echapper(nomClient(c) + ' – ' + libelleType(c) + ' – ' + (STATUTS[c.statut] || ''))}">
        ${c.heure ? `<span class="heure">${echapper(c.heure)}</span>` : ''}<strong>${echapper(nomClient(c))}</strong><span class="type-texte"> · ${echapper(libelleType(c))}</span>
      </button>`).join('');
    html += `<div class="${classes.join(' ')}" data-date="${cle}"><div class="numero"><span>${d.getDate()}</span></div>${puces}</div>`;
  }
  grille.innerHTML = html;
}

function allerAuMois(d, { alerte = true } = {}) {
  moisAffiche = debutDuMois(d);
  afficherCalendrier();
  if (alerte) afficherAlerteMois(false);
}

/* ---------- Alerte mensuelle ---------- */

function afficherAlerteMois(meme_si_vide) {
  const liste = commandesDuMois(moisAffiche);
  const fenetre = $('#fenetre-mois');
  const nomMois = `${MOIS[moisAffiche.getMonth()]} ${moisAffiche.getFullYear()}`;
  if (!liste.length && !meme_si_vide) { fenetre.hidden = true; return; }
  $('#titre-alerte').textContent = `Commandes de ${nomMois}`;
  const actives = liste.filter((c) => c.statut !== 'annulee').length;
  $('#resume-alerte').textContent = liste.length
    ? `${liste.length} commande${liste.length > 1 ? 's' : ''} ce mois-ci${actives !== liste.length ? ` (dont ${liste.length - actives} annulée${liste.length - actives > 1 ? 's' : ''})` : ''}. Cliquez sur une ligne pour ouvrir la fiche.`
    : 'Aucune commande ce mois-ci.';
  $('#liste-alerte').innerHTML = liste.map((c) => `
    <tr data-id="${echapper(c.id)}" tabindex="0">
      <td>${echapper(dateCourte(c.date))}${c.heure ? `<br><small>${echapper(c.heure)}</small>` : ''}</td>
      <td><strong>${echapper(nomClient(c))}</strong></td>
      <td><span class="type-etiquette"><i class="pastille type-${echapper(c.type)}"></i>${echapper(libelleType(c))}</span></td>
      <td><span class="statut statut-${echapper(c.statut)}">${echapper(STATUTS[c.statut] || '')}</span></td>
    </tr>`).join('');
  fenetre.hidden = false;
}

/* ---------- Fiche commande ---------- */

const formulaire = () => $('#fiche');

function commandeVide(date) {
  return {
    id: null, nom: '', prenom: '', telephone: '', email: '',
    type: 'mariage', typePrecision: '', date: date || cleDate(new Date()), heure: '', lieu: '', mode: 'livraison',
    description: '', fleurs: '', couleurs: '', compositions: [],
    inspirations: [], moodboard: [], moodboardNotes: '',
    statut: 'devis', prix: '', acompte: '', notesInternes: '',
  };
}

const CHAMPS_TEXTE = ['nom', 'prenom', 'telephone', 'email', 'type', 'typePrecision', 'date', 'heure', 'lieu',
  'description', 'fleurs', 'couleurs', 'moodboardNotes', 'statut', 'prix', 'acompte', 'notesInternes'];

function ouvrirFiche(commande) {
  brouillon = structuredClone(commande);
  brouillon.compositions ||= [];
  brouillon.inspirations ||= [];
  brouillon.moodboard ||= [];
  const f = formulaire();
  for (const nom of CHAMPS_TEXTE) f.elements[nom].value = brouillon[nom] ?? '';
  for (const r of f.querySelectorAll('input[name=mode]')) r.checked = r.value === (brouillon.mode || 'livraison');
  $$('input.erreur', f).forEach((el) => el.classList.remove('erreur'));
  $('#titre-fiche').textContent = brouillon.id ? nomClient(brouillon) : 'Nouvelle commande';
  $('#fiche-supprimer').hidden = !brouillon.id;
  afficherCompositions();
  afficherGaleries();
  majAutre();
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
  c.compositions = $$('.ligne-composition', f)
    .map((l) => ({ nom: l.querySelector('[data-nom]').value.trim(), quantite: l.querySelector('[data-quantite]').value.trim() }))
    .filter((x) => x.nom || x.quantite);
  if (c.type !== 'autre') c.typePrecision = '';
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

function majAutre() {
  $('.si-autre').hidden = formulaire().elements.type.value !== 'autre';
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
    <button type="button" aria-label="Retirer cette composition" title="Retirer">×</button>`;
  ligne.querySelector('[data-nom]').value = comp.nom || '';
  ligne.querySelector('[data-quantite]').value = comp.quantite || '';
  ligne.querySelector('button').onclick = () => ligne.remove();
  $('#liste-compositions').appendChild(ligne);
  return ligne;
}

function afficherGaleries() {
  for (const galerie of ['inspirations', 'moodboard']) {
    const conteneur = $(`#galerie-${galerie}`);
    conteneur.innerHTML = brouillon[galerie].map((nom, i) => `
      <div class="vignette">
        <img src="${Stockage.urlImage(nom)}" alt="" loading="lazy" data-galerie="${galerie}" data-index="${i}">
        <button type="button" class="retirer" data-galerie="${galerie}" data-index="${i}" title="Retirer cette image" aria-label="Retirer cette image">×</button>
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
    messageFlottant('Commande enregistrée ✓');
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
        <i class="pastille type-${echapper(c.type)}"></i>
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
    messageFlottant('Sauvegarde téléchargée ✓ (dossier Téléchargements)');
    majRappelSauvegarde();
  } catch (e) {
    alert('La sauvegarde a échoué : ' + e.message);
  } finally {
    bouton.disabled = false;
  }
}

async function majRappelSauvegarde() {
  const rappel = $('#rappel-sauvegarde');
  const derniere = await Stockage.derniereSauvegarde();
  const jours = derniere ? Math.floor((Date.now() - new Date(derniere).getTime()) / 86400000) : null;
  if (!commandes.length || (jours !== null && jours < 7)) { rappel.hidden = true; return; }
  $('#rappel-texte').textContent = jours === null
    ? 'Vous n’avez encore jamais fait de sauvegarde.'
    : `Votre dernière sauvegarde date de ${jours} jours.`;
  rappel.hidden = false;
}

async function importer(fichier) {
  if (!fichier) return;
  if (!confirm(`Restaurer la sauvegarde « ${fichier.name} » ?\nToutes les commandes actuelles seront remplacées par celles de ce fichier.`)) return;
  try {
    const nombre = await Stockage.importer(await fichier.text());
    await chargerCommandes();
    $('#fenetre-sauvegarde').hidden = true;
    allerAuMois(moisAffiche, { alerte: false });
    messageFlottant(`Sauvegarde restaurée : ${nombre} commande${nombre > 1 ? 's' : ''} ✓`);
  } catch (e) {
    alert(e.message);
  }
}

/* ---------- Évènements ---------- */

function brancher() {
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
  $('#rappel-sauvegarde button').onclick = exporter;

  $('#grille').addEventListener('click', (e) => {
    const puce = e.target.closest('.puce');
    if (puce) return ouvrirFicheParId(puce.dataset.id);
    const jour = e.target.closest('.jour');
    if (jour) ouvrirFiche(commandeVide(jour.dataset.date));
  });

  // Fenêtres simples : fermeture par le bouton, par un clic à côté
  for (const id of ['fenetre-mois', 'fenetre-sauvegarde']) {
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
  f.elements.type.addEventListener('change', majAutre);
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
    if (!$('#fenetre-fiche').hidden) return fermerFiche(false);
    $('#fenetre-mois').hidden = true;
    $('#fenetre-sauvegarde').hidden = true;
    $('#resultats').hidden = true;
  });

  window.addEventListener('beforeunload', (e) => { if (ficheModifiee()) { e.preventDefault(); e.returnValue = ''; } });
}

async function demarrer() {
  brancher();
  try {
    await Stockage.demarrer();
    await chargerCommandes();
    await Stockage.nettoyerImages(commandes);
  } catch (e) {
    alert(e.message);
  }
  allerAuMois(new Date());
  majRappelSauvegarde();
}

demarrer();
