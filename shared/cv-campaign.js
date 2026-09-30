/* CAVIAR COURSE — campaign schedule and rules (one place for every date and number).
   Mirrors the overview: 3 weeks, one new game per week, pre-save → bingo → rewards.
   The Verse8 server (verse8/server.js) keeps its own copy of the dates and limits and is
   the authority for anything that counts; this file drives what the pages show.

   Demo helpers
     demo.unlockAllWeeks   every week open regardless of the date (for presentations)
     ?date=2026-11-03      pretend today is that date (KST) — to walk through the weeks;
                           turns unlockAllWeeks off so the week locks show as on that day
   Needs cv-storage.js. */
(function (NS) {
  'use strict';

  var C = {
    // Weeks: game + mission release, all dates KST (inclusive)
    weeks: [
      // W1 shark (Escape) · W2 Match · W3 Master Chef (Verse8 game team builds; the repo
      // games stand in for them). verse8/server.js WEEKS keeps the same order.
      { id: 'w1', label: 'W1', start: '2026-10-26', end: '2026-11-01', game: 'caviar-escape',      tone: 'gold'  },
      { id: 'w2', label: 'W2', start: '2026-11-02', end: '2026-11-08', game: 'caviar-match',       tone: 'green' },
      { id: 'w3', label: 'W3', start: '2026-11-09', end: '2026-11-15', game: 'caviar-master-chef', tone: 'white' }
    ],
    releaseDate: '2026-11-16',      // D-day: pre-save button turns into "listen on Spotify"

    dailyPlays: 3,                  // runs per game per day
    presaveBonusPlays: 1,           // +1 run per day after pre-saving
    booster: 1.2,                   // leaderboard score multiplier after pre-saving
    v8Booster: 1.5,                 // V8 login: first counted run of each week (overview §5)
    referralRunCap: 3,              // +1 run a day per referral, at most +3
    streakLifeEvery: 3,             // 3 days in a row with a run → one +1 life booster
    lifeGames: ['caviar-escape'],   // games with lives: a +1 life booster is used there
    leaderboardTop: 10,

    // Retargeting (overview §6): events go to window.dataLayer, and to fbq / kreatorsPixel when
    // Kreators' pixel snippet is on the page. Event names: see CAVIAR.track in cv-storage.js.
    tracking: { prefix: 'caviar_' },
    tickets: { presave: 2, line: 3, firstRun: 1, dailyRun: 1, share: 1 },   // run / share: once per game per day
    referralDailyCap: 5,            // referrals credited per inviter per day (abuse cap)

    // Bingo numbers (overview §4) — provisional until the alpha data (10/13).
    // verse8/server.js keeps the same numbers in BINGO and judges every cell.
    bingo: {
      score: { 'caviar-match': 5000, 'caviar-escape': 4000, 'caviar-master-chef': 5000 },  // booster score
      rankTopPct: 10,               // game rank cell: weekly top 10 %
      refRankTop: 10,               // referral rank cell: weekly top 10
      refNeed: [3, 5, 10],          // referral count cells (cumulative)
      attNeed: [7, 10, 14]          // attendance cells (days with a finished run, of 21)
    },

    links: {
      presave: '',                  // TODO: n Moi Spotify pre-save smart link
      stream: ''                    // TODO: Spotify link used from the release date
    },

    demo: {
      unlockAllWeeks: true          // set false for launch: weeks then open on their dates
    }
  };

  function kstToday() {
    var q = /[?&]date=(\d{4}-\d{2}-\d{2})/.exec(window.location.search);
    if (q) return q[1];
    var d = new Date(Date.now() + 9 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  }

  function md(iso) { var p = iso.split('-'); return Number(p[1]) + '/' + Number(p[2]); }

  NS.campaign = {
    config: C,
    weeks: C.weeks,
    today: kstToday,
    md: md,

    /** Index of the running week (0..2), -1 before W1, 3 after W3. */
    weekIndex: function () {
      var t = kstToday();
      for (var i = 0; i < C.weeks.length; i++) {
        if (t >= C.weeks[i].start && t <= C.weeks[i].end) return i;
      }
      return t < C.weeks[0].start ? -1 : C.weeks.length;
    },

    /** Week i is open (its game and missions are available). */
    isWeekOpen: function (i) {
      if (C.demo.unlockAllWeeks && !/[?&]date=/.test(window.location.search)) return true;
      return kstToday() >= C.weeks[i].start;
    },

    weekOfGame: function (gameId) {
      for (var i = 0; i < C.weeks.length; i++) if (C.weeks[i].game === gameId) return i;
      return -1;
    },

    isGameOpen: function (gameId) {
      var i = this.weekOfGame(gameId);
      return i < 0 ? true : this.isWeekOpen(i);
    },

    /** Leaderboard season id for today: w1/w2/w3, 'pre' before, 'post' after. */
    season: function () {
      var i = this.weekIndex();
      return i < 0 ? 'pre' : i >= C.weeks.length ? 'post' : C.weeks[i].id;
    },

    seasonLabel: function (id) {
      for (var i = 0; i < C.weeks.length; i++) {
        var w = C.weeks[i];
        if (w.id === id) return w.label + ' 시즌 · ' + md(w.start) + '–' + md(w.end);
      }
      return id === 'pre' ? '프리시즌 (오픈 전)' : '시즌 종료';
    },

    isReleased: function () { return kstToday() >= C.releaseDate; },

    isDemo: function () { return !!C.demo.unlockAllWeeks; }
  };
})(window.CAVIAR = window.CAVIAR || {});
