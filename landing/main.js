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
    if (a.key === 'email' && flow.emailOk()) ui.setEmailState(false);
    ui.setComplete(flow.isComplete());
  });
  ui.on('emailBlur', function () { ui.setEmailState(!!flow.answers.email && !flow.emailOk()); });
  ui.on('submit', function () {
    if (!flow.isComplete()) return;
    var order = flow.toOrder();
    NS.hub.setOrder(order);
    NS.track('entry', {});
    NS.account.profile(order);   // TIER 0 entry: nickname + email on the Verse8 server
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
  // TIER 1 · V8 login — placeholder: the bingo board shows the login gate / slot.
  NS.landingMenu.on('login', function () { NS.bingoUI.open(); });
  // Demo reset (for presentations): bingo, tickets, runs, login flag. Keeps the order.
  NS.landingMenu.on('reset', function () {
    if (!window.confirm(NS.t('시연용 초기화: 빙고·응모권·오늘 판수·데모 로그인을 지울까요?'))) return;
    NS.bingo.reset();
    NS.account.reset();
    syncBingo();
  });

  // Home line (overview S1 / S6): a new guest sees how many joined and this week's game; a
  // returning guest the three things closest to done, and today's multiplier.
  var tableInfo = document.createElement('p');
  tableInfo.className = 'lp-table__info';
  document.getElementById('table-presave').appendChild(tableInfo);
  var participants = null;
  function syncTableInfo() {
    var parts = [];
    var wi = Math.min(Math.max(NS.campaign.weekIndex(), 0), 2), w = NS.campaign.weeks[wi];
    var game = NS.bingo.games[w.game].name;
    if (NS.hub.getOrder()) {
      var C = NS.campaign.config.bingo, st = NS.account.state();
      var nextOf = function (list, have) { for (var i = 0; i < list.length; i++) if (have < list[i]) return list[i]; return list[list.length - 1]; };
      parts.push('출석 ' + NS.account.days() + '/' + nextOf(C.attNeed, NS.account.days()));
      parts.push('초대 ' + st.referrals + '/' + nextOf(C.refNeed, st.referrals));
      parts.push('빙고 ' + NS.bingo.doneCount() + '/16');
      parts.push('오늘 ' + game + ' x' + NS.account.multiplier().toFixed(1));
    } else {
      if (participants) parts.push(participants.toLocaleString('en-US') + '명 참여 중');
      parts.push(w.label + ' 이번 주 게임 · ' + game);
    }
    tableInfo.textContent = parts.join(' · ');
  }
  NS.account.onChange(syncTableInfo);
  NS.bingo.onChange(syncTableInfo);
  syncTableInfo();
  NS.whenServer(function (s) {
    if (s && s.getStats) s.getStats().then(function (r) { participants = r.participants; syncTableInfo(); }, function () {});
  });

  // Pre-save on the home and selection screens (overview: 선택 · HUD · 결과 · 홈)
  document.getElementById('table-presave').appendChild(NS.presave.chip());
  document.getElementById('cans-presave').appendChild(NS.presave.chip());
  // This week's mission progress + booster nudge under the cans
  var progressHost = document.getElementById('cans-progress');
  function syncProgress() {
    progressHost.innerHTML = '';
    progressHost.appendChild(NS.bingoUI.progressBlock(false));
  }
  NS.bingo.onChange(syncProgress);
  NS.account.onChange(syncProgress);
  syncProgress();

  // Week lock on the cans: W1 셰프 10/26 · W2 훔쳐라 11/2 · W3 매치 11/9
  function gameIdOf(can) { return can.game.replace(/^games\/|\/$/g, ''); }
  function syncCans() {
    var now = NS.campaign.weekIndex();
    ui.setCanLocks(function (id) {
      var can = flow.can(id), gid = gameIdOf(can);
      var wi = NS.campaign.weekOfGame(gid), w = NS.campaign.weeks[wi];
      var open = NS.campaign.isGameOpen(gid);
      return {
        open: open,
        now: wi === now,
        badge: w.label + ' · ' + (open ? NS.campaign.md(w.start) + ' OPEN' : NS.campaign.md(w.start) + ' 공개')
      };
    });
  }
  syncCans();

  NS.sound.bgm('landing');   // restaurant loop, starts on the first tap
  ui.on('can', function (id) {
    var can = flow.can(id);
    if (!can) return;
    if (!NS.campaign.isGameOpen(gameIdOf(can))) { ui.nudgeCan(id); return; }
    NS.hub.setOrder(flow.toOrder());
    ui.chooseCan(id, function () { window.location.href = NS.hub.gameUrl(can.game); });
  });

  // Returning guest: keep their answers; #cans jumps back to the can selection.
  if (flow.restore(NS.hub.getOrder())) {
    ui.fillForm(flow.answers);
    ui.setComplete(true);
    if (window.location.hash === '#cans') flow.go('cans');
    else if (window.location.hash === '#order') flow.go('order');
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
