// Assemble toute l'application en UN SEUL fichier HTML autonome : « Calendrier Arrose.html ».
// Usage : node assembler.js
'use strict';
const fs = require('fs');
const path = require('path');
const src = (f) => path.join(__dirname, 'sources', f);
const lire = (f) => fs.readFileSync(src(f), 'utf8');
const logo = 'data:image/png;base64,' + fs.readFileSync(src('logo.png')).toString('base64');
const script = (f) => '<script>\n' + lire(f).replace(/<\/script/gi, '<\\/script') + '\n</script>';

let html = lire('page.html');
const remplacer = (avant, apres) => {
  if (!html.includes(avant)) throw new Error('Introuvable dans page.html : ' + avant);
  html = html.split(avant).join(apres);
};
remplacer('<link rel="stylesheet" href="fichiers/style.css">', '<style>\n' + lire('style.css') + '\n</style>');
remplacer('href="fichiers/logo.png"', `href="${logo}"`);
remplacer('src="fichiers/logo.png"', `src="${logo}"`);
remplacer('<script src="fichiers/exemples.js"></script>', script('exemples.js'));
remplacer('<script src="fichiers/stockage.js"></script>', script('stockage.js'));
remplacer('<script src="fichiers/app.js"></script>', script('app.js'));
fs.writeFileSync(path.join(__dirname, 'Calendrier Arrose.html'), html);
console.log('Calendrier Arrose.html créé (' + Math.round(html.length / 1024) + ' Ko)');
