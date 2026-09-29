/* CAVIAR BINGO — DOM: board overlay, quest link on a game's title card,
   quest result on a game's result card. Styles: shared/cv-bingo.css.
   Needs cv-storage.js and cv-bingo.js.

   Landing:  CAVIAR.bingoUI.mount({ root: '' });            then .open()
   Game:     CAVIAR.bingoUI.attachGame(gameId, { root: '../../' });
             CAVIAR.bingoUI.showRun(gameId, CAVIAR.bingo.report(gameId, stats)); */
(function (NS) {
  'use strict';

  var B = NS.bingo;
  var overlay = null, els = {}, opts = { root: '' }, selected = null, currentGame = null;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function host() { return document.getElementById('app') || document.body; }

  function build() {
    overlay = el('div', 'cv-overlay cv-bingo');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', '캐비어 빙고');
    var panel = el('div', 'cv-panel cv-bingo__panel');

    var head = el('div', 'cv-bingo__head');
    head.appendChild(el('p', 'cv-eyebrow', 'NMOI · CAVIAR SERVICE'));
    els.title = el('h2', 'cv-bingo__title');
    els.sub = el('p', 'cv-bingo__sub');
    head.appendChild(els.title);
    head.appendChild(els.sub);

    els.board = el('div', 'cv-bingo__board');
    els.board.setAttribute('role', 'grid');

    els.detail = el('div', 'cv-bingo__detail');

    var close = el('button', 'cv-btn cv-bingo__close', '닫기');
    close.type = 'button';
    close.addEventListener('click', api.close);

    panel.appendChild(head);
    panel.appendChild(els.board);
    panel.appendChild(els.detail);
    panel.appendChild(close);
    if (NS.brand) NS.brand.badge(panel);
    overlay.appendChild(panel);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) api.close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay.classList.contains('is-open')) api.close(); });
    host().appendChild(overlay);
  }

  function tone(cell) { return cell.id === B.presave.id ? B.presave.tone : cell.game.tone; }

  function tinImage(cell) {
    var src = cell.done ? B.art.filled[tone(cell)] : B.art.empty;
    var img = el('img', 'cv-bingo__tin');
    img.alt = '';
    img.decoding = 'async';
    img.onerror = function () { img.removeAttribute('src'); img.classList.add('cv-bingo__tin--css'); };
    img.src = NS.url(src);
    return img;
  }

  var SVG = 'http://www.w3.org/2000/svg';

  function renderLines(lines) {
    var svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'cv-bingo__lines');
    svg.setAttribute('viewBox', '0 0 ' + B.size + ' ' + B.size);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    lines.forEach(function (line) {
      var a = line[0], z = line[line.length - 1];
      var l = document.createElementNS(SVG, 'line');
      l.setAttribute('x1', a % B.size + 0.5); l.setAttribute('y1', Math.floor(a / B.size) + 0.42);
      l.setAttribute('x2', z % B.size + 0.5); l.setAttribute('y2', Math.floor(z / B.size) + 0.42);
      svg.appendChild(l);
    });
    return svg;
  }

  function renderBoard() {
    var cells = B.cells();
    var lines = B.lines();
    var fresh = B.unseen();

    els.title.textContent = lines.length ? 'BINGO × ' + lines.length : 'CAVIAR BINGO';
    els.sub.innerHTML = '';
    els.sub.appendChild(document.createTextNode('채운 캔 '));
    els.sub.appendChild(el('b', '', B.doneCount() + ' / ' + cells.length));
    els.sub.appendChild(document.createTextNode(lines.length ? ' · 빙고 ' + lines.length + '줄' : ' · 한 줄을 채우면 빙고'));

    els.board.innerHTML = '';
    cells.forEach(function (cell) {
      var b = el('button', 'cv-bingo__cell');
      b.type = 'button';
      b.dataset.index = cell.index;
      if (cell.done) b.classList.add('is-done');
      if (cell.done && fresh.indexOf(cell.id) >= 0) b.classList.add('is-fresh');
      if (cell.id === B.presave.id) b.classList.add('is-presave');
      if (selected === cell.index) b.classList.add('is-selected');
      b.setAttribute('aria-label', cell.quest.title + (cell.done ? ' — 완료' : ''));
      b.appendChild(tinImage(cell));
      b.appendChild(el('span', 'cv-bingo__name', cell.quest.title));
      b.addEventListener('click', function () { selected = cell.index; renderBoard(); });
      els.board.appendChild(b);
    });
    if (lines.length) els.board.appendChild(renderLines(lines));
    B.markSeen();
    renderDetail(cells);
  }

  function renderDetail(cells) {
    var d = els.detail;
    d.innerHTML = '';
    var cell = selected === null ? null : cells[selected];
    if (!cell) {
      d.appendChild(el('p', 'cv-bingo__hint', '칸을 누르면 퀘스트를 볼 수 있어요. 한 줄을 채우면 빙고!'));
      var n = B.lines().length;
      var tiers = el('div', 'cv-bingo__rewards');
      B.rewards.forEach(function (r) {
        var t = el('div', 'cv-bingo__reward' + (n >= r.lines ? ' is-on' : ''));
        t.appendChild(el('b', '', r.label));
        t.appendChild(el('span', '', r.reward));
        tiers.appendChild(t);
      });
      d.appendChild(tiers);
      return;
    }
    var q = cell.quest;
    var meta = el('p', 'cv-bingo__meta', cell.id === B.presave.id ? 'SPECIAL' : cell.game.caviar + ' · ' + cell.game.name);
    d.appendChild(meta);
    var qt = el('p', 'cv-bingo__q', q.title);
    if (cell.done) qt.appendChild(el('span', 'cv-tag cv-bingo__done', '완료'));
    d.appendChild(qt);
    d.appendChild(el('p', 'cv-bingo__desc', q.desc));

    var actions = el('div', 'cv-bingo__actions');
    if (cell.id === B.presave.id) {
      if (!cell.done && NS.presave) {
        d.appendChild(NS.presave.linkBlock(function () { renderBoard(); refreshLinks(); }));
      }
    } else if (!cell.done && cell.gameId !== currentGame) {
      var play = el('a', 'cv-bingo__link', '게임하러 가기 →');
      play.href = NS.hub ? NS.hub.gameUrl(cell.game.path) : NS.url(cell.game.path + 'index.html');
      actions.appendChild(play);
    }
    if (actions.childNodes.length) d.appendChild(actions);
  }

  /* ---------- game cards ---------- */

  var titleLinks = [];

  function questLinkText(gameId) {
    var p = B.progress(gameId);
    var n = B.lines().length;
    return '퀘스트 ' + p.done + '/' + p.total + (n ? ' · 빙고 ' + n + '줄' : '') + ' · 빙고판 보기';
  }

  function refreshLinks() {
    titleLinks.forEach(function (l) { l.btn.textContent = questLinkText(l.game); });
  }

  function insertBeforeActions(panel, node) {
    var actions = panel.querySelector('.cv-actions');
    if (actions) panel.insertBefore(node, actions); else panel.appendChild(node);
  }

  var api = {
    mount: function (o) {
      if (o) for (var k in o) opts[k] = o[k];
      if (!overlay) build();
    },

    open: function (focusIndex) {
      api.mount();
      selected = typeof focusIndex === 'number' ? focusIndex : null;
      renderBoard();
      overlay.classList.add('is-open');
    },

    close: function () {
      if (overlay) overlay.classList.remove('is-open');
      refreshLinks();
    },

    /** Adds "퀘스트 n/5 · 빙고판 보기" to the game's title card. */
    attachGame: function (gameId, o) {
      currentGame = gameId;
      api.mount(o);
      var panel = document.querySelector('#screen-title .cv-panel');
      if (!panel) return;
      var btn = el('button', 'cv-quest-link', questLinkText(gameId));
      btn.type = 'button';
      btn.addEventListener('click', function () { api.open(); });
      insertBeforeActions(panel, btn);
      titleLinks.push({ btn: btn, game: gameId });
    },

    /** Shows quests finished by this run (or progress) on the result card. */
    showRun: function (gameId, fresh) {
      refreshLinks();
      var panel = document.querySelector('#screen-result .cv-panel');
      if (!panel) return;
      var box = panel.querySelector('.cv-quest-result');
      if (!box) {
        box = el('div', 'cv-quest-result');
        insertBeforeActions(panel, box);
      }
      box.innerHTML = '';
      var p = B.progress(gameId);
      var n = B.lines().length;
      if (fresh && fresh.length) {
        box.classList.add('is-new');
        box.appendChild(el('p', 'cv-quest-result__head', '퀘스트 달성 · 캔이 채워졌어요'));
        fresh.forEach(function (q) { box.appendChild(el('p', 'cv-quest-result__item', q.title + ' — ' + q.desc)); });
      } else {
        box.classList.remove('is-new');
      }
      var more = el('button', 'cv-quest-result__more', '퀘스트 ' + p.done + '/' + p.total + (n ? ' · 빙고 ' + n + '줄' : '') + ' · 빙고판 보기');
      more.type = 'button';
      more.addEventListener('click', function () { api.open(); });
      box.appendChild(more);

      // Mission -> Spotify pre-save hand-off (the campaign's real goal)
      if (!B.isDone(B.presave.id)) {
        var ps = el('button', 'cv-presave-cta');
        ps.type = 'button';
        ps.appendChild(el('span', 'cv-presave-cta__tag', 'MISSION'));
        ps.appendChild(el('span', '', 'NMOI Spotify Pre-save 하고 빙고 칸 채우기 →'));
        ps.addEventListener('click', function () { if (NS.presave) NS.presave.interstitial(); else api.open(B.presaveIndex()); });
        box.appendChild(ps);
      }
      if (NS.leaderboard) NS.leaderboard.renderResult(box, gameId);
      if (NS.brand) NS.brand.badge(panel);
      if (NS.presave) setTimeout(NS.presave.interstitial, 450);   // after the result card appears
    }
  };

  B.onChange(function () { refreshLinks(); });

  NS.bingoUI = api;
})(window.CAVIAR = window.CAVIAR || {});
