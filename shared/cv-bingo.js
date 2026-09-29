/* CAVIAR BINGO — quests, board and progress. No DOM (see cv-bingo-ui.js).
   4x4 board: 5 quests per game x 3 games + 1 NMOI pre-save cell.
   Games call CAVIAR.bingo.report(gameId, stats) when a run ends.
   Needs shared/cv-storage.js. */
(function (NS) {
  'use strict';

  /* ---------------- Data (edit freely) ---------------- */

  var GAMES = {
    'caviar-escape':      { name: '캐비어를 훔쳐라', caviar: 'ALMAS',    tone: 'white', path: 'games/caviar-escape/' },
    'caviar-match':       { name: '캐비어 매치',     caviar: 'IMPERIAL', tone: 'green', path: 'games/caviar-match/' },
    'caviar-master-chef': { name: '마스터 셰프',     caviar: 'CLASSIC',  tone: 'black', path: 'games/caviar-master-chef/' }
  };

  /* test(stats, meta): stats = what the game reported for this run,
     meta.plays = runs finished in this game so far (including this one). */
  var QUESTS = [
    // Caviar Escape — stats: { result: 'clear'|'over', score, lives, closeCalls }
    { id: 'e1', game: 'caviar-escape', title: '첫 탈출',       desc: '30초 버티고 탈출 성공',          test: function (s) { return s.result === 'clear'; } },
    { id: 'e2', game: 'caviar-escape', title: '노 데미지',     desc: '라이프 3개 그대로 탈출',         test: function (s) { return s.result === 'clear' && s.lives >= 3; } },
    { id: 'e3', game: 'caviar-escape', title: '아슬아슬',      desc: '한 판에 아슬아슬 5번',           test: function (s) { return s.closeCalls >= 5; } },
    { id: 'e4', game: 'caviar-escape', title: '4,000점',       desc: '한 판 4,000점 이상',             test: function (s) { return s.score >= 4000; } },
    { id: 'e5', game: 'caviar-escape', title: '단골 손님',     desc: '3판 플레이',                     test: function (s, m) { return m.plays >= 3; } },

    // Caviar Match — stats: { score, maxCombo, stage, total, collected: [n per kind] }
    { id: 'm1', game: 'caviar-match', title: '첫 컬렉션',      desc: '한 판에 캐비어 20개 수집',       test: function (s) { return s.total >= 20; } },
    { id: 'm2', game: 'caviar-match', title: '콤보 3',         desc: '연속 매치 3콤보',                test: function (s) { return s.maxCombo >= 3; } },
    { id: 'm3', game: 'caviar-match', title: '테이블 클리어',  desc: '보드를 비우고 스테이지 2 도달',  test: function (s) { return s.stage >= 2; } },
    { id: 'm4', game: 'caviar-match', title: '5,000점',        desc: '한 판 5,000점 이상',             test: function (s) { return s.score >= 5000; } },
    { id: 'm5', game: 'caviar-match', title: '4종 컬렉터',     desc: '한 판에 네 종류 각각 5개 이상',  test: function (s) { return !!s.collected && s.collected.length >= 4 && s.collected.every(function (n) { return n >= 5; }); } },

    // Caviar Master Chef — stats: { score, ordersCompleted, perfectOrders, maxCombo }
    { id: 'c1', game: 'caviar-master-chef', title: '첫 주문',   desc: '주문 1개 완성',                  test: function (s) { return s.ordersCompleted >= 1; } },
    { id: 'c2', game: 'caviar-master-chef', title: '퍼펙트 3',  desc: '실수 없는 주문 3개',             test: function (s) { return s.perfectOrders >= 3; } },
    { id: 'c3', game: 'caviar-master-chef', title: '콤보 3',    desc: '퍼펙트 주문 3연속',              test: function (s) { return s.maxCombo >= 3; } },
    { id: 'c4', game: 'caviar-master-chef', title: '바쁜 주방', desc: '한 판에 주문 5개 완성',          test: function (s) { return s.ordersCompleted >= 5; } },
    { id: 'c5', game: 'caviar-master-chef', title: '5,000점',   desc: '한 판 5,000점 이상',             test: function (s) { return s.score >= 5000; } }
  ];

  /* Tins seen from above (paths from the repo root). A cell shows the empty tin
     until its quest is done, then the tin filled with its game's caviar (tone). */
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

  var PRESAVE = {
    id: 'presave',
    tone: 'gold',
    title: 'NMOI 프리세이브',
    desc: 'Spotify에서 프리세이브하고 채우기'   // link: shared/cv-presave.js
  };

  /* Board, row by row. Games are mixed so every line needs more than one game;
     the pre-save cell sits on a diagonal. */
  var LAYOUT = [
    'e1', 'm1', 'c1', 'e2',
    'm2', 'presave', 'e3', 'c2',
    'c3', 'e4', 'm3', 'm4',
    'e5', 'c4', 'm5', 'c5'
  ];

  var SIZE = 4;

  /* Rewards by finished lines (contents decided later). */
  var REWARDS = [
    { lines: 1, label: '1줄', reward: '보상 A (추후 공개)' },
    { lines: 2, label: '2줄', reward: '보상 B (추후 공개)' },
    { lines: 3, label: '3줄', reward: '보상 C (추후 공개)' }
  ];

  /* ---------------- Logic ---------------- */

  var store = NS.storage.scope('bingo');
  var listeners = [];

  function readDone() {
    try {
      var list = JSON.parse(store.get('done', '[]'));
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }
  function writeDone(list) { store.set('done', JSON.stringify(list)); }

  function quest(id) {
    if (id === PRESAVE.id) return PRESAVE;
    for (var i = 0; i < QUESTS.length; i++) if (QUESTS[i].id === id) return QUESTS[i];
    return null;
  }

  function isDone(id) { return readDone().indexOf(id) >= 0; }

  function lines() {
    var done = readDone(), out = [], r, c, i;
    function full(idx) { return idx.every(function (k) { return done.indexOf(LAYOUT[k]) >= 0; }); }
    for (r = 0; r < SIZE; r++) { var row = []; for (c = 0; c < SIZE; c++) row.push(r * SIZE + c); if (full(row)) out.push(row); }
    for (c = 0; c < SIZE; c++) { var col = []; for (r = 0; r < SIZE; r++) col.push(r * SIZE + c); if (full(col)) out.push(col); }
    var d1 = [], d2 = [];
    for (i = 0; i < SIZE; i++) { d1.push(i * SIZE + i); d2.push(i * SIZE + (SIZE - 1 - i)); }
    if (full(d1)) out.push(d1);
    if (full(d2)) out.push(d2);
    return out;
  }

  function emit(change) {
    for (var i = 0; i < listeners.length; i++) listeners[i](change);
  }

  function complete(ids) {
    if (!ids.length) return;
    var before = lines().length;
    writeDone(readDone().concat(ids));
    emit({ added: ids, newLines: lines().length - before });
  }

  NS.bingo = {
    size: SIZE,
    games: GAMES,
    presave: PRESAVE,
    art: ART,
    rewards: REWARDS,

    /** Board index of the pre-save cell. */
    presaveIndex: function () { return LAYOUT.indexOf(PRESAVE.id); },

    /** Ids completed since the board was last viewed (they get a fill animation). */
    unseen: function () {
      var seen;
      try { seen = JSON.parse(store.get('seen', '[]')); } catch (e) { seen = []; }
      return readDone().filter(function (id) { return seen.indexOf(id) < 0; });
    },
    markSeen: function () { store.set('seen', JSON.stringify(readDone())); },

    /** Cells in board order: { index, id, quest, game, done }. */
    cells: function () {
      var done = readDone();
      return LAYOUT.map(function (id, index) {
        var q = quest(id);
        return { index: index, id: id, quest: q, game: q && q.game ? GAMES[q.game] : null, gameId: q ? q.game : null, done: done.indexOf(id) >= 0 };
      });
    },

    questsFor: function (gameId) {
      var done = readDone();
      return QUESTS.filter(function (q) { return q.game === gameId; }).map(function (q) {
        return { id: q.id, title: q.title, desc: q.desc, done: done.indexOf(q.id) >= 0 };
      });
    },

    progress: function (gameId) {
      var list = this.questsFor(gameId);
      return { done: list.filter(function (q) { return q.done; }).length, total: list.length };
    },

    doneCount: function () { return readDone().length; },
    lines: lines,
    isDone: isDone,

    /** A run ended. Returns the quests completed by it (may be empty). */
    report: function (gameId, stats) {
      var plays = (store.getNumber('plays:' + gameId, 0) || 0) + 1;
      store.set('plays:' + gameId, plays);
      var meta = { plays: plays };
      var done = readDone();
      var fresh = QUESTS.filter(function (q) {
        if (q.game !== gameId || done.indexOf(q.id) >= 0) return false;
        try { return !!q.test(stats || {}, meta); } catch (e) { return false; }
      });
      complete(fresh.map(function (q) { return q.id; }));
      if (NS.leaderboard && stats) NS.leaderboard.submit(gameId, stats.score);
      return fresh.map(function (q) { return { id: q.id, title: q.title, desc: q.desc }; });
    },

    /** Pre-save cell (self-reported until a real Spotify check exists). */
    completePresave: function () {
      if (!isDone(PRESAVE.id)) complete([PRESAVE.id]);
    },

    onChange: function (fn) { listeners.push(fn); },

    /** For testing only. */
    reset: function () {
      writeDone([]);
      store.set('seen', '[]');
      Object.keys(GAMES).forEach(function (g) { store.set('plays:' + g, 0); });
      emit({ added: [], newLines: 0, reset: true });
    }
  };
})(window.CAVIAR = window.CAVIAR || {});
