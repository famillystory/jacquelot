(function () {
'use strict';
function injectStage() {
if (document.getElementById('bfw-stage')) return;
var stage = document.createElement('div');
stage.id = 'bfw-stage';
stage.innerHTML = '<div id="bfw-loading">Pagination en cours…</div>';
document.body.appendChild(stage);
}
function injectCounterOverrideStyle() {
if (document.getElementById('bfw-counter-override')) return;
var style = document.createElement('style');
style.id = 'bfw-counter-override';
style.textContent =
'.pagedjs_margin-content[data-bfw-clear]::after,' +
'.pagedjs_margin-content[data-bfw-clear]::before {' +
'  content: none !important;' +
'}';
document.head.appendChild(style);
}
/* Masquage des pages Paged.js statiques une fois le flip-book construit.
   Injecté APRÈS la pagination : le polisher de Paged.js supprime les blocs
   @media screen des feuilles de style traitées, une balise posée après coup
   (comme #bfw-counter-override) n'est donc jamais touchée. Le @media screen
   préserve la sortie d'impression, où les pages statiques sont le rendu. */
function hideStaticPages() {
if (document.getElementById('bfw-hide-static')) return;
var style = document.createElement('style');
style.id = 'bfw-hide-static';
style.textContent =
'@media screen {' +
'.pagedjs_pages { display: none !important; }' +
'}';
document.head.appendChild(style);
}
function findCounterCell(p) {
var candidates = Array.from(p.querySelectorAll(
'.pagedjs_margin-bottom-left .pagedjs_margin-content,' +
'.pagedjs_margin-bottom-right .pagedjs_margin-content'
));
for (var i = 0; i < candidates.length; i++) {
var content = window.getComputedStyle(candidates[i], '::after').getPropertyValue('content');
if (content && content.indexOf('counter') !== -1) return candidates[i];
}
var isLeft = p.classList.contains('pagedjs_left_page');
var side = isLeft ? 'pagedjs_margin-bottom-left' : 'pagedjs_margin-bottom-right';
return p.querySelector('.' + side + '.hasContent .pagedjs_margin-content') || null;
}
function snapshotPageNumbers(pages) {
var defaultTopOffset = 0;
pages.forEach(function(p) {
if (defaultTopOffset) return;
if (p.classList.contains('pagedjs_first_page')) return;
var mc = p.querySelector(
'.pagedjs_margin-bottom-left.hasContent,' +
'.pagedjs_margin-bottom-right.hasContent'
);
if (!mc) return;
var mcs = window.getComputedStyle(mc);
var v = (parseFloat(mcs.borderTopWidth) || 0) + (parseFloat(mcs.paddingTop) || 0);
if (v > 0) defaultTopOffset = v;
});
pages.forEach(function(p) {
var num = p.getAttribute('data-bfw-folio') || p.getAttribute('data-page-number');
if (!num) return;
var allCells = Array.from(p.querySelectorAll(
'.pagedjs_margin-bottom-left.hasContent .pagedjs_margin-content,' +
'.pagedjs_margin-bottom-right.hasContent .pagedjs_margin-content'
));
if (p.classList.contains('pagedjs_first_page') || p.classList.contains('bfw-no-folio')) {
allCells.forEach(function(c) { c.setAttribute('data-bfw-clear', '1'); });
return;
}
var activeCell = findCounterCell(p);
if (!activeCell && allCells.length > 0) {
var isLeft = p.classList.contains('pagedjs_left_page');
var side   = isLeft ? 'pagedjs_margin-bottom-left' : 'pagedjs_margin-bottom-right';
activeCell = p.querySelector('.' + side + '.hasContent .pagedjs_margin-content')
|| allCells[0];
}
if (activeCell) {
activeCell.setAttribute('data-bfw-pagenum', num);
var isRight = activeCell.closest('.pagedjs_margin-bottom-right') !== null;
activeCell.setAttribute('data-bfw-side', isRight ? 'right' : 'left');
var marginCell = activeCell.closest('.pagedjs_margin-bottom-left, .pagedjs_margin-bottom-right');
var topOffset  = defaultTopOffset;
if (marginCell) {
var mcs = window.getComputedStyle(marginCell);
var v   = (parseFloat(mcs.borderTopWidth) || 0) + (parseFloat(mcs.paddingTop) || 0);
if (v > 0) topOffset = v;
}
activeCell.setAttribute('data-bfw-top', topOffset);
allCells.forEach(function(c) {
if (c !== activeCell) c.setAttribute('data-bfw-clear', '1');
});
} else {
allCells.forEach(function(c) { c.setAttribute('data-bfw-clear', '1'); });
}
});
}
function clearPageNums(p) {
p.querySelectorAll(
'.pagedjs_margin-bottom-left.hasContent .pagedjs_margin-content,' +
'.pagedjs_margin-bottom-right.hasContent .pagedjs_margin-content'
).forEach(function(cell) {
cell.removeAttribute('data-bfw-pagenum');
cell.removeAttribute('data-bfw-side');
cell.setAttribute('data-bfw-clear', '1');
});
}
function restoreImages(root) {
var imgs = root.querySelectorAll('img[data-src]');
for (var i = 0; i < imgs.length; i++) {
var img = imgs[i];
var real = img.getAttribute('data-src');
if (real && img.getAttribute('src') !== real) {
img.setAttribute('src', real);
}
}
}
function clonePage(p) {
var c = p.cloneNode(true);
c.querySelectorAll('.pagedjs_margin-content[data-bfw-pagenum]').forEach(function(cell) {
var num      = cell.getAttribute('data-bfw-pagenum');
var isRight  = cell.getAttribute('data-bfw-side') === 'right';
var topOffset = parseFloat(cell.getAttribute('data-bfw-top')) || 0;
var marginCell = cell.closest('.pagedjs_margin-bottom-left, .pagedjs_margin-bottom-right');
if (marginCell) marginCell.style.position = 'relative';
var target = marginCell || cell;
cell.innerHTML = '';
var span = document.createElement('span');
span.className = 'bfw-injected-num';
span.textContent = num;
span.style.cssText =
'position:absolute;top:' + topOffset + 'px;' +
(isRight ? 'right:4px;text-align:right;' : 'left:4px;text-align:left;') +
'font:inherit;color:inherit;white-space:nowrap;font-size:0.8rem;';
target.appendChild(span);
cell.setAttribute('data-bfw-clear', '1');
});
c.querySelectorAll('.pagedjs_margin-content').forEach(function(cell) {
if (cell.querySelector('.bfw-injected-num')) return;
cell.innerHTML = '';
cell.style.setProperty('content', 'none', 'important');
cell.setAttribute('data-bfw-clear', '1');
});
restoreImages(c);
return c;
}
function makePage(html, extraCss) {
var div = document.createElement('div');
div.className = 'pagedjs_page bfw-custom-page';
div.style.cssText = 'width:100%;height:100%;position:relative;overflow:hidden;box-sizing:border-box;' + (extraCss||'');
div.innerHTML = html;
return div;
}
function makeBlankPage(model) {
var b = model.cloneNode(true);
b.removeAttribute('id');
b.removeAttribute('data-bfw-start');
b.removeAttribute('data-bfw-folio');
b.classList.add('pagedjs_blank_page', 'bfw-no-folio');
b.querySelectorAll('[id]').forEach(function(el) { el.removeAttribute('id'); });
var content = b.querySelector('.pagedjs_page_content');
if (content) content.innerHTML = '';
clearPageNums(b);
return b;
}
function buildBook(pages) {
injectStage();
/* SUPPRESSION : plus de makeCoverPage() ni makeColophonPage()
Les couvertures sont maintenant définies dans le .adoc via
[.couv.couv-front] et [.couv.couv-back] */
var body = document.body;
var pagedPages = Array.prototype.slice.call(pages);
/* Paged.js met l'index 0 à droite, le flip-book à gauche : si la page
   [.start-numbering] tombe à gauche d'une double page, on insère une
   page blanche avant elle (la parité des pages suivantes, dont la 4e
   de couverture, redevient alors celle de Paged.js). */
var startIdx = -1;
for (var s = 0; s < pagedPages.length; s++) {
if (pagedPages[s].hasAttribute('data-bfw-start')) { startIdx = s; break; }
}
if (startIdx >= 0 && startIdx % 2 === 0) {
pagedPages.splice(startIdx, 0, makeBlankPage(pagedPages[startIdx]));
}
pages = pagedPages;
var spreads = [];
for (var i = 0; i < pages.length; i += 2)
spreads.push({ left: pages[i], right: pages[i + 1] || null });
if (!spreads.length) return;
/* Les ancres internes (#_chapitre_i…, TOC, notes) pointent vers des
   éléments répartis dans les pages Paged.js statiques (masquées) : on
   retrouve la double page qui contient l'ancre pour que les liens de la
   table des matières ouvrent le flip-book au bon endroit. */
function spreadForAnchor(id) {
if (!id) return -1;
var sel = '[id="' + id.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"]';
for (var i = 0; i < spreads.length; i++) {
if ((spreads[i].left && spreads[i].left.querySelector(sel)) ||
(spreads[i].right && spreads[i].right.querySelector(sel))) return i;
}
return -1;
}
var cur = 0, flipping = false;
var r  = pages[0].getBoundingClientRect();
var PW = Math.round(r.width)  || 420;
var PH = Math.round(r.height) || 595;
console.log('[book-flip] démarrage', pages.length, 'pages', PW + 'x' + PH);
var stage = document.getElementById('bfw-stage');
stage.innerHTML = '';
var MARGIN = 32;
var BOOK_W = PW * 2 + 28;
var BOOK_H = PH;
var availW = document.documentElement.clientWidth  - MARGIN * 2;
var availH = document.documentElement.clientHeight - MARGIN * 2;
var S      = Math.min(availW / BOOK_W, availH / BOOK_H, 1);
var bwrap = document.createElement('div');
bwrap.style.cssText = 'position:relative;flex-shrink:0;' +
'width:'  + Math.round(BOOK_W * S) + 'px;' +
'height:' + Math.round(BOOK_H * S + 60) + 'px;' +
'overflow:visible;margin:0 auto;';
var book = document.createElement('div');
book.className = 'bfw-book';
book.style.cssText = 'width:' + BOOK_W + 'px;height:' + BOOK_H + 'px;' +
'position:absolute;top:0;left:0;' +
'transform:scale(' + S + ');transform-origin:top left;';
var cover = document.createElement('div'); cover.className = 'bfw-cover';
var spine = document.createElement('div'); spine.className = 'bfw-spine';
spine.style.left = (PW + 4) + 'px'; spine.style.width = '20px';
book.appendChild(cover); book.appendChild(spine);
var areaL = document.createElement('div');
areaL.className = 'bfw-area bfw-area-left';
areaL.style.cssText = 'left:14px;width:' + PW + 'px';
var slotL = document.createElement('div'); slotL.className = 'bfw-slot bfw-slot-left';
areaL.appendChild(slotL); book.appendChild(areaL);
var areaR = document.createElement('div');
areaR.className = 'bfw-area bfw-area-right';
areaR.style.cssText = 'right:14px;width:' + PW + 'px';
var slotR = document.createElement('div'); slotR.className = 'bfw-slot bfw-slot-right';
var curl  = document.createElement('div'); curl.className  = 'bfw-curl';
areaR.appendChild(slotR); areaR.appendChild(curl); book.appendChild(areaR);
var flip = document.createElement('div');
flip.className = 'bfw-flip is-right';
flip.style.cssText = 'width:' + PW + 'px;right:14px;left:auto;pointer-events:none';
var ff = document.createElement('div'); ff.className = 'bfw-flip-front';
var fb = document.createElement('div'); fb.className = 'bfw-flip-back';
flip.appendChild(ff); flip.appendChild(fb); book.appendChild(flip);
bwrap.appendChild(book);
stage.appendChild(bwrap);
var ctrl  = document.createElement('div');   ctrl.className  = 'bfw-controls';
ctrl.style.margin = '0 auto';
var bPrev = document.createElement('button'); bPrev.className = 'bfw-btn';
bPrev.innerHTML = '◀ Précédent';
var ind   = document.createElement('span');   ind.className   = 'bfw-indicator';
var bNext = document.createElement('button'); bNext.className = 'bfw-btn';
bNext.innerHTML = 'Suivant ▶';
ctrl.appendChild(bPrev); ctrl.appendChild(ind); ctrl.appendChild(bNext);
stage.appendChild(ctrl);
function fill(slot, page) {
slot.innerHTML = '';
if (page) slot.appendChild(clonePage(page));
}
function render(i) {
var s = spreads[i];
fill(slotL, s.left); fill(slotR, s.right); fill(ff, s.right);
ind.textContent = (i*2+1) + (s.right ? ' – ' + (i*2+2) : '');
bPrev.disabled = (i === 0);
bNext.disabled = (i === spreads.length - 1);
var isEdge = (i === 0 || i === spreads.length - 1);
cover.style.display = isEdge ? 'none' : '';
spine.style.display = isEdge ? 'none' : '';
updateEdgeArrows(i);
updateBackBtn(i);
updateTocBtn(i);
}
var tocBtn = null; /* bouton « Table des matières », créé plus bas si le
                      doc a une TOC ; enfant du livre, sous le bord inférieur */
function doFlip(dir) {
if (flipping) {
flipping = false;
flip.removeEventListener('animationend', flip._onEnd);
if (flip._safeTimer) { clearTimeout(flip._safeTimer); flip._safeTimer = null; }
if (flip._pendingNxt !== undefined) { cur = flip._pendingNxt; flip._pendingNxt = undefined; }
flip.classList.remove('anim-fwd','anim-bwd','is-left');
flip.classList.add('is-right');
flip.style.cssText = 'width:' + PW + 'px;right:14px;left:auto;pointer-events:none';
render(cur);
setHash(cur);
}
var nxt = cur + dir;
if (nxt < 0 || nxt >= spreads.length) return;
/* Navigation manuelle : la mémorisation du lien « Retour » est effacée. */
clearLinkJump();
flipping = true;
flip.style.pointerEvents = 'auto';
var isEdge = (nxt === 0 || nxt === spreads.length - 1);
cover.style.display = isEdge ? 'none' : '';
spine.style.display = isEdge ? 'none' : '';
var sn = spreads[nxt];
flip.classList.remove('anim-fwd','anim-bwd','is-right','is-left');
void flip.offsetWidth;
if (dir > 0) {
fill(ff, spreads[cur].right); fill(fb, sn.left);
flip.classList.add('is-right','anim-fwd');
flip.style.cssText = 'width:' + PW + 'px;right:14px;left:auto;pointer-events:none';
fill(slotR, sn.right);
} else {
fill(ff, spreads[cur].left); fill(fb, sn.right);
flip.classList.add('is-left','anim-bwd');
flip.style.cssText = 'width:' + PW + 'px;left:14px;right:auto;pointer-events:none';
fill(slotL, sn.left);
}
flip.style.animationDuration = '';
var durMs = parseFloat(
getComputedStyle(document.documentElement).getPropertyValue('--bfw-dur') || '1.2'
) * 1000;
function onEnd() {
flip.removeEventListener('animationend', onEnd);
if (flip._safeTimer) { clearTimeout(flip._safeTimer); flip._safeTimer = null; }
cur = nxt; flipping = false;
flip.classList.remove('anim-fwd','anim-bwd','is-left');
flip.classList.add('is-right');
flip.style.cssText = 'width:' + PW + 'px;right:14px;left:auto;pointer-events:none';
flip.style.transform = '';
render(cur);
setHash(cur);
}
flip._pendingNxt = nxt;
flip._onEnd = onEnd;
flip.addEventListener('animationend', onEnd);
flip._safeTimer = setTimeout(onEnd, durMs + 100);
}
bNext.addEventListener('click', function () { doFlip(1); });
bPrev.addEventListener('click', function () { doFlip(-1); });
document.addEventListener('keydown', function (e) {
if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); doFlip(1);  }
if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   { e.preventDefault(); doFlip(-1); }
});
function bfwUrl(val, def) {
if (val === undefined) return def;
val = val.trim();
if (val === '' ) return def;
if (val === 'none') return '';
return val;
}
var URL_PREV = bfwUrl(document.body.dataset.bfwPrev, 'Previous.html');
var URL_NEXT = bfwUrl(document.body.dataset.bfwNext, 'Next.html');
var arrowL = document.createElement('div');
arrowL.innerHTML = '◀';
arrowL.style.cssText = 'position:absolute;top:50%;left:16px;transform:translateY(-50%);font-size:2.5rem;color:rgba(201,168,76,0.5);pointer-events:none;z-index:30;display:none;';
book.appendChild(arrowL);
var arrowR = document.createElement('div');
arrowR.innerHTML = '▶';
arrowR.style.cssText = 'position:absolute;top:50%;right:16px;transform:translateY(-50%);font-size:2.5rem;color:rgba(201,168,76,0.5);pointer-events:none;z-index:30;display:none;';
book.appendChild(arrowR);
function updateEdgeArrows(i) {
arrowL.style.display = (i === 0 && URL_PREV) ? '' : 'none';
arrowR.style.display = (i === spreads.length - 1 && URL_NEXT) ? '' : 'none';
}
/* Bouton « Retour » après un saut par lien interne vers une double page
   éloignée (plus d'un tour) : un clic ramène à la double page d'origine
   du lien. Placé près du canon (centre du livre), sur la page opposée à
   celle qui porte l'ancre ciblée, pour ne pas masquer le contenu atteint.
   Flèche seule, orientée vers l'origine : ↩ (orig. avant), ↪ (orig. après).
   Toute navigation manuelle (flips) efface la mémorisation. */
var linkReturn = null, linkTarget = -1, linkAnchor = null;
var backBtn = document.createElement('button');
backBtn.type = 'button';
backBtn.className = 'bfw-btn bfw-back-link';
backBtn.style.display = 'none';
book.appendChild(backBtn);
function clearLinkJump() {
linkReturn = null; linkTarget = -1; linkAnchor = null;
backBtn.style.display = 'none';
}
function anchorOnLeft(idx, id) {
if (!id) return false;
var sel = '[id="' + id.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"]';
return !!(spreads[idx].left && spreads[idx].left.querySelector(sel));
}
function updateBackBtn(i) {
if (linkReturn === null || i !== linkTarget || Math.abs(linkReturn - linkTarget) < 2) {
backBtn.style.display = 'none';
return;
}
var onLeft = !anchorOnLeft(linkTarget, linkAnchor);
if (onLeft) {
backBtn.style.left = 'auto';
backBtn.style.right = (PW + 32) + 'px';
} else {
backBtn.style.left = (PW + 32) + 'px';
backBtn.style.right = 'auto';
}
/* Origine avant → flèche crochets gauche ; origine après → droite. */
backBtn.innerHTML = (linkReturn < linkTarget) ? '&#8617;' : '&#8618;';
backBtn.title = 'Retour à la page du lien';
backBtn.style.display = '';
}
backBtn.addEventListener('click', function () {
if (linkReturn === null) return;
var dst = linkReturn;
clearLinkJump();
cur = dst; render(cur); setHash(cur);
});
/* Bouton « Table des matières » : identique à l'ancien bouton posé sur le
   livre (enfants de `book`, mêmes coordonnées, alternance gauche/droite
   selon la position de la TOC relativement à la page courante), mais
   déplacé verticalement sous le bord inférieur — dans la bande de 60 px
   déjà réservée sous le livre par bwrap, sans escamoter la rangée
   « Précédent / Suivant » ni obligeant à scroller.
   Masqué sur la TOC elle-même (ou sans TOC dans le doc), et aussi tant
   que le bouton « Retour » est affiché — celui-ci renvoie à la page
   exacte du lien, plus précis qu'un saut vers la TOC.
   Un clic mémorise l'origine pour le bouton « Retour » si le saut est
   lointain. */
var tocSpread = spreadForAnchor('toc');
var updateTocBtn = function () {};
if (tocSpread >= 0) {
tocBtn = document.createElement('button');
tocBtn.type = 'button';
tocBtn.className = 'bfw-btn bfw-toc-link';
tocBtn.innerHTML = '&#9776;';
tocBtn.title = 'Table des matières';
tocBtn.style.display = 'none';
book.appendChild(tocBtn);
updateTocBtn = function (i) {
if (i === tocSpread || linkReturn !== null) { tocBtn.style.display = 'none'; return; }
if (i < tocSpread) {
tocBtn.style.left = (PW + 32) + 'px';
tocBtn.style.right = 'auto';
} else {
tocBtn.style.left = 'auto';
tocBtn.style.right = (PW + 32) + 'px';
}
tocBtn.style.top = 'auto';
tocBtn.style.bottom = '-3.3rem';
tocBtn.style.transform = 'none';
tocBtn.style.display = '';
};
tocBtn.addEventListener('click', function () {
if (Math.abs(tocSpread - cur) >= 2) {
linkReturn = cur; linkTarget = tocSpread; linkAnchor = 'toc';
} else {
clearLinkJump();
}
cur = tocSpread; render(cur); setHash(cur);
});
}
document.addEventListener('click', function(e) {
var bookRect = book.getBoundingClientRect();
var inBook = e.clientX >= bookRect.left && e.clientX <= bookRect.right &&
e.clientY >= bookRect.top  && e.clientY <= bookRect.bottom;
if (!inBook) return;
var link = e.target.closest('a');
if (link) {
/* Ancre interne (TOC, notes, liens croisés) : ouvrir le flip-book à la
   double page qui contient l'ancre au lieu du comportement par défaut
   (défilement des pages statiques masquées sous le flip-book). */
var href = link.getAttribute('href') || '';
var hi = href.indexOf('#');
if (hi >= 0) {
var frag = href.slice(hi + 1);
var sp = -1, aid = null;
var ms = frag.match(/^spread-(\d+)$/);
var ml = frag.match(/^last-(\d+)$/);
if (ms) {
sp = Math.min(parseInt(ms[1], 10), spreads.length - 1);
} else if (ml) {
sp = Math.max(0, spreads.length - 1 - parseInt(ml[1], 10));
} else {
try { aid = decodeURIComponent(frag); } catch (err) { aid = frag; }
sp = spreadForAnchor(aid);
}
/* N'intercepter que les liens menant à ce document : `#ancre` pur, ou
   lien explicite vers l'URL courante (link:livre-demo.anime.html#…[]
   écrit dans l'AsciiDoc). Un lien vers un autre fichier (Prev.html,
   Next.html) reste une vraie navigation. */
var sameDoc = hi === 0;
if (!sameDoc) {
var res = document.createElement('a');
res.href = href;
sameDoc = (res.pathname === location.pathname && res.search === location.search);
}
if (sameDoc && sp >= 0 && sp !== cur) {
e.preventDefault();
/* Saut lointain (≥ 2 doubles pages) : mémoriser l'origine pour le
   bouton « Retour » ; un saut proche ne le mérite pas. */
if (Math.abs(sp - cur) >= 2) {
linkReturn = cur; linkTarget = sp; linkAnchor = aid;
} else {
clearLinkJump();
}
cur = sp; render(cur); setHash(cur);
}
}
return;
}
if (e.target.closest('button, input, select, textarea')) return;
var mid = bookRect.left + bookRect.width / 2;
if (e.clientX < mid) {
if (cur === 0 && URL_PREV) { location.href = URL_PREV; return; }
doFlip(-1);
} else {
if (cur === spreads.length - 1 && URL_NEXT) { location.href = URL_NEXT; return; }
doFlip(1);
}
}, true);
function setHash(i) { history.replaceState(null, '', '#spread-' + i); }
function getHashSpread() {
var m = location.hash.match(/^#?spread-(\d+)$/);
if (m) return Math.min(parseInt(m[1]), spreads.length - 1);
var ml = location.hash.match(/^#?last-(\d+)$/);
if (ml) return Math.max(0, spreads.length - 1 - parseInt(ml[1]));
/* Ancre interne (TOC, liens croisés) → double page la contenant.
   location.hash est percent-encodé par le navigateur (è → %C3%A8) :
   décoder avant la recherche d'id. */
if (location.hash.length > 1) {
var raw = location.hash.slice(1);
var id;
try { id = decodeURIComponent(raw); } catch (err) { id = raw; }
var a = spreadForAnchor(id);
if (a >= 0) return a;
}
return 0;
}
window.addEventListener('hashchange', function() {
var i = getHashSpread();
if (i !== cur) {
clearLinkJump();
cur = i;
render(cur);
setHash(cur);
}
});
var startSpread = getHashSpread();
render(startSpread);
cur = startSpread;
setHash(startSpread);
}
if (!window.PagedConfig) window.PagedConfig = {};
window.PagedConfig.after = function () {
if (window.matchMedia && window.matchMedia('print').matches) {
console.log('[book-flip] contexte impression détecté — pagination standard, pas de flip-book');
return;
}
function tryBuild(attempts) {
var pages = Array.prototype.slice.call(document.querySelectorAll('.pagedjs_page'));
if (!pages.length || pages[0].getBoundingClientRect().width === 0) {
if (attempts > 0) { setTimeout(function(){ tryBuild(attempts-1); }, 100); }
return;
}
console.log('[book-flip] build:', pages.length, 'pages');
snapshotPageNumbers(pages);
injectCounterOverrideStyle();
buildBook(pages);
hideStaticPages();
document.body.classList.add('bfw-ready');
window.scrollTo(0, 0);
}
setTimeout(function(){ tryBuild(30); }, 100);
};
}());