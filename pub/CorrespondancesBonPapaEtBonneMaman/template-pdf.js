'use strict';
/*
   Template dédié au PDF (pagination "print" classique, sans interactivité).
   CSS et structure des sections viennent de template-common.js, partagé
   avec template.js (vue animée) — c'est ce qui garantit la mise en page
   identique entre les deux sorties, sans dupliquer la moindre règle CSS.

   Historique : une première version de ce fichier ne chargeait pas
   paged.polyfill.js, en supposant à tort que la génération PDF
   d'asciidoctor-web-pdf utilisait le moteur d'impression natif de
   Chromium plutôt que Paged.js. Résultat : marges, numérotation de
   page (content: counter(page)) et page blanche dynamique (.couv4)
   disparaissaient, puisque c'est justement Paged.js qui calcule tout
   ça — pas le CSS seul, ni Chromium seul. Le convertisseur PAR DÉFAUT
   d'asciidoctor-web-pdf charge lui-même paged.polyfill.js en interne ;
   un template custom doit donc le faire explicitement, comme ici.
*/

var common = require('./template-common.js');

module.exports = {
  document: function(node) {
    var title    = (node.getDocumentTitle() || '').replace(/"/g, '&quot;');
    var subtitle = (node.getAttribute('subtitle') || '').replace(/"/g, '&quot;');
    var author   = (node.getAttribute('author')   || '').replace(/"/g, '&quot;');

    return [
      '<!DOCTYPE html>',
      '<html lang="fr">',
      '<head>',
      '  <meta charset="UTF-8">',
      '  <title>' + node.getDocumentTitle() + '</title>',
      '  <!-- CSS commun (contenu, typographie, taille de page) -->',
      '  <style>' + common.ASCIIDOCTOR_CSS + '</style>',
      '  <!-- CSS du livre animé : on le charge aussi pour que les règles',
      '       de mise en page volontairement communes (ex: .couv4 sur',
      '       page de gauche, neutralisation des sauts de page indus)',
      '       s\'appliquent identiquement au PDF. Rien dans bfw.css ne',
      '       construit de flip-book tant que bfw.js n\'est pas chargé',
      '       (absent ici, propre au template de la vue animée). -->',
      '  <style>' + common.BFW_CSS + '</style>',
      '  <!-- Surcharge ponctuelle de la taille via -a book-width/book-height -->',
      '  ' + common.pageSizeOverride(node),
            '  <!-- Correction architecturale PDF : forcer la première page à avoir des boîtes de marges -->',
            '  <!-- Couverture pleine page : voir #cover plus bas dans le body. -->',
      '  <style>',
      '    @page :first {',
      '      margin: 0 !important;',
      '      /* Plus de background-image ici : l\'image devient un vrai <img>',
      '         dans #cover (voir body), pour pouvoir détecter son absence via',
      '         onerror et laisser le style de secours (titre/auteur) s\'afficher',
      '         si le fichier est manquant — un background-image CSS n\'a pas',
      '         d\'équivalent onerror. */',
      '      /* Supprimer absolument tous les traits de marge sur la couverture */',
      '      @top-left-corner     { border: none !important; }',
      '      @top-left           { border: none !important; }',
      '      @top-center         { border: none !important; }',
      '      @top-right          { border: none !important; }',
      '      @top-right-corner   { border: none !important; }',
      '      @bottom-left-corner  { border: none !important; }',
      '      @bottom-left         { border: none !important; }',
      '      @bottom-center        { border: none !important; }',
      '      @bottom-right         { border: none !important; }',
      '      @bottom-right-corner  { border: none !important; }',
      '    }',
      '    /* #cover reprend le style natif de title-page.css/coverI.css',
      '       (disposition, typographie des h1/h2) — on ajoute juste ce qu\'il',
      '       faut pour que l\'image de couverture (si présente) le recouvre. */',
      '    #cover { position: relative; overflow: hidden; }',
      '    #cover .bfw-cover-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 1; }',
      '    /* Folio 1 : porté par [.start-numbering] dans le .adoc (custom.css). */',
      '  </style>',
      '  <script src="./paged.polyfill.js"><\/script>',
      '  <script>' + common.BFW_LEAF_LI_HANDLER_JS + '<\/script>',
      '</head>',
      '<body data-bfw-print="1" data-title="' + title + '" data-subtitle="' + subtitle + '" data-author="' + author + '">',
      '  <!-- p.1 : couverture (@page :first). #cover porte le style natif',
      '       (title-page.css/coverI.css) comme style de secours ; l\'image',
      '       ci-dessous le recouvre si elle charge, et se retire elle-même',
      '       (onerror) si le fichier est absent — le style de secours reste',
      '       alors visible, jamais de page blanche. Div consomme la page',
      '       entière et empêche tout contenu de couler dessus (break-after). -->',
      '  <div id="cover" style="break-after: page;">',
      '    <h1>' + title + '</h1>',
      (subtitle ? '    <h2>' + subtitle + '</h2>' : ''),
      '    <img class="bfw-cover-img" src="./img/coverI.jpg" alt=""',
      '         onerror="this.style.display=\'none\';">',
      '  </div>',
      '  <!-- p.2 : la page blanche du .adoc (preamble, page nommée "preamble").',
      '       p.3 : premier chapitre, page droite, folio 1 (voir <style>). -->',
      '  <div class="bfw-book-start">',
        node.getContent(),
      '  </div>',
      '</body>',
      '</html>'
    ].join('\n');
  },

  section: common.section,
};