/* Short gameplay clips for the game description cards (assets/clips/<game>.mp4 + .jpg poster).

     npm i playwright        (once, anywhere on the path; uses its Chromium)
     pip install imageio-ffmpeg
     node tools/record-clips.js [escape|match|chef ...]   (needs the local server: npx http-server -c-1 -p 5179)

   Each game is played by a small bot in a headless phone-sized browser; the recorder keeps
   the highlight window (Escape: the final wave to the clear, Match: a table cleared,
   Master Chef: a perfect order) and crops it to the play area. A take with a hit / miss is
   thrown away and played again. */
'use strict';
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'clips');
const BASE = process.env.CLIP_BASE || 'http://localhost:5179';
const FFMPEG = execFileSync('python', ['-c', 'import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())']).toString().trim();
const VIEW = { width: 390, height: 800 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- in-page bots ---------- */

// Escape: the simulation bot (tools/sim-escape.js) steering with the arrow keys every 0.12 s.
const ESCAPE_BOT = () => {
  const NS = window.CAVIAR, g = NS.debug.game, input = NS.debug.input;
  const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const DIRS = [{ x: 0, y: 0 }].concat(Array.from({ length: 8 }, (_, i) => ({ x: Math.cos(i * Math.PI / 4), y: Math.sin(i * Math.PI / 4) })));
  function danger(dir) {
    const c = g.cfg, pc = c.player, sc = c.shark;
    let px = g.player.x, py = g.player.y, vx = g.player.vx, vy = g.player.vy;
    const sh = g.sharks.filter((s) => s.mode !== 'warn').map((s) => ({ x: s.x, y: s.y, h: s.heading, v: s.mode === 'aim' ? 0 : s.speed,
      hunt: s.kind === 'hunt' && s.mode === 'hunt', aim: s.mode === 'aim' ? s.t : 0, size: s.size || 1 }));
    const turn = sc.turnRate + sc.turnGain * g.elapsed, dt = 0.05;
    let worst = 1e9;
    for (let t = 0; t < 1.0; t += dt) {
      const k = 1 - Math.exp(-pc.response * dt);
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
    return { gap: worst, room: Math.min(px, g.W - px, py, g.H - py), x: px, y: py };
  }
  function steer() {
    let pearl = null, bd = 1e9;
    for (const pe of g.pearls || []) { const d = Math.hypot(pe.x - g.player.x, pe.y - g.player.y); if (d < bd) { bd = d; pearl = pe; } }
    let best = DIRS[0], bestScore = -1e9;
    for (const dir of DIRS) {
      const r = danger(dir);
      let score = Math.min(r.gap, 60) * 3 + Math.min(r.room, 50);
      if (pearl) score -= Math.hypot(pearl.x - r.x, pearl.y - r.y) * 0.45;
      if (score > bestScore) { bestScore = score; best = dir; }
    }
    return best;
  }
  function hold(dir) {
    input.held = { right: dir.x > 0.3, left: dir.x < -0.3, down: dir.y > 0.3, up: dir.y < -0.3 };
  }
  window.__clip = { hits: 0, steer, hold };
  setInterval(() => { if (g.phase === 'play') hold(steer()); else input.held = {}; }, 120);
};

// Match: tries every aim angle with the game's own trace and fires at the biggest group.
const MATCH_BOT = () => {
  const app = window.CM.app, g = app.game, b = g.board;
  const stage = document.getElementById('stage');
  function value(angle) {
    const t = g.traceAim(angle);
    const cell = t && (t.cell || t.landing || t.hit);
    if (!cell || cell.r === undefined) return -1;
    if (b.get(cell.r, cell.c) !== null && b.get(cell.r, cell.c) !== undefined) return -1;
    b.set(cell.r, cell.c, g.current);
    const group = b.findGroup(cell.r, cell.c);
    let v = 0;
    if (group.length >= g.cfg.matchSize) {
      const saved = group.map(([r, c]) => [r, c, b.get(r, c)]);
      saved.forEach(([r, c]) => b.set(r, c, null));
      v = group.length + b.findDetached().length * 1.5 + 10;
      saved.forEach(([r, c, v0]) => b.set(r, c, v0));
    } else v = group.length * 0.5 - cell.r * 0.01;
    b.set(cell.r, cell.c, null);
    b.trim();
    return v;
  }
  // The middle of the widest run of best angles: a narrow (often banked) window misses in play.
  function best() {
    const list = [];
    for (let d = 10; d <= 170; d += 0.5) list.push({ d, v: value(d * Math.PI / 180) });
    const top = Math.max(...list.map((x) => x.v));
    let run = [], bestRun = [];
    for (const x of list) {
      if (x.v === top) { run.push(x.d); if (run.length > bestRun.length) bestRun = run.slice(); } else run = [];
    }
    return bestRun[Math.floor(bestRun.length / 2)] * Math.PI / 180;
  }
  async function shoot() {
    if (!g.canFire()) return false;
    const a = best();
    const v = app.view, rect = v.canvas.getBoundingClientRect();   // the view maps from its canvas
    const sx = rect.left + v.ox + g.shooter.x * v.scale, sy = rect.top + v.oy + g.shooter.y * v.scale;
    const tx = sx + Math.cos(a) * 140, ty = sy - Math.sin(a) * 140;
    const ev = (type, x, y) => stage.dispatchEvent(new PointerEvent(type, { pointerId: 9, pointerType: 'touch', isPrimary: true, bubbles: true, clientX: x, clientY: y }));
    ev('pointerdown', tx - Math.cos(a) * 40, ty + Math.sin(a) * 40);
    for (let i = 1; i <= 6; i++) { await new Promise((r) => setTimeout(r, 45)); ev('pointermove', tx - Math.cos(a) * 40 * (1 - i / 6), ty + Math.sin(a) * 40 * (1 - i / 6)); }
    await new Promise((r) => setTimeout(r, 160));
    ev('pointerup', tx, ty);
    return true;
  }
  // The end of a table: two pairs on the ceiling, the loaded caviar (left) and the next one
  // (right), each holding a few others. Two good shots drop everything (TABLE CLEARED).
  function stageEnding() {
    b.clear();
    const a = g.current, n = g.next, t = g.typeCount;
    const o1 = (a + 1) % t === n ? (a + 2) % t : (a + 1) % t, o2 = (n + 1) % t === a ? (n + 2) % t : (n + 1) % t;
    b.set(0, 1, a); b.set(0, 2, a); b.set(1, 1, o1); b.set(1, 2, o2); b.set(2, 1, o1); b.set(2, 2, o1); b.set(3, 2, o2);
    b.set(0, 6, n); b.set(0, 7, n); b.set(1, 6, o2); b.set(1, 7, o1); b.set(2, 6, o2); b.set(2, 7, o2); b.set(3, 6, o1);
  }
  window.__clip = { shoot, stageEnding };
};

// Master Chef: reads the order, waits a moment as if memorising, then plates it step by step.
const CHEF_BOT = () => {
  const g = window.CAVIAR.debug.game;
  async function plate(readMs, gapMs) {
    while (g.phase !== 'memorize') await new Promise((r) => setTimeout(r, 30));
    const steps = g.order.steps.slice();
    await new Promise((r) => setTimeout(r, readMs));
    document.getElementById('btn-ready').click();
    for (const s of steps) {
      await new Promise((r) => setTimeout(r, gapMs));
      const row = document.getElementById(s.kind === 'caviar' ? 'caviar-row' : 'ingredient-row');
      const label = (s.kind === 'caviar' ? g.cfg.caviars : g.cfg.ingredients).find((x) => x.id === s.id).label;
      const btn = [...document.querySelectorAll('.cm-pick')].find((x) => x.textContent.trim() === window.CAVIAR.t(label) || x.textContent.trim() === label);
      btn.click();
    }
    return steps.length;
  }
  window.__clip = { plate };
};

/* ---------- recording ---------- */

async function startGame(page) {
  await page.click('#btn-start');
  await sleep(500);
  const basic = await page.$('.cv-booster.is-open .cv-booster__can.is-basic');
  if (basic) { await basic.click(); await sleep(300); }
}

/* Crop box (CSS px) from the top of one element to the bottom of another; `aspect` (w/h)
   trims the height around the middle. */
async function rectOf(page, top, bottom, aspect) {
  const r = await page.evaluate(([t, b]) => {
    const a = document.querySelector(t).getBoundingClientRect(), z = document.querySelector(b).getBoundingClientRect();
    return { x: Math.round(a.left), y: Math.round(a.top), w: Math.round(a.width), h: Math.round(z.bottom - a.top) };
  }, [top, bottom]);
  if (aspect && r.w / r.h < aspect) { const h = Math.round(r.w / aspect); r.y += Math.round((r.h - h) / 2); r.h = h; }
  return r;
}

// Length of the recorded video (s): its timeline is shorter than the wall clock, so clips are
// cut from the end (the window always ends just before the recording stops).
function durationOf(file) {
  let out = '';
  try { execFileSync(FFMPEG, ['-i', file], { stdio: 'pipe' }); } catch (e) { out = String(e.stderr); }
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(out);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

const GAMES = {
  escape: {
    url: '/games/caviar-escape/?from=hub&lang=ko',
    crop: ['#stage', '#stage', 4 / 5],
    async play(page) {
      await page.evaluate(ESCAPE_BOT);
      await startGame(page);
      await page.waitForFunction(() => window.CAVIAR.debug.game.phase === 'play');
      // Skip to the final wave with the bot steering, then let it play in real time to the clear.
      await page.evaluate(() => {
        const NS = window.CAVIAR, D = NS.debug, g = D.game;
        g.lives = 99;
        while (g.elapsed < 25.4) { D.input.held = {}; window.__clip.hold(window.__clip.steer()); D.step(0.1); }
        g.lives = 3; g.invuln = 0;
        g.events.length = 0;
        const hit = g._hit.bind(g);
        g._hit = (s) => { window.__clip.hits++; hit(s); };
      });
      const t = Date.now();
      await page.waitForFunction(() => window.CAVIAR.debug.game.phase === 'clear' || window.CAVIAR.debug.game.phase === 'over', null, { timeout: 15000 });
      await sleep(1500);   // the clear: confetti and the member's dance
      const ok = await page.evaluate(() => window.__clip.hits === 0 && window.CAVIAR.debug.game.result === 'clear');
      return { ok, from: t + 600, to: Date.now() };
    }
  },
  match: {
    url: '/games/caviar-match/?from=hub&lang=ko',
    crop: ['#stage', '#stage'],
    async play(page) {
      await page.evaluate(MATCH_BOT);
      await startGame(page);
      await page.waitForFunction(() => window.CM.app.game.state === 'playing');
      await sleep(800);
      // The end of a table, played for real: two shots, each dropping half the table.
      await page.evaluate(() => window.__clip.stageEnding());
      await sleep(400);
      const t = Date.now();
      await sleep(500);
      await page.evaluate(() => window.__clip.shoot());
      await sleep(1300);
      const cleared = page.evaluate(() => new Promise((res) => {
        const g = window.CM.app.game, stage = g.stage;
        const iv = setInterval(() => { if (g.stage !== stage) { clearInterval(iv); res(true); } }, 30);
        setTimeout(() => { clearInterval(iv); res(false); }, 5000);
      }));
      await page.evaluate(() => window.__clip.shoot());
      const ok = await cleared;
      await sleep(1600);   // TABLE CLEARED and the new rows
      return { ok, from: t, to: Date.now() };
    }
  },
  chef: {
    url: '/games/caviar-master-chef/?from=hub&lang=ko',
    crop: ['.cm-ticket', '#stage'],
    async play(page) {
      await page.evaluate(CHEF_BOT);
      await startGame(page);
      await page.evaluate(() => window.__clip.plate(300, 120));   // order 1, quickly, off the clip
      await page.waitForFunction(() => window.CAVIAR.debug.game.phase === 'memorize');
      const t = Date.now();
      const before = await page.evaluate(() => window.CAVIAR.debug.game.perfectOrders);
      await page.evaluate(() => window.__clip.plate(1300, 380));
      await sleep(1500);   // PERFECT ORDER and the plate
      const ok = await page.evaluate((n) => window.CAVIAR.debug.game.perfectOrders === n + 1, before);
      return { ok, from: t - 200, to: Date.now() };
    }
  }
};

async function record(name) {
  const spec = GAMES[name];
  const dir = path.join(ROOT, 'tools', '.clips-tmp');
  fs.rmSync(dir, { recursive: true, force: true });
  for (let attempt = 1; attempt <= 8; attempt++) {
    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: VIEW, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'no-preference',
      recordVideo: { dir, size: VIEW }   // the screencast is 1x whatever the device scale
    });
    const page = await context.newPage();
    await page.goto(BASE + spec.url);
    await sleep(2500);
    const crop = await rectOf(page, spec.crop[0], spec.crop[1], spec.crop[2]);
    let res;
    try { res = await spec.play(page); } catch (e) { res = { ok: false, err: e.message }; }
    const video = page.video();
    const tEnd = Date.now();
    await context.close();
    await browser.close();
    const file = await video.path();
    if (!res.ok) { console.log(name, 'take', attempt, 'thrown away', res.err || ''); continue; }
    const total = durationOf(file);
    const dur = Math.min(5.5, (res.to - res.from) / 1000);
    const ss = Math.max(0, total - (tEnd - res.from) / 1000).toFixed(2);
    fs.mkdirSync(OUT, { recursive: true });
    const mp4 = path.join(OUT, name + '.mp4'), jpg = path.join(OUT, name + '.jpg');
    const vf = `crop=${crop.w & ~1}:${crop.h & ~1}:${crop.x}:${crop.y},fps=30`;   // 358 px wide; the card shows ~210
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-ss', ss, '-i', file, '-t', dur.toFixed(2), '-vf', vf, '-an',
      '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-crf', '26', '-preset', 'slow', '-movflags', '+faststart', mp4]);
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', mp4, '-frames:v', '1', '-q:v', '4', jpg]);
    console.log(name, 'ok', dur.toFixed(2) + 's of ' + total + 's', Math.round(fs.statSync(mp4).size / 1024) + ' KB', '(take ' + attempt + ')');
    fs.rmSync(dir, { recursive: true, force: true });
    return;
  }
  console.log(name, 'no clean take in 8 tries');
}

(async () => {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(GAMES);
  for (const n of names) await record(n);
})();
