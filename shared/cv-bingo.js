/* CAVIAR BINGO — missions, board and progress. No DOM (see cv-bingo-ui.js).
   Overview §4: 4x4 = 15 mission cards + n Moi pre-save. Per week 5: game score · game rank ·
   referral rank · referral count · attendance. Rewards: each mission = one B-cut card ·
   a line = +3 tickets · full board = top tier.
   Game and referral-rank cells open with their week; referral count and attendance count
   from D1. Rank cells are judged on the final weekly board, after the week ends.
   The Verse8 server judges every cell (getBingo); this page mirrors what it can (score,
   referral count, attendance, pre-save) so a local preview still fills the board.
   Needs cv-storage.js, cv-campaign.js (and cv-account.js for referral / attendance / tickets). */
(function (NS) {
  'use strict';

  /* ---------------- Data (edit freely) ---------------- */

  var GAMES = {
    // week order (cv-campaign.js weeks): W1 훔쳐라 · W2 매치 · W3 셰프
    'caviar-escape':      { name: '캐비어를 훔쳐라', caviar: 'ALMAS',    tone: 'white', path: 'games/caviar-escape/' },
    'caviar-match':       { name: '캐비어 매치',     caviar: 'CLASSIC',  tone: 'black', path: 'games/caviar-match/' },
    'caviar-master-chef': { name: '마스터 셰프',     caviar: 'IMPERIAL', tone: 'green', path: 'games/caviar-master-chef/' }
  };

  /* Mission cards in B-cut order: mission n unlocks B-cut n (pages/content.js).
     week: 0..2 · type: score | rank | refrank | ref | att.  `fromStart`: counts from D1
     (not gated by its week). Numbers: cv-campaign.js bingo. */
  var BC = NS.campaign.config.bingo;
  var MISSIONS = [];
  NS.campaign.weeks.forEach(function (w, i) {
    var g = GAMES[w.game], k = 'w' + (i + 1), end = NS.campaign.md(w.end);
    MISSIONS.push(
      { id: k + '-score', week: i, type: 'score', game: w.game, score: BC.score[w.game],
        title: w.label + ' ' + fmt(BC.score[w.game]) + '점', desc: g.name + ' 한 판 ' + fmt(BC.score[w.game]) + '점 이상 (부스터 적용 점수)' },
      { id: k + '-rank', week: i, type: 'rank', game: w.game,
        title: w.label + ' 상위 ' + BC.rankTopPct + '%', desc: g.name + ' 주간 리더보드 상위 ' + BC.rankTopPct + '% (' + end + ' 마감 순위로 판정)' },
      { id: k + '-refrank', week: i, type: 'refrank',
        title: w.label + ' 초대 TOP ' + BC.refRankTop, desc: w.label + ' 동안 내 초대 링크로 프리세이브한 친구 수 주간 상위 ' + BC.refRankTop + '명 (' + end + ' 마감 순위로 판정)' },
      { id: k + '-ref', week: i, type: 'ref', need: BC.refNeed[i], fromStart: true,
        title: '친구 초대 ' + BC.refNeed[i], desc: '초대 링크로 들어온 새 친구 ' + BC.refNeed[i] + '명이 프리세이브 (누적)' },
      { id: k + '-att', week: i, type: 'att', need: BC.attNeed[i], fromStart: true,
        title: '출석 ' + BC.attNeed[i] + '일', desc: '서로 다른 ' + BC.attNeed[i] + '일, 방문해서 게임 1판 (캠페인 21일 중)' }
    );
  });
  function fmt(n) { return Number(n).toLocaleString('en-US'); }

  var PRESAVE = { id: 'presave', type: 'presave', tone: 'pearl', title: 'n Moi 프리세이브', desc: 'Spotify에서 프리세이브하고 채우기' };

  /* Board, row by row (W1 gold, W2 green, W3 ivory). Pre-save sits on a diagonal so it
     counts for 3 lines (overview §4). Same layout as BINGO.layout in verse8/server.js. */
  var LAYOUT = [
    'w1-score', 'w1-refrank', 'w2-score', 'w2-refrank',
    'w1-rank', 'presave', 'w2-rank', 'w3-score',
    'w1-att', 'w2-att', 'w3-refrank', 'w3-rank',
    'w1-ref', 'w2-ref', 'w3-att', 'w3-ref'
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
  var lastRun = {};   // gameId -> stats of the latest finished run (result screen)
  var serverStatus = {};   // cellId -> progress from the server ({ rank, cutoff, total, final } | { best, need })

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
  function weekOpen(m) { return m.week === undefined || m.fromStart || NS.campaign.isWeekOpen(m.week); }
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
    // A finished line pays +3 tickets once (the server pays it on its own board, getBingo).
    if (NS.account) now.forEach(function (l) { NS.account.lineTicket(l.id); });
    emit({ added: ids, newLines: now.length - before });
  }

  /* Cells the server has judged (getBingo): its board wins — done cells, progress, and its
     ticket count (line tickets included). */
  function fromServer(b) {
    if (!b || !b.done) return;
    serverStatus = b.status || {};
    var done = readDone();
    complete(b.done.filter(function (id) { return !!mission(id) && done.indexOf(id) < 0; }));
    if (b.me && NS.account) NS.account.merge(b.me);   // after complete: the server's ticket count wins
    emit({ added: [], newLines: 0 });
  }
  function refresh() {
    if (!NS.whenServer) return;
    NS.whenServer(function (s) { if (s && s.getBingo) s.getBingo().then(fromServer, function () {}); });
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
      status: serverStatus[id] || null,
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

    refresh: refresh,

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
    lastRun: function (gameId) { return lastRun[gameId] || null; },
    /** The open, unfinished score mission of a game ({ mission, need }) — for the result nudge. */
    scoreMission: function (gameId) {
      var done = readDone();
      for (var i = 0; i < MISSIONS.length; i++) {
        var m = MISSIONS[i];
        if (m.game === gameId && m.score && done.indexOf(m.id) < 0 && weekOpen(m)) return { mission: m, need: m.score };
      }
      return null;
    },
    sync: sync,

    /** A run ended. Returns the missions completed by it (may be empty). */
    report: function (gameId, stats) {
      stats = stats || {};
      var booster = NS.account ? NS.account.runMultiplier(gameId) : 1;
      stats.boostedScore = Math.floor((stats.score || 0) * booster);
      lastRun[gameId] = { score: stats.score || 0, boosted: booster > 1, need: this.scoreMission(gameId) };
      if (NS.account) { NS.account.recordRun(gameId); sync(); }   // attendance day + run tickets
      var done = readDone();
      // Score cells from this run; rank cells only come from the server's final boards.
      var fresh = MISSIONS.filter(function (m) {
        return m.type === 'score' && m.game === gameId && done.indexOf(m.id) < 0 && weekOpen(m) && stats.boostedScore >= m.score;
      });
      complete(fresh.map(function (m) { return m.id; }));
      if (NS.leaderboard) {
        var sent = NS.leaderboard.submit(gameId, stats.score);
        if (sent && sent.then) sent.then(function (r) { if (r && r.counted) refresh(); }, function () {});
      }
      return fresh.map(function (m) { return { id: m.id, title: m.title, desc: m.desc }; });
    },

    /** Pre-save cell (self-reported: click-based, see cv-presave.js). */
    completePresave: function () {
      if (NS.account) {
        var sent = NS.account.presave();
        if (sent && sent.then) sent.then(refresh, function () {});
      }
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
  refresh();
})(window.CAVIAR = window.CAVIAR || {});
