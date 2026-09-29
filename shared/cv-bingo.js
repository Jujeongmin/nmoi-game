/* CAVIAR BINGO — missions, board and progress. No DOM (see cv-bingo-ui.js).
   4x4 = 15 mission cards (5 per week: game 2 · referral 2 · attendance 1) + NMOI pre-save.
   Rewards: each mission = one B-cut card · a line = +3 tickets · full board = top tier.
   Missions of a week can only be completed once that week is open (cv-campaign.js).
   Needs cv-storage.js, cv-campaign.js (and cv-account.js for referral / attendance / tickets). */
(function (NS) {
  'use strict';

  /* ---------------- Data (edit freely) ---------------- */

  var GAMES = {
    // week order: W1 매치 · W2 훔쳐라 · W3 셰프
    'caviar-match':       { name: '캐비어 매치',     caviar: 'IMPERIAL', tone: 'green', path: 'games/caviar-match/' },
    'caviar-escape':      { name: '캐비어를 훔쳐라', caviar: 'ALMAS',    tone: 'white', path: 'games/caviar-escape/' },
    'caviar-master-chef': { name: '마스터 셰프',     caviar: 'CLASSIC',  tone: 'black', path: 'games/caviar-master-chef/' }
  };

  /* Mission cards in B-cut order: mission n unlocks B-cut n (pages/content.js).
     week: 0..2 · type: game | ref | att.  game: test(stats) on a finished run.
     ref / att: need = referrals / attendance days required. */
  var MISSIONS = [
    // W1 · Caviar Match
    { id: 'w1-g1', week: 0, type: 'game', game: 'caviar-match', title: '첫 컬렉션', desc: '캐비어 매치 한 판에 캐비어 20개 수집', test: function (s) { return s.total >= 20; } },
    { id: 'w1-g2', week: 0, type: 'game', game: 'caviar-match', title: '5,000점', desc: '캐비어 매치 한 판 5,000점 이상', test: function (s) { return s.score >= 5000; } },
    { id: 'w1-r1', week: 0, type: 'ref', need: 1, title: '친구 초대 1', desc: '초대 링크로 들어온 새 친구 1명이 프리세이브' },
    { id: 'w1-r2', week: 0, type: 'ref', need: 2, title: '친구 초대 2', desc: '초대 링크로 들어온 새 친구 2명이 프리세이브' },
    { id: 'w1-a1', week: 0, type: 'att', need: 1, title: '출석 1일', desc: '레스토랑에 하루 방문' },
    // W2 · Caviar Escape
    { id: 'w2-g1', week: 1, type: 'game', game: 'caviar-escape', title: '첫 탈출', desc: '캐비어를 훔쳐라 30초 버티고 탈출', test: function (s) { return s.result === 'clear'; } },
    { id: 'w2-g2', week: 1, type: 'game', game: 'caviar-escape', title: '아슬아슬 5', desc: '캐비어를 훔쳐라 한 판에 아슬아슬 5번', test: function (s) { return s.closeCalls >= 5; } },
    { id: 'w2-r1', week: 1, type: 'ref', need: 3, title: '친구 초대 3', desc: '초대 링크로 들어온 새 친구 3명이 프리세이브' },
    { id: 'w2-r2', week: 1, type: 'ref', need: 4, title: '친구 초대 4', desc: '초대 링크로 들어온 새 친구 4명이 프리세이브' },
    { id: 'w2-a1', week: 1, type: 'att', need: 2, title: '출석 2일', desc: '서로 다른 날 2번 방문' },
    // W3 · Caviar Master Chef
    { id: 'w3-g1', week: 2, type: 'game', game: 'caviar-master-chef', title: '첫 주문', desc: '마스터 셰프 주문 1개 완성', test: function (s) { return s.ordersCompleted >= 1; } },
    { id: 'w3-g2', week: 2, type: 'game', game: 'caviar-master-chef', title: '퍼펙트 3', desc: '마스터 셰프 실수 없는 주문 3개', test: function (s) { return s.perfectOrders >= 3; } },
    { id: 'w3-r1', week: 2, type: 'ref', need: 5, title: '친구 초대 5', desc: '초대 링크로 들어온 새 친구 5명이 프리세이브' },
    { id: 'w3-r2', week: 2, type: 'ref', need: 6, title: '친구 초대 6', desc: '초대 링크로 들어온 새 친구 6명이 프리세이브' },
    { id: 'w3-a1', week: 2, type: 'att', need: 3, title: '출석 3일', desc: '서로 다른 날 3번 방문' }
  ];

  var PRESAVE = { id: 'presave', type: 'presave', tone: 'pearl', title: 'NMOI 프리세이브', desc: 'Spotify에서 프리세이브하고 채우기' };

  /* Board, row by row — the overview's layout (W1 gold, W2 green, W3 ivory, PRE inside). */
  var LAYOUT = [
    'w1-g1', 'w1-r1', 'w2-g1', 'w2-r1',
    'w1-g2', 'presave', 'w2-g2', 'w3-g1',
    'w1-a1', 'w2-a1', 'w3-r1', 'w3-g2',
    'w1-r2', 'w2-r2', 'w3-a1', 'w3-r2'
  ];
  var SIZE = 4;

  var WEEK_TONE = ['gold', 'green', 'white'];
  var ART = {
    empty: 'assets/bingo/tin-empty.webp',
    filled: {
      white: 'assets/bingo/tin-almas.webp',
      green: 'assets/bingo/tin-imperial.webp',
      black: 'assets/bingo/tin-classic.webp',
      gold:  'assets/bingo/tin-platinum.webp',
      pearl: 'assets/bingo/tin-whitepearl.webp'
    }
  };

  var REWARDS = [
    { key: 'card', label: '달성', reward: '칸마다 B컷 카드 1장' },
    { key: 'line', label: '줄 완성', reward: '응모권 +3' },
    { key: 'full', label: '판 완성', reward: '상위 등급 · 쇼케이스 초청 추첨' }
  ];
  var REWARD_NOTE = '보상은 계정당 1회 · 수령 시에만 실명 확인';

  /* ---------------- Logic ---------------- */

  var store = NS.storage.scope('bingo');
  var listeners = [];

  function readDone() {
    try {
      var list = JSON.parse(store.get('done', '[]'));
      return Array.isArray(list) ? list.filter(function (id) { return !!mission(id); }) : [];
    } catch (e) { return []; }
  }
  function writeDone(list) { store.set('done', JSON.stringify(list)); }

  function mission(id) {
    if (id === PRESAVE.id) return PRESAVE;
    for (var i = 0; i < MISSIONS.length; i++) if (MISSIONS[i].id === id) return MISSIONS[i];
    return null;
  }
  function weekOpen(m) { return m.week === undefined || NS.campaign.isWeekOpen(m.week); }
  function isDone(id) { return readDone().indexOf(id) >= 0; }

  function lineList() {
    var out = [], r, c, i;
    for (r = 0; r < SIZE; r++) { var row = []; for (c = 0; c < SIZE; c++) row.push(r * SIZE + c); out.push({ id: 'r' + r, cells: row }); }
    for (c = 0; c < SIZE; c++) { var col = []; for (r = 0; r < SIZE; r++) col.push(r * SIZE + c); out.push({ id: 'c' + c, cells: col }); }
    var d1 = [], d2 = [];
    for (i = 0; i < SIZE; i++) { d1.push(i * SIZE + i); d2.push(i * SIZE + (SIZE - 1 - i)); }
    out.push({ id: 'd0', cells: d1 }, { id: 'd1', cells: d2 });
    return out;
  }
  var LINES = lineList();

  function finishedLines() {
    var done = readDone();
    return LINES.filter(function (l) { return l.cells.every(function (k) { return done.indexOf(LAYOUT[k]) >= 0; }); });
  }

  function emit(change) { for (var i = 0; i < listeners.length; i++) listeners[i](change); }

  function complete(ids) {
    if (!ids.length) return;
    var before = finishedLines().length;
    writeDone(readDone().concat(ids));
    var now = finishedLines();
    // A finished line pays +3 tickets once (server keeps the record).
    if (NS.account) now.forEach(function (l) { NS.account.claimLine(l.id); });
    emit({ added: ids, newLines: now.length - before });
  }

  /** Referral / attendance / pre-save cells from the account state. */
  function sync() {
    if (!NS.account) return [];
    var st = NS.account.state(), days = NS.account.days(), done = readDone();
    var fresh = MISSIONS.filter(function (m) {
      if (done.indexOf(m.id) >= 0 || !weekOpen(m)) return false;
      if (m.type === 'ref') return st.referrals >= m.need;
      if (m.type === 'att') return days >= m.need;
      return false;
    }).map(function (m) { return m.id; });
    if (st.presaved && done.indexOf(PRESAVE.id) < 0) fresh.push(PRESAVE.id);
    complete(fresh);
    return fresh;
  }

  function cellOf(id, index, done) {
    var m = mission(id);
    var game = m.game ? GAMES[m.game] : null;
    return {
      index: index, id: id, quest: m, type: m.type, week: m.week,
      game: game, gameId: m.game || null,
      tone: m.type === 'presave' ? PRESAVE.tone : WEEK_TONE[m.week],
      locked: !weekOpen(m),
      done: done.indexOf(id) >= 0
    };
  }

  NS.bingo = {
    size: SIZE,
    games: GAMES,
    presave: PRESAVE,
    art: ART,
    rewards: REWARDS,
    rewardNote: REWARD_NOTE,
    missions: MISSIONS,

    presaveIndex: function () { return LAYOUT.indexOf(PRESAVE.id); },

    unseen: function () {
      var seen;
      try { seen = JSON.parse(store.get('seen', '[]')); } catch (e) { seen = []; }
      return readDone().filter(function (id) { return seen.indexOf(id) < 0; });
    },
    markSeen: function () { store.set('seen', JSON.stringify(readDone())); },

    cells: function () {
      var done = readDone();
      return LAYOUT.map(function (id, index) { return cellOf(id, index, done); });
    },

    /** The week's 5 missions (default: the running week, or W1 before the start). */
    weekProgress: function (weekIdx) {
      var i = typeof weekIdx === 'number' ? weekIdx : Math.min(Math.max(NS.campaign.weekIndex(), 0), 2);
      var list = MISSIONS.filter(function (m) { return m.week === i; });
      var done = readDone();
      return { week: i, done: list.filter(function (m) { return done.indexOf(m.id) >= 0; }).length, total: list.length };
    },

    /** Game missions of one game (for its title and result cards). */
    questsFor: function (gameId) {
      var done = readDone();
      return MISSIONS.filter(function (m) { return m.game === gameId; }).map(function (m) {
        return { id: m.id, title: m.title, desc: m.desc, done: done.indexOf(m.id) >= 0 };
      });
    },
    progress: function (gameId) {
      var list = this.questsFor(gameId);
      return { done: list.filter(function (q) { return q.done; }).length, total: list.length };
    },

    /** B-cut n (0-based) is unlocked by mission n. */
    bcut: function (n) {
      var m = MISSIONS[n];
      return m ? { mission: m, unlocked: isDone(m.id) } : { mission: null, unlocked: true };
    },

    doneCount: function () { return readDone().length; },
    missionCount: function () { return readDone().filter(function (id) { return id !== PRESAVE.id; }).length; },
    lines: function () { return finishedLines().map(function (l) { return l.cells; }); },
    fullBoard: function () { return readDone().length >= LAYOUT.length; },
    isDone: isDone,
    sync: sync,

    /** A run ended. Returns the missions completed by it (may be empty). */
    report: function (gameId, stats) {
      var done = readDone();
      var fresh = MISSIONS.filter(function (m) {
        if (m.game !== gameId || done.indexOf(m.id) >= 0 || !weekOpen(m)) return false;
        try { return !!m.test(stats || {}); } catch (e) { return false; }
      });
      complete(fresh.map(function (m) { return m.id; }));
      if (NS.leaderboard && stats) NS.leaderboard.submit(gameId, stats.score);
      return fresh.map(function (m) { return { id: m.id, title: m.title, desc: m.desc }; });
    },

    /** Pre-save cell (self-reported: click-based, see cv-presave.js). */
    completePresave: function () {
      if (NS.account) NS.account.presave();
      if (!isDone(PRESAVE.id)) complete([PRESAVE.id]);
    },

    onChange: function (fn) { listeners.push(fn); },

    /** Demo / testing only. */
    reset: function () {
      writeDone([]);
      store.set('seen', '[]');
      emit({ added: [], newLines: 0, reset: true });
    }
  };

  if (NS.account) {
    NS.account.onChange(function () { sync(); });
    sync();
  }
})(window.CAVIAR = window.CAVIAR || {});
