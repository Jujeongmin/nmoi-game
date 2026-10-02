/* CAVIAR ESCAPE — motion effects with generated sprites (assets/escape/fx, tools/make-escape-art.py).
   Particles are sprites that fly, spin, scale and fade; the camera adds shake, flash and a zoom punch.
   World-space particles are drawn by the renderer inside its camera transform; the flash is a
   full-screen overlay. Reduce motion (OS setting) softens shake and flash. */
(function (NS) {
  'use strict';

  var TAU = Math.PI * 2;
  var MAX = 250;
  function rand(a, b) { return a + Math.random() * (b - a); }

  /* sprite(key) returns a loaded image or null (the renderer owns the images). */
  function FX(sprite) {
    this.sprite = sprite;
    this.list = [];
    this.shakeT = 0; this.shakeDur = 0; this.shakeAmp = 0;
    this.flashT = 0; this.flashDur = 0; this.flashAlpha = 0; this.flashColor = '#fff';
    this.punchV = 0;
    this.zoom = 1;
    this.ox = 0; this.oy = 0;
  }

  var P = FX.prototype;

  P._calm = function () { return !!(NS.settings && NS.settings.reduceMotion && NS.settings.reduceMotion()); };

  P.clear = function () {
    this.list.length = 0;
    this.shakeT = this.flashT = 0;
    this.punchV = 0; this.zoom = 1;
  };

  /* p: { key, x, y, vx, vy, life, size, grow, drag, grav, rot, vr, alpha, pop } */
  P._add = function (p) {
    if (this.list.length >= MAX) this.list.shift();
    p.t = 0;
    p.vx = p.vx || 0; p.vy = p.vy || 0;
    p.drag = p.drag || 0; p.grav = p.grav || 0;
    p.rot = p.rot || 0; p.vr = p.vr || 0;
    p.grow = p.grow == null ? 1 : p.grow;
    p.alpha = p.alpha == null ? 1 : p.alpha;
    this.list.push(p);
    return p;
  };

  /* ---------- emitters ---------- */

  /* Twinkle stars (or another sprite) flying out of a point. */
  P.sparks = function (x, y, n, speed, key) {
    for (var i = 0; i < n; i++) {
      var a = rand(0, TAU), v = rand(0.35, 1) * (speed || 120);
      this._add({ key: key || 'twinkle', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: rand(0.4, 0.75), size: rand(7, 13), grow: 0.4, drag: 3.2, rot: rand(0, TAU), vr: rand(-5, 5) });
    }
  };

  P.bubbles = function (x, y, n, spread) {
    spread = spread || 6;
    for (var i = 0; i < n; i++) {
      this._add({ key: 'bubble', x: x + rand(-spread, spread), y: y + rand(-spread, spread),
        vx: rand(-8, 8), vy: rand(-38, -16), life: rand(0.7, 1.4), size: rand(3, 7),
        drag: 0.6, grav: -14, alpha: 0.85, wobble: rand(0, TAU) });
    }
  };

  /* An expanding ring sprite (gold shockwave by default). */
  P.ring = function (x, y, radius, life, key) {
    this._add({ key: key || 'ring', x: x, y: y, life: life || 0.55, size: 14, grow: (radius || 40) * 2 / 14, ring: true });
  };

  /* One sprite that pops in (overshoot), holds, and fades: sparks, pearl burst, glow ... */
  P.pop = function (x, y, key, size, life, opts) {
    var p = { key: key, x: x, y: y, life: life || 0.45, size: size || 48, grow: 1.15, pop: true, rot: rand(-0.3, 0.3) };
    if (opts) for (var k in opts) p[k] = opts[k];
    return this._add(p);
  };

  /* Text that pops in, overshoots, and drifts up (typography; the numbers change). */
  P.text = function (x, y, str, color, size, life) {
    this._add({ kind: 'text', x: x, y: y, vy: -26, life: life || 1.0, size: size || 13,
      color: color, text: str, drag: 1.2 });
  };

  /* Confetti ribbons and pearls falling from the top of the screen (success). */
  P.confetti = function (W, H, n) {
    for (var i = 0; i < n; i++) {
      this._add({ key: i % 3 ? 'confetti' : 'pearl', x: rand(0, W), y: rand(-H * 0.25, -6), vx: rand(-30, 30), vy: rand(40, 120),
        life: rand(1.8, 2.8), size: i % 3 ? rand(14, 22) : rand(6, 9), drag: 0.4, grav: 70, rot: rand(0, TAU), vr: rand(-6, 6),
        flutter: rand(0, TAU) });
    }
  };

  /* Burst from a point outward (success at the player). */
  P.burst = function (x, y, n) {
    for (var i = 0; i < n; i++) {
      var a = rand(0, TAU), v = rand(80, 240);
      this._add({ key: i % 3 ? 'confetti' : 'pearl', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60,
        life: rand(1.2, 2.0), size: i % 3 ? rand(14, 22) : rand(6, 9), drag: 1.6, grav: 120, rot: rand(0, TAU), vr: rand(-8, 8),
        flutter: rand(0, TAU) });
    }
  };

  /* ---------- camera ---------- */

  P.shake = function (amp, dur) {
    if (this._calm()) amp *= 0.25;
    if (amp >= this.shakeAmp * (this.shakeT > 0 ? this.shakeT / this.shakeDur : 0)) {
      this.shakeAmp = amp; this.shakeDur = this.shakeT = dur;
    }
  };

  P.flash = function (color, alpha, dur) {
    if (this._calm()) alpha *= 0.3;
    this.flashColor = color; this.flashAlpha = alpha; this.flashDur = this.flashT = dur;
  };

  /* A quick zoom-in that springs back. */
  P.punch = function (amount) {
    if (this._calm()) amount *= 0.3;
    this.punchV += amount * 14;
  };

  /* ---------- step + draw ---------- */

  P.update = function (dt) {
    if (this.shakeT > 0) {
      this.shakeT = Math.max(0, this.shakeT - dt);
      var k = this.shakeT / this.shakeDur, a = this.shakeAmp * k * k;
      this.ox = rand(-a, a); this.oy = rand(-a, a);
    } else { this.ox = this.oy = 0; }

    if (this.flashT > 0) this.flashT = Math.max(0, this.flashT - dt);

    // Spring the zoom back to 1.
    var z = this.zoom - 1;
    this.punchV += (-z * 260 - this.punchV * 18) * dt;
    this.zoom += this.punchV * dt;
    if (Math.abs(this.zoom - 1) < 0.0005 && Math.abs(this.punchV) < 0.01) { this.zoom = 1; this.punchV = 0; }

    for (var i = this.list.length - 1; i >= 0; i--) {
      var p = this.list[i];
      p.t += dt;
      if (p.t >= p.life) { this.list.splice(i, 1); continue; }
      var d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy = p.vy * d + p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
  };

  P.draw = function (ctx, font) {
    for (var i = 0; i < this.list.length; i++) {
      var p = this.list[i], q = p.t / p.life;
      if (p.kind === 'text') { this._text(ctx, p, q, font); continue; }
      var img = this.sprite(p.key);
      if (!img) continue;

      var scale, alpha;
      if (p.ring) {                      // grows fast, thins out
        var e = 1 - Math.pow(1 - q, 3);
        scale = 1 + (p.grow - 1) * e;
        alpha = 1 - q;
      } else if (p.pop) {                // 0 → 1.3 → 1, then fades
        scale = q < 0.18 ? q / 0.18 * 1.3 : q < 0.3 ? 1.3 - (q - 0.18) / 0.12 * 0.3 : 1 + (p.grow - 1) * (q - 0.3) / 0.7;
        alpha = q < 0.6 ? 1 : (1 - q) / 0.4;
      } else {
        scale = 1 + (p.grow - 1) * q;
        alpha = q > 0.7 ? (1 - q) / 0.3 : 1;
      }
      var s = p.size * scale;
      var w = s, h = s * img.naturalHeight / img.naturalWidth;
      if (img.naturalHeight > img.naturalWidth) { h = s; w = s * img.naturalWidth / img.naturalHeight; }
      var x = p.x, sy = 1;
      if (p.wobble != null) x += Math.sin(p.t * 6 + p.wobble) * 1.5;
      if (p.flutter != null) sy = Math.abs(Math.cos(p.t * 7 + p.flutter)) * 0.7 + 0.3;

      ctx.globalAlpha = alpha * p.alpha;
      ctx.save();
      ctx.translate(x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, sy);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  };

  P._text = function (ctx, p, q, font) {
    // Pop: 0 → 1.35 → 1 in the first 0.18 s.
    var s = p.t < 0.1 ? p.t / 0.1 * 1.35 : p.t < 0.18 ? 1.35 - (p.t - 0.1) / 0.08 * 0.35 : 1;
    ctx.globalAlpha = q < 0.7 ? 1 : (1 - q) / 0.3;
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(s, s);
    ctx.font = '800 ' + p.size + 'px ' + font;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(8, 10, 12, 0.85)';
    ctx.strokeText(p.text, 0, 0);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, 0, 0);
    ctx.restore();
    ctx.globalAlpha = 1;
  };

  P.drawFlash = function (ctx, w, h) {
    if (this.flashT <= 0) return;
    ctx.globalAlpha = this.flashAlpha * (this.flashT / this.flashDur);
    ctx.fillStyle = this.flashColor;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  };

  NS.FX = FX;
})(window.CAVIAR = window.CAVIAR || {});
