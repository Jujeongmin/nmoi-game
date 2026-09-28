/* CAVIAR MATCH — canvas renderer: board, aim guide, shooter. Owns the world <-> screen transform.
   Reads game state; never changes it. */
window.CM = window.CM || {};

CM.BoardView = (function () {
  'use strict';

  const TAU = Math.PI * 2;

  function cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function withAlpha(hex, a) {
    const n = parseInt(hex.replace('#', ''), 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  class BoardView {
    constructor(canvas, stage, cfg) {
      this.canvas = canvas;
      this.stage = stage;
      this.ctx = canvas.getContext('2d');
      this.cfg = cfg;
      this.R = cfg.radius;
      this.W = cfg.cols * 2 * cfg.radius;
      this.worldH = cfg.minWorldHeight;
      this.scale = 1;
      this.ox = 0;
      this.oy = 0;
      this.dpr = 1;
      this.onLayout = null;
      this.time = 0;

      const gold = cssVar('--cv-gold', '#c9ae78');
      this.colors = {
        table: cssVar('--cv-espresso', '#15100b'),
        gold,
                goldA: (a) => withAlpha(gold, a),
      };
    }

    observe() {
      const ro = new ResizeObserver(() => this.resize());
      ro.observe(this.stage);
      this.resize();
    }

    resize() {
      const w = this.stage.clientWidth;
      const h = this.stage.clientHeight;
      if (!w || !h) return;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      this.canvas.width = Math.round(w * this.dpr);
      this.canvas.height = Math.round(h * this.dpr);

      const cfg = this.cfg;
      const s = Math.min(w / this.W, h / cfg.minWorldHeight);
      let worldH = h / s;
      let oy = 0;
      if (worldH > cfg.maxWorldHeight) {
        oy = (h - cfg.maxWorldHeight * s) / 2;
        worldH = cfg.maxWorldHeight;
      }
      this.scale = s;
      this.worldH = worldH;
      this.ox = (w - this.W * s) / 2;
      this.oy = oy;
      if (this.onLayout) this.onLayout(worldH);
    }

    clientToWorld(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left - this.ox) / this.scale,
        y: (clientY - rect.top - this.oy) / this.scale,
      };
    }

    /** World point -> CSS px relative to `host` (used by the fx layer). */
    worldToHost(x, y, host) {
      const rect = this.canvas.getBoundingClientRect();
      const hr = host.getBoundingClientRect();
      return {
        x: rect.left - hr.left + this.ox + x * this.scale,
        y: rect.top - hr.top + this.oy + y * this.scale,
      };
    }

    render(game, aim, dt) {
      this.time += dt || 0;
      const ctx = this.ctx;
      const k = this.dpr * this.scale;
      const W = this.W, H = this.worldH, R = this.R;
      const hair = 1 / this.scale;
      const col = this.colors;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.setTransform(k, 0, 0, k, this.ox * this.dpr, this.oy * this.dpr);

      // Table surface + frame
      ctx.fillStyle = col.table;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = col.goldA(0.28);
      ctx.lineWidth = hair;
      ctx.beginPath();
      ctx.moveTo(hair / 2, 0); ctx.lineTo(hair / 2, H);
      ctx.moveTo(W - hair / 2, 0); ctx.lineTo(W - hair / 2, H);
      ctx.stroke();

      // Fail line
      const danger = game.state === 'playing' ? game.dangerLevel() : 0;
      const pulse = danger > 0 ? 0.5 + 0.5 * Math.sin(this.time * 7) : 0;
      ctx.strokeStyle = col.goldA(0.22 + danger * (0.35 + 0.4 * pulse));
      ctx.setLineDash([3 * hair * 1.5, 6 * hair * 1.5]);
      ctx.beginPath();
      ctx.moveTo(8, game.deathY);
      ctx.lineTo(W - 8, game.deathY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Caviar on the board
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.clip();
      const board = game.board;
      const dim = game.state === 'ended';
      if (dim) ctx.globalAlpha = 0.55;
      board.forEach((r, c, t) => {
        const p = board.cellPos(r, c);
        CM.CaviarArt.draw(ctx, t, p.x, p.y + game.dropOffset, R * 0.95, k);
      });
      ctx.restore();

      if (aim.visible && game.canFire()) this.drawAim(game.traceAim(aim.angle), game, k);

      if (game.projectile) {
        const p = game.projectile;
        CM.CaviarArt.draw(ctx, p.type, p.x, p.y, R * 0.95, k);
      }

      this.drawShooter(game, k, hair);
    }

    drawAim(trace, game, k) {
      const ctx = this.ctx;
      const pts = trace.pts;
      const gap = 11;
      let total = 0;
      for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      const maxLen = Math.min(total, 900);

      let walked = 0;
      let nextDot = this.R * 1.4; // start clear of the shooter ring
      for (let i = 1; i < pts.length && nextDot < maxLen; i++) {
        const a = pts[i - 1], b = pts[i];
        const seg = Math.hypot(b.x - a.x, b.y - a.y);
        while (nextDot <= walked + seg && nextDot < maxLen) {
          const t = (nextDot - walked) / seg;
          const f = 1 - nextDot / (maxLen + 60);
          ctx.fillStyle = this.colors.goldA(0.25 + 0.65 * f);
          ctx.beginPath();
          ctx.arc(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 1.7, 0, TAU);
          ctx.fill();
          nextDot += gap;
        }
        walked += seg;
      }

      // Ghost ring where the caviar will settle
      if (trace.cell) {
        const p = game.board.cellPos(trace.cell.r, trace.cell.c);
        ctx.strokeStyle = this.colors.goldA(0.5);
        ctx.lineWidth = 1 / this.scale;
        ctx.beginPath();
        ctx.arc(p.x, p.y + game.dropOffset, this.R * 0.9, 0, TAU);
        ctx.stroke();
      }
    }

    drawShooter(game, k, hair) {
      const ctx = this.ctx;
      const R = this.R;
      const s = game.shooter;
      const col = this.colors;

      // Base ring
      ctx.strokeStyle = col.goldA(0.6);
      ctx.lineWidth = hair;
      ctx.beginPath();
      ctx.arc(s.x, s.y, R + 7, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = col.goldA(0.22);
      ctx.beginPath();
      ctx.moveTo(s.x - R - 26, s.y); ctx.lineTo(s.x - R - 12, s.y);
      ctx.moveTo(s.x + R + 12, s.y); ctx.lineTo(s.x + R + 26, s.y);
      ctx.stroke();

      if (game.current !== null) {
        CM.CaviarArt.draw(ctx, game.current, s.x, s.y, R * 0.95, k);
      }

      // NEXT
      const nx = this.W * 0.16;
      const nr = R * 0.7;
      ctx.fillStyle = col.gold;
      ctx.font = '600 9px "Noto Sans KR", "Malgun Gothic", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if ('letterSpacing' in ctx) ctx.letterSpacing = '1px';
      ctx.fillText('다음', nx, s.y - nr - 12);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      ctx.strokeStyle = col.goldA(0.3);
      ctx.beginPath();
      ctx.arc(nx, s.y, nr + 5, 0, TAU);
      ctx.stroke();
      if (game.next !== null) {
        CM.CaviarArt.draw(ctx, game.next, nx, s.y, nr, k);
      }
    }
  }

  return BoardView;
})();
