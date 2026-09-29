/* Game host page: ?game=<key of CAVIAR.host.games>. */
(function (NS) {
  'use strict';

  function $(id) { return document.getElementById(id); }
  var key = (/[?&]game=([a-z0-9-]+)/.exec(window.location.search) || [])[1] || 'sample';
  var entry = NS.host.games[key];

  $('link-home').href = NS.hub.link('index.html') + '#cans';
  $('btn-bingo').addEventListener('click', function () { NS.bingoUI.open(); });
  NS.bingoUI.mount();

  // Pre-save bar under the (empty) HUD line, like every game page
  document.querySelector('.cv-host__hud').replaceWith(NS.presave.chip('cv-presave-chip--hud'));

  if (!entry || !NS.host.embed($('stage'), key)) {
    $('host-title').textContent = entry ? entry.name : 'Caviar';
    $('stage').appendChild(NS.assetSlot({
      name: (entry ? entry.name : key) + ' 게임 빌드 자리',
      spec: 'Verse8 게임팀 빌드가 들어오면 이 자리에 iframe으로 실행됩니다 (shared/cv-host.js 레지스트리)',
      className: 'cv-host__slot'
    }));
    return;
  }
  $('host-title').textContent = entry.name;

  var result = $('screen-result');
  NS.host.on('end', function (r) {
    $('result-score').textContent = r.score.toLocaleString('en-US');
    result.classList.add('is-open');
    NS.bingoUI.showRun(r.gameId, r.missions);
  });
  NS.host.on('exit', function () { window.location.href = $('link-home').href; });
  $('btn-close-result').addEventListener('click', function () { result.classList.remove('is-open'); });
  $('btn-exit').addEventListener('click', function () { window.location.href = $('link-home').href; });
})(window.CAVIAR = window.CAVIAR || {});
