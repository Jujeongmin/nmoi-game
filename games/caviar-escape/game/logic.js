/* CAVIAR ESCAPE — game logic. No DOM, no canvas.
   Consumes an input vector {x, y} (length 0..1) and emits events that the UI,
   renderer and sound react to:
   go · hit · nearMiss · pickup · combo · wave · dashAim · dash · end

   Sharks come in three kinds:
     hunt  — enters from an edge, turns toward the player for a few seconds, swims off
     dash  — (wave 2) aims from the edge, locks its line, charges straight across
     pack  — (final wave) small sharks in a column crossing the screen, no tracking */
(function (NS) {
  'use strict';

  var TAU = Math.PI * 2;
  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function wrap(a) {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
  }

  function EscapeGame(config) {
    this.cfg = config;
    this.W = config.worldMin;
    this.H = config.worldMin * 1.5;
    this.events = [];
    this.player = { x: 0, y: 0, vx: 0, vy: 0, facing: -Math.PI / 2, r: config.player.radius };
    this.idle();
  }

  var P = EscapeGame.prototype;

  /* ---------- lifecycle ---------- */

  P._reset = function () {
    var c = this.cfg;
    this.elapsed = 0;
    this.timeLeft = c.duration;
    this.lives = c.lives;
    this.invuln = 0;
    this.survival = 0;
    this.bonus = 0;
    this.lifeBonus = 0;
    this.closeCalls = 0;
    this.pickups = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.mult = 1;
    this.maxCombo = 0;
    this.wave = 0;
    this.result = null;
    this.sharks = [];
    this.pearls = [];
    this.spawnTimer = c.spawn.first;
    this.dashTimer = 0;
    this.packTimer = 0;
    this.dartTimer = c.dart.first;
    this.pearlTimer = c.pearls.first;
    this.events = [];
    var p = this.player;
    p.x = this.W / 2;
    p.y = this.H * 0.55;
    p.vx = p.vy = 0;
    p.kbx = p.kby = 0;
    p.cx = p.cy = 0;
    p.facing = -Math.PI / 2;
  };

  P._setPhase = function (phase) { this.phase = phase; this.phaseTime = 0; };
  P._emit = function (type, data) { data = data || {}; data.type = type; this.events.push(data); };

  P.idle = function () { this._reset(); this._setPhase('idle'); };
  P.start = function () { this._reset(); this._setPhase('countdown'); };

  /* Keep everything in proportion when the play area is resized. */
  P.setWorld = function (W, H) {
    var sx = W / this.W, sy = H / this.H;
    var p = this.player, i;
    p.x *= sx; p.y *= sy;
    var lists = [this.sharks, this.pearls];
    for (var l = 0; l < lists.length; l++) {
      for (i = 0; i < lists[l].length; i++) { lists[l][i].x *= sx; lists[l][i].y *= sy; }
    }
    for (i = 0; i < this.sharks.length; i++) {
      var s = this.sharks[i];
      if (s.tx != null) { s.tx *= sx; s.ty *= sy; }
    }
    this.W = W; this.H = H;
  };

  /* ---------- read-only helpers for UI ---------- */

  P.getScore = function () { return Math.floor(this.survival) + this.bonus + this.lifeBonus; };
  P.difficulty = function () { return clamp(this.elapsed / this.cfg.duration, 0, 1); };
  P.countdownLeft = function () { return Math.max(0, this.cfg.countdown - this.phaseTime); };
  P.isOver = function () { return this.phase === 'clear' || this.phase === 'over'; };
  P.comboLeft = function () { return this.combo > 0 ? this.comboTimer / this.cfg.combo.window : 0; };
  P.drainEvents = function () { var e = this.events; this.events = []; return e; };

  /* ---------- main step ---------- */

  P.update = function (dt, input) {
    this.phaseTime += dt;
    var c = this.cfg;

    switch (this.phase) {
      case 'countdown':
        if (this.phaseTime >= c.countdown) { this._setPhase('play'); this._emit('go'); }
        break;

      case 'play':
        this.elapsed += dt;
        this.timeLeft = Math.max(0, c.duration - this.elapsed);
        this.survival += c.score.perSecond * dt;
        if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
        this._updateCombo(dt);
        this._updateWave();
        this._updatePlayer(dt, input);
        this._updateSpawner(dt);
        this._updateItems(dt);
        this._updateSharks(dt);
        this._resolve();
        if (this.lives <= 0) this._finish('over');
        else if (this.timeLeft <= 0) this._finish('clear');
        break;

      case 'clear':
      case 'over':
        this._updatePlayer(dt, null);
        this._updateSharks(dt);
        break;
    }
  };

  P._updateWave = function () {
    var waves = this.cfg.waves;
    while (this.wave + 1 < waves.length && this.elapsed >= waves[this.wave + 1].at) {
      this.wave++;
      var w = waves[this.wave];
      if (this.wave === 1) this.dashTimer = 0.8;     // the first dash comes right after the banner
      if (this.wave === 2) this.packTimer = 1.0;
      this._emit('wave', { index: this.wave, label: w.label, sub: w.sub });
    }
  };

  /* ---------- combo ---------- */

  P._updateCombo = function (dt) {
    if (this.combo <= 0) return;
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) { this.combo = 0; this.mult = 1; this.comboTimer = 0; }
  };

  /* One link in the chain (a pearl or a close call). Returns the multiplier for its points. */
  P._chain = function (x, y) {
    var cc = this.cfg.combo;
    var mult = this.mult;                     // this link scores at the multiplier it was earned under
    this.combo++;
    this.comboTimer = cc.window;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    var next = Math.min(cc.maxMult, 1 + Math.floor(this.combo / cc.step));
    if (next > this.mult) {
      this.mult = next;
      this._emit('combo', { x: x, y: y, mult: next, combo: this.combo });
    }
    return mult;
  };

  P._breakCombo = function () { this.combo = 0; this.mult = 1; this.comboTimer = 0; };

  /* ---------- player ---------- */

  /* input: { x, y } keyboard direction (0..1), or { drag: true, dx, dy } — a finger drag
     in world units that moves the member right away. A flick faster than dragMax is spread
     over the next frames (p.carry), so no distance is lost and nothing teleports. */
  P._updatePlayer = function (dt, input) {
    var c = this.cfg.player, p = this.player;
    if (input && input.drag) {
      var ax = p.cx + input.dx * c.dragGain, ay = p.cy + input.dy * c.dragGain;
      var mx = ax, my = ay, ml = Math.hypot(mx, my), cap = c.dragMax * dt;
      if (ml > cap) { mx *= cap / ml; my *= cap / ml; }
      p.cx = ax - mx; p.cy = ay - my;
      p.x += mx; p.y += my;
      // Velocity only drives the look (lean, facing, bubbles) — smoothed so it doesn't flicker.
      var kv = dt > 0 ? 1 - Math.exp(-18 * dt) : 0;
      p.vx += ((dt > 0 ? mx / dt : 0) - p.vx) * kv;
      p.vy += ((dt > 0 ? my / dt : 0) - p.vy) * kv;
    } else {
      p.cx = p.cy = 0;
      var tx = input ? input.x * c.maxSpeed : 0;
      var ty = input ? input.y * c.maxSpeed : 0;
      var k = 1 - Math.exp(-c.response * dt);
      p.vx += (tx - p.vx) * k;
      p.vy += (ty - p.vy) * k;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    // A hit pushes the member away, whatever the input.
    if (p.kbx || p.kby) {
      p.x += p.kbx * dt; p.y += p.kby * dt;
      var kd = Math.exp(-7 * dt);
      p.kbx *= kd; p.kby *= kd;
      if (Math.abs(p.kbx) + Math.abs(p.kby) < 4) p.kbx = p.kby = 0;
    }
    if (p.x < p.r) { p.x = p.r; p.vx = 0; }
    if (p.x > this.W - p.r) { p.x = this.W - p.r; p.vx = 0; }
    if (p.y < c.halfHeight) { p.y = c.halfHeight; p.vy = 0; }
    if (p.y > this.H - c.halfHeight) { p.y = this.H - c.halfHeight; p.vy = 0; }
    if (p.vx * p.vx + p.vy * p.vy > 144) p.facing = Math.atan2(p.vy, p.vx);
  };

  /* ---------- spawning ---------- */

  P._updateSpawner = function (dt) {
    var c = this.cfg, s = c.spawn, t = this.difficulty();
    var active = 0;
    for (var i = 0; i < this.sharks.length; i++) {
      var sh = this.sharks[i];
      if (sh.kind === 'hunt' && sh.mode !== 'leave') active++;
    }
    var max = Math.floor(lerp(s.maxStart, s.maxEnd + 0.999, t));

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      if (active < max) {
        this._spawnShark();
        this.spawnTimer = lerp(s.intervalStart, s.intervalEnd, t) * rand(0.8, 1.2);
      } else {
        this.spawnTimer = 0.25;
      }
    }

    // Darts: small sharks shot straight across from the edges, ever thicker (죽림고수 style).
    this.dartTimer -= dt;
    if (this.dartTimer <= 0) {
      this._spawnDart();
      this.dartTimer = lerp(c.dart.every[0], c.dart.every[1], Math.pow(t, c.dart.ease)) * rand(0.7, 1.3);
    }

    if (this.wave >= 1) {
      this.dashTimer -= dt;
      if (this.dashTimer <= 0 && this.timeLeft > c.dash.aimTime + 0.4) {
        this._spawnDash();
        this.dashTimer = rand(c.dash.every[0], c.dash.every[1]);
      }
    }
    if (this.wave >= 2) {
      this.packTimer -= dt;
      if (this.packTimer <= 0 && this.timeLeft > c.pack.warnTime + 0.6) {
        this._spawnPack();
        this.packTimer = rand(c.pack.every[0], c.pack.every[1]);
      }
    }
  };

  /* A point just outside an edge, as far from the player as a few tries allow. */
  P._edgePoint = function (m, minDist) {
    var p = this.player, W = this.W, H = this.H;
    var x = 0, y = 0, best = -1, bx = 0, by = 0, bedge = 0;
    for (var i = 0; i < 8; i++) {
      var edge = Math.floor(Math.random() * 4);
      if (edge === 0) { x = rand(30, W - 30); y = -m; }
      else if (edge === 1) { x = W + m; y = rand(40, H - 40); }
      else if (edge === 2) { x = rand(30, W - 30); y = H + m; }
      else { x = -m; y = rand(40, H - 40); }
      var d = Math.hypot(x - p.x, y - p.y);
      if (d > best) { best = d; bx = x; by = y; bedge = edge; }
      if (d > minDist) break;
    }
    return { x: bx, y: by, edge: bedge };
  };

  P._newShark = function (kind, x, y, heading, size) {
    return {
      kind: kind, size: size || 1,
      x: x, y: y, heading: heading, speed: 0,
      mode: 'warn', t: 0, track: 0,
      close: false, tainted: false, bonusCd: 0,
      wob: Math.random() * TAU
    };
  };

  P._spawnShark = function () {
    var c = this.cfg.shark, p = this.player;
    var e = this._edgePoint(c.length * 0.6, Math.min(this.W, this.H) * 0.5);
    var s = this._newShark('hunt', e.x, e.y, Math.atan2(p.y - e.y, p.x - e.x), c.size);
    s.t = c.warnTime;
    s.track = rand(c.trackTime[0], c.trackTime[1]);
    this.sharks.push(s);
  };

  P._spawnDash = function () {
    var c = this.cfg, p = this.player;
    var e = this._edgePoint(c.shark.length * c.dash.size * 0.12, Math.min(this.W, this.H) * 0.55);
    var s = this._newShark('dash', e.x, e.y, Math.atan2(p.y - e.y, p.x - e.x), c.dash.size);
    s.mode = 'aim';
    s.t = c.dash.aimTime;
    s.tx = p.x; s.ty = p.y;                  // aim point (follows the player until the lock)
    this.sharks.push(s);
    this._emit('dashAim', { x: e.x, y: e.y, heading: s.heading });
  };

  /* A dart from any edge, no warning. Some are aimed at where the player is now (a little
     spread); most keep their own path across the screen — a straight line or a wave — so the
     water is busy without everything coming for the player. */
  P._spawnDart = function () {
    var c = this.cfg, d = c.dart, p = this.player, W = this.W, H = this.H;
    var e = this._edgePoint(c.shark.length * d.size * 0.6, Math.min(W, H) * 0.45);
    var aimed = Math.random() < d.aimed;
    var tx = aimed ? p.x : rand(W * 0.15, W * 0.85), ty = aimed ? p.y : rand(H * 0.15, H * 0.85);
    var s = this._newShark('dart', e.x, e.y, Math.atan2(ty - e.y, tx - e.x) + (aimed ? rand(-d.spread, d.spread) : 0), d.size);
    s.mode = 'swim';
    s.speed = lerp(d.speed[0], d.speed[1], Math.pow(this.difficulty(), d.ease)) * rand(0.88, 1.12);
    s.aimed = aimed;
    if (!aimed && Math.random() < d.wavy) {
      s.base = { x: e.x, y: e.y, h: s.heading };   // the line it travels; the wave rides on it
      s.amp = rand(d.waveAmp[0], d.waveAmp[1]);
      s.freq = rand(2.2, 3.6);
      s.wt = 0;
    }
    this.sharks.push(s);
  };

  /* A column of small sharks along one line across the screen, aimed near the player. */
  P._spawnPack = function () {
    var c = this.cfg, pk = c.pack, p = this.player, W = this.W, H = this.H;
    var m = c.shark.length * pk.size * 0.6;
    var edge = Math.floor(Math.random() * 4);
    var x, y;
    if (edge === 0) { x = clamp(p.x + rand(-60, 60), 30, W - 30); y = -m; }
    else if (edge === 1) { x = W + m; y = clamp(p.y + rand(-60, 60), 40, H - 40); }
    else if (edge === 2) { x = clamp(p.x + rand(-60, 60), 30, W - 30); y = H + m; }
    else { x = -m; y = clamp(p.y + rand(-60, 60), 40, H - 40); }
    // Head roughly toward the player's side of the screen, never straight down the edge.
    var heading = Math.atan2(p.y - y, p.x - x) + rand(-0.25, 0.25);
    var cx = Math.cos(heading), cy = Math.sin(heading);
    var group = Math.random();
    for (var i = 0; i < pk.count; i++) {
      var s = this._newShark('pack', x - cx * pk.gap * i, y - cy * pk.gap * i, heading, pk.size);
      s.t = pk.warnTime;
      s.group = group;
      s.lead = i === 0;
      this.sharks.push(s);
    }
  };

  /* ---------- items ---------- */

  P._updateItems = function (dt) {
    var c = this.cfg, i;

    this.pearlTimer -= dt;
    if (this.pearlTimer <= 0) {
      if (this.pearls.length < c.pearls.max) this.pearls.push(this._itemAt(c.pearls.life, 'pearl'));
      this.pearlTimer = rand(c.pearls.every[0], c.pearls.every[1]);
    }

    for (i = this.pearls.length - 1; i >= 0; i--) {
      var pe = this.pearls[i];
      pe.age += dt;
      if (pe.age >= pe.life) { this.pearls.splice(i, 1); continue; }
      if (this._toPlayer(pe.x, pe.y) < c.player.pickRadius) {
        this.pearls.splice(i, 1);
        var mult = this._chain(pe.x, pe.y);
        var amount = c.pearls.points * mult;
        this.bonus += amount;
        this.pickups++;
        this._emit('pickup', { kind: 'pearl', x: pe.x, y: pe.y, amount: amount, mult: mult, tone: pe.tone });
      }
    }
  };

  /* A spot away from the edges, not on top of the player, not on another item. */
  P._itemAt = function (life, kind) {
    var p = this.player, W = this.W, H = this.H, x = W / 2, y = H / 2;
    for (var i = 0; i < 12; i++) {
      x = rand(36, W - 36);
      y = rand(54, H - 64);
      if (Math.hypot(x - p.x, y - p.y) < 70) continue;
      var clear = true, all = this.pearls;
      for (var j = 0; j < all.length; j++) if (Math.hypot(x - all[j].x, y - all[j].y) < 48) { clear = false; break; }
      if (clear) break;
    }
    return { kind: kind, x: x, y: y, age: 0, life: life, tone: Math.floor(Math.random() * 4), ph: Math.random() * TAU };
  };

  /* ---------- sharks ---------- */

  P._updateSharks = function (dt) {
    var c = this.cfg.shark, cfg = this.cfg, p = this.player;
    var target = c.baseSpeed + c.speedGain * this.elapsed;
    var turn = (c.turnRate + c.turnGain * this.elapsed) * dt;
    var ending = this.isOver();
    var list = this.sharks;

    for (var i = list.length - 1; i >= 0; i--) {
      var s = list[i];
      var margin = c.length * s.size;
      s.wob += dt * (s.kind === 'dash' && s.mode === 'dash' ? 16 : s.kind === 'pack' ? 13 : 9);
      if (s.bonusCd > 0) s.bonusCd -= dt;

      if (s.kind === 'dash') {
        if (s.mode === 'aim') {
          s.t -= dt;
          if (s.t > cfg.dash.lockTime) {       // still tracking the player
            s.tx = p.x; s.ty = p.y;
            s.heading = Math.atan2(p.y - s.y, p.x - s.x);
          }
          if (s.t <= 0) {
            s.mode = 'dash';
            s.speed = cfg.dash.speed;
            this._emit('dash', { x: s.x, y: s.y, heading: s.heading });
          }
          if (ending) list.splice(i, 1);
          continue;
        }
        s.x += Math.cos(s.heading) * s.speed * dt;
        s.y += Math.sin(s.heading) * s.speed * dt;
        if (this._outside(s, margin * 1.2)) list.splice(i, 1);
        continue;
      }

      if (s.kind === 'pack' || s.kind === 'dart') {
        if (s.mode === 'warn') {
          s.t -= dt;
          if (s.t <= 0) { s.mode = 'swim'; s.speed = cfg.pack.speed; }
          continue;
        }
        if (s.base) {
          // Wavy path: along its line, swaying side to side; it faces the way it moves.
          var b = s.base, bx = Math.cos(b.h), by = Math.sin(b.h);
          s.wt += dt;
          b.x += bx * s.speed * dt; b.y += by * s.speed * dt;
          var off = Math.sin(s.wt * s.freq) * s.amp;
          s.x = b.x - by * off; s.y = b.y + bx * off;
          s.heading = b.h + Math.atan2(Math.cos(s.wt * s.freq) * s.amp * s.freq, s.speed);
        } else {
          s.x += Math.cos(s.heading) * s.speed * dt;
          s.y += Math.sin(s.heading) * s.speed * dt;
        }
        // The column has to clear the screen once before it may be removed.
        if (s.mode === 'swim' && !this._outside(s, 0)) s.mode = 'cross';
        if (s.mode === 'cross' && this._outside(s, margin)) list.splice(i, 1);
        else if (s.mode === 'swim' && this._outside(s, this.W + this.H)) list.splice(i, 1);
        continue;
      }

      // hunt
      if (s.mode === 'warn') {
        s.heading = Math.atan2(p.y - s.y, p.x - s.x);
        s.t -= dt;
        if (s.t <= 0) { s.mode = 'hunt'; s.t = s.track; s.speed = target * 0.7; }
        continue;
      }

      if (s.mode === 'hunt') {
        var want = Math.atan2(p.y - s.y, p.x - s.x);
        s.heading = wrap(s.heading + clamp(wrap(want - s.heading), -turn, turn));
        s.speed += (target - s.speed) * Math.min(1, 2 * dt);
        s.t -= dt;
        if (s.t <= 0) s.mode = 'leave';
      } else {
        // Leaving. Once the run ends, sharks turn away from the player and retreat.
        if (ending) {
          var away = Math.atan2(s.y - p.y, s.x - p.x);
          s.heading = wrap(s.heading + clamp(wrap(away - s.heading), -turn * 1.5, turn * 1.5));
        }
        s.speed += (target * 1.15 - s.speed) * Math.min(1, dt);
      }

      s.x += Math.cos(s.heading) * s.speed * dt;
      s.y += Math.sin(s.heading) * s.speed * dt;

      if (s.mode === 'leave' && this._outside(s, margin)) list.splice(i, 1);
    }

    // Light separation between hunting sharks so stacked sharks don't read as one.
    var minD = c.radius * c.size * 2.4;
    for (var a = 0; a < list.length; a++) {
      if (list[a].kind !== 'hunt' || list[a].mode === 'warn') continue;
      for (var b = a + 1; b < list.length; b++) {
        if (list[b].kind !== 'hunt' || list[b].mode === 'warn') continue;
        var dx = list[b].x - list[a].x, dy = list[b].y - list[a].y;
        var d = Math.hypot(dx, dy);
        if (d > 0.01 && d < minD) {
          var push = (minD - d) / 2 / d;
          list[a].x -= dx * push; list[a].y -= dy * push;
          list[b].x += dx * push; list[b].y += dy * push;
        }
      }
    }
  };

  P._outside = function (s, m) {
    return s.x < -m || s.x > this.W + m || s.y < -m || s.y > this.H + m;
  };

  /* Sharks that can touch the player right now. */
  P._live = function (s) {
    return s.mode !== 'warn' && s.mode !== 'aim';
  };

  /* Distance from point to the player's vertical capsule axis. */
  P._toPlayer = function (x, y) {
    var p = this.player, span = this.cfg.player.hitSpan;
    var dy = y - clamp(y, p.y - span, p.y + span);
    return Math.hypot(x - p.x, dy);
  };

  /* Gap between player capsule and the shark's head/body circles (tail is harmless). */
  P._gap = function (s) {
    var c = this.cfg, L = c.shark.length * s.size, r = c.shark.radius * s.size;
    var cx = Math.cos(s.heading), cy = Math.sin(s.heading);
    var d1 = this._toPlayer(s.x + cx * L * 0.2, s.y + cy * L * 0.2) - r;
    var d2 = this._toPlayer(s.x - cx * L * 0.1, s.y - cy * L * 0.1) - r * 0.85;
    return Math.min(d1, d2) - c.player.hitRadius;
  };

  P._resolve = function () {
    var sc = this.cfg.score, nm = sc.nearMissDist;
    for (var i = 0; i < this.sharks.length; i++) {
      var s = this.sharks[i];
      if (!this._live(s)) continue;
      var g = this._gap(s);

      if (g < 0) {
        if (this.invuln <= 0) this._hit(s);
        s.close = true; s.tainted = true;
      } else if (g < nm) {
        s.close = true;
        if (this.invuln > 0) s.tainted = true;
      } else if (s.close && g > nm * 1.6) {
        // Shark passed by without touching: close call.
        if (!s.tainted && s.bonusCd <= 0) {
          var mult = this._chain(this.player.x, this.player.y);
          var amount = (s.kind === 'dart' ? sc.nearMissDart : sc.nearMiss) * mult;
          this.bonus += amount;
          this.closeCalls++;
          s.bonusCd = 0.8;
          this._emit('nearMiss', { x: this.player.x, y: this.player.y, amount: amount, mult: mult, kind: s.kind });
        }
        s.close = false; s.tainted = false;
      }
    }
  };

  P._hit = function (s) {
    var p = this.player, c = this.cfg;
    var dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy) || 1;
    p.kbx = dx / d * c.player.knockback;
    p.kby = dy / d * c.player.knockback;
    if (s.kind === 'hunt') s.mode = 'leave';
    this.invuln = c.invulnTime;
    this.lives--;
    this._breakCombo();
    this._emit('hit', { x: p.x, y: p.y, lives: this.lives });
  };

  P._finish = function (result) {
    var c = this.cfg;
    this.result = result;
    if (result === 'clear') this.lifeBonus = this.lives * c.score.clearPerLife;
    this.sharks = this.sharks.filter(function (s) { return s.mode !== 'warn' && s.mode !== 'aim'; });
    for (var i = 0; i < this.sharks.length; i++) if (this.sharks[i].kind === 'hunt') this.sharks[i].mode = 'leave';
    this.pearls.length = 0;
    this.invuln = 0;
    this._setPhase(result);
    this._emit('end', { result: result, score: this.getScore() });
  };

  NS.EscapeGame = EscapeGame;
})(window.CAVIAR = window.CAVIAR || {});
