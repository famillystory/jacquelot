'use strict';
/* Template dédié à la VUE ANIMÉE (flip-book interactif).
   CSS et structure des sections viennent de template-common.js, partagé
   avec template-pdf.js — c'est ce qui garantit la mise en page identique
   entre les deux sorties. */

var fs      = require('fs');
var path    = require('path');
var common  = require('./template-common.js');

var BFW_JS = fs.readFileSync(path.join(__dirname, 'bfw.js'), 'utf8');

/* ① BLANK_IMG + toDeferred : NOUVEAUX, à ajouter juste AU-DESSUS de deferImages */

/* GIF 1×1 transparent (data: → zéro requête réseau).
   Donne aux images différées un état « disponible » immédiat
   (complete=true ET naturalWidth=1) : quel que soit le filtre utilisé
   par Paged.js (!complete ou naturalWidth===0), il n'attend rien.
   La géométrie vient des width/height injectés ; restoreImages() de
   bfw.js écrase ensuite ce placeholder par l'URL réelle, spread par
   spread — AUCUNE modification de bfw.js nécessaire. */
var BLANK_IMG =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/* Dimensions lues dans l'en-tête du fichier image (PNG, GIF, JPEG).
   Indispensables pour différer : Paged.js calcule les coupures avec des
   <img> sans src — sans width/height, leur hauteur serait nulle. */
/* Dimensions lues dans l'en-tête du fichier image (PNG, GIF, JPEG). */
function imageSize(buf) {
  try {
    if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50)
      return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    if (buf.length > 10 && buf.toString('ascii', 0, 3) === 'GIF')
      return { w: buf.readUInt16LE(6),  h: buf.readUInt16LE(8) };
    if (buf.length > 4 && buf[0] === 0xFF && buf[1] === 0xD8) {
      var o = 2;
      while (o + 9 < buf.length) {
        if (buf[o] !== 0xFF) { o++; continue; }
        var m = buf[o + 1];
        if (m === 0xDA) break;
        if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC)
          return { h: buf.readUInt16BE(o + 5), w: buf.readUInt16BE(o + 7) };
        o += 2 + buf.readUInt16BE(o + 2);
      }
    }
  } catch (e) {}
  return null;
}

