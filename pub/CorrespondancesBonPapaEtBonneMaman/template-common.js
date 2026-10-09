'use strict';
/*
Module PARTAGÉ entre template.js (vue animée) et template-pdf.js (PDF).
Objectif : une seule source de vérité pour tout ce qui doit rester
identique entre les deux sorties — CSS et structure des sections —
afin que la mise en page (pagination, sauts de page, taille du livre)
soit garantie cohérente sans dupliquer le moindre code.
Ce que ce module NE contient PAS (volontairement) : tout ce qui est
spécifique à l'interactivité écran (bfw.js, #bfw-stage, paged.polyfill
côté vue animée) — ça reste dans template.js.
*/
var fs   = require('fs');
var path = require('path');
var BFW_CSS = fs.readFileSync(path.join(__dirname, 'bfw.css'), 'utf8');
var PDF_CSS_DIR = path.join(__dirname, 'css/web');
/* ── Handler Paged.js partagé (PDF + vue animée) ──────────────────────
beforeParsed : marque les <li> feuilles/branches pour bfw.css.
afterRendered : « guérison » des <li> posés au ras du bord bas de page
(bug de rastérisation Blink : contenu layouté correctement mais absent
du dernier paint — invisible dans Chromium, visible dans Firefox,
réapparaît après toute mutation DOM). Le remède est un translateZ(0)
appliqué PERMANENCEMENT : l'élément est promu dans son propre layer
composité et ne peut plus dépendre du layer périmé. L'inline style est
copié par cloneNode dans clonePage(), donc le fix survit au flip-book. */
var BFW_LIST_GUARD = 1400; /* <li> au-dessus : reste sécable (densité) */
var BFW_LEAF_LI_HANDLER_JS = [
'(function () {',
'  if (!window.Paged || !window.Paged.Handler) { return; }',
'  var GUARD = ' + BFW_LIST_GUARD + ';',
'  function isPrintContext() {',
'    if (document.body && document.body.getAttribute("data-bfw-print") === "1") { return true; }',
'    return !!(window.matchMedia && window.matchMedia("print").matches);',
'  }',
'  function tagLeafListItems(content) {',
'    var allLi = content.querySelectorAll("li");',
'    for (var i = 0; i < allLi.length; i++) {',
'      var li = allLi[i];',
'      var hasNestedList = false;',
'      for (var j = 0; j < li.children.length; j++) {',
'        var cls = li.children[j].className || "";',
'        if (typeof cls === "string" &&',
'            (cls.indexOf("ulist") !== -1 || cls.indexOf("olist") !== -1)) {',
'          hasNestedList = true;',
'          break;',
'        }',
'      }',
'      if (hasNestedList) { li.classList.add("bfw-branch-li"); }',
'      else if (li.textContent.trim().length < GUARD) { li.classList.add("bfw-leaf-li"); }',
'    }',
'    console.log("[book-flip] <li> tagués :", content.querySelectorAll(".bfw-leaf-li").length,',
'      "feuilles /", content.querySelectorAll(".bfw-branch-li").length, "branches");',
'  }',
'  var EDGE_SLACK = 3; /* px : en dessous, le <li> est « au ras du bord » */',
'  function healEdgeItems(root) {',
'    var pages = (root || document).querySelectorAll(".pagedjs_page");',
'    var healed = 0;',
'    Array.prototype.forEach.call(pages, function (page) {',
'      var area = page.querySelector(".pagedjs_area");',
'      if (!area) { return; }',
'      var bottom = area.getBoundingClientRect().bottom;',
'      Array.prototype.forEach.call(page.querySelectorAll("li"), function (li) {',
'        if (li.querySelector("li")) { return; }  /* branches : hors périmètre */',
'        if (li.style.transform) { return; }      /* déjà traité : idempotent */',
'        var r = li.getBoundingClientRect();',
'        if (!r.height) { return; }               /* page masquée : rien à mesurer */',
'        if (bottom - (r.top + r.height) < EDGE_SLACK) {',
'          li.style.transform = "translateZ(0)";  /* LAISSÉ en place, volontairement */',
'          healed++;',
'        }',
'      });',
'    });',
'    if (healed) { console.log("[bfw] guérison bord de page :", healed, "item(s)"); }',
'    return healed;',
'  }',
'  window.bfwHealEdgeItems = healEdgeItems; /* exposé pour bfw.js (clones) */',
'',
'  function ensureProgressStage() {',
'    if (isPrintContext()) { return; }',
'    if (document.getElementById("bfw-stage")) { return; }',
'    var stage = document.createElement("div");',
'    stage.id = "bfw-stage";',
'    var d = document.createElement("div");',
'    d.id = "bfw-loading";',
'    d.innerHTML = \'<div class="bfw-progress-ring"><span class="bfw-progress-pct">0 %</span></div>\' +',
'                  \'<div class="bfw-progress-label">Pagination en cours…</div>\';',
'    stage.appendChild(d);',
'    document.body.appendChild(stage);',
'  }',
'  /* Avancement = rang, dans le source, du dernier élément posé sur la page.',
'     Le nombre total de pages est inconnu tant que la pagination n\'est pas',
'     finie ; les data-ref posés par Paged.js au parsing, eux, sont connus. */',
'  var refRank = {}, refTotal = 0, lastPct = 0;',
'  function indexRefs(parsed) {',
'    var els = parsed.querySelectorAll("[data-ref]");',
'    refRank = {};',
'    for (var i = 0; i < els.length; i++) { refRank[els[i].getAttribute("data-ref")] = i + 1; }',
'    refTotal = els.length;',
'    lastPct = 0;',
'  }',
'  function showProgress(pct) {',
'    var el = document.getElementById("bfw-loading");',
'    if (!el) { return; }',
'    var ring = el.querySelector(".bfw-progress-ring");',
'    var txt  = el.querySelector(".bfw-progress-pct");',
'    if (ring) { ring.style.setProperty("--bfw-p", pct); }',
'    if (txt)  { txt.textContent = pct + " %"; }',
'  }',
'  function updateProgress(pageElement) {',
'    if (isPrintContext() || !refTotal) { return; }',
'    var els = pageElement.querySelectorAll(".pagedjs_page_content [data-ref]");',
'    if (!els.length) { return; }  /* page blanche : avancement inchangé */',
'    var rank = refRank[els[els.length - 1].getAttribute("data-ref")] || 0;',
'    var pct = Math.min(99, Math.floor(rank * 100 / refTotal));',
'    if (pct <= lastPct) { return; }',
'    lastPct = pct;',
'    showProgress(pct);',
'  }',
'',
'  /* Folios : aucun avant la page [.start-numbering] ; ensuite folio =',
'     rang physique - rang de départ + 1 (copie de counter(page) pour bfw.js,',
'     les compteurs CSS ne survivant pas à cloneNode). */',
'  /* Aucun folio non plus sur les couvertures, ni à partir de la 4e de couverture. */',
'  function markFolios() {',
'    var pages = document.querySelectorAll(".pagedjs_page");',
'    var start = -1, end = pages.length;',
'    for (var i = 0; i < pages.length; i++) {',
'      if (start < 0 && pages[i].querySelector(".start-numbering")) { start = i; }',
'      if (pages[i].querySelector(".couv-back")) { end = i; break; }',
'    }',
'    if (start >= 0) {',
'      pages[start].setAttribute("data-bfw-start", "1");',
'      console.log("[bfw] folio 1 sur la page physique", start + 1);',
'    }',
'    for (var k = 0; k < pages.length; k++) {',
'      var p = pages[k];',
'      var isCover = p.classList.contains("bfw-has-couv-front") || p.classList.contains("bfw-has-couv-back");',
'      if ((start >= 0 && k < start) || k >= end || isCover) {',
'        p.classList.add("bfw-no-folio");',
'        p.removeAttribute("data-bfw-folio");',
'      } else if (start >= 0) {',
'        p.setAttribute("data-bfw-folio", String(k - start + 1));',
'      }',
'    }',
'  }',
'',
'  class BfwLeafListHandler extends window.Paged.Handler {',
'    beforeParsed(content) { ensureProgressStage(); tagLeafListItems(content); }',
'    afterParsed(parsed) { indexRefs(parsed); }',
'    afterPageLayout(pageElement) {',
'      updateProgress(pageElement);',
'      /* Détection des couvertures définies dans le .adoc */',
'      if (pageElement.querySelector(".couv-front")) {',
'        pageElement.classList.add("bfw-has-couv-front");',
'      }',
'      if (pageElement.querySelector(".couv-back")) {',
'        pageElement.classList.add("bfw-has-couv-back");',
'      }',
'    }',
'    afterRendered(pages) {',
'      var st = document.getElementById("bfw-stage");',
'      if (st && isPrintContext() && st.parentNode) { st.parentNode.removeChild(st); }',
'      if (!isPrintContext()) { showProgress(100); }',
'      markFolios();',
'      healEdgeItems();',
'    }',
'  }',
'  window.Paged.registerHandlers(BfwLeafListHandler);',
'})();'
].join('\n');

