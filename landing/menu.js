/* PRE-SAVE LANDING — site menu, records / weekly leaderboard, invite sheet.
   The leaderboard is weekly (3 seasons, shared/cv-campaign.js) on the Verse8 server;
   "my records" are local best scores of each game. */
(function (NS) {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function pad(n) { return String(Math.max(0, Math.floor(n))).padStart(5, '0'); }

  var handlers = {};

  function open(sheet) { sheet.classList.add('is-open'); }
  function close(sheet) { sheet.classList.remove('is-open'); }

  function renderRanking() {
    var body = $('ranking-body');
    body.innerHTML = '';

    body.appendChild(el('p', 'lp-rank__head', '내 최고 기록'));
    var list = el('dl', 'cv-menu lp-rank__mine');
    Object.keys(NS.bingo.games).forEach(function (id) {
      var g = NS.bingo.games[id];
      var best = NS.storage.scope(id).getNumber('best', 0);
      var row = el('div', 'cv-menu__row');
      row.appendChild(el('dt', '', g.name));
      row.appendChild(el('dd', 'lp-rank__score', pad(best)));
      list.appendChild(row);
    });
    body.appendChild(list);

    body.appendChild(el('p', 'lp-rank__head', '주간 리더보드 · TOP 20'));
    // Season tabs: W1 · W2 · W3 (the running week first selected)
    var cur = NS.campaign.season();
    // Before W1 (demo) the scores land in a 'pre' season — shown as its own tab.
    var seasons = (cur === 'pre' ? ['pre'] : []).concat(NS.campaign.weeks.map(function (w) { return w.id; }));
    var season = seasons.indexOf(cur) >= 0 ? cur : (cur === 'post' ? seasons[seasons.length - 1] : seasons[0]);
    var stabs = el('div', 'lp-rank__tabs lp-rank__tabs--season');
    seasons.forEach(function (id) {
      var t = el('button', 'lp-rank__tab', id.toUpperCase());
      t.type = 'button';
      t.dataset.season = id;
      t.addEventListener('click', function () { season = id; select(current); });
      stabs.appendChild(t);
    });
    body.appendChild(stabs);
    var seasonNote = el('p', 'lp-rank__season');
    body.appendChild(seasonNote);
    var tabs = el('div', 'lp-rank__tabs');
    var current = 0;
    var board = el('div', 'lp-rank__board');
    var ids = ['total'].concat(Object.keys(NS.bingo.games));
    ids.forEach(function (id, i) {
      var t = el('button', 'lp-rank__tab', id === 'total' ? '통합' : NS.bingo.games[id].name);
      t.type = 'button';
      t.addEventListener('click', function () { select(i); });
      tabs.appendChild(t);
    });
    body.appendChild(tabs);
    body.appendChild(board);

    function select(i) {
      current = i;
      Array.prototype.forEach.call(tabs.children, function (t, k) { t.classList.toggle('is-on', k === i); });
      Array.prototype.forEach.call(stabs.children, function (t) { t.classList.toggle('is-on', t.dataset.season === season); });
      seasonNote.textContent = NS.campaign.seasonLabel(season) + (season === cur && cur !== 'pre' ? ' · 진행 중' : '');
      board.innerHTML = '';
      board.appendChild(el('p', 'lp-rank__note', '불러오는 중…'));
      NS.leaderboard.load(ids[i], NS.campaign.config.leaderboardTop, season).then(function (res) {
        board.innerHTML = '';
        if (!res.top.length) { board.appendChild(el('p', 'lp-rank__note', '아직 기록이 없어요. 첫 번째 주인공이 되어보세요!')); return; }
        var ol = el('ol', 'lp-rank__list');
        res.top.forEach(function (r) {
          var li = el('li', r.me ? 'is-me' : '');
          li.appendChild(el('b', '', String(r.rank)));
          li.appendChild(el('span', '', r.nickname));
          li.appendChild(el('em', '', pad(r.score)));
          ol.appendChild(li);
        });
        board.appendChild(ol);
        if (res.mine && !res.top.some(function (r) { return r.me; })) {
          board.appendChild(el('p', 'lp-rank__mine-row', '내 순위 ' + res.mine.rank + '위 · ' + pad(res.mine.score)));
        }
      }, function () {
        board.innerHTML = '';
        board.appendChild(NS.assetSlot({
          name: '리더보드 (Verse8 서버)',
          spec: 'Verse8에 배포된 페이지에서 실시간 순위가 표시됩니다 · 닉네임 = 주문서의 성함',
          className: 'lp-rank__slot'
        }));
      });
    }
    select(0);
  }

  function bind(sheet) {
    sheet.addEventListener('click', function (e) {
      if (e.target === sheet) { close(sheet); return; }
      var act = e.target.closest('[data-act]');
      if (!act) return;
      var name = act.dataset.act;
      if (name === 'close') { close(sheet); return; }
      close(sheet);
      if (handlers[name]) handlers[name]();
    });
  }

  NS.landingMenu = {
    init: function () {
      var menu = $('menu-sheet'), ranking = $('ranking-sheet'), privacy = $('privacy-sheet'), invite = $('invite-sheet');
      bind(invite);
      handlers.invite = function () {
        var box = $('invite-body');
        box.innerHTML = '';
        box.appendChild(el('p', 'lp-invite__lead', '친구가 내 링크로 들어와 새 이메일로 프리세이브하면 1명 인정 (하루 최대 ' + NS.campaign.config.referralDailyCap + '명). 누적 인원과 주간 순위로 빙고 초대 미션이 채워져요.'));
        box.appendChild(NS.bingoUI.inviteBlock());
        open(invite);
      };
      bind(privacy);
      $('btn-privacy').addEventListener('click', function () { open(privacy); });
      // Links resolved from the site root (works on a CDN / proxied preview too)
      Array.prototype.forEach.call(document.querySelectorAll('[data-href]'), function (a) {
        a.href = NS.hub.link(a.dataset.href);
      });
      bind(menu);
      bind(ranking);
      $('btn-menu').addEventListener('click', function () { open(menu); });
      handlers.ranking = function () { renderRanking(); open(ranking); };
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { close(menu); close(ranking); close(invite); close(privacy); }
      });
    },
    on: function (name, fn) { handlers[name] = fn; }
  };
})(window.CAVIAR = window.CAVIAR || {});
