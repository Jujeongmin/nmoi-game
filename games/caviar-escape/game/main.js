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
  NS.bingoUI.attachGame(cfg.gameId, { root: cfg.assetRoot });

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
    // A guest from the landing gets the member their order picked.
    selectMember((NS.hub.fromHub && NS.hub.memberId()) || store.get('member', members[0].id));
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
    slowmo = 0;
    ui.hideScreens();
    renderer.clearEffects();
    renderer.playAnim('idle');
    input.reset();
    input.enabled = true;
    resultShown = false;
    game.start();
    game.lives += NS.account.runBonus(cfg.gameId).extraLife;   // +1 life booster (3-day streak)
  }
  NS.live = { gameId: cfg.gameId, score: function () { return game.phase === 'play' ? game.getScore() : null; } };

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
    NS.bingoUI.showRun(cfg.gameId, NS.bingo.report(cfg.gameId, {
      result: game.result, score: score, lives: game.lives, closeCalls: game.closeCalls
    }));
  }

  var talk = NS.talk ? NS.talk.bubble(stageEl, { anchor: 'top' }) : null;
  var warned = false;
  var slowmo = 0;   // seconds of slow motion left (close call)
  function handle(ev) {
    NS.sound.event(cfg.gameId, ev.type, ev);
    if (talk) {
      if (ev.type === 'go') { warned = false; talk.say('start'); }
      else if (ev.type === 'hit') talk.say('oops');
      else if (ev.type === 'nearMiss') talk.say('good');
      else if (ev.type === 'end') talk.hide();
    }
    renderer.event(ev, game);
    switch (ev.type) {
      case 'hit':
        renderer.playAnim('frown');
        break;
      case 'nearMiss':
        ui.bonusFeedback();
        slowmo = cfg.slowmo.time;
        break;
      case 'pickup':
      case 'combo':
        ui.bonusFeedback();
        break;
      case 'wave':
        ui.banner(ev.label, NS.t(ev.sub));
        break;
      case 'end':
        slowmo = 0;
        renderer.playAnim(ev.result === 'clear' ? 'dance' : 'frown', ev.result !== 'clear');
        break;
    }
  }

  ui.on('start', startRun);
  ui.on('retry', startRun);
  ui.on('back', NS.hub.backOr(toTitle));

  // Paused while the tab is hidden or the settings panel is open.
  function syncPause() {
    paused = document.hidden || !!(NS.settings && NS.settings.isOpen());
    last = performance.now();
    input.reset();
  }
  document.addEventListener('visibilitychange', syncPause);
  window.addEventListener('cv-settings', syncPause);

  function tick(dt) {
    // A close call slows the game for a moment; the scene keeps its own pace.
    var gdt = dt;
    if (slowmo > 0) { slowmo = Math.max(0, slowmo - dt); gdt = dt * cfg.slowmo.factor; }
    game.update(gdt, input.enabled ? input.vector() : null);
    if (talk && !warned && game.phase === 'play' && game.timeLeft <= 10) { warned = true; talk.say('last10'); }
    var events = game.drainEvents();
    for (var i = 0; i < events.length; i++) handle(events[i]);

    if (!resultShown && game.isOver() && game.phaseTime >= cfg.resultDelay) showResult();

    renderer.render(game, input, slowmo > 0 ? dt * 0.6 : dt);
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