function readCss(/* ...segments */) {
var file = path.join.apply(path, [PDF_CSS_DIR].concat(Array.prototype.slice.call(arguments)));
console.log('css commun: ' + file);
try { return fs.readFileSync(file, 'utf8'); }
catch (e) { console.log('ERROR reading ' + file + ': ' + e.message); return ''; }
}

var ASCIIDOCTOR_CSS =
readCss('custom/asciidoctor.css') +
readCss('custom/document.css') +
readCss('custom/page-size.css') +
readCss('default/features', 'book.css') +
readCss('custom/features', 'title-page.css') +
readCss('default/features', 'title-document-numbering.css') +
readCss('custom.css');

/* Construit le <style>@page{...}</style> de surcharge ponctuelle de la
taille du livre, si -a book-width=... -a book-height=... est fourni
(sinon la taille par défaut vient de custom/page-size.css, déjà dans
ASCIIDOCTOR_CSS ci-dessus — donc déjà partagée PDF + vue animée). */
function pageSizeOverride(node) {
var w = node.getAttribute('book-width')  || '';
var h = node.getAttribute('book-height') || '';
return (w && h)
? '<style>@page { size: ' + w + ' ' + h + ' !important; }</style>'
: '';
}

/* Convertisseur de section, partagé : reporte id/rôle sur <section>,
et utilise le VRAI niveau AsciiDoc (node.getLevel()) pour la classe
— sect1/sect2/sect3... — au lieu de tout figer sur "sect1" (c'était
la cause du bug de saut de page avant chaque sous-section : book.css
ne cible que .sect1, donc seul le niveau 1 (chapitre) doit le porter). */
function section(node) {
var title = node.getTitle() === '!' ? '' : '<h2>' + node.getTitle() + '</h2>';
var id    = node.getId()   ? ' id="'   + node.getId()   + '"' : '';
var role  = node.getRole() ? ' ' + node.getRole() : '';
var levelClass = 'sect' + node.getLevel();
return '<section class="' + levelClass + role + '"' + id + '>' + title
+ '<div class="sectionbody">' + node.getContent() + '</div></section>';
}

module.exports = {
ASCIIDOCTOR_CSS: ASCIIDOCTOR_CSS,
BFW_CSS: BFW_CSS,
BFW_LEAF_LI_HANDLER_JS: BFW_LEAF_LI_HANDLER_JS,
pageSizeOverride: pageSizeOverride,
section: section,
};