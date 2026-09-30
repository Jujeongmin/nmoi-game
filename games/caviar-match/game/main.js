/* CAVIAR MATCH — wiring: input -> game, game events -> fx/ui, one render loop. */
(function () {
  'use strict';

  const cfg = CM.CONFIG;
  const app = document.getElementById('app');
  const stage = document.getElementById('stage');

  const ui = new CM.UI(cfg);
  const view = new CM.BoardView(document.getElementById('board'), stage, cfg);
  const fx = new CM.FxLayer(document.getElementById('fx'), app);
  const game = new CM.MatchGame(cfg, onGameEvent);

  CM.CaviarArt.preload();
  view.onLayout = (worldH) => game.setLayout(worldH);
  view.observe();
  fx.onArrive = (type) => ui.bumpCollection(type);

  const store = CAVIAR.storage.scope(cfg.gameId);
  let best = store.getNumber('best', 0);
  CAVIAR.bingoUI.attachGame(cfg.gameId, { root: cfg.assetRoot });
  let resultTimer = null;

  // --- Game events ------------------------------------------------------

  function onGameEvent(type, d) {
    CAVIAR.sound.event(cfg.gameId, type, d);
    if (type === 'collect') {
      const r = view.scale * cfg.radius * 0.95;
      fx.collect(d.items.map((it, i) => {
        const s = view.worldToHost(it.x, it.y, app);
        const t = ui.slotCenter(it.type);
        return { type: it.type, sx: s.x, sy: s.y, tx: t.x, ty: t.y, r, tr: t.r, delay: i * 0.035 + (it.detached ? 0.1 : 0) };
      }));
      const o = view.worldToHost(d.x, d.y, app);
      fx.text('+' + d.points, o.x, o.y - 8, 'score');
      if (d.combo >= 2) fx.text('콤보 ' + d.combo, o.x, o.y - 34, 'label');
    } else if (type === 'stageClear') {
      const o = view.worldToHost(game.W / 2, game.deathY * 0.6, app);
      fx.text('테이블 클리어', o.x, o.y - 26, 'label');
      fx.text('+' + d.bonus, o.x, o.y, 'score');
    } else if (type === 'end') {
      aim.down = false;
      scheduleResult(d);
    }
  }

  function scheduleResult(d) {
    const fresh = CAVIAR.bingo.report(cfg.gameId, {
      score: d.score, maxCombo: d.maxCombo, stage: d.stage, total: d.total, collected: d.collected,
    });
    const newBest = d.score > best;
    if (newBest) {
      best = d.score;
      store.set('best', best);
    }
    const started = performance.now();
    clearInterval(resultTimer);
    // let collected caviar finish gliding home before the bill arrives
    resultTimer = setInterval(() => {
      const waited = performance.now() - started;
      if ((!fx.busy && waited > 700) || waited > 2000) {
        clearInterval(resultTimer);
        ui.showResult(Object.assign({}, d, { best, newBest }));
        CAVIAR.bingoUI.showRun(cfg.gameId, fresh);
      }
    }, 100);
  }

  // --- Flow -------------------------------------------------------------

  CAVIAR.live = { gameId: cfg.gameId, score: () => (game.state === 'playing' ? game.score : null) };

  function startGame() {
    clearInterval(resultTimer);
    fx.clear();
    ui.resetCollection();
    game.start();
    ui.show('game');
  }

  function backToTitle() {
    clearInterval(resultTimer);
    fx.clear();
    ui.resetCollection();
    game.prepare();
    ui.show('title');
  }

  ui.on('btn-start', startGame);
  ui.on('btn-retry', startGame);
  ui.on('btn-back', CAVIAR.hub.backOr(backToTitle));

  // --- Input: pointer events cover mouse, touch and pen -----------------
  // Mouse: move to aim, click to send.  Touch: drag to aim, release to send.
  // Releasing below the shooter cancels the shot.

  const aim = { angle: Math.PI / 2, valid: false, down: false, hover: false, visible: false };

  function updateAim(e) {
    const p = view.clientToWorld(e.clientX, e.clientY);
    const dx = p.x - game.shooter.x;
    const dy = game.shooter.y - p.y;
    aim.valid = dy > cfg.radius * 0.6;
    aim.angle = game.clampAngle(Math.atan2(Math.max(dy, 0.001), dx));
  }

  stage.addEventListener('pointerdown', (e) => {
    if (game.state !== 'playing') return;
    e.preventDefault();
    try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    aim.down = true;
    updateAim(e);
  });

  stage.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') aim.hover = true;
    if (aim.down || e.pointerType === 'mouse') updateAim(e);
  });

  stage.addEventListener('pointerup', (e) => {
    if (!aim.down) return;
    aim.down = false;
    updateAim(e);
    if (aim.valid) game.fire(aim.angle);
  });

  stage.addEventListener('pointercancel', () => { aim.down = false; });
  stage.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') aim.hover = false; });
  stage.addEventListener('contextmenu', (e) => e.preventDefault());

  // --- Loop -------------------------------------------------------------

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    game.update(dt);
    fx.update(dt);

    aim.visible = game.state === 'playing' && aim.valid && (aim.down || aim.hover);
    view.render(game, aim, dt);
    fx.render();

    ui.setHud({
      stage: game.stage,
      time: game.time,
      score: game.score,
      combo: game.combo,
      alert: game.state === 'playing' && game.time <= cfg.alertTime,
    });

    requestAnimationFrame(frame);
  }

  // handle for debugging / future campaign shell integration
  CM.app = { game, view, fx, ui, start: startGame, back: backToTitle };

  game.prepare();
  ui.setBest(best);
  ui.show('title');
  requestAnimationFrame(frame);
})();
