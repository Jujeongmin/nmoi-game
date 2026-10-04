/* The guest's account on the Verse8 server: profile, tickets, pre-save, referrals,
   attendance, runs per day, leaderboard. Needs cv-storage.js, cv-campaign.js, cv-hub.js.

   The server (verse8/server.js) is the authority whenever it is reachable
   (CAVIAR.server, only in the Verse8 build). Without it the same numbers are kept in
   this browser so every screen still works in a local preview or demo.

   CAVIAR.account.state()                  { tickets, presaved, referrals, days, lines, inviteCode, ... }
   CAVIAR.account.profile(order)           entry: nickname + email (+ ?ref invite code)
   CAVIAR.account.presave()                pre-save click → +2 tickets, booster, +1 run/day
   CAVIAR.account.cellTickets(n)           new bingo cells → +1 ticket each (local mirror)
   CAVIAR.account.lineTicket(id)           bingo line → +3 tickets (local mirror; the server pays in getBingo)
   CAVIAR.account.recordRun(gameId)        finished run → attendance day + run tickets (returns grants)
   CAVIAR.account.share(gameId)            result-screen share → +1 ticket (once per game per day)
   CAVIAR.account.sendInvite()             invite link copied / shared → +1 ticket (once a day)
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
    var log = s.ticketLog || {};
    s.ticketLog = { first: log.first || {}, daily: log.daily || {}, share: log.share || {} };
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
    if (typeof me.lifeTokens === 'number') state.lifeTokens = me.lifeTokens;
    if (typeof me.multiplier === 'number') state.serverMultiplier = me.multiplier;
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

  var UNLIMITED = 9999;   // demo: no daily run limit (campaign.config.demo.unlimitedPlays)
  function limit() {
    if (CFG.demo && CFG.demo.unlimitedPlays) return UNLIMITED;
    return CFG.dailyPlays + (state.presaved ? CFG.presaveBonusPlays : 0) + Math.min(CFG.referralRunCap, state.referrals || 0);
  }

  // Multiplier of the next counted run (overview §5): x1.5 for a V8 login's first run of the
  // week, else x1.2 after pre-save. The server decides; this mirrors it.
  function multiplier() {
    var season = NS.campaign.season();
    var weekly = NS.account && NS.account.loggedIn() && state.v8Week !== season && season !== 'pre' && season !== 'post';
    return weekly ? CFG.v8Booster : state.presaved ? CFG.booster : 1;
  }

  // Days in a row ending today among the attendance days.
  function streak(days) {
    var n = 0, t = Date.parse(NS.campaign.today() + 'T00:00:00Z');
    while (days.indexOf(new Date(t).toISOString().slice(0, 10)) >= 0) { n++; t -= 864e5; }
    return n;
  }

  /* Attendance = a visit with a finished run (a visit alone does not count; the server
     marks the day when it records the run). On load only the server's numbers are read. */
  quiet(server().then(function (s) { return s.getMe(); }).then(merge));

  // Invite code from ?ref= (kept until the entry form sends it)
  (function readRef() {
    var m = /[?&]ref=([A-Za-z0-9]{4,8})/.exec(window.location.search);
    if (m) store.set('ref', m[1].toUpperCase());
  })();

  var last = {};   // gameId -> promise of the latest submit
  var grants = {}; // gameId -> tickets the latest finished run earned [{ reason, n }]
  var runBonus = {}; // gameId -> { multiplier, extraLife } of the run just opened

  // V8 login (placeholder, see loggedIn) → the server's x1.5 weekly run; reported once.
  function reportLogin() {
    if (store.get('loginSent', '')) return;
    NS.track('v8_login', {});
    quiet(server().then(function (s) { return s.markLogin(); }).then(function (me) { store.set('loginSent', '1'); merge(me); }));
  }
  var runs = {};   // gameId -> the server run opened at start ({ ok, runId }), until its score is sent
  var RUN_WAIT_MS = 8000;

  /* The Verse8 build loads the server bridge (shared/cv-server.js) on every game page; a local
     preview has none and plays on the local mirror. */
  function serverExpected() {
    return !!NS.server || !!document.querySelector('script[src*="cv-server"]');
  }

  /* Server not reachable when a run should start: ask to retry or reload. */
  function offlineNotice(retry) {
    var host = document.getElementById('app') || document.body;
    var old = host.querySelector('.cv-offline');
    if (old) old.remove();
    var box = el('div', 'cv-overlay cv-offline is-open');
    box.setAttribute('role', 'alertdialog');
    box.setAttribute('aria-labelledby', 'cv-offline-title');
    var panel = el('div', 'cv-panel');
    panel.appendChild(el('p', 'cv-eyebrow', 'SERVER'));
    var h = el('h2', 'cv-offline__title', '서버에 연결되지 않았어요');
    h.id = 'cv-offline-title';
    panel.appendChild(h);
    panel.appendChild(el('p', 'cv-body cv-offline__text', '점수와 순위는 서버에서 기록돼요. 연결을 다시 시도하거나 페이지를 새로고침해 주세요.'));
    var actions = el('div', 'cv-actions');
    var again = el('button', 'cv-btn cv-btn--primary', '다시 시도');
    var reload = el('button', 'cv-btn', '새로고침');
    again.type = reload.type = 'button';
    again.addEventListener('click', function () {
      again.disabled = true;
      again.textContent = '연결 중…';
      var up = NS.server ? NS.server.connect() : Promise.resolve(false);
      up.then(function (ok) {
        if (!ok) { again.disabled = false; again.textContent = '다시 시도'; return; }
        box.remove();
        if (retry) retry();
      });
    });
    reload.addEventListener('click', function () { window.location.reload(); });
    actions.appendChild(again);
    actions.appendChild(reload);
    panel.appendChild(actions);
    box.appendChild(panel);
    host.appendChild(box);
    again.focus();
  }

  NS.account = {
    state: function () { return state; },
    onChange: function (fn) { listeners.push(fn); },
    limit: limit,
    days: function () { return Math.max(state.days.length, state.serverDays || 0); },

    /** Entry form: nickname + email (consent is on the form). */
    profile: function (order) {
      if (!order || !order.nickname || !order.email) return Promise.resolve();   // restored from the server: already there
      var email = String(order.email).trim().toLowerCase();
      var choices = { mood: order.mood, caviar: order.caviar, eat: order.eat, drink: order.drink, member: order.member };
      return sha256(email).then(function (hash) {
        var key = order.nickname + '|' + hash + '|' + JSON.stringify(choices);
        if (store.get('profileSent', '') === key) return;
        return server().then(function (s) {
          return s.setProfile({ nickname: order.nickname, email: email, emailHash: hash, ref: store.get('ref', ''), order: choices });
        }).then(function (me) { store.set('profileSent', key); merge(me); });
      }).catch(function () { /* retried on the next submit */ });
    },

    presaved: function () { return !!state.presaved; },

    /** The same Verse8 account's order sheet from the server (another device), or null.
        The e-mail stays on the server: the order is marked emailOnServer. */
    serverOrder: function () {
      var t = new Promise(function (resolve) { setTimeout(function () { resolve(null); }, WAIT_MS); });
      var q = server().then(function (s) { return s.getMe(); }).then(function (me) {
        if (!me || !me.hasEmail || !me.order || !me.nickname) return null;
        merge(me);
        var o = me.order;
        return { nickname: me.nickname, email: '', emailOnServer: true, consent: true,
                 mood: o.mood, caviar: o.caviar, eat: o.eat, drink: o.drink, member: o.member };
      }, function () { return null; });
      return Promise.race([q, t]);
    },

    /** Pre-save click (smart link opened by cv-presave.js). */
    presave: function () {
      if (!state.presaved) {
        state.presaved = true;
        state.tickets += CFG.tickets.presave;
        save();
      }
      return quiet(server().then(function (s) { return s.markPresave(); }).then(merge));
    },

    /** New bingo mission cells → +1 ticket each (local mirror; the server pays in getBingo). */
    cellTickets: function (n) {
      if (!(n > 0)) return;
      state.tickets += n;
      save();
    },

    lineTicket: function (lineId) {
      if (state.lines.indexOf(lineId) >= 0) return;
      state.lines.push(lineId);
      state.tickets += CFG.tickets.line;
      save();
    },

    /** Server summary (getMe / getBingo / submitScore) into the local mirror. */
    merge: merge,

    /** A run finished: today counts as attendance; first run of the game +1 ticket (once),
        a run +1 (once per game per day). Mirrors the server, which decides when online. */
    recordRun: function (gameId) {
      var today = NS.campaign.today(), log = state.ticketLog, got = [];
      if (multiplier() === CFG.v8Booster) state.v8Week = NS.campaign.season();   // the week's x1.5 is used
      if (state.days.indexOf(today) < 0) {
        state.days.push(today);
        if (streak(state.days) % CFG.streakLifeEvery === 0) { state.lifeTokens = (state.lifeTokens || 0) + 1; got.push({ reason: 'streak', n: 0 }); }
      }
      if (!log.first[gameId]) { log.first[gameId] = true; got.push({ reason: 'first', n: CFG.tickets.firstRun }); }
      if (log.daily[gameId] !== today) { log.daily[gameId] = today; got.push({ reason: 'daily', n: CFG.tickets.dailyRun }); }
      got.forEach(function (g) { state.tickets += g.n; });
      save();
      grants[gameId] = got;
      NS.track('play', { game: gameId });
      return got;
    },
    runGrants: function (gameId) { return grants[gameId] || []; },

    shared: function (gameId) { return state.ticketLog.share[gameId] === NS.campaign.today(); },

    /** Result-screen share: +1 ticket once per game per day (the page cannot verify a share). */
    share: function (gameId) {
      if (NS.account.shared(gameId)) return 0;
      NS.track('share', { game: gameId });
      state.ticketLog.share[gameId] = NS.campaign.today();
      state.tickets += CFG.tickets.share;
      save();
      quiet(server().then(function (s) { return s.claimShare(gameId); }).then(merge));
      return CFG.tickets.share;
    },

    /** Sending the invite link (copy / share button): +1 ticket once a day. */
    invited: function () { return NS.account.shared('invite'); },
    sendInvite: function () { return NS.account.share('invite'); },

    playsLeft: function (gameId) { return Math.max(0, limit() - (state.plays.counts[gameId] || 0)); },

    /** A run starts. Opens it on the server first (the only run a score is accepted for),
        then counts it locally. Resolves { ok } or { ok: false, reason: 'limit' | 'offline' };
        a local preview (no server bridge) always gets { ok: true, local: true }. */
    startRun: function (gameId) {
      function count() {
        state.plays.counts[gameId] = (state.plays.counts[gameId] || 0) + 1;
        save();
      }
      if (!serverExpected()) {
        count();
        var local = { ok: true, local: true, multiplier: multiplier(), extraLife: 0 };
        if (CFG.lifeGames.indexOf(gameId) >= 0 && state.lifeTokens > 0) { state.lifeTokens -= 1; local.extraLife = 1; save(); }
        runBonus[gameId] = local;
        return Promise.resolve(local);
      }
      runs[gameId] = null;
      var timeout = new Promise(function (resolve) { setTimeout(function () { resolve({ ok: false, reason: 'offline' }); }, RUN_WAIT_MS); });
      var call = server().then(function (s) { return s.startRun(gameId); }).then(function (r) {
        return r && typeof r.ok === 'boolean' ? r : { ok: false, reason: 'offline' };
      }, function () { return { ok: false, reason: 'offline' }; });
      return Promise.race([call, timeout]).then(function (r) {
        if (r.ok) { runs[gameId] = r; runBonus[gameId] = r; count(); }
        else if (r.reason === 'limit') { state.plays.counts[gameId] = limit(); save(); }
        return r;
      });
    },

    offlineNotice: offlineNotice,

    /** The run just opened: { multiplier, extraLife } (a game with lives adds extraLife). */
    runBonus: function (gameId) { return runBonus[gameId] || { multiplier: multiplier(), extraLife: 0 }; },
    /** Multiplier of the next counted run (HUD, result nudge, score missions). */
    multiplier: function () { return typeof state.serverMultiplier === 'number' && state.online ? state.serverMultiplier : multiplier(); },
    runMultiplier: function (gameId) {
      if (NS.campaign.timed(gameId)) return 1;   // survival games: the booster is a shield, the time stays real
      return (runBonus[gameId] && runBonus[gameId].multiplier) || multiplier();
    },
    /** Shields for this run of a survival game: 1 after pre-save, 2 with the V8 weekly booster. */
    runShields: function (gameId) {
      var m = (runBonus[gameId] && runBonus[gameId].multiplier) || multiplier();
      return m >= CFG.v8Booster ? 2 : m > 1 ? 1 : 0;
    },
    lifeTokens: function () { return state.lifeTokens || 0; },
    streak: function () { return streak(state.days); },

    inviteLink: function () {
      return state.inviteCode ? NS.url('index.html') + '?ref=' + state.inviteCode : '';
    },

    /* TIER 1 — V8 login. Placeholder: a Verse8 account in the URL (?account=) counts as
       logged in; the login button itself will point at Verse8's login once we have it. */
    loggedIn: function () {
      return /[?&]account=/.test(window.location.search) || store.get('demoLogin', '') === '1';
    },
    setDemoLogin: function (on) { store.set('demoLogin', on ? '1' : ''); if (on) reportLogin(); emit(); },

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
        if (limit() >= UNLIMITED) {
          line.textContent = '데모 · 판수 제한 없음' + (state.presaved ? ' · 부스터 ' + NS.campaign.boostLabel(gameId) + ' 적용' : '');
          ['btn-start', 'btn-retry'].forEach(function (id) {
            var btn = document.getElementById(id);
            if (btn && btn.dataset.out === '1') { btn.dataset.out = ''; if (btn.dataset.label) btn.textContent = btn.dataset.label; }
          });
          return;
        }
        var b = document.createElement('b');
        b.textContent = left + ' / ' + limit();
        line.appendChild(document.createTextNode('오늘 남은 판 '));
        line.appendChild(b);
        if (state.presaved) line.appendChild(document.createTextNode(' · 부스터 ' + NS.campaign.boostLabel(gameId) + ' 적용'));
        if (left <= 0) {
          line.classList.add('is-out');
          line.appendChild(document.createElement('br'));
          // A way on: pre-save (+1 run), or invite (+1 run a day per friend), or come back tomorrow.
          var more = null;
          if (!state.presaved && NS.presave && !NS.campaign.isReleased()) more = ['프리세이브하고 1판 더 ›', function () { NS.presave.interstitial(); }];
          else if ((state.referrals || 0) < CFG.referralRunCap) more = ['친구 초대하고 1판 더 ›', function () { NS.hub.invite(); }];
          line.appendChild(document.createTextNode(more ? '오늘 판을 모두 썼어요.' : '오늘은 모두 플레이했어요. 내일 다시 만나요!'));
          if (more) {
            var go = document.createElement('button');
            go.type = 'button';
            go.className = 'cv-plays__more';
            go.textContent = more[0];
            go.addEventListener('click', more[1]);
            line.appendChild(document.createTextNode(' '));
            line.appendChild(go);
          }
        }
        // Out of runs: start / retry take the guest back to the restaurant instead of doing nothing.
        ['btn-start', 'btn-retry'].forEach(function (id) {
          var btn = document.getElementById(id);
          if (!btn) return;
          if (!btn.dataset.label) btn.dataset.label = btn.textContent;
          var out = left <= 0;
          btn.dataset.out = out ? '1' : '';
          if (btn.getAttribute('aria-busy') !== 'true') btn.textContent = out ? '레스토랑으로 돌아가기' : btn.dataset.label;
        });
      }
      render();
      NS.account.onChange(render);

      // Gate the start / retry buttons (capture phase, before the game's own handler): the
      // booster choice first (once, cv-presave.js), then the game starts only after the
      // server opened the run, by clicking the button again.
      ['btn-start', 'btn-retry'].forEach(function (id) {
        var btn = document.getElementById(id);
        if (!btn) return;
        var pass = false;
        function outOfRuns() {
          if (NS.campaign.isGameOpen(gameId) && !state.presaved && NS.presave) NS.presave.interstitial();
          render();
        }
        btn.addEventListener('click', function (e) {
          if (pass) { pass = false; return; }
          e.stopImmediatePropagation();
          e.preventDefault();
          if (btn.getAttribute('aria-busy') === 'true') return;
          if (btn.dataset.out === '1') { NS.hub.exit(); return; }
          if (!NS.campaign.isGameOpen(gameId) || NS.account.playsLeft(gameId) <= 0) { outOfRuns(); return; }

          var label = btn.textContent;
          btn.setAttribute('aria-busy', 'true');
          var choice = NS.presave ? NS.presave.boosterChoice() : Promise.resolve();
          choice.then(function () {
            btn.textContent = '준비 중…';
            return NS.account.startRun(gameId);
          }).then(function (r) {
            btn.removeAttribute('aria-busy');
            btn.textContent = label;
            if (r.ok) { pass = true; btn.click(); return; }
            if (r.reason === 'limit') { outOfRuns(); return; }
            offlineNotice(function () { btn.click(); });
          });
        }, true);
      });
    }
  };

  if (NS.account.loggedIn()) reportLogin();

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
      if (!order || (!order.email && !order.emailOnServer)) {
        last[gameId] = Promise.reject(new Error('no-profile'));
      } else {
        var run = runs[gameId];
        runs[gameId] = null;   // one score per run
        last[gameId] = !run ? (serverExpected() ? Promise.resolve({ counted: false, reason: 'no-run' }) : Promise.reject(new Error('offline'))) : NS.account.profile(order).then(server).then(function (s) {
          return s.submitScore(gameId, Math.floor(score), run.runId);
        }).then(function (r) { if (r && r.me) merge(r.me); return r; });
      }
      last[gameId].catch(function () {});
      return last[gameId];
    },

    renderResult: function (box, gameId) {
      if (!box) return;
      var line = box.querySelector('.cv-rank-line');
      if (!line) { line = el('div', 'cv-rank-line'); box.insertBefore(line, box.firstChild); }
      line.classList.remove('is-off', 'is-ranked');
      line.textContent = '리더보드 집계 중…';
      var task = last[gameId];
      if (!task) { line.textContent = ''; return; }
      task.then(function (r) {
        line.textContent = '';
        if (!r.counted) {
          line.classList.add('is-off');
          line.textContent = r.reason === 'limit'
            ? '오늘 판을 모두 써서 이번 판은 리더보드에 기록되지 않았어요'
            : '이번 판은 리더보드에 기록되지 않았어요';
          return;
        }
        // Rank first and large; the week's TOP 10 is one tap away.
        line.classList.add('is-ranked');
        var mult = r.multiplier || (r.boosted ? CFG.booster : 1);
        var main = el('div', 'cv-rank-line__main');
        main.appendChild(el('span', 'cv-rank-line__tag', NS.campaign.seasonLabel(r.season).split(' · ')[0]));
        main.appendChild(el('b', 'cv-rank-line__no', r.rank + '위'));
        main.appendChild(el('span', 'cv-rank-line__best', '최고 ' + NS.campaign.fmtScore(gameId, r.best)));
        line.appendChild(main);
        var open = el('button', 'cv-rank-line__open', '순위표 보기 ›');
        open.type = 'button';
        open.addEventListener('click', function () { NS.leaderboard.open(gameId); });
        line.appendChild(open);
        if (NS.campaign.timed(gameId)) mult = 1;   // a shield, not a multiplier: the time is real
        var meta = (mult > 1 ? 'x' + mult + (mult === CFG.v8Booster ? ' V8 주간 부스터' : ' 부스터') : '') + (r.improved ? (mult > 1 ? ' · ' : '') + '기록 갱신!' : '');
        if (meta) line.appendChild(el('p', 'cv-rank-line__meta', meta));
      }, function (err) {
        line.classList.add('is-off');
        line.textContent = err && err.message === 'no-profile'
          ? '레스토랑 주문서(닉네임·이메일)를 작성하면 리더보드에 올라가요'
          : '리더보드는 Verse8 서버에서 집계돼요 (지금은 연결 안 됨)';
      });
    },

    load: function (gameId, limitN, season) {
      return server().then(function (s) { return s.getLeaderboard(gameId, limitN || 20, season); });
    },

    /** This week's TOP N of one game, over the game (result card "순위표 보기 ›"). */
    open: function (gameId) {
      var box = document.querySelector('.cv-lb');
      if (!box) {
        box = el('div', 'cv-overlay cv-lb');
        box.setAttribute('role', 'dialog');
        box.addEventListener('click', function (e) { if (e.target === box || e.target.closest('.cv-lb__close')) box.classList.remove('is-open'); });
        (document.getElementById('app') || document.body).appendChild(box);
      }
      var top = CFG.leaderboardTop || 10;
      var panel = el('div', 'cv-panel cv-lb__panel');
      panel.appendChild(el('p', 'cv-eyebrow', 'RANKING'));
      panel.appendChild(el('h2', 'cv-lb__title', '이번 주 TOP ' + top));
      var season = el('p', 'cv-lb__season', '');
      panel.appendChild(season);
      var list = el('ol', 'cv-lb__list');
      list.appendChild(el('li', 'cv-lb__note', '불러오는 중…'));
      panel.appendChild(list);
      var closeBtn = el('button', 'cv-btn cv-lb__close', '닫기');
      closeBtn.type = 'button';
      panel.appendChild(closeBtn);
      box.innerHTML = '';
      box.appendChild(panel);
      box.classList.add('is-open');
      NS.leaderboard.load(gameId, top).then(function (res) {
        season.textContent = NS.campaign.seasonLabel(res.season);
        list.innerHTML = '';
        if (!res.top.length) { list.appendChild(el('li', 'cv-lb__note', '아직 기록이 없어요. 첫 번째 주인공이 되어보세요!')); return; }
        res.top.forEach(function (r) {
          var li = el('li', r.me ? 'is-me' : '');
          li.appendChild(el('b', '', String(r.rank)));
          li.appendChild(el('span', '', r.nickname));
          li.appendChild(el('em', '', NS.campaign.fmtScore(gameId, r.score)));
          list.appendChild(li);
        });
        if (res.mine && !res.top.some(function (r) { return r.me; })) {
          var li = el('li', 'is-me cv-lb__mine');
          li.appendChild(el('b', '', String(res.mine.rank)));
          li.appendChild(el('span', '', res.mine.nickname || '나'));
          li.appendChild(el('em', '', NS.campaign.fmtScore(gameId, res.mine.score)));
          list.appendChild(li);
        }
      }, function () {
        list.innerHTML = '';
        list.appendChild(el('li', 'cv-lb__note', '리더보드는 Verse8 서버에서 집계돼요 (지금은 연결 안 됨)'));
      });
    }
  };
})(window.CAVIAR = window.CAVIAR || {});
