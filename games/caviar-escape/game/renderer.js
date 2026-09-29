/* CAVIAR ESCAPE — canvas renderer. Reads game state, never mutates it.
   Colours come from the shared CSS tokens so every campaign game matches.
   Placeholders are drawn in code; config.assets can swap in real sprites. */
(function (NS) {
  'use strict';

  var TAU = Math.PI * 2;

  function token(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  function rand(a, b) { return a + Math.random() * (b - a); }

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
    this.floats = [];
    this.pulses = [];

    this.col = {
      bg: token('--cv-espresso', '#15100b'),
      ivory: token('--cv-ivory', '#efe8d8'),
      gold: token('--cv-gold', '#c9ae78'),
      goldBright: token('--cv-gold-bright', '#e2cc98'),
      ink: token('--cv-ink', '#1a1612'),
      garnet: token('--cv-garnet', '#9a4136'),
      shark: '#5a5f5d',
      pearls: [
        token('--cv-caviar-white', '#e6dfcf'),
        token('--cv-caviar-green', '#56603f'),
        token('--cv-caviar-black', '#22201d'),
        token('--cv-caviar-gold', '#c9ae78')
      ]
    };
    this.uiFont = token('--cv-font-ui', 'sans-serif');

    this.sprites = {};
    var assets = config.assets || {};
    for (var key in assets) {
      if (!assets[key]) continue;
      var img = new Image();
      img.src = assets[key];
      this.sprites[key] = img;
    }

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
    this._seedMotes();
    return { W: this.W, H: this.H };
  };

  P._seedMotes = function () {
    var n = Math.round(this.W * this.H / 4200);
    this.motes = [];
    for (var i = 0; i < n; i++) {
      this.motes.push({
        x: rand(0, this.W), y: rand(0, this.H),
        r: rand(0.5, 1.5), v: rand(3, 11), a: rand(0.05, 0.2), ph: rand(0, TAU)
      });
    }
  };

  /* ---------- effects requested by main.js on game events ---------- */
  P.pulse = function (x, y, tone) { this.pulses.push({ x: x, y: y, t: 0, life: 0.6, tone: tone }); };
  P.float = function (x, y, text) { this.floats.push({ x: x, y: y, t: 0, life: 1.0, text: text }); };
  P.clearEffects = function () { this.floats.length = 0; this.pulses.length = 0; };

  /* ---------- frame ---------- */
  P.render = function (game, input, dt) {
    var ctx = this.ctx, k = this.dpr * this.scale;
    this.time += dt;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = this.col.bg;
    ctx.fillRect(0, 0, this.cssW, this.cssH);

    ctx.setTransform(k, 0, 0, k, 0, 0);
    this._drawBackdrop(dt);
    this._drawWarnings(game);
    for (var i = 0; i < game.sharks.length; i++) {
      if (game.sharks[i].mode !== 'warn') this._drawShark(game.sharks[i]);
    }
    this._drawPlayer(game, dt);
    this._drawEffects(dt);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this._drawStick(input);
  };

  P._drawBackdrop = function (dt) {
    var ctx = this.ctx, W = this.W, H = this.H;

    // One faint shaft of light from the surface.
    ctx.globalAlpha = 0.035;
    ctx.fillStyle = this.col.ivory;
    ctx.beginPath();
    ctx.moveTo(W * 0.38, 0); ctx.lineTo(W * 0.62, 0);
    ctx.lineTo(W * 0.9, H); ctx.lineTo(W * 0.35, H);
    ctx.closePath(); ctx.fill();

    // Depth hairlines, like the ruled lines of a menu.
    ctx.globalAlpha = 0.07;
    ctx.strokeStyle = this.col.gold;
    ctx.lineWidth = 1 / this.scale;
    for (var y = 72; y < H; y += 72) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Slow rising motes.
    ctx.fillStyle = this.col.ivory;
    for (var i = 0; i < this.motes.length; i++) {
      var m = this.motes[i];
      m.y -= m.v * dt;
      m.ph += dt * 0.8;
      if (m.y < -4) { m.y = H + 4; m.x = rand(0, W); }
      ctx.globalAlpha = m.a;
      ctx.beginPath();
      ctx.arc(m.x + Math.sin(m.ph) * 3, m.y, m.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  /* Gold chevrons at the edge where a shark is about to enter. */
  P._drawWarnings = function (game) {
    var ctx = this.ctx, W = this.W, H = this.H;
    for (var i = 0; i < game.sharks.length; i++) {
      var s = game.sharks[i];
      if (s.mode !== 'warn') continue;
      var x = Math.min(W - 14, Math.max(14, s.x));
      var y = Math.min(H - 14, Math.max(14, s.y));
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(s.heading);
      ctx.globalAlpha = 0.45 + 0.4 * Math.sin(this.time * 14);
      ctx.strokeStyle = this.col.gold;
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      for (var j = 0; j < 2; j++) {
        var o = -5 + j * 6;
        ctx.beginPath();
        ctx.moveTo(o - 4, -6); ctx.lineTo(o + 2, 0); ctx.lineTo(o - 4, 6);
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  P._drawShark = function (s) {
    var ctx = this.ctx, L = this.cfg.shark.length, h = L * 0.16;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.heading + Math.sin(s.wob) * 0.04);
    if (Math.cos(s.heading) < 0) ctx.scale(1, -1); // keep dorsal fin on top

    var img = this._sprite('shark');
    if (img) {
      var sw = L * 1.1, sh = sw * img.naturalHeight / img.naturalWidth;
      ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh);
      ctx.restore();
      return;
    }

    var tail = Math.sin(s.wob) * h * 0.25;
    ctx.beginPath();
    ctx.moveTo(L * 0.5, h * 0.1);                                        // snout
    ctx.quadraticCurveTo(L * 0.44, -h * 0.95, L * 0.16, -h);
    ctx.quadraticCurveTo(-L * 0.18, -h * 0.95, -L * 0.36, -h * 0.25);   // back to tail root
    ctx.lineTo(-L * 0.53, -h * 1.35 + tail);                            // upper lobe
    ctx.quadraticCurveTo(-L * 0.45, tail * 0.5, -L * 0.5, h * 0.9 + tail); // lower lobe
    ctx.lineTo(-L * 0.36, h * 0.3);
    ctx.quadraticCurveTo(-L * 0.1, h * 0.95, L * 0.2, h * 0.8);         // belly
    ctx.quadraticCurveTo(L * 0.45, h * 0.62, L * 0.5, h * 0.1);
    ctx.closePath();
    // dorsal fin
    ctx.moveTo(L * 0.1, -h * 0.9);
    ctx.lineTo(-L * 0.06, -h * 2.15);
    ctx.quadraticCurveTo(-L * 0.08, -h * 1.3, -L * 0.17, -h * 0.9);
    ctx.closePath();
    // pectoral fin
    ctx.moveTo(L * 0.16, h * 0.7);
    ctx.lineTo(-L * 0.02, h * 1.75);
    ctx.lineTo(L * 0.03, h * 0.72);
    ctx.closePath();

    ctx.fillStyle = this.col.shark;
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = this.col.ivory;
    ctx.lineWidth = 0.9;
    ctx.stroke();

    // gill line + eye
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(L * 0.25, -h * 0.5); ctx.quadraticCurveTo(L * 0.22, 0, L * 0.25, h * 0.45);
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#0b0a08';
    ctx.beginPath(); ctx.arc(L * 0.36, -h * 0.28, 1.3, 0, TAU); ctx.fill();
    ctx.restore();
  };

  P._drawPearl = function (x, y, r, color) {
    var ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.globalAlpha *= 0.55;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x - r * 0.32, y - r * 0.36, r * 0.3, 0, TAU); ctx.fill();
    ctx.globalAlpha /= 0.55;
  };

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
    var ctx = this.ctx, p = game.player, r = p.r, col = this.col;
    var blink = game.invuln > 0 && Math.floor(this.time * 14) % 2 === 0;
    var m = this.member;
    var sheet = m && this.memberSheets[m.id];
    var frame = this._memberFrame(dt);

    if (sheet && sheet.complete && sheet.naturalWidth && frame) {
      this._drawMember(game, sheet, frame, blink);
      return;
    }

    ctx.save();
    ctx.translate(p.x, p.y);

    if (game.phase === 'clear') this._drawOrbit(game, r + 17, r + 17);

    ctx.globalAlpha = blink ? 0.3 : 1;

    var img = this._sprite('player');
    if (img) {
      var sz = r * 2.4;
      ctx.drawImage(img, -sz / 2, -sz / 2, sz, sz);
    } else {
      ctx.fillStyle = col.ivory;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = col.gold;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.globalAlpha *= 0.55;
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.58, 0, TAU); ctx.stroke();
      ctx.globalAlpha /= 0.55;
      ctx.globalAlpha *= 0.7;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(-r * 0.36, -r * 0.4, r * 0.22, 0, TAU); ctx.fill();
      ctx.globalAlpha /= 0.7;
    }

    // The caviar case, carried on the trailing side.
    var ca = p.facing + Math.PI * 0.8;
    this._drawCase(Math.cos(ca) * (r + 3), Math.sin(ca) * (r + 3));
    ctx.restore();
  };

  /* Success: the four caviar pearls rise out of the case and circle the player.
     Drawn in the player's local space; rx/ry allow an ellipse around a tall sprite. */
  P._drawOrbit = function (game, rx, ry) {
    var ctx = this.ctx, col = this.col;
    var e = Math.min(1, game.phaseTime / 0.7);
    var ease = 1 - Math.pow(1 - e, 3);
    ctx.globalAlpha = 0.25 * ease;
    ctx.strokeStyle = col.gold;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, 0, rx * ease, ry * ease, 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = ease;
    for (var i = 0; i < 4; i++) {
      var a = this.time * 1.4 + i * TAU / 4;
      this._drawPearl(Math.cos(a) * rx * ease, Math.sin(a) * ry * ease, 4, col.pearls[i]);
    }
    ctx.globalAlpha = 1;
  };

  /* Member chibi sprite: idle while swimming (bob + lean), frown on a touch, dance on success. */
  P._drawMember = function (game, sheet, frame, blink) {
    var ctx = this.ctx, p = game.player, pc = this.cfg.player, m = this.member, col = this.col;
    var s = pc.spriteHeight / m.bounds.h;           // world units per sheet pixel
    var bcx = m.bounds.x + m.bounds.w / 2, bcy = m.bounds.y + m.bounds.h / 2;
    var idle = this.anim.name === 'idle';
    var speed = Math.min(1, Math.hypot(p.vx, p.vy) / pc.maxSpeed);
    var bob = idle ? Math.sin(this.time * 11) * 1.6 * speed : 0;
    var lean = idle ? (p.vx / pc.maxSpeed) * 0.14 : 0;
    if (p.vx > 8) this._flip = 1; else if (p.vx < -8) this._flip = -1;
    var flip = this._flip || 1;

    ctx.save();
    ctx.translate(p.x, p.y);

    // Ivory plate under the feet keeps the silhouette readable on the dark water.
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = col.ivory;
    ctx.beginPath(); ctx.ellipse(0, pc.halfHeight - 1, 17, 4.5, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = col.gold;
    ctx.lineWidth = 0.8;
    ctx.stroke();

    if (game.phase === 'clear') this._drawOrbit(game, 26, pc.halfHeight + 4);

    ctx.translate(0, bob);
    ctx.rotate(lean);
    ctx.globalAlpha = blink ? 0.35 : 1;
    ctx.shadowColor = 'rgba(239, 232, 216, 0.5)';
    ctx.shadowBlur = 5 * this.scale * this.dpr;
    ctx.imageSmoothingQuality = 'high';
    ctx.save();
    ctx.scale(flip, 1);
    ctx.drawImage(sheet, frame.col * m.cell, frame.row * m.cell, m.cell, m.cell,
      -bcx * s, -bcy * s, m.cell * s, m.cell * s);
    ctx.restore();
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    // Caviar case: in the trailing hand while swimming, set down at the feet while dancing.
    if (this.anim.name === 'dance') this._drawCase(flip * 17, pc.halfHeight - 5);
    else this._drawCase(-flip * 13, 5);
    ctx.restore();
  };

  P._drawCase = function (x, y) {
    var ctx = this.ctx, w = 12, h = 8.5, col = this.col;
    ctx.save();
    ctx.translate(x, y);
    // handle
    ctx.strokeStyle = col.gold;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, -h / 2, 2.6, Math.PI, 0); ctx.stroke();
    // body
    ctx.fillStyle = col.gold;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-w / 2, -h / 2, w, h, 1.6);
    else ctx.rect(-w / 2, -h / 2, w, h);
    ctx.fill();
    ctx.strokeStyle = col.ink;
    ctx.lineWidth = 0.6;
    ctx.stroke();
    // clasp line
    ctx.globalAlpha *= 0.6;
    ctx.beginPath(); ctx.moveTo(-w / 2, -0.6); ctx.lineTo(w / 2, -0.6); ctx.stroke();
    ctx.restore();
  };

  P._drawEffects = function (dt) {
    var ctx = this.ctx, i;

    for (i = this.pulses.length - 1; i >= 0; i--) {
      var pu = this.pulses[i];
      pu.t += dt;
      if (pu.t >= pu.life) { this.pulses.splice(i, 1); continue; }
      var q = pu.t / pu.life;
      ctx.globalAlpha = (1 - q) * 0.8;
      ctx.strokeStyle = pu.tone === 'alert' ? this.col.garnet : this.col.goldBright;
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(pu.x, pu.y, 14 + q * 26, 0, TAU); ctx.stroke();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 12px ' + this.uiFont;
    for (i = this.floats.length - 1; i >= 0; i--) {
      var f = this.floats[i];
      f.t += dt;
      if (f.t >= f.life) { this.floats.splice(i, 1); continue; }
      var e = f.t / f.life;
      ctx.globalAlpha = e < 0.7 ? 1 : (1 - e) / 0.3;
      ctx.fillStyle = this.col.goldBright;
      ctx.fillText(f.text, f.x, f.y - e * 22);
    }
    ctx.globalAlpha = 1;
  };

  /* Drag stick feedback, drawn in CSS pixels at the touch origin. */
  P._drawStick = function (input) {
    var p = input && input.pointer;
    if (!p || !p.active || !input.enabled) return;
    var ctx = this.ctx, R = input.stickRadius;
    var dx = p.x - p.ox, dy = p.y - p.oy, len = Math.hypot(dx, dy);
    if (len > R) { dx = dx / len * R; dy = dy / len * R; }
    ctx.strokeStyle = this.col.gold;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.arc(p.ox, p.oy, R, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.arc(p.ox + dx, p.oy + dy, 12, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  };

  NS.Renderer = Renderer;
})(window.CAVIAR = window.CAVIAR || {});
