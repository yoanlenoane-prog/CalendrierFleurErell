// Assemble toute l'application en UN SEUL fichier HTML autonome : « Calendrier Arrose.html ».
// Usage : node assembler.js
'use strict';
const fs = require('fs');
const path = require('path');
const src = (f) => path.join(__dirname, 'sources', f);
const lire = (f) => fs.readFileSync(src(f), 'utf8');
const script = (f) => '<script>\n' + lire(f).replace(/<\/script/gi, '<\\/script') + '\n</script>';

// Polices incluses dans le fichier (licence SIL Open Font License, voir sources/polices/LICENCE-OFL.txt)
const POLICES = [
  ['Jost', 400, 'jost-latin-400-normal.woff2'],
  ['Jost', 500, 'jost-latin-500-normal.woff2'],
  ['Jost', 600, 'jost-latin-600-normal.woff2'],
  ['Cormorant Garamond', 500, 'cormorant-garamond-latin-500-normal.woff2'],
  ['Cormorant Garamond', 600, 'cormorant-garamond-latin-600-normal.woff2'],
  ['Caveat', 600, 'caveat-latin-600-normal.woff2'],
];
const fontFace = POLICES.map(([famille, graisse, fichier]) => {
  const b64 = fs.readFileSync(src('polices/' + fichier)).toString('base64');
  return `@font-face{font-family:"${famille}";font-weight:${graisse};font-style:normal;font-display:swap;src:url(data:font/woff2;base64,${b64}) format("woff2");}`;
}).join('\n');

let html = lire('page.html');
const remplacer = (avant, apres) => {
  if (!html.includes(avant)) throw new Error('Introuvable dans page.html : ' + avant);
  html = html.split(avant).join(apres);
};
remplacer('<link rel="stylesheet" href="style.css">', '<style>\n' + fontFace + '\n' + lire('style.css') + '\n</style>');
remplacer('<script src="exemples.js"></script>', script('exemples.js'));
remplacer('<script src="stockage.js"></script>', script('stockage.js'));
remplacer('<script src="drive.js"></script>', script('drive.js'));
remplacer('<script src="app.js"></script>', script('app.js'));
fs.writeFileSync(path.join(__dirname, 'Calendrier Arrose.html'), html);
console.log('Calendrier Arrose.html créé (' + Math.round(html.length / 1024) + ' Ko)');
