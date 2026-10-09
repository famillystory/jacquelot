#!/usr/bin/env node
'use strict';
/*
  Génère le PDF et la vue animée avec la MÊME dimension de livre,
  passée en paramètre. Nécessaire car asciidoctor-web-pdf (le PDF natif)
  ne lit la taille de page QUE dans le CSS statique (:stylesheet:) — il
  n'existe pas d'attribut "-a pdf-page-size" pour cet outil (contrairement
  au gem Ruby asciidoctor-pdf). On régénère donc custom/page-size.css
  avant l'appel PDF, et on transmet les mêmes valeurs à la vue animée via
  -a book-width/book-height (lues par template.js).

  Usage :
    node build-book.js
    node build-book.js --width 15.6cm --height 23.39cm
    node build-book.js --width 148mm  --height 210mm   (A5)
    node build-book.js --input livre-demo.adoc
*/

var fs = require('fs');
var path = require('path');
var { execFileSync } = require('child_process');

function getArg(name, def) {
  var i = process.argv.indexOf('--' + name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

var WIDTH  = getArg('width',  '15.6cm');
var HEIGHT = getArg('height', '23.39cm');
var INPUT  = getArg('input',  'livre-demo.adoc');

var PAGE_SIZE_CSS = path.join(__dirname, 'css/web/custom/page-size.css');

console.log('[build-book] dimension : ' + WIDTH + ' x ' + HEIGHT);

fs.writeFileSync(
  PAGE_SIZE_CSS,
  '/* Généré par build-book.js — ne pas éditer à la main. */\n' +
  '@page {\n  size: ' + WIDTH + ' ' + HEIGHT + ';\n}\n'
);
console.log('[build-book] écrit : ' + PAGE_SIZE_CSS);

console.log('[build-book] génération du PDF...');
execFileSync('asciidoctor-web-pdf', [
  INPUT,
  '--template-require', './template-pdf.js',
  '-o', INPUT + '.web.pdf'
], { stdio: 'inherit' });

console.log('[build-book] génération de la vue animée...');
execFileSync('asciidoctor-web-pdf', [
  INPUT,
  '--template-require', './template.js',
  '--preview',
  '-a', 'anim-view',
  '-a', 'book-width=' + WIDTH,
  '-a', 'book-height=' + HEIGHT,
  '-o', INPUT + '.tplt.html'
], { stdio: 'inherit' });

console.log('[build-book] terminé.');