function resolveImg(src, bases) {
  var rel;
  try { rel = decodeURIComponent(src.split('?')[0].split('#')[0]); }
  catch (e) { return null; }
  if (/^(https?:)?\/\//i.test(rel) || /^data:/i.test(rel)) return null;
  for (var i = 0; i < bases.length; i++) {
    var f = path.resolve(bases[i], rel);
    try { fs.accessSync(f); return f; } catch (e) {}
  }
  return null;
}


function toDeferred(tag) {
  /* src non cité (HTML invalide) : on n'y touche pas, restera eager. */
  if (!/\ssrc=(["'])/i.test(tag)) { return tag; }
  return tag
    /* 1. l'URL réelle migre en data-src (l'espace de tête est préservé) */
    .replace(/\ssrc=(["'][^"']*["'])/i, ' data-src=$1')
    /* 2. le placeholder prend la place de src, en tête de balise.
          ORDRE IMPORTANT : d'abord déplacer src, PUIS insérer le
          placeholder — l'inverse donnerait deux src ou un data-src du
          placeholder. */
    .replace(/<img\b/i, '<img src="' + BLANK_IMG + '"');
}

/* Ajoute (ou fusionne dans un style= existant) une déclaration CSS sur
   une balise <img>. Le guillemet d'origine est réutilisé. */
function addStyleDecl(tag, decl) {
  var m = tag.match(/\sstyle\s*=\s*(["'])([\s\S]*?)\1/i);
  if (m) {
    var inner = m[2].replace(/\s*;\s*$/, '');
    return tag.slice(0, m.index) + ' style=' + m[1] + inner + '; ' + decl + m[1] +
      tag.slice(m.index + m[0].length);
  }
  return tag.replace(/(\s*\/?>)$/, ' style="' + decl + '"$1');
}

function deferImages(html, extraBases) {
  var bases = [process.cwd()].concat(extraBases || [], [__dirname]);
  function numAttr(tag, name) {
    var m = tag.match(new RegExp('\\s' + name + '\\s*=\\s*(["\']?)(\\d+(?:\\.\\d+)?)\\1', 'i'));
    return m ? parseFloat(m[2]) : null;   /* null si absent OU non numérique */
  }
  var deferred = 0, kept = 0, problems = [];
  /* ③ LE REGEX : première ligne du .replace — ANCIEN :
        /<img\b[^>]*>/gi
     NOUVEAU (sensible aux guillemets : une valeur d'attribut citée est
     consommée en bloc, donc les « > » qu'elle contient — ex. un alt
     avec <sup> — ne referment pas la balise, et les injections de
     width/height atterrissent en FIN de balise réelle, pas dans l'alt) : */
  var out = html.replace(/<img\b(?:"[^"]*"|'[^']*'|[^"'>])*>/gi, function (tag) {

    /* ② LE GARDE : toute première instruction du callback ↓↓↓ */
    if (/\bdata-src=/i.test(tag)) { return tag; }
    /* ↑↑↑ un tag déjà traité est rendu tel quel : évite data-data-src=
       ou un double placeholder si la fonction repassait sur le même
       contenu. ↑↑↑ */

    var w = numAttr(tag, 'width'), h = numAttr(tag, 'height');
    if (w && h) { deferred++; return toDeferred(tag); }

    var m = tag.match(/\ssrc=(["'])([^"']+)\1/i);
    if (!m) { kept++; return tag; }
    var src = m[2], buf = null;
    if (/^data:image\/(png|jp?g|gif);base64,/i.test(src)) {
      buf = Buffer.from(src.replace(/^data:image\/[^,]+,/, '').slice(0, 65536), 'base64');
    } else {
      var f = resolveImg(src, bases);
      if (f) { try { buf = fs.readFileSync(f); } catch (e) {} }
    }
    var dims = buf ? imageSize(buf) : null;
    /* Différable dès que le fichier est lisible. Une dimension présente
       mais non numérique (width="95%", height="3cm"…) ne peut pas
       recevoir de pixels : on pose alors le ratio intrinsèque en style
       (aspect-ratio) et on n'injecte des px QUE dans la dimension libre
       dont l'autre n'est pas ambiguë — sinon la boîte serait déterminée
       deux fois et le ratio ignoré. */
    if (dims) {
      var nnW = /\swidth\s*=/i.test(tag) && w === null;   /* présent, non numérique */
      var nnH = /\sheight\s*=/i.test(tag) && h === null;
      var add = '';
      if (!/\swidth\s*=/i.test(tag) && !nnH) add += ' width="'  + dims.w + '"';
      if (!/\sheight\s*=/i.test(tag) && !nnW) add += ' height="' + dims.h + '"';
      if (add) tag = tag.replace(/(\s*\/?>)$/, add + '$1');
      if ((nnW || nnH) && dims.w > 0 && dims.h > 0) {
        tag = addStyleDecl(tag, 'aspect-ratio:' + dims.w + '/' + dims.h);
      }
      deferred++;
      return toDeferred(tag);
    }
    kept++;
    problems.push((/\swidth\s*=/i.test(tag) || /\sheight\s*=/i.test(tag)
      ? 'attribut width/height non numérique et dimensions intrinsèques illisibles'
      : 'fichier introuvable/illisible')
      + ' : ' + src.slice(0, 60));
    return tag;   /* laissé en eager, tel quel */
  });
  console.log('[bfw] images différées :', deferred, '| laissées en eager :', kept);
  problems.forEach(function (s) { console.warn('  [bfw] non différé —', s); });
  return out;
}

module.exports = {
  document: function(node) {
    var title    = (node.getDocumentTitle() || '').replace(/"/g, '&quot;');
    var subtitle = (node.getAttribute('subtitle') || '').replace(/"/g, '&quot;');
    var author   = (node.getAttribute('author')   || '').replace(/"/g, '&quot;');
    var urlPrev  = (node.getAttribute('bfw-prev')  ||
                    node.getAttribute('bfw_prev')  ||
                    node.getAttribute('bfwprev')   || '').replace(/"/g, '&quot;');
    var urlNext  = (node.getAttribute('bfw-next')  ||
                    node.getAttribute('bfw_next')  ||
                    node.getAttribute('bfwnext')   || '').replace(/"/g, '&quot;');
    var outfileBases = [];
	try {
	  var of = node.getAttribute('outfile');
	  if (of) outfileBases = [path.dirname(path.resolve(of))];
	} catch (e) {}
    return [
      '<!DOCTYPE html>',
      '<html lang="fr">',
      '<head>',
      '  <meta charset="UTF-8">',
      '  <title>' + node.getDocumentTitle() + '</title>',
      '  <!-- 1. CSS commun (contenu, typographie, taille de page) -->',
      '  <style>' + common.ASCIIDOCTOR_CSS + '</style>',
      '  <!-- 2. CSS du livre animé (mise en page flip, surcharge écran) -->',
      '  <style>' + common.BFW_CSS + '</style>',
      '  <!-- 3. Surcharge ponctuelle de la taille via -a book-width/book-height -->',
      '  ' + common.pageSizeOverride(node),
      '  <script>' + BFW_JS + '<\/script>',
      '  <script src="./paged.polyfill.js"><\/script>',
      '  <script>' + common.BFW_LEAF_LI_HANDLER_JS + '<\/script>',
      '</head>',
      '<body data-title="' + title + '" data-subtitle="' + subtitle + '" data-author="' + author + '" data-bfw-prev="' + urlPrev + '" data-bfw-next="' + urlNext + '">',
      deferImages(node.getContent(), outfileBases),
      '</body>',
      '</html>'
    ].join('\n');
  },

  section: common.section,
};