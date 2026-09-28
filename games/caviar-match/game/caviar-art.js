/* CAVIAR MATCH — caviar sprite factory for canvas.
   Draws a simple pearl (body gradient + rim + one soft highlight) and caches it
   per type and pixel size. If a type in CM.CONFIG.types has an `image`, that
   image is used instead — the only change needed when real art arrives. */
window.CM = window.CM || {};

CM.CaviarArt = (function () {
  'use strict';

  const TAU = Math.PI * 2;
  const cache = new Map();
  const images = [];

  function types() { return CM.CONFIG.types; }

  function preload() {
    types().forEach((t, i) => {
      if (!t.image) return;
      const img = new Image();
      img.onload = () => { images[i] = img; cache.clear(); };
      img.src = (CM.CONFIG.assetRoot || '') + t.image;
    });
  }

  function build(typeIndex, px) {
    const t = types()[typeIndex];
    const pad = Math.ceil(px * 0.2) + 2;
    const size = Math.ceil(px * 2 + pad * 2);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    const c = size / 2;
    const r = px;

    if (images[typeIndex]) {
      g.drawImage(images[typeIndex], c - r, c - r, r * 2, r * 2);
      return { canvas, size };
    }

    // Soft contact shadow
    g.fillStyle = 'rgba(0, 0, 0, 0.32)';
    g.beginPath();
    g.arc(c + r * 0.04, c + r * 0.1, r, 0, TAU);
    g.fill();

    // Body
    const body = g.createRadialGradient(c - r * 0.34, c - r * 0.4, r * 0.08, c, c, r);
    body.addColorStop(0, t.light);
    body.addColorStop(0.46, t.base);
    body.addColorStop(1, t.shade);
    g.fillStyle = body;
    g.beginPath();
    g.arc(c, c, r, 0, TAU);
    g.fill();

    // Rim (keeps dark caviar readable on a dark table)
    const lw = Math.max(1, r * 0.055);
    g.strokeStyle = t.rim;
    g.lineWidth = lw;
    g.beginPath();
    g.arc(c, c, r - lw / 2, 0, TAU);
    g.stroke();

    // Highlight
    g.save();
    g.translate(c - r * 0.36, c - r * 0.42);
    g.rotate(-0.62);
    g.fillStyle = 'rgba(255, 255, 255, ' + t.gloss + ')';
    g.beginPath();
    g.ellipse(0, 0, r * 0.24, r * 0.14, 0, 0, TAU);
    g.fill();
    g.restore();

    return { canvas, size };
  }

  function sprite(typeIndex, px) {
    const k = typeIndex + ':' + px;
    let s = cache.get(k);
    if (!s) {
      s = build(typeIndex, px);
      cache.set(k, s);
    }
    return s;
  }

  /** Draw caviar centred at (x, y) with radius r in the ctx's current units.
      pxPerUnit = device pixels per unit, so the sprite stays crisp. */
  function draw(ctx, typeIndex, x, y, r, pxPerUnit) {
    const px = Math.max(2, Math.round(r * pxPerUnit));
    const s = sprite(typeIndex, px);
    const drawn = s.size / pxPerUnit;
    ctx.drawImage(s.canvas, x - drawn / 2, y - drawn / 2, drawn, drawn);
  }

  return { preload, draw };
})();
