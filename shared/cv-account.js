/* The guest's account on the Verse8 server: profile, tickets, pre-save, referrals,
   attendance, runs per day, leaderboard. Needs cv-storage.js, cv-campaign.js, cv-hub.js.

   The server (verse8/server.js) is the authority whenever it is reachable
   (CAVIAR.server, only in the Verse8 build). Without it the same numbers are kept in
   this browser so every screen still works in a local preview or demo.

   CAVIAR.account.state()                  { tickets, presaved, referrals, days, lines, inviteCode, ... }
   CAVIAR.account.profile(order)           entry: nickname + email (+ ?ref invite code)
   CAVIAR.account.presave()                pre-save click → +2 tickets, booster, +1 run/day
   CAVIAR.account.claimLine(id)            bingo line → +3 tickets (once per line)
   CAVIAR.account.playsLeft(gameId)        runs left today
   CAVIAR.account.attachGame(gameId)       title card: runs left, week lock, start gating
   CAVIAR.account.inviteLink()             landing URL with this guest's invite code
   CAVIAR.account.loggedIn()               TIER 1 (V8 login) — placeholder, see below
   CAVIAR.leaderboard.submit / renderResult / load */
(function (NS) {
  'use strict';

  var CFG = NS.campaign.config;
  var store = NS.storage.scope('account');
  var listeners = [];
  var WAIT_MS = 4000;

  /* ---------------- local mirror ---------------- */

  function read() {
    var s;
    try { s = JSON.parse(store.get('state', '{}')) || {}; } catch (e) { s = {}; }
    s.tickets = s.tickets || 0;
    s.referrals = s.referrals || 0;
    s.days = s.days || [];
    s.lines = s.lines || [];
    s.plays = s.plays && s.plays.date === NS.campaign.today() ? s.plays : { date: NS.campaign.today(), counts: {} };
    return s;
  }
  var state = read();
  function save() { store.set('state', JSON.stringify(state)); emit(); }
  function emit() { listeners.forEach(function (fn) { try { fn(state); } catch (e) {} }); }

  // Server summary wins where it has an answer.
  function merge(me) {
    if (!me) return;
    state.tickets = me.tickets;
    state.presaved = me.presaved || state.presaved;
    state.referrals = me.referrals;
    state.inviteCode = me.inviteCode || state.inviteCode;
    state.lines = me.lines || state.lines;
    if (me.days > state.days.length) state.serverDays = me.days;
    Object.keys(me.playsToday || {}).forEach(function (g) {
      state.plays.counts[g] = Math.max(state.plays.counts[g] || 0, me.playsToday[g]);
    });
    state.online = true;
    save();
  }

  function server() {
    if (NS.server) return Promise.resolve(NS.server);
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(new Error('offline')); }, WAIT_MS);
      NS.whenServer(function (s) { clearTimeout(t); resolve(s); });
    });
  }
  function quiet(p) { p.catch(function () {}); return p; }

  function sha256(text) {
    if (!window.crypto || !crypto.subtle) return Promise.reject(new Error('no crypto'));
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    });
  }

  function limit() { return CFG.dailyPlays + (state.presaved ? CFG.presaveBonusPlays : 0); }

  /* ---------------- attendance (every page counts) ---------------- */

  (function checkIn() {
    var today = NS.campaign.today();
    if (state.days.indexOf(today) < 0) { state.days.push(today); save(); }
    quiet(server().then(function (s) { return s.checkIn(); }).then(merge));
  })();

  // Invite code from ?ref= (kept until the entry form sends it)
  (function readRef() {
    var m = /[?&]ref=([A-Za-z0-9]{4,8})/.exec(window.location.search);
    if (m) store.set('ref', m[1].toUpperCase());
  })();

  var last = {};   // gameId -> promise of the latest submit

  NS.account = {
    state: function () { return state; },
    onChange: function (fn) { listeners.push(fn); },
    limit: limit,
    days: function () { return Math.max(state.days.length, state.serverDays || 0); },

    /** Entry form: nickname + email (consent is on the form). */
    profile: function (order) {
      if (!order || !order.nickname || !order.email) return Promise.resolve();
      var email = String(order.email).trim().toLowerCase();
      return sha256(email).then(function (hash) {
        var key = order.nickname + '|' + hash;
        if (store.get('profileSent', '') === key) return;
        return server().then(function (s) {
          return s.setProfile({ nickname: order.nickname, email: email, emailHash: hash, ref: store.get('ref', '') });
        }).then(function (me) { store.set('profileSent', key); merge(me); });
      }).catch(function () { /* retried on the next submit */ });
    },

    presaved: function () { return !!state.presaved; },

    /** Pre-save click (smart link opened by cv-presave.js). */
    presave: function () {
      if (!state.presaved) {
        state.presaved = true;
        state.tickets += CFG.tickets.presave;
        save();
      }
      return quiet(server().then(function (s) { return s.markPresave(); }).then(merge));
    },

    claimLine: function (lineId) {
      if (state.lines.indexOf(lineId) >= 0) return;
      state.lines.push(lineId);
      state.tickets += CFG.tickets.line;
      save();
      quiet(server().then(function (s) { return s.claimLine(lineId); }).then(merge));
    },

    playsLeft: function (gameId) { return Math.max(0, limit() - (state.plays.counts[gameId] || 0)); },

    consumePlay: function (gameId) {
      state.plays.counts[gameId] = (state.plays.counts[gameId] || 0) + 1;
      save();
    },

    inviteLink: function () {
      return state.inviteCode ? NS.url('index.html') + '?ref=' + state.inviteCode : '';
    },

    /* TIER 1 — V8 login. Placeholder: a Verse8 account in the URL (?account=) counts as
       logged in; the login button itself will point at Verse8's login once we have it. */
    loggedIn: function () {
      return /[?&]account=/.test(window.location.search) || store.get('demoLogin', '') === '1';
    },
    setDemoLogin: function (on) { store.set('demoLogin', on ? '1' : ''); emit(); },

    /** Demo reset (menu): local tickets, runs, lines and login flag. The server keeps its own. */
    reset: function () {
      ['state', 'profileSent', 'demoLogin'].forEach(function (k) { store.set(k, ''); });
      state = read();
      state.days.push(NS.campaign.today());
      save();
    },

    /** Title card of a game: week lock, runs left today, start gating. */
    attachGame: function (gameId) {
      var panel = document.querySelector('#screen-title .cv-panel');
      if (!panel) return;
      var line = document.createElement('p');
      line.className = 'cv-plays';
      var actions = panel.querySelector('.cv-actions');
      panel.insertBefore(line, actions || null);

      var weekIdx = NS.campaign.weekOfGame(gameId);
      var week = weekIdx >= 0 ? NS.campaign.weeks[weekIdx] : null;

      function render() {
        line.innerHTML = '';
        line.classList.remove('is-out', 'is-locked');
        if (!NS.campaign.isGameOpen(gameId)) {
          line.classList.add('is-locked');
          line.textContent = week.label + ' · ' + NS.campaign.md(week.start) + ' 오픈 — 이 게임은 아직 준비 중이에요';
          return;
        }
        var left = NS.account.playsLeft(gameId);
        var b = document.createElement('b');
        b.textContent = left + ' / ' + limit();
        line.appendChild(document.createTextNode('오늘 남은 판 '));
        line.appendChild(b);
        if (state.presaved) line.appendChild(document.createTextNode(' · 부스터 x' + CFG.booster + ' 적용'));
        if (left <= 0) {
          line.classList.add('is-out');
          line.appendChild(document.createElement('br'));
          line.appendChild(document.createTextNode(state.presaved ? '오늘은 모두 플레이했어요. 내일 다시 만나요!' : '오늘 판을 모두 썼어요. 프리세이브하면 1판 더!'));
        }
      }
      render();
      NS.account.onChange(render);

      // Gate the start / retry buttons (capture phase, before the game's own handler).
      ['btn-start', 'btn-retry'].forEach(function (id) {
        var btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener('click', function (e) {
          var blocked = !NS.campaign.isGameOpen(gameId) || NS.account.playsLeft(gameId) <= 0;
          if (blocked) {
            e.stopImmediatePropagation();
            e.preventDefault();
            if (NS.campaign.isGameOpen(gameId) && !state.presaved && NS.presave) NS.presave.interstitial();
            else if (id === 'btn-retry') btn.textContent = '오늘은 모두 플레이했어요';
            render();
            return;
          }
          NS.account.consumePlay(gameId);
        }, true);
      });
    }
  };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  /* ---------------- leaderboard ---------------- */

  NS.leaderboard = {
    submit: function (gameId, score) {
      if (typeof score !== 'number' || !isFinite(score)) return;
      var order = NS.hub && NS.hub.getOrder && NS.hub.getOrder();
      if (!order || !order.email) {
        last[gameId] = Promise.reject(new Error('no-profile'));
      } else {
        last[gameId] = NS.account.profile(order).then(server).then(function (s) { return s.submitScore(gameId, Math.floor(score)); });
      }
      last[gameId].catch(function () {});
      return last[gameId];
    },

    renderResult: function (box, gameId) {
      if (!box) return;
      var line = box.querySelector('.cv-rank-line');
      if (!line) { line = el('p', 'cv-rank-line'); box.insertBefore(line, box.firstChild); }
      line.classList.remove('is-off');
      line.textContent = '리더보드 집계 중…';
      var task = last[gameId];
      if (!task) { line.textContent = ''; return; }
      task.then(function (r) {
        line.textContent = '';
        if (!r.counted) {
          line.classList.add('is-off');
          line.textContent = '오늘 판을 모두 써서 이번 판은 리더보드에 기록되지 않았어요';
          return;
        }
        line.appendChild(el('span', 'cv-rank-line__tag', 'RANK'));
        line.appendChild(document.createTextNode(' ' + NS.campaign.seasonLabel(r.season).split(' · ')[0] + ' ' + r.rank + '위 · 최고 ' + r.best.toLocaleString('en-US') + '점' +
          (r.boosted ? ' · x' + CFG.booster + ' 부스터' : '') + (r.improved ? ' · 기록 갱신!' : '')));
      }, function (err) {
        line.classList.add('is-off');
        line.textContent = err && err.message === 'no-profile'
          ? '레스토랑 주문서(닉네임·이메일)를 작성하면 리더보드에 올라가요'
          : '리더보드는 Verse8 서버에서 집계돼요 (지금은 연결 안 됨)';
      });
    },

    load: function (gameId, limitN, season) {
      return server().then(function (s) { return s.getLeaderboard(gameId, limitN || 20, season); });
    }
  };
})(window.CAVIAR = window.CAVIAR || {});
