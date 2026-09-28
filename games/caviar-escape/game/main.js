/* CAVIAR ESCAPE — wiring: loop, state flow, events.
   title → countdown → 30s play → success / game over → result → retry | back */
(function (NS) {
  'use strict';

  var cfg = NS.config;
  var stageEl = document.getElementById('stage');
  var canvas = document.getElementById('stage-canvas');

  var game = new NS.EscapeGame(cfg);
  var renderer = new NS.Renderer(canvas, cfg);
  var input = new NS.Input(stageEl);
  var ui = new NS.UI(cfg);
  var store = NS.storage.scope(cfg.gameId);

  var best = store.getNumber('best', 0);

  // Member selection (remembered locally).
  var members = NS.members || [];
  function findMember(id) {
    for (var i = 0; i < members.length; i++) if (members[i].id === id) return members[i];
    return members[0] || null;
  }
  function selectMember(id) {
    var m = findMember(id);
    if (!m) return;
    store.set('member', m.id);
    renderer.setMember(m);
    ui.setMember(m);
  }
  if (members.length) {
    ui.buildPicker(members);
    selectMember(store.get('member', members[0].id));
  }
  ui.on('member', selectMember);
  var resultShown = true;
  var paused = false;
  var last = performance.now();

  function fit() {
    var r = stageEl.getBoundingClientRect();
    var world = renderer.resize(r.width, r.height);
    game.setWorld(world.W, world.H);
  }
  if (window.ResizeObserver) new ResizeObserver(fit).observe(stageEl);
  else window.addEventListener('resize', fit);
  fit();

  function startRun() {
    ui.hideScreens();
    renderer.clearEffects();
    renderer.playAnim('idle');
    input.reset();
    input.enabled = true;
    resultShown = false;
    game.start();
  }

  function toTitle() {
    input.enabled = false;
    input.reset();
    renderer.clearEffects();
    renderer.playAnim('idle');
    resultShown = true;
    game.idle();
    ui.showTitle(best);
  }

  function showResult() {
    resultShown = true;
    input.enabled = false;
    input.reset();
    var score = game.getScore();
    var isNewBest = score > best;
    if (isNewBest) { best = score; store.set('best', best); }
    ui.showResult({
      result: game.result,
      score: score,
      best: best,
      isNewBest: isNewBest,
      survived: game.elapsed,
      closeCalls: game.closeCalls,
      lifeBonus: game.lifeBonus
    });
  }

  function handle(ev) {
    switch (ev.type) {
      case 'hit':
        ui.hitFeedback();
        renderer.pulse(ev.x, ev.y, 'alert');
        renderer.playAnim('frown');
        break;
      case 'nearMiss':
        ui.bonusFeedback();
        renderer.pulse(ev.x, ev.y, 'gold');
        renderer.float(ev.x, ev.y - 34, '아슬아슬 +' + ev.amount);
        break;
      case 'end':
        if (ev.result === 'clear') {
          renderer.pulse(game.player.x, game.player.y, 'gold');
          renderer.playAnim('dance');
        } else {
          renderer.playAnim('frown', true);
        }
        break;
    }
  }

  ui.on('start', startRun);
  ui.on('retry', startRun);
  ui.on('back', toTitle);

  document.addEventListener('visibilitychange', function () {
    paused = document.hidden;
    last = performance.now();
    input.reset();
  });

  function tick(dt) {
    game.update(dt, input.enabled ? input.vector() : null);
    var events = game.drainEvents();
    for (var i = 0; i < events.length; i++) handle(events[i]);

    if (!resultShown && game.isOver() && game.phaseTime >= cfg.resultDelay) showResult();

    renderer.render(game, input, dt);
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

  // Debug handle for testing in the console. step(seconds) advances the game manually.
  NS.debug = {
    game: game,
    input: input,
    step: function (seconds) { for (var t = 0; t < seconds; t += 1 / 60) tick(1 / 60); }
  };
})(window.CAVIAR = window.CAVIAR || {});
