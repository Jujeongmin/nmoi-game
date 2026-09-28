/* CAVIAR MATCH — rules and simulation. No DOM, no drawing.
   Talks to the outside world through `onEvent(type, payload)`:
     start, fire, place, collect, drop, stageClear, end */
window.CM = window.CM || {};

CM.MatchGame = (function () {
  'use strict';

  const DEG = Math.PI / 180;

  class MatchGame {
    constructor(cfg, onEvent) {
      this.cfg = cfg;
      this.emit = onEvent || function () {};
      this.R = cfg.radius;
      this.W = cfg.cols * 2 * cfg.radius;
      this.board = new CM.HexBoard(cfg.cols, cfg.radius);
      this.typeCount = cfg.types.length;
      this.state = 'idle';           // idle | playing | ended
      this.endReason = null;
      this.projectile = null;
      this.current = null;
      this.next = null;
      this.dropOffset = 0;           // visual slide when rows are added
      this.fillCell = this.fillCell.bind(this);
      this.setLayout(cfg.minWorldHeight);
      this.resetStats();
    }

    resetStats() {
      this.score = 0;
      this.combo = 0;
      this.maxCombo = 0;
      this.time = this.cfg.timeLimit;
      this.stage = 1;
      this.misses = 0;
      this.dropTimer = 0;
      this.collected = new Array(this.typeCount).fill(0);
    }

    get totalCollected() { return this.collected.reduce((a, b) => a + b, 0); }

    /** World height changes with the screen; shooter and fail line follow it. */
    setLayout(worldHeight) {
      this.H = worldHeight;
      this.shooter = { x: this.W / 2, y: worldHeight - this.R * 2.6 };
      this.deathY = this.shooter.y - this.R * 3.4;
    }

    /** Fresh board and ammo, clock stopped (also used behind the title card). */
    prepare() {
      this.resetStats();
      this.board.clear();
      this.dropOffset = 0;
      this.projectile = null;
      this.endReason = null;
      for (let i = 0; i < this.cfg.startRows; i++) this.insertRow(false);
      this.current = this.pickAmmo();
      this.next = this.pickAmmo();
      this.state = 'idle';
    }

    start() {
      this.prepare();
      this.state = 'playing';
      this.emit('start', {});
    }

    canFire() {
      return this.state === 'playing' && !this.projectile && this.current !== null;
    }

    clampAngle(angle) {
      const min = this.cfg.minAimDeg * DEG;
      return Math.max(min, Math.min(Math.PI - min, angle));
    }

    /** angle: radians, 0 = right, PI/2 = straight up. */
    fire(angle) {
      if (!this.canFire()) return false;
      const a = this.clampAngle(angle);
      const v = this.cfg.shotSpeed;
      this.projectile = {
        x: this.shooter.x,
        y: this.shooter.y,
        vx: Math.cos(a) * v,
        vy: -Math.sin(a) * v,
        type: this.current,
      };
      this.current = null;
      this.emit('fire', { type: this.projectile.type });
      return true;
    }

    update(dt) {
      if (this.dropOffset < 0) {
        const speed = Math.max(this.board.rowH * 5, -this.dropOffset * 7);
        this.dropOffset = Math.min(0, this.dropOffset + speed * dt);
      }
      if (this.state !== 'playing') return;

      this.time -= dt;
      if (this.time <= 0) {
        this.time = 0;
        this.end('timeup');
        return;
      }

      this.dropTimer += dt;
      const interval = Math.max(this.cfg.dropIntervalMin, this.cfg.dropInterval - (this.stage - 1) * 1.5);
      if (this.dropTimer >= interval) {
        this.dropTimer = 0;
        this.insertRow(true);
        this.emit('drop', {});
        if (this.checkOverflow()) return;
      }

      if (this.projectile) this.stepProjectile(dt);
    }

    // --- Board generation ------------------------------------------------

    randomType() { return Math.floor(Math.random() * this.typeCount); }

    fillCell(r, c, board) {
      const near = [];
      const left = board.get(r, c - 1);
      if (left !== null) near.push(left);
      for (const [nr, nc] of board.neighbors(r, c)) {
        if (nr > r) {
          const v = board.get(nr, nc);
          if (v !== null) near.push(v);
        }
      }
      if (near.length && Math.random() < this.cfg.clusterChance) {
        return near[Math.floor(Math.random() * near.length)];
      }
      return this.randomType();
    }

    insertRow(animate) {
      this.board.insertTopRow(this.fillCell);
      if (animate) this.dropOffset -= this.board.rowH;
    }

    pickAmmo() {
      const present = [...this.board.presentTypes()];
      if (!present.length) return this.randomType();
      return present[Math.floor(Math.random() * present.length)];
    }

    refreshAmmo() {
      const present = this.board.presentTypes();
      const nextOk = present.size === 0 || present.has(this.next);
      this.current = nextOk ? this.next : this.pickAmmo();
      this.next = this.pickAmmo();
    }

    // --- Flight + collision ----------------------------------------------

    stepProjectile(dt) {
      const p = this.projectile;
      const R = this.R;
      const dist = Math.hypot(p.vx, p.vy) * dt;
      const steps = Math.max(1, Math.ceil(dist / (R * 0.35)));
      const sdt = dt / steps;
      for (let i = 0; i < steps; i++) {
        p.x += p.vx * sdt;
        p.y += p.vy * sdt;
        if (p.x < R) { p.x = 2 * R - p.x; p.vx = -p.vx; }
        else if (p.x > this.W - R) { p.x = 2 * (this.W - R) - p.x; p.vx = -p.vx; }

        if (p.y <= R) { this.land(p, null); return; }
        const hit = this.findCollision(p.x, p.y);
        if (hit) { this.land(p, hit); return; }
      }
    }

    findCollision(x, y) {
      const lim = Math.pow(2 * this.R * this.cfg.collideFactor, 2);
      let best = null;
      this.board.forEach((r, c) => {
        const q = this.board.cellPos(r, c);
        const d = (q.x - x) * (q.x - x) + (q.y - y) * (q.y - y);
        if (d < lim && (!best || d < best.d)) best = { r, c, d };
      });
      return best;
    }

    /** Nearest free cell next to what was hit (or on the ceiling). */
    snapCell(x, y, hit) {
      const b = this.board;
      let cands = [];
      if (hit) {
        cands = b.neighbors(hit.r, hit.c).filter(([r, c]) => b.get(r, c) === null);
      } else {
        for (let c = 0; c < b.rowLength(0); c++) if (b.get(0, c) === null) cands.push([0, c]);
      }
      if (!cands.length) {
        const last = b.lowestRow() + 1;
        for (let r = 0; r <= last; r++) {
          for (let c = 0; c < b.rowLength(r); c++) {
            if (b.get(r, c) !== null) continue;
            if (r === 0 || b.neighbors(r, c).some(([nr, nc]) => b.get(nr, nc) !== null)) cands.push([r, c]);
          }
        }
      }
      let best = null;
      for (const [r, c] of cands) {
        const q = b.cellPos(r, c);
        const d = (q.x - x) * (q.x - x) + (q.y - y) * (q.y - y);
        if (!best || d < best.d) best = { r, c, d };
      }
      return best;
    }

    land(p, hit) {
      const cell = this.snapCell(p.x, Math.max(p.y, this.R), hit);
      this.projectile = null;
      if (!cell) { this.refreshAmmo(); return; }
      this.board.set(cell.r, cell.c, p.type);
      this.emit('place', { r: cell.r, c: cell.c, type: p.type });
      this.resolve(cell);
    }

    // --- Match resolution ------------------------------------------------

    resolve(cell) {
      const b = this.board;
      const cfg = this.cfg;
      const sc = cfg.score;
      const group = b.findGroup(cell.r, cell.c);

      if (group.length >= cfg.matchSize) {
        this.combo++;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        this.misses = 0;

        const origin = b.cellPos(cell.r, cell.c);
        const items = [];
        const take = (r, c, detached) => {
          const type = b.get(r, c);
          const q = b.cellPos(r, c);
          items.push({ type, x: q.x, y: q.y + this.dropOffset, detached });
          b.set(r, c, null);
          this.collected[type]++;
        };
        group.forEach(([r, c]) => take(r, c, false));
        const loose = b.findDetached();
        loose.forEach(([r, c]) => take(r, c, true));
        b.trim();

        const points = group.length * sc.perCaviar
          + loose.length * sc.perDetached
          + (this.combo >= 2 ? (this.combo - 1) * sc.comboBonus : 0);
        this.score += points;

        this.emit('collect', {
          items,
          points,
          combo: this.combo,
          x: origin.x,
          y: origin.y + this.dropOffset,
        });
      } else {
        this.combo = 0;
        this.misses++;
        if (this.misses >= cfg.missesBeforeDrop) {
          this.misses = 0;
          this.insertRow(true);
          this.emit('drop', {});
        }
      }

      if (b.count() === 0) {
        this.stage++;
        this.score += sc.clearBonus;
        for (let i = 0; i < cfg.startRows; i++) this.insertRow(true);
        this.dropTimer = 0;
        this.emit('stageClear', { stage: this.stage, bonus: sc.clearBonus });
      }

      if (this.checkOverflow()) return;
      this.refreshAmmo();
    }

    checkOverflow() {
      const low = this.board.lowestRow();
      if (low < 0) return false;
      if (this.board.cellPos(low, 0).y + this.R > this.deathY) {
        this.end('overflow');
        return true;
      }
      return false;
    }

    /** 0 = safe, 1 = touching the line. Used for the warning pulse. */
    dangerLevel() {
      const low = this.board.lowestRow();
      if (low < 0) return 0;
      const bottom = this.board.cellPos(low, 0).y + this.R;
      const span = this.board.rowH * 2.5;
      return Math.max(0, Math.min(1, (bottom - (this.deathY - span)) / span));
    }

    end(reason) {
      if (this.state !== 'playing') return;
      this.state = 'ended';
      this.endReason = reason;
      this.projectile = null;
      this.emit('end', {
        reason,
        score: this.score,
        stage: this.stage,
        maxCombo: this.maxCombo,
        collected: this.collected.slice(),
        total: this.totalCollected,
      });
    }

    // --- Aim prediction --------------------------------------------------

    /** Simulates a shot. Returns the path (with bounce points) and landing cell. */
    traceAim(angle) {
      const R = this.R;
      const a = this.clampAngle(angle);
      const step = R * 0.35;
      let x = this.shooter.x, y = this.shooter.y;
      let dx = Math.cos(a), dy = -Math.sin(a);
      const pts = [{ x, y }];
      for (let i = 0; i < 800; i++) {
        x += dx * step;
        y += dy * step;
        if (x < R) { x = 2 * R - x; dx = -dx; pts.push({ x: R, y }); }
        else if (x > this.W - R) { x = 2 * (this.W - R) - x; dx = -dx; pts.push({ x: this.W - R, y }); }
        if (y <= R) {
          pts.push({ x, y: R });
          return { pts, cell: this.snapCell(x, R, null) };
        }
        const hit = this.findCollision(x, y);
        if (hit) {
          pts.push({ x, y });
          return { pts, cell: this.snapCell(x, y, hit) };
        }
      }
      pts.push({ x, y });
      return { pts, cell: null };
    }
  }

  return MatchGame;
})();
