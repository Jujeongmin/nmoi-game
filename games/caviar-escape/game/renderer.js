/* CAVIAR ESCAPE — canvas renderer. Reads game state, never mutates it.
   Every picture is a generated sprite (config.assets; tools/make-escape-art.py): the midnight-ocean
   background, kelp and light-ray layers, pearls, warnings and the effects in fx.js.
   The code only moves them — kelp sways, rays breathe, bubbles rise, sharks swim (the sprite is cut
   into strips that wave toward the tail). Game events reach it through event(ev, game).

   Readability first: the background is dimmed, and sharks, pearls and the member get a soft
   light behind them, so nothing in play sinks into the scenery. */
(function (NS) {
  'use strict';

  var TAU = Math.PI * 2;
  var STRIPS = 10;         // shark sprite strips for the swimming wave
  var KELP_BANDS = 12;     // kelp sprite bands for the sway
  var BG_ALPHA = 0.42;     // background picture and kelp opacity over deep navy (low: the small sharks must read)

  function token(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function Renderer(canvas, config) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cfg = config;
    this.dpr = 1;
    this.scale = 1;
    this.cssW = this.cssH = 0;
    this.W = this.H = 0;
    this.time = 0;
    this.motes = [];
    this.deco = [];
    this.tints = {};

    this.col = {
      gold: token('--cv-gold', '#c9ae78'),
      goldBright: token('--cv-gold-bright', '#e2cc98'),
      alert: '#ff6a55'
    };
    this.uiFont = token('--cv-font-ui', 'sans-serif');

    var self = this;
    this.sprites = {};
    var assets = config.assets || {};
    for (var key in assets) {
      if (!assets[key]) continue;
      var img = new Image();
      if (key === 'bg') img.onload = function () { self._cacheBackdrop(); };
      img.src = assets[key];
      this.sprites[key] = img;
    }
    this.fx = new NS.FX(function (k) { return self._sprite(k); });

    // Member sheets (preloaded so switching members is instant).
    this.memberSheets = {};
    var members = NS.members || [];
    for (var i = 0; i < members.length; i++) {
      var sheet = new Image();
      sheet.src = NS.url(members[i].sheet);
      this.memberSheets[members[i].id] = sheet;
    }
    this.member = null;
    this.anim = { name: 'idle', t: 0 };
  }

  var P = Renderer.prototype;

  P.setMember = function (member) { this.member = member; };

  /* View-only animation state: 'idle' | 'frown' | 'dance'. Non-looping clips
     return to idle unless hold is set (game over keeps the last frown frame). */
  P.playAnim = function (name, hold) { this.anim = { name: name, t: 0, hold: !!hold }; };

  P._sprite = function (key) {
    var img = this.sprites[key];
    return img && img.complete && img.naturalWidth ? img : null;
  };

  /* A sprite recoloured once (e.g. the gold glow as a red danger glow), cached. */
  P._tinted = function (key, color) {
    var id = key + color, c = this.tints[id];
    if (c) return c;
    var img = this._sprite(key);
    if (!img) return null;
    c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    var g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    c.naturalWidth = c.width; c.naturalHeight = c.height;
    return (this.tints[id] = c);
  };

  /* Draw a sprite centred at (x, y); `size` = its longer side in world units. */
  P._spr = function (img, x, y, size, rot, alpha) {
    if (!img) return;
    var w = img.naturalWidth, h = img.naturalHeight, k = size / Math.max(w, h);
    var ctx = this.ctx;
    if (alpha != null) ctx.globalAlpha = alpha;
    if (rot) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      ctx.drawImage(img, -w * k / 2, -h * k / 2, w * k, h * k);
      ctx.restore();
    } else {
      ctx.drawImage(img, x - w * k / 2, y - h * k / 2, w * k, h * k);
    }
  };

  /* Returns world size for the logic: shorter side = config.worldMin units. */
  P.resize = function (cssW, cssH) {
    this.cssW = Math.max(1, cssW);
    this.cssH = Math.max(1, cssH);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
    this.scale = Math.min(this.cssW, this.cssH) / this.cfg.worldMin;
    this.W = this.cssW / this.scale;
    this.H = this.cssH / this.scale;
    this._seedScene();
    this._cacheBackdrop();
    return { W: this.W, H: this.H };
  };

  P._seedScene = function () {
    var n = Math.round(this.W * this.H / 9000);
    this.motes = [];
    for (var i = 0; i < n; i++) {
      this.motes.push({ x: rand(0, this.W), y: rand(0, this.H), r: rand(3, 8), v: rand(8, 22), a: rand(0.1, 0.25), ph: rand(0, TAU) });
    }
  };

  /* The background picture, cover-fitted (sand kept at the bottom) and half see-through over deep navy,
     so it stays a backdrop and never competes with the sharks and pearls. Drawn once per resize. */
  P._cacheBackdrop = function () {
    var img = this._sprite('bg');
    if (!img || !this.canvas.width) return;
    var w = this.canvas.width, h = this.canvas.height;
    var c = this.base = this.base || document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');
    var k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    var dw = img.naturalWidth * k, dh = img.naturalHeight * k;
    g.fillStyle = '#050b16';
    g.fillRect(0, 0, w, h);
    g.globalAlpha = BG_ALPHA;
    g.drawImage(img, (w - dw) / 2, h - dh, dw, dh);
    g.globalAlpha = 1;
  };

  /* ---------- effects requested by main.js ---------- */

  P.clearEffects = function () { this.fx.clear(); };

  /* One place that turns game events into motion. */
  P.event = function (ev, game) {
    var fx = this.fx, col = this.col, p = game.player;
    switch (ev.type) {
      case 'go':
        fx.ring(p.x, p.y, 60, 0.6);
        fx.bubbles(p.x, p.y + 20, 10, 14);
        fx.punch(0.05);
        break;
      case 'hit':
        fx.pop(ev.x, ev.y, 'sparks', 74, 0.45);
        fx.sparks(ev.x, ev.y, 6, 150);
        fx.shake(7, 0.38);
        fx.flash('#ff3b2a', 0.32, 0.28);
        fx.text(ev.x, ev.y - 38, '-1', col.alert, 16, 0.9);
        break;
      case 'pickup':
        fx.pop(ev.x, ev.y, 'pearl-burst', 46, 0.45);
        fx.sparks(ev.x, ev.y, 3, 90, 'gold-leaf');
        fx.sparks(ev.x, ev.y, 5, 100);
        fx.text(ev.x, ev.y - 20, '+' + ev.amount + (ev.mult > 1 ? ' x' + ev.mult : ''), col.goldBright, 13, 0.9);
        break;
      case 'combo':
        fx.ring(p.x, p.y, 64, 0.5);
        fx.pop(p.x, p.y, 'glow', 90, 0.45);
        fx.punch(0.04);
        break;
      case 'wave':
        fx.flash('#ffffff', 0.12, 0.35);
        fx.shake(3, 0.3);
        break;
      case 'dash':
        fx.shake(3, 0.2);
        fx.bubbles(ev.x, ev.y, 12, 10);
        break;
      case 'end':
        if (ev.result === 'clear') {
          fx.confetti(this.W, this.H, 80);
          fx.burst(p.x, p.y, 36);
          fx.ring(p.x, p.y, 90, 0.9);
          fx.pop(p.x, p.y, 'glow', 150, 0.9);
          fx.flash('#f3d58c', 0.25, 0.5);
          fx.punch(0.07);
        } else {
          fx.shake(6, 0.5);
        }
        break;
    }
  };

  /* ---------- frame ---------- */
  P.render = function (game, input, dt) {
    var ctx = this.ctx, dpr = this.dpr, s = this.scale;
    this.time += dt;
    this.fx.update(dt);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.base) ctx.drawImage(this.base, 0, 0);
    else { ctx.fillStyle = '#071226'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); }

    // Camera: zoom punch around the player, plus shake (in world units).
    var fx = this.fx, z = fx.zoom, p = game.player;
    var k = dpr * s * z;
    ctx.setTransform(k, 0, 0, k, dpr * s * (p.x * (1 - z) + fx.ox), dpr * s * (p.y * (1 - z) + fx.oy));

    this._drawWater(dt);
    if (game.phase === 'idle') this._drawDeco(dt);
    this._drawWarnings(game);
    this._drawItems(game);
    var i, list = game.sharks;
    for (i = 0; i < list.length; i++) if (this._visible(list[i])) this._drawShark(list[i], dt);
    this._drawPlayer(game, dt);
    fx.draw(ctx, this.uiFont);

    // Screen-space overlays.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this._drawMood(game);
    fx.drawFlash(ctx, this.canvas.width, this.canvas.height);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._drawStick(input);
  };

  /* Mouse stick, drawn in CSS pixels at the press point: the gold ring and a pearl knob. */
  P._drawStick = function (input) {
    var p = input && input.pointer;
    if (!p || !p.active || !p.mouse || !input.enabled) return;
    var ctx = this.ctx, R = input.stickRadius;
    var dx = p.x - p.ox, dy = p.y - p.oy, len = Math.hypot(dx, dy);
    if (len > R) { dx = dx / len * R; dy = dy / len * R; }
    var ring = this._sprite('ring'), pearl = this._sprite('pearl');
    if (ring) { ctx.globalAlpha = 0.45; ctx.drawImage(ring, p.ox - R, p.oy - R, R * 2, R * 2); }
    if (pearl) { ctx.globalAlpha = 0.8; ctx.drawImage(pearl, p.ox + dx - 11, p.oy + dy - 11, 22, 22); }
    ctx.globalAlpha = 1;
  };

  P._visible = function (s) { return s.mode !== 'warn' && s.mode !== 'aim' || s.kind === 'dash'; };

  /* Light rays breathe, kelp sways at both edges, bubbles rise. */
  P._drawWater = function (dt) {
    var ctx = this.ctx, W = this.W, H = this.H, t = this.time, i;

    var rays = this._sprite('rays');
    if (rays) {
      var rw = W * 1.05, rh = rw * rays.naturalHeight / rays.naturalWidth;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.16 + 0.08 * Math.sin(t * 0.7);
      ctx.translate(W / 2, -8);
      ctx.transform(1, 0, Math.sin(t * 0.3) * 0.08, 1, 0, 0);   // slow sway
      ctx.drawImage(rays, -rw / 2, 0, rw, rh);
      ctx.restore();
    }

    this._drawKelp(this._sprite('kelpLeft'), -1, t);
    this._drawKelp(this._sprite('kelpRight'), 1, t + 1.7);

    var bubble = this._sprite('bubble');
    for (i = 0; i < this.motes.length; i++) {
      var m = this.motes[i];
      m.y -= m.v * dt;
      m.ph += dt * 1.2;
      if (m.y < -8) { m.y = H + 8; m.x = rand(0, W); }
      this._spr(bubble, m.x + Math.sin(m.ph) * 3, m.y, m.r, 0, m.a);
    }
    ctx.globalAlpha = 1;
  };

  /* Kelp at one edge, cut into horizontal bands that sway more toward the top. */
  P._drawKelp = function (img, side, t) {
    if (!img) return;
    var ctx = this.ctx, W = this.W, H = this.H;
    var h = H * 0.5, w = h * img.naturalWidth / img.naturalHeight;
    var x0 = side < 0 ? -w * 0.32 : W - w * 0.68, y0 = H - h + 6;
    var bh = img.naturalHeight / KELP_BANDS, dh = h / KELP_BANDS;
    ctx.globalAlpha = BG_ALPHA;
    for (var i = 0; i < KELP_BANDS; i++) {
      var q = 1 - i / KELP_BANDS;                     // 1 at the top band
      var off = Math.sin(t * 1.1 + q * 2.2) * 7 * q * q;
      ctx.drawImage(img, 0, i * bh, img.naturalWidth, bh + 1, x0 + off, y0 + i * dh, w, dh + 0.6);
    }
    ctx.globalAlpha = 1;
  };

  /* Behind the title card: a few sharks cruising, no collisions. */
  P._drawDeco = function (dt) {
    var W = this.W, i;
    if (!this.deco.length) {
      for (i = 0; i < 3; i++) this.deco.push(this._decoShark(true, i));
    }
    for (i = 0; i < this.deco.length; i++) {
      var d = this.deco[i];
      d.x += Math.cos(d.heading) * d.speed * dt;
      d.y += Math.sin(this.time * 0.6 + d.ph) * 4 * dt;
      d.wob += dt * 7;
      if (d.x < -90 || d.x > W + 90) this.deco[i] = this._decoShark(false, i);
      this._drawShark(d, dt, d.alpha);
    }
    this.ctx.globalAlpha = 1;
  };

  P._decoShark = function (anywhere, i) {
    var right = Math.random() < 0.5;
    return {
      kind: 'deco', mode: 'swim', size: rand(0.8, 1.5),
      x: anywhere ? rand(0, this.W) : right ? -80 : this.W + 80,
      y: this.H * (0.18 + 0.28 * i) + rand(-20, 20),
      heading: right ? 0 : Math.PI, speed: rand(22, 38),
      wob: rand(0, TAU), ph: rand(0, TAU), alpha: rand(0.35, 0.55)
    };
  };

  /* ---------- warnings ---------- */

  P._drawWarnings = function (game) {
    var W = this.W, H = this.H;
    for (var i = 0; i < game.sharks.length; i++) {
      var s = game.sharks[i];
      if (s.kind === 'dash' && s.mode === 'aim') { this._drawAim(s); continue; }
      if (s.mode !== 'warn') continue;
      if (s.kind === 'pack' && !s.lead) continue;
      this._edgeMarker(clamp(s.x, 16, W - 16), clamp(s.y, 16, H - 16), s.heading,
        s.kind === 'pack' ? 'x' + this.cfg.pack.count : '');
    }
    this.ctx.globalAlpha = 1;
  };

  /* Pulsing "!" badge at the edge with an arrow pointing the way the shark will come in. */
  P._edgeMarker = function (x, y, heading, label) {
    var ctx = this.ctx, pulse = 0.5 + 0.5 * Math.sin(this.time * 16);
    this._spr(this._sprite('glow'), x, y, 46 + pulse * 10, 0, 0.35 + 0.25 * pulse);
    this._spr(this._sprite('warn'), x, y, 24 + pulse * 3, 0, 1);
    this._spr(this._sprite('chevron'), x + Math.cos(heading) * 22, y + Math.sin(heading) * 22, 14, heading, 0.6 + 0.4 * pulse);
    if (label) {
      ctx.globalAlpha = 1;
      ctx.font = '800 10px ' + this.uiFont;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8, 10, 12, 0.9)';
      ctx.strokeText(label, x, y + 18);
      ctx.fillStyle = this.col.alert;
      ctx.fillText(label, x, y + 18);
    }
    ctx.globalAlpha = 1;
  };

  /* Dash shark: red chevrons stream along its line toward a spinning reticle; once the line is
     locked they grow and flash. */
  P._drawAim = function (s) {
    var t = this.time, lock = this.cfg.dash.lockTime;
    var locked = s.t <= lock;
    var len = Math.hypot(this.W, this.H) * 1.2;
    var blink = locked ? (Math.floor(t * 20) % 2 ? 1 : 0.6) : 0.7 + 0.3 * Math.sin(t * 18);
    var cx = Math.cos(s.heading), cy = Math.sin(s.heading);
    var gap = 24, shift = (t * 90) % gap;
    var chev = this._tinted('chevron', '#ff6a55');   // the gold line-art arrow in danger red
    for (var d = 26 + shift; d < len; d += gap) {
      this._spr(chev, s.x + cx * d, s.y + cy * d, locked ? 19 : 14, s.heading, blink * (locked ? 0.95 : 0.7));
    }
    var r = 44 - (1 - Math.min(1, s.t / this.cfg.dash.aimTime)) * 16;   // closes in as the charge nears
    this._spr(this._tinted('reticle', '#ff6a55'), s.tx, s.ty, r, t * 2.5, blink);
    this._edgeMarker(clamp(s.x, 16, this.W - 16), clamp(s.y, 16, this.H - 16), s.heading, '');
    this.ctx.globalAlpha = 1;
  };

  /* ---------- pickups ---------- */

  P._drawItems = function (game) {
    var t = this.time, i;
    var glow = this._sprite('glow'), pearl = this._sprite('pearl'), tw = this._sprite('twinkle');
    for (i = 0; i < game.pearls.length; i++) {
      var pe = game.pearls[i];
      if (pe.life - pe.age < 1.5 && Math.floor(t * 10) % 2) continue;
      var sc = popIn(pe.age);
      var y = pe.y + Math.sin(t * 2.6 + pe.ph) * 2.5;
      this._spr(glow, pe.x, y, 32 * sc, 0, 0.55 + 0.25 * Math.sin(t * 4 + pe.ph));
      this._spr(pearl, pe.x, y, 15 * sc, 0, 1);
      var twk = Math.max(0, Math.sin(t * 3 + pe.ph * 3));
      if (twk > 0.2) this._spr(tw, pe.x + 4, y - 5, 8 * twk, t, twk);
    }

    this.ctx.globalAlpha = 1;
  };

  /* ---------- sharks ---------- */

  P._drawShark = function (s, dt, alpha) {
    var ctx = this.ctx, L = this.cfg.shark.length * s.size;
    var dashing = s.kind === 'dash';
    var baseAlpha = alpha == null ? 1 : alpha;

    // Tail bubbles (view-only, random so no state is kept on the shark).
    if (s.kind !== 'deco' && Math.random() < dt * (dashing && s.mode === 'dash' ? 40 : s.kind === 'dart' ? 1.5 : 6)) {
      this.fx.bubbles(s.x - Math.cos(s.heading) * L * 0.5, s.y - Math.sin(s.heading) * L * 0.5, 1, 2);
    }

    // A soft light behind every shark so it reads on the dark water; red for a dash shark.
    if (s.kind !== 'deco') {
      var back = dashing ? this._tinted('glow', '#ff4a35') : this._sprite('glow');
      var ga = dashing ? (s.mode === 'aim' ? 0.55 + 0.35 * Math.sin(this.time * 20) : 0.85) : 0.6;
      this._spr(back, s.x, s.y, Math.max(L * (dashing ? 1.7 : 1.5), 34), 0, ga * baseAlpha);
    }

    ctx.save();
    ctx.globalAlpha = baseAlpha;
    ctx.translate(s.x, s.y);
    ctx.rotate(s.heading + Math.sin(s.wob) * 0.03);
    if (Math.cos(s.heading) < 0) ctx.scale(1, -1); // keep dorsal fin on top

    var img = this._sprite('shark');
    if (img) {
      var iw = img.naturalWidth, ih = img.naturalHeight;
      var sw = L * 1.1, sh = sw * ih / iw;
      var amp = sh * (dashing && s.mode === 'dash' ? 0.06 : 0.1);
      // A light rim (the shark's silhouette, a little larger, behind it) so it stands off the water.
      if (s.kind !== 'deco') {
        var rim = this._tinted('shark', dashing ? '#ff7a62' : '#fff1d6');
        if (rim) { ctx.globalAlpha = 0.9 * baseAlpha; ctx.drawImage(rim, -sw * 1.09 / 2, -sh * 1.2 / 2, sw * 1.09, sh * 1.2); ctx.globalAlpha = baseAlpha; }
      }
      for (var i = 0; i < STRIPS; i++) {
        var q = i / (STRIPS - 1);                 // 0 = tail, 1 = head
        var tail = Math.pow(1 - q, 1.7);
        var off = Math.sin(s.wob - q * 2.6) * amp * tail;
        var sx = i * iw / STRIPS;
        var sWid = Math.min(iw - sx, iw / STRIPS + 1);
        ctx.drawImage(img, sx, 0, sWid, ih, -sw / 2 + q * sw * (STRIPS - 1) / STRIPS, -sh / 2 + off, sw / STRIPS + 0.5, sh);
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  };

  /* ---------- player ---------- */

  P._memberFrame = function (dt) {
    var m = this.member, a = this.anim;
    var clip = m && m.anims[a.name];
    if (!clip) return null;
    a.t += dt;
    var f = Math.floor(a.t * clip.fps);
    if (clip.loop) f %= clip.frames;
    else if (f >= clip.frames) {
      if (a.hold) f = clip.frames - 1;
      else { this.anim = { name: 'idle', t: 0 }; return this._memberFrame(0); }
    }
    return { row: m.anims[this.anim.name].row, col: f };
  };

  P._drawPlayer = function (game, dt) {
    var ctx = this.ctx, p = game.player, pc = this.cfg.player;
    var blink = game.invuln > 0 && Math.floor(this.time * 14) % 2 === 0;
    var m = this.member;
    var sheet = m && this.memberSheets[m.id];
    var frame = this._memberFrame(dt);

    // Warm light behind the member and a glow at the feet.
    var glow = this._sprite('glow'), ps = pc.spriteHeight / 52;   // trims were drawn for a 52-unit member
    this._spr(glow, p.x, p.y, 76 * ps, 0, 0.32);
    if (glow) {
      ctx.save();
      ctx.translate(p.x, p.y + pc.halfHeight - 1);
      ctx.scale(1, 0.3);
      this._spr(glow, 0, 0, 64 * ps, 0, 0.75);
      ctx.restore();
    }

    // Bubbles while swimming.
    var speed = Math.hypot(p.vx, p.vy);
    if (game.phase === 'play' && Math.random() < dt * speed / 14) this.fx.bubbles(p.x - p.vx * 0.06, p.y + 4 - p.vy * 0.06, 1, 5);

    if (sheet && sheet.complete && sheet.naturalWidth && frame) this._drawMember(game, sheet, frame, blink);
    ctx.globalAlpha = 1;
  };

  /* Success: pearls rise out of the tin and circle the player. Drawn in the player's local space. */
  P._drawOrbit = function (game, rx, ry, k) {
    k = k || 1;
    var e = Math.min(1, game.phaseTime / 0.7);
    var ease = 1 - Math.pow(1 - e, 3);
    var pearl = this._sprite('pearl');
    for (var i = 0; i < 4; i++) {
      var a = this.time * 1.4 + i * TAU / 4;
      this._spr(pearl, Math.cos(a) * rx * ease, Math.sin(a) * ry * ease, 11 * k, 0, ease);
    }
    this.ctx.globalAlpha = 1;
  };

  /* Member chibi sprite: idle while swimming (bob + lean), frown on a touch, dance on success. */
  P._drawMember = function (game, sheet, frame, blink) {
    var ctx = this.ctx, p = game.player, pc = this.cfg.player, m = this.member;
    var s = pc.spriteHeight / m.bounds.h;           // world units per sheet pixel
    var bcx = m.bounds.x + m.bounds.w / 2, bcy = m.bounds.y + m.bounds.h / 2;
    var idle = this.anim.name === 'idle';
    var speed = Math.min(1, Math.hypot(p.vx, p.vy) / pc.maxSpeed);
    var ps = pc.spriteHeight / 52;
    var bob = idle ? Math.sin(this.time * 11) * 1.6 * ps * speed : 0;
    var lean = idle ? (p.vx / pc.maxSpeed) * 0.14 : 0;
    if (p.vx > 8) this._flip = 1; else if (p.vx < -8) this._flip = -1;
    var flip = this._flip || 1;

    ctx.save();
    ctx.translate(p.x, p.y);
    if (game.phase === 'clear') this._drawOrbit(game, 26 * ps, pc.halfHeight + 4 * ps, ps);

    ctx.translate(0, bob);
    ctx.rotate(lean);
    ctx.globalAlpha = blink ? 0.35 : 1;
    ctx.imageSmoothingQuality = 'high';
    ctx.save();
    ctx.scale(flip, 1);
    // Source cell from the image actually loaded (a phone may still hold an older sheet
    // with smaller cells); bounds and the drawn size stay in members.js cell units.
    var cols = 0;
    for (var k in m.anims) cols = Math.max(cols, m.anims[k].frames);
    var sc = sheet.naturalWidth / cols;
    ctx.drawImage(sheet, frame.col * sc, frame.row * sc, sc, sc,
      -bcx * s, -bcy * s, m.cell * s, m.cell * s);
    ctx.restore();

    // The caviar tin: in the trailing hand while swimming, set down at the feet while dancing.
    var tin = this._sprite('tin');
    if (this.anim.name === 'dance') this._spr(tin, flip * 17 * ps, pc.halfHeight - 6 * ps, 13 * ps, 0, 1);
    else this._spr(tin, -flip * 13 * ps, 5 * ps, 13 * ps, 0, blink ? 0.35 : 1);
    ctx.restore();
  };

  /* ---------- screen-space overlays ---------- */

  /* Last 10 seconds: the red glow sprite pulses along the side edges. Game over: the water darkens. */
  P._drawMood = function (game) {
    var ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
    if (game.phase === 'play' && game.timeLeft <= 10) {
      var red = this._tinted('glow', '#ff3b2a');
      if (red) {
        var rate = game.timeLeft <= 5 ? 9 : 5;
        var e = Math.round(Math.min(w, h) * 0.09);
        ctx.globalAlpha = 0.35 + 0.35 * Math.sin(this.time * rate);
        ctx.drawImage(red, -e, -e * 0.5, e * 2, h + e);
        ctx.drawImage(red, w - e, -e * 0.5, e * 2, h + e);
      }
    }
    if (game.phase === 'over') {
      ctx.globalAlpha = Math.min(0.55, game.phaseTime / 1.6 * 0.55);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.globalAlpha = 1;
  };

  /* 0 → 1.25 → 1 over the first 0.3 s. */
  function popIn(age) {
    if (age >= 0.3) return 1;
    var q = age / 0.3;
    return q < 0.6 ? q / 0.6 * 1.25 : 1.25 - (q - 0.6) / 0.4 * 0.25;
  }

  NS.Renderer = Renderer;
})(window.CAVIAR = window.CAVIAR || {});
