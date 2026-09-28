/* CAVIAR ESCAPE — game logic. No DOM, no canvas.
   Consumes an input vector {x, y} (length 0..1) and emits events
   ('go', 'hit', 'nearMiss', 'end') that the UI and renderer react to. */
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
    this.result = null;
    this.sharks = [];
    this.spawnTimer = c.spawn.first;
    this.events = [];
    var p = this.player;
    p.x = this.W / 2;
    p.y = this.H * 0.55;
    p.vx = p.vy = 0;
    p.facing = -Math.PI / 2;
  };

  P._setPhase = function (phase) { this.phase = phase; this.phaseTime = 0; };
  P._emit = function (type, data) { data = data || {}; data.type = type; this.events.push(data); };

  P.idle = function () { this._reset(); this._setPhase('idle'); };
  P.start = function () { this._reset(); this._setPhase('countdown'); };

  /* Keep everything in proportion when the play area is resized. */
  P.setWorld = function (W, H) {
    var sx = W / this.W, sy = H / this.H;
    var p = this.player;
    p.x *= sx; p.y *= sy;
    for (var i = 0; i < this.sharks.length; i++) { this.sharks[i].x *= sx; this.sharks[i].y *= sy; }
    this.W = W; this.H = H;
  };

  /* ---------- read-only helpers for UI ---------- */

  P.getScore = function () { return Math.floor(this.survival) + this.bonus + this.lifeBonus; };
  P.difficulty = function () { return clamp(this.elapsed / this.cfg.duration, 0, 1); };
  P.countdownLeft = function () { return Math.max(0, this.cfg.countdown - this.phaseTime); };
  P.isOver = function () { return this.phase === 'clear' || this.phase === 'over'; };
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
        this._updatePlayer(dt, input);
        this._updateSpawner(dt);
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

  P._updatePlayer = function (dt, input) {
    var c = this.cfg.player, p = this.player;
    var tx = input ? input.x * c.maxSpeed : 0;
    var ty = input ? input.y * c.maxSpeed : 0;
    var k = 1 - Math.exp(-c.response * dt);
    p.vx += (tx - p.vx) * k;
    p.vy += (ty - p.vy) * k;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.x < p.r) { p.x = p.r; p.vx = 0; }
    if (p.x > this.W - p.r) { p.x = this.W - p.r; p.vx = 0; }
    if (p.y < c.halfHeight) { p.y = c.halfHeight; p.vy = 0; }
    if (p.y > this.H - c.halfHeight) { p.y = this.H - c.halfHeight; p.vy = 0; }
    if (p.vx * p.vx + p.vy * p.vy > 144) p.facing = Math.atan2(p.vy, p.vx);
  };

  P._updateSpawner = function (dt) {
    var s = this.cfg.spawn, t = this.difficulty();
    var active = 0;
    for (var i = 0; i < this.sharks.length; i++) if (this.sharks[i].mode !== 'leave') active++;
    var max = Math.floor(lerp(s.maxStart, s.maxEnd + 0.999, t));

    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    if (active < max) {
      this._spawnShark();
      this.spawnTimer = lerp(s.intervalStart, s.intervalEnd, t) * rand(0.8, 1.2);
    } else {
      this.spawnTimer = 0.25;
    }
  };

  P._spawnShark = function () {
    var c = this.cfg.shark, p = this.player, W = this.W, H = this.H;
    var m = c.length * 0.6;
    var minDist = Math.min(W, H) * 0.5;
    var x = 0, y = 0, best = -1, bx = 0, by = 0;

    // Pick an edge that isn't right next to the player.
    for (var i = 0; i < 8; i++) {
      var edge = Math.floor(Math.random() * 4);
      if (edge === 0) { x = rand(30, W - 30); y = -m; }
      else if (edge === 1) { x = W + m; y = rand(40, H - 40); }
      else if (edge === 2) { x = rand(30, W - 30); y = H + m; }
      else { x = -m; y = rand(40, H - 40); }
      var d = Math.hypot(x - p.x, y - p.y);
      if (d > best) { best = d; bx = x; by = y; }
      if (d > minDist) break;
    }

    this.sharks.push({
      x: bx, y: by,
      heading: Math.atan2(p.y - by, p.x - bx),
      speed: 0,
      mode: 'warn',
      t: c.warnTime,
      track: rand(c.trackTime[0], c.trackTime[1]),
      close: false,
      tainted: false,
      bonusCd: 0,
      wob: Math.random() * TAU
    });
  };

  P._updateSharks = function (dt) {
    var c = this.cfg.shark, p = this.player;
    var target = c.baseSpeed + c.speedGain * this.elapsed;
    var turn = (c.turnRate + c.turnGain * this.elapsed) * dt;
    var ending = this.isOver();
    var margin = c.length;
    var list = this.sharks;

    for (var i = list.length - 1; i >= 0; i--) {
      var s = list[i];
      s.wob += dt * 9;
      if (s.bonusCd > 0) s.bonusCd -= dt;

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

      if (s.mode === 'leave' &&
          (s.x < -margin || s.x > this.W + margin || s.y < -margin || s.y > this.H + margin)) {
        list.splice(i, 1);
      }
    }

    // Light separation so stacked sharks don't read as one.
    var minD = c.radius * 2.4;
    for (var a = 0; a < list.length; a++) {
      if (list[a].mode === 'warn') continue;
      for (var b = a + 1; b < list.length; b++) {
        if (list[b].mode === 'warn') continue;
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

  /* Distance from point to the player's vertical capsule axis. */
  P._toPlayer = function (x, y) {
    var p = this.player, span = this.cfg.player.hitSpan;
    var dy = y - clamp(y, p.y - span, p.y + span);
    return Math.hypot(x - p.x, dy);
  };

  /* Gap between player capsule and the shark's head/body circles (tail is harmless). */
  P._gap = function (s) {
    var c = this.cfg, L = c.shark.length, r = c.shark.radius;
    var cx = Math.cos(s.heading), cy = Math.sin(s.heading);
    var d1 = this._toPlayer(s.x + cx * L * 0.2, s.y + cy * L * 0.2) - r;
    var d2 = this._toPlayer(s.x - cx * L * 0.1, s.y - cy * L * 0.1) - r * 0.85;
    return Math.min(d1, d2) - c.player.hitRadius;
  };

  P._resolve = function () {
    var sc = this.cfg.score, nm = sc.nearMissDist;
    for (var i = 0; i < this.sharks.length; i++) {
      var s = this.sharks[i];
      if (s.mode === 'warn') continue;
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
          this.bonus += sc.nearMiss;
          this.closeCalls++;
          s.bonusCd = 0.8;
          this._emit('nearMiss', { x: this.player.x, y: this.player.y, amount: sc.nearMiss });
        }
        s.close = false; s.tainted = false;
      }
    }
  };

  P._hit = function (s) {
    var p = this.player, c = this.cfg;
    this.lives--;
    this.invuln = c.invulnTime;
    var dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy) || 1;
    p.vx = dx / d * c.player.knockback;
    p.vy = dy / d * c.player.knockback;
    s.mode = 'leave';
    this._emit('hit', { x: p.x, y: p.y, lives: this.lives });
  };

  P._finish = function (result) {
    var c = this.cfg;
    this.result = result;
    if (result === 'clear') this.lifeBonus = this.lives * c.score.clearPerLife;
    this.sharks = this.sharks.filter(function (s) { return s.mode !== 'warn'; });
    for (var i = 0; i < this.sharks.length; i++) this.sharks[i].mode = 'leave';
    this.invuln = 0;
    this._setPhase(result);
    this._emit('end', { result: result, score: this.getScore() });
  };

  NS.EscapeGame = EscapeGame;
})(window.CAVIAR = window.CAVIAR || {});
