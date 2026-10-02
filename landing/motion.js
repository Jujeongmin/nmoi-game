/* PRE-SAVE LANDING — motion on the table scene and small touches for the other steps.
   The pictures are the painted table and generated light (assets/landing/glint.webp, candle.webp,
   assets/menu/gold-leaf.webp); this file only places and moves them. Styles: landing.css "Motion".

   CAVIAR.landingMotion.ambience(scene, img)   glints on the crystal and silver, the candle flickers,
                                               a light passes over the menu cover
   CAVIAR.landingMotion.leaf(host, x, y, n)    a few flakes of gold leaf drift from (x, y) px in host */
(function (NS) {
  'use strict';

  // Points on the table picture (assets/landing/table.webp, 1024 x 1536).
  var IMG_W = 1024, IMG_H = 1536;
  var CANDLE = { x: 357, y: 262, size: 230 };
  var GLINTS = [
    { x: 420, y: 226, s: 46 }, { x: 905, y: 70, s: 58 }, { x: 1000, y: 250, s: 44 }, { x: 862, y: 330, s: 36 },
    { x: 60, y: 612, s: 34 }, { x: 152, y: 562, s: 40 }, { x: 846, y: 560, s: 46 }, { x: 958, y: 640, s: 38 },
    { x: 525, y: 668, s: 40 }, { x: 752, y: 552, s: 44 }, { x: 266, y: 1010, s: 38 }, { x: 778, y: 975, s: 36 }
  ];
  var BOOK = { x: 290, y: 490, w: 490, h: 650 };   // the cover, inside its gold frame

  function el(tag, cls) { var n = document.createElement(tag); n.className = cls; return n; }
  function img(cls, path) { var n = el('img', cls); n.alt = ''; n.src = NS.url(path); return n; }

  function ambience(scene, picture) {
    var layer = el('span', 'lp-glints');
    layer.setAttribute('aria-hidden', 'true');
    var candle = img('lp-candle', 'assets/landing/candle.webp');
    layer.appendChild(candle);
    var glints = GLINTS.map(function (g, i) {
      var n = img('lp-glint', 'assets/landing/glint.webp');
      n.style.animationDelay = (i * 0.37 % 2.6).toFixed(2) + 's';
      n.style.animationDuration = (2.2 + (i * 0.53) % 1.6).toFixed(2) + 's';
      layer.appendChild(n);
      return n;
    });
    var sheen = el('span', 'lp-cover-sheen');
    layer.appendChild(sheen);
    scene.appendChild(layer);

    // Map picture coordinates through object-fit: cover; object-position: 50% 55% (landing.css).
    function place() {
      var W = scene.clientWidth, H = scene.clientHeight;
      if (!W || !H) return;
      var k = Math.max(W / IMG_W, H / IMG_H);
      var ox = (W - IMG_W * k) * 0.5, oy = (H - IMG_H * k) * 0.55;
      function put(n, x, y, size) {
        n.style.width = (size * k) + 'px';
        n.style.left = (ox + x * k) + 'px';
        n.style.top = (oy + y * k) + 'px';
      }
      put(candle, CANDLE.x, CANDLE.y, CANDLE.size);
      GLINTS.forEach(function (g, i) { put(glints[i], g.x, g.y, g.s); });
      sheen.style.left = (ox + BOOK.x * k) + 'px';
      sheen.style.top = (oy + BOOK.y * k) + 'px';
      sheen.style.width = (BOOK.w * k) + 'px';
      sheen.style.height = (BOOK.h * k) + 'px';
    }
    if (window.ResizeObserver) new ResizeObserver(place).observe(scene);
    else window.addEventListener('resize', place);
    if (picture && !picture.complete) picture.addEventListener('load', place);
    place();
  }

  function leaf(host, x, y, n) {
    for (var i = 0; i < n; i++) {
      var f = img('lp-leaf', 'assets/menu/gold-leaf.webp');
      f.style.left = x + 'px';
      f.style.top = y + 'px';
      f.style.setProperty('--dx', (Math.random() * 70 - 35).toFixed(0) + 'px');
      f.style.setProperty('--dy', (Math.random() * 30 + 16).toFixed(0) + 'px');
      f.style.setProperty('--r', (Math.random() * 300 - 150).toFixed(0) + 'deg');
      f.style.animationDelay = (i * 40) + 'ms';
      host.appendChild(f);
      setTimeout(function (node) { node.remove(); }.bind(null, f), 1100 + i * 40);
    }
  }

  NS.landingMotion = { ambience: ambience, leaf: leaf };
})(window.CAVIAR = window.CAVIAR || {});
