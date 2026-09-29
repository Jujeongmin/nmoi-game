/* CAVIAR MASTER CHEF — tuning & content.
   `image`: leave null to use the CSS placeholder, or set a URL relative to
   this game's index.html (e.g. 'assets/salmon.png') to swap in real art. */
(function (NS) {
  'use strict';

  NS.config = {
    gameId: 'caviar-master-chef',
    duration: 60,                 // seconds
    wrongPenalty: 2,              // seconds removed per wrong pick
    orderLengths: [3, 4, 5, 6],   // steps per order (last step = signature caviar); repeats last
    memorize: { base: 1.4, perStep: 0.5 }, // seconds the order stays readable
    serveDelay: 1.15,             // completion presentation before the next order
    resultDelay: 1.3,             // pause between time up and the result card

    score: {
      correct: 100,
      orderComplete: 500,
      perfectBonus: 300
    },

    // Path from this game's index.html to the repo root (shared assets live there).
    assetRoot: '../../',

    ingredients: [
      { id: 'cracker', label: '크래커', image: null },
      { id: 'cream',   label: '크림',   image: null },
      { id: 'lemon',   label: '레몬',   image: null },
      { id: 'herb',    label: '허브',   image: null },
      { id: 'salmon',  label: '연어',   image: null }
    ],

    // tone: white | green | black | gold  (maps to .cv-pearl--{tone})
    caviars: [
      { id: 'almas',    label: '알마스',   tone: 'white', image: null },
      { id: 'imperial', label: '임페리얼', tone: 'green', image: null },
      { id: 'classic',  label: '클래식',   tone: 'black', image: null },
      { id: 'platinum', label: '플래티넘', tone: 'gold',  image: null }
    ]
  };
})(window.CAVIAR = window.CAVIAR || {});
