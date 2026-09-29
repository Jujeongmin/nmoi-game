/* CAVIAR MASTER CHEF — wiring: loop, state flow, events.
   title → order (memorize) → plating → signature caviar → next order … → time up → result → retry | back */
(function (NS) {
  'use strict';

  var cfg = NS.config;
  var game = new NS.ChefGame(cfg);
  var ui = new NS.UI(cfg);
  var store = NS.storage.scope(cfg.gameId);

  var best = store.getNumber('best', 0);
  NS.bingoUI.attachGame(cfg.gameId, { root: cfg.assetRoot });
  var resultShown = true;
  var paused = false;
  var last = performance.now();

  function startRun() {
    ui.hideScreens();
    resultShown = false;
    game.start();
  }

  function toTitle() {
    resultShown = true;
    game.idle();
    ui.hideScreens();
    ui.showTitle(best);
  }

  function showResult() {
    resultShown = true;
    var score = game.score;
    var isNewBest = score > best;
    if (isNewBest) { best = score; store.set('best', best); }
    ui.showResult({
      score: score,
      best: best,
      isNewBest: isNewBest,
      ordersCompleted: game.ordersCompleted,
      perfectOrders: game.perfectOrders,
      maxCombo: game.maxCombo
    });
    NS.bingoUI.showRun(cfg.gameId, NS.bingo.report(cfg.gameId, {
      score: score, ordersCompleted: game.ordersCompleted, perfectOrders: game.perfectOrders, maxCombo: game.maxCombo
    }));
  }

  ui.on('start', startRun);
  ui.on('retry', startRun);
  ui.on('back', NS.hub.backOr(toTitle));
  ui.on('ready', function () { game.ready(); flush(); });
  ui.on('select', function (pick) { game.select(pick.kind, pick.id); flush(); });

  // Hand queued game events to the UI right away so taps feel immediate.
  function flush() {
    var events = game.drainEvents();
    for (var i = 0; i < events.length; i++) {
      NS.sound.event(cfg.gameId, events[i].type, events[i]);
      ui.handle(events[i], game);
    }
  }

  document.addEventListener('visibilitychange', function () {
    paused = document.hidden;
    last = performance.now();
  });

  function tick(dt) {
    game.update(dt);
    flush();
    if (!resultShown && game.isOver() && game.overTime >= cfg.resultDelay) showResult();
    ui.update(game, best);
  }

  function frame(now) {
    var dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    tick(paused ? 0 : dt);
    requestAnimationFrame(frame);
  }

  toTitle();
  requestAnimationFrame(frame);

  // Block pinch / page scroll on mobile; all play happens inside the app column.
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  document.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });

  // Debug handle for testing in the console. step(seconds) advances the game manually.
  NS.debug = {
    game: game,
    step: function (seconds) { for (var t = 0; t < seconds; t += 1 / 60) tick(1 / 60); }
  };
})(window.CAVIAR = window.CAVIAR || {});
