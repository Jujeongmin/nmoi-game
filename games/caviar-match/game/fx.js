/* CAVIAR MATCH — collection effects on a canvas covering the whole app.
   Matched caviar glow softly in place, then glide along an arc into their
   Collection slot. Nothing bursts, breaks or disappears: the caviar sheds a few
   flakes of gold leaf as it glides, and a thin gold ring opens where it lands
   (assets/menu, the campaign's menu ornaments). */
window.CM = window.CM || {};

CM.FxLayer = (function () {
  'use strict';

  const TAU = Math.PI * 2;
  const GLOW = 0.32;   // seconds glowing in place
  const FLY = 0.62;    // seconds gliding to the slot

  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const art = (path) => { const i = new Image(); i.src = CAVIAR.url(path); return i; };
  const LEAF = art('assets/menu/gold-leaf.webp');
  const RING = art('assets/menu/ring.webp');
  const ready = (img) => img.complete && img.naturalWidth > 0;
  const MAX_BITS = 140;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  class FxLayer {
    constructor(canvas, host) {
      this.canvas = canvas;
      this.host = host;
      this.ctx = canvas.getContext('2d');
      this.movers = [];
      this.texts = [];
      this.bits = [];   // gold leaf and landing rings
      this.onArrive = null;
      this.dpr = 1;
      new ResizeObserver(() => this.resize()).observe(host);
      this.resize();
    }

    resize() {
      this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      this.w = this.host.clientWidth;
      this.h = this.host.clientHeight;
      this.canvas.width = Math.round(this.w * this.dpr);
      this.canvas.height = Math.round(this.h * this.dpr);
    }

    get busy() { return this.movers.length > 0; }

    clear() {
      this.movers.length = 0;
      this.texts.length = 0;
      this.bits.length = 0;
    }

    /** items: { type, sx, sy, tx, ty, r, tr, delay } in host CSS px. */
    collect(items) {
      for (const it of items) {
        const bend = (Math.random() - 0.5) * 70;
        this.movers.push(Object.assign({}, it, {
          t: -(it.delay || 0),
          cx: it.sx + (it.tx - it.sx) * 0.25 + bend,
          cy: it.sy - (it.sy - it.ty) * 0.45 - 20,
        }));
      }
    }

    /** style: 'score' | 'label' */
    text(str, x, y, style) {
      this.texts.push({ str, x, y, style: style || 'score', t: 0, dur: style === 'label' ? 1.4 : 0.95 });
    }

    update(dt) {
      for (let i = this.movers.length - 1; i >= 0; i--) {
        const m = this.movers[i];
        m.t += dt;
        if (m.t >= GLOW + FLY) {
          this.movers.splice(i, 1);
          this.bit({ kind: 'ring', x: m.tx, y: m.ty, size: m.tr * 2, grow: 2.2, life: 0.45 });
          if (this.onArrive) this.onArrive(m.type);
        } else if (m.t > GLOW && Math.random() < dt * 16) {
          const p = this.pos(m);
          this.bit({ kind: 'leaf', x: p.x, y: p.y, vx: (Math.random() - 0.5) * 30, vy: 10 + Math.random() * 20,
            size: 5 + Math.random() * 5, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 6, life: 0.7 + Math.random() * 0.4 });
        }
      }
      for (let i = this.texts.length - 1; i >= 0; i--) {
        const t = this.texts[i];
        t.t += dt;
        if (t.t >= t.dur) this.texts.splice(i, 1);
      }
      for (let i = this.bits.length - 1; i >= 0; i--) {
        const b = this.bits[i];
        b.t += dt;
        if (b.t >= b.life) { this.bits.splice(i, 1); continue; }
        b.x += (b.vx || 0) * dt;
        b.y += (b.vy || 0) * dt;
        b.rot = (b.rot || 0) + (b.vr || 0) * dt;
      }
    }

    bit(b) {
      if (this.bits.length >= MAX_BITS) this.bits.shift();
      b.t = 0;
      this.bits.push(b);
    }

    /** Where a gliding mover is now (same curve as render). */
    pos(m) {
      const p = easeInOut(Math.min(1, (m.t - GLOW) / FLY));
      const u = 1 - p;
      return { x: u * u * m.sx + 2 * u * p * m.cx + p * p * m.tx, y: u * u * m.sy + 2 * u * p * m.cy + p * p * m.ty };
    }

    render() {
      const ctx = this.ctx;
      const d = this.dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.setTransform(d, 0, 0, d, 0, 0);

      for (const m of this.movers) {
        let x = m.sx, y = m.sy, r = m.r, glow = 0;
        if (m.t <= 0) {
          // waiting its turn — sits still where it was
        } else if (m.t < GLOW) {
          const p = m.t / GLOW;
          glow = Math.sin(p * Math.PI * 0.5);
          r = m.r * (1 + 0.08 * glow);
        } else {
          const p = easeInOut((m.t - GLOW) / FLY);
          const u = 1 - p;
          x = u * u * m.sx + 2 * u * p * m.cx + p * p * m.tx;
          y = u * u * m.sy + 2 * u * p * m.cy + p * p * m.ty;
          r = m.r * 1.08 + (m.tr - m.r * 1.08) * easeOut(p);
          glow = 1 - p * 0.7;
        }
        if (glow > 0) this.drawHalo(x, y, r, glow);
        CM.CaviarArt.draw(ctx, m.type, x, y, r, d);
      }

      this.drawBits();
      for (const t of this.texts) this.drawText(t);
    }

    drawBits() {
      const ctx = this.ctx;
      for (const b of this.bits) {
        const q = b.t / b.life;
        const img = b.kind === 'ring' ? RING : LEAF;
        if (!ready(img)) continue;
        const s = b.kind === 'ring' ? b.size * (1 + (b.grow - 1) * easeOut(q)) : b.size;
        const w = s, h = s * img.naturalHeight / img.naturalWidth;
        ctx.save();
        ctx.globalAlpha = b.kind === 'ring' ? 1 - q : (q > 0.6 ? (1 - q) / 0.4 : 1);
        ctx.translate(b.x, b.y);
        if (b.rot) ctx.rotate(b.rot);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();
      }
    }

    drawHalo(x, y, r, k) {
      const ctx = this.ctx;
      const g = ctx.createRadialGradient(x, y, r * 0.7, x, y, r * 2.1);
      g.addColorStop(0, 'rgba(240, 222, 176, ' + 0.42 * k + ')');
      g.addColorStop(1, 'rgba(240, 222, 176, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r * 2.1, 0, TAU);
      ctx.fill();
    }

    drawText(t) {
      const ctx = this.ctx;
      const p = t.t / t.dur;
      const alpha = p < 0.15 ? p / 0.15 : 1 - Math.max(0, (p - 0.55) / 0.45);
      const rise = easeOut(p) * 26;
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (t.style === 'label') {
        ctx.font = '600 12px "Noto Sans KR", "Malgun Gothic", sans-serif';
        if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
        ctx.fillStyle = '#c9ae78';
      } else {
        ctx.font = '500 24px "Noto Serif KR", "Nanum Myeongjo", serif';
        ctx.fillStyle = '#e2cc98';
      }
      ctx.fillText(t.str, t.x, t.y - rise);
      ctx.restore();
    }
  }

  return FxLayer;
})();
