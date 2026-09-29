/* PRE-SAVE LANDING — wiring: flow state ⇄ UI, order hand-off to the games.
   index.html#cans opens straight at the can selection when an order is stored
   (that is where the games send guests back). */
(function (NS) {
  'use strict';

  var cfg = NS.landingConfig;
  var flow = new NS.LandingFlow(cfg);
  var ui = new NS.LandingUI(cfg);
  var members = NS.members || [];

  function findMember(id) {
    for (var i = 0; i < members.length; i++) if (members[i].id === id) return members[i];
    return null;
  }

  function render() {
    ui.show(flow.step, flow.index(), flow.steps.length);
    if (flow.step === 'serve') {
      var caviar = flow.caviar();
      var eat = flow.eat();
      ui.fillServe({
        nickname: flow.answers.nickname,
        caviar: caviar,
        drink: flow.drink(),
        member: findMember(caviar.member),
        anim: eat ? eat.anim : 'idle',
      });
    }
    if (flow.step === 'cans') ui.resetCans();
    if (flow.step === 'order') ui.focusNickname();
  }

  function go(step) {
    if (flow.go(step)) {
      if (window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search);
      render();
    }
  }

  ui.on('open', function () { ui.openMenu(function () { go('order'); }); });
  ui.on('prev', function () { flow.prev(); render(); });
  ui.on('answer', function (a) {
    flow.set(a.key, a.value);
    ui.setComplete(flow.isComplete());
  });
  ui.on('submit', function () {
    if (!flow.isComplete()) return;
    NS.hub.setOrder(flow.toOrder());
    if (flow.answers.consent) NS.leaderboard.syncNickname(flow.answers.nickname);   // leaderboard name (opt-in)
    go('serve');
  });
  ui.on('secret', function () { go('cans'); });

  // Bingo board (shared/cv-bingo*.js)
  NS.bingoUI.mount({ root: '' });
  function syncBingo() { ui.setBingo(NS.bingo.doneCount(), NS.bingo.size * NS.bingo.size, NS.bingo.lines().length); }
  NS.bingo.onChange(syncBingo);
  syncBingo();
  ui.on('bingo', function () { NS.bingoUI.open(); });

  // Site menu (landing/menu.js)
  NS.landingMenu.init();
  document.getElementById('menu-sound').appendChild(NS.sound.button());
  NS.landingMenu.on('bingo', function () { NS.bingoUI.open(); });
  NS.landingMenu.on('presave', function () { NS.presave.interstitial(); });
  NS.landingMenu.on('restart', function () { flow.step = 'table'; render(); });

  NS.sound.bgm('landing');   // restaurant loop, starts on the first tap
  ui.on('can', function (id) {
    var can = flow.can(id);
    if (!can) return;
    NS.hub.setOrder(flow.toOrder());
    ui.chooseCan(id, function () { window.location.href = NS.hub.gameUrl(can.game); });
  });

  // Returning guest: keep their answers; #cans jumps back to the can selection.
  if (flow.restore(NS.hub.getOrder())) {
    ui.fillForm(flow.answers);
    ui.setComplete(true);
    if (window.location.hash === '#cans') flow.go('cans');
  }
  render();

  // Coming back with the browser's back button restores this page from cache.
  window.addEventListener('pageshow', function (ev) {
    if (ev.persisted && flow.step === 'cans') ui.resetCans();
    if (ev.persisted) syncBingo();
  });

  // Debug handle for the console.
  NS.landing = { flow: flow, ui: ui, go: go };
})(window.CAVIAR = window.CAVIAR || {});
