/* Leaderboard on the Verse8 server. Needs cv-storage.js (+ cv-hub.js for the nickname).
   The server bridge (CAVIAR.server, module shared/cv-server.js) only exists in the Verse8
   build; without it everything here degrades to an "offline" message.

   CAVIAR.leaderboard.syncNickname(nick)        landing order sheet
   CAVIAR.leaderboard.submit(gameId, score)     called by cv-bingo.js report()
   CAVIAR.leaderboard.renderResult(box, gameId) rank line on a game's result card
   CAVIAR.leaderboard.load(gameId, limit)       -> Promise<{ top, mine }> */
(function (NS) {
  'use strict';

  var store = NS.storage.scope('leaderboard');
  var WAIT_MS = 4000;
  var last = {};        // gameId -> Promise of the latest submit result
  var nickTask = null;

  function server() {
    if (NS.server) return Promise.resolve(NS.server);
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(new Error('offline')); }, WAIT_MS);
      NS.whenServer(function (s) { clearTimeout(t); resolve(s); });
    });
  }

  function orderNickname() {
    var o = NS.hub && NS.hub.getOrder && NS.hub.getOrder();
    return o && o.nickname ? String(o.nickname) : '';
  }

  /** Leaderboard is opt-in (order sheet consent). No consent = nothing is sent. */
  function consented() {
    var o = NS.hub && NS.hub.getOrder && NS.hub.getOrder();
    return !!(o && o.consent);
  }

  function ensureNickname() {
    var nick = orderNickname();
    if (!nick || store.get('synced', '') === nick) return Promise.resolve();
    if (!nickTask) {
      nickTask = server().then(function (s) { return s.setNickname(nick); })
        .then(function (saved) { store.set('synced', saved || nick); })
        .catch(function () { /* retried next time */ })
        .then(function () { nickTask = null; });
    }
    return nickTask;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  NS.leaderboard = {
    syncNickname: function (nick) {
      if (nick) store.set('synced', '');   // force a re-sync with the new name
      return ensureNickname();
    },

    consented: consented,

    submit: function (gameId, score) {
      if (typeof score !== 'number' || !isFinite(score)) return;
      if (!consented()) { last[gameId] = Promise.reject(new Error('no-consent')); last[gameId].catch(function () {}); return last[gameId]; }
      last[gameId] = ensureNickname()
        .then(server)
        .then(function (s) { return s.submitScore(gameId, Math.floor(score)); });
      last[gameId].catch(function () { /* shown by renderResult */ });
      return last[gameId];
    },

    renderResult: function (box, gameId) {
      if (!box) return;
      var line = box.querySelector('.cv-rank-line');
      if (!line) {
        line = el('p', 'cv-rank-line');
        box.insertBefore(line, box.firstChild);
      }
      line.textContent = '리더보드 집계 중…';
      var task = last[gameId];
      if (!task) { line.textContent = ''; return; }
      task.then(function (r) {
        line.textContent = '';
        line.appendChild(el('span', 'cv-rank-line__tag', 'RANK'));
        line.appendChild(document.createTextNode(' 전체 ' + r.rank + '위 · 최고 ' + r.best.toLocaleString('en-US') + '점' + (r.improved ? ' · 기록 갱신!' : '')));
      }, function (err) {
        line.textContent = err && err.message === 'no-consent'
          ? '리더보드 미참여 · 주문서에서 공개에 동의하면 순위에 올라가요'
          : '리더보드는 Verse8 서버에서 집계돼요 (지금은 연결 안 됨)';
        line.classList.add('is-off');
      });
    },

    load: function (gameId, limit) {
      return server().then(function (s) { return s.getLeaderboard(gameId, limit || 20); });
    }
  };
})(window.CAVIAR = window.CAVIAR || {});
