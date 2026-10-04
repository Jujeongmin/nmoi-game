/* Caviar Escape score balance: plays the real game logic (games/caviar-escape/game/logic.js)
   headless with bots of three skill levels and prints the score spread.

     node tools/sim-escape.js [runs per bot, default 400]

   See BOTS for how a bot plays. Used to set the bingo score cells (shared/cv-campaign.js and verse8/server.js, scoreEasy / score). */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { window: {}, Math, console };
ctx.window.CAVIAR = {};
vm.createContext(ctx);
// SIM_DIR: another copy of config.js + logic.js (e.g. an older version) to compare against.
const dir = process.env.SIM_DIR || path.join(root, 'games/caviar-escape/game');
for (const f of ['config.js', 'logic.js']) {
  vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
}
const NS = ctx.window.CAVIAR;

// A bot decides every `think` seconds (reaction time = skill): it tries 8 directions and standing
// still, plays each `horizon` seconds ahead against the sharks (hunters keep turning toward it at
// their limited rate, dash sharks and the pack go straight), and takes the safest one, with a pull
// toward the nearest pearl (`greed`) and some wobble (`jitter`).
const BOTS = {
  poor:    { think: 0.6,  horizon: 0.35, greed: 0,  jitter: 0.7 },   // barely looks: a first-timer
  novice:  { think: 0.40, horizon: 0.5, greed: 0.15, jitter: 0.35 },
  average: { think: 0.25, horizon: 0.7, greed: 0.3,  jitter: 0.2 },
  good:    { think: 0.15, horizon: 0.9, greed: 0.45, jitter: 0.08 },
};

function wrap(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

function danger(g, dir, b) {
  const c = g.cfg, pc = c.player, sc = c.shark;
  let px = g.player.x, py = g.player.y, vx = g.player.vx, vy = g.player.vy;
  const sh = g.sharks.filter((s) => s.mode !== 'warn').map((s) => ({ x: s.x, y: s.y, h: s.heading, v: s.mode === 'aim' ? 0 : s.speed,
    kind: s.kind, hunt: s.kind === 'hunt' && s.mode === 'hunt', aim: s.mode === 'aim' ? s.t : 0, size: s.size || 1 }));
  const turn = (sc.turnRate + sc.turnGain * g.elapsed);
  const dt = 0.05;
  let worst = 1e9;
  for (let t = 0; t < b.horizon; t += dt) {
    const k = pc.response > 0 ? 1 - Math.exp(-pc.response * dt) : 1;
    vx += (dir.x * pc.maxSpeed - vx) * k; vy += (dir.y * pc.maxSpeed - vy) * k;
    px = Math.max(pc.radius, Math.min(g.W - pc.radius, px + vx * dt));
    py = Math.max(pc.halfHeight, Math.min(g.H - pc.halfHeight, py + vy * dt));
    for (const s of sh) {
      if (s.aim > 0) { s.aim -= dt; if (s.aim <= 0) s.v = c.dash.speed; continue; }
      if (s.hunt) { const want = Math.atan2(py - s.y, px - s.x); s.h = wrap(s.h + Math.max(-turn * dt, Math.min(turn * dt, wrap(want - s.h)))); }
      s.x += Math.cos(s.h) * s.v * dt; s.y += Math.sin(s.h) * s.v * dt;
      const d = Math.hypot(px - s.x, py - s.y) - (sc.radius + 8) * s.size - pc.hitRadius;
      if (d < worst) worst = d;
    }
  }
  const room = Math.min(px, g.W - px, py, g.H - py);
  return { gap: worst, room, x: px, y: py };
}

const DIRS = [{ x: 0, y: 0 }].concat(Array.from({ length: 8 }, (_, i) => ({ x: Math.cos(i * Math.PI / 4), y: Math.sin(i * Math.PI / 4) })));

function steer(g, b) {
  let pearl = null, bd = 1e9;
  for (const pe of g.pearls || []) { const d = Math.hypot(pe.x - g.player.x, pe.y - g.player.y); if (d < bd) { bd = d; pearl = pe; } }
  let best = DIRS[0], bestScore = -1e9;
  for (const dir of DIRS) {
    const r = danger(g, dir, b);
    let score = Math.min(r.gap, 60) * 3 + Math.min(r.room, 50);
    if (pearl) score -= Math.hypot(pearl.x - r.x, pearl.y - r.y) * b.greed;
    score += (Math.random() - 0.5) * b.jitter * 60;
    if (score > bestScore) { bestScore = score; best = dir; }
  }
  return best;
}

function play(b) {
  const g = new NS.EscapeGame(NS.config);
  g.setWorld(360, 440);   // a phone's play area in world units (shorter side 360)
  g.start();
  const dt = 1 / 60;
  let input = { x: 0, y: 0 }, wait = 0;
  const hits = {};
  while (!g.isOver()) {
    wait -= dt;
    if (wait <= 0) { input = steer(g, b); wait = b.think; }
    const before = g.lives;
    g.update(dt, input);
    if (g.lives < before) {
      // which kind of shark touched the player
      let k = 'hunt', bd = 1e9;
      for (const s of g.sharks) { const d = Math.hypot(s.x - g.player.x, s.y - g.player.y); if (d < bd) { bd = d; k = s.kind || 'hunt'; } }
      hits[k] = (hits[k] || 0) + 1;
    }
    g.drainEvents();
  }
  return { score: g.getScore(), clear: g.result === 'clear', lives: g.lives, time: g.elapsed, hits };
}

const runs = Number(process.argv[2]) || 400;
const pct = (a, q) => a[Math.min(a.length - 1, Math.floor(q * a.length))];
for (const [name, b] of Object.entries(BOTS)) {
  const res = Array.from({ length: runs }, () => play(b));
  const s = res.map((r) => r.score).sort((x, y) => x - y);
  const clear = res.filter((r) => r.clear).length / runs;
  const hits = {};
  res.forEach((r) => { for (const k in r.hits) hits[k] = (hits[k] || 0) + r.hits[k]; });
  const t = res.map((r) => r.time).sort((x, y) => x - y);
  console.log(name.padEnd(8),
    'clear', (clear * 100).toFixed(0).padStart(3) + '%', ' survive median', pct(t, 0.5).toFixed(1) + 's',
    ' hits', JSON.stringify(hits),
    ' survive p10', pct(t, 0.1).toFixed(1) + 's', ' p25', pct(t, 0.25).toFixed(1) + 's',
    ' p10', pct(s, 0.1), ' p25', pct(s, 0.25), ' median', pct(s, 0.5), ' p75', pct(s, 0.75), ' p90', pct(s, 0.9), ' best', s[s.length - 1]);
}
