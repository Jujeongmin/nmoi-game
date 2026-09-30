/* CAVIAR COURSE — hub side of the game integration (pages/play/).
   Embeds a game build in an iframe and speaks the postMessage protocol of
   docs/game-integration.md. The hub owns everything that counts: week lock, runs per
   day, missions, leaderboard, pre-save panel. The game only reports.

   Registry: which builds may be embedded (never an arbitrary URL from the query string).
   `src` is from the site root, or an absolute https URL when the Verse8 game team hosts
   the build elsewhere — then add its origin to `origins`.
   Needs cv-storage, cv-campaign, cv-hub, cv-account, cv-bingo, cv-bingo-ui, cv-presave. */
(function (NS) {
  'use strict';

  var GAMES = {
    // Verse8 game team builds go here when delivered (src: null = not delivered yet).
    'caviar-match':       { src: null, name: '캐비어 매치' },
    'caviar-escape':      { src: null, name: '캐비어를 훔쳐라' },
    'caviar-master-chef': { src: null, name: '마스터 셰프 캐비어' },
    // Reference game that follows the spec (reports as caviar-match for the missions).
    'sample':             { src: 'pages/play/sample/index.html', name: '연동 샘플 (매치 규격)', gameId: 'caviar-match' }
  };
  var ORIGINS = [window.location.origin];   // + external build origins, e.g. 'https://games.verse8.io'

  var frame = null, entry = null, gameId = null, runId = null, targetOrigin = '*';
  var handlers = {};

  function send(type, data) {
    if (!frame || !frame.contentWindow) return;
    var msg = { source: 'caviar-hub', v: 1, type: type };
    if (data) for (var k in data) if (Object.prototype.hasOwnProperty.call(data, k)) msg[k] = data[k];
    frame.contentWindow.postMessage(msg, targetOrigin);
  }

  function config() {
    var order = NS.hub.getOrder() || {};
    return {
      gameId: gameId,
      nickname: order.nickname || '',
      member: order.member || null,
      weekOpen: NS.campaign.isGameOpen(gameId),
      playsLeft: NS.account.playsLeft(gameId),
      dailyLimit: NS.account.limit(),
      presaved: NS.account.presaved(),
      booster: NS.account.presaved() ? NS.campaign.config.booster : 1,
      multiplier: NS.account.multiplier(),
      muted: NS.sound ? NS.sound.muted() : false
    };
  }

  function newRunId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  function onMessage(e) {
    if (!frame || e.source !== frame.contentWindow) return;
    if (ORIGINS.indexOf(e.origin) < 0) return;
    var m = e.data;
    if (!m || m.source !== 'caviar-game' || m.v !== 1) return;

    switch (m.type) {
      case 'ready':
        send('config', config());
        break;

      case 'start': {
        if (!NS.campaign.isGameOpen(gameId)) { send('start-denied', { reason: 'locked' }); break; }
        var denyLimit = function () {
          send('start-denied', { reason: 'limit', playsLeft: 0 });
          if (!NS.account.presaved() && NS.presave) NS.presave.interstitial();
        };
        if (NS.account.playsLeft(gameId) <= 0) { denyLimit(); break; }
        // Booster choice (once), then the server opens the run; without it the game may not start.
        var choice = NS.presave ? NS.presave.boosterChoice() : Promise.resolve();
        choice.then(function () { return NS.account.startRun(gameId); }).then(function (r) {
          if (r.ok) {
            runId = newRunId();
            var need = NS.bingo.scoreMission(gameId);
            send('start-ok', {
              runId: runId,
              playsLeft: NS.account.playsLeft(gameId),
              retries: NS.account.playsLeft(gameId),      // overview §2 name for the runs left
              multiplier: r.multiplier || 1,              // shown in the game HUD (x1.0 / x1.2 / x1.5)
              extraLife: r.extraLife || 0,                // +1 life booster (games with lives)
              missionScore: need ? need.need : null       // booster score of the open score mission
            });
          } else if (r.reason === 'limit') {
            denyLimit();
          } else {
            send('start-denied', { reason: 'offline' });
            NS.account.offlineNotice(null);
          }
        });
        break;
      }

      case 'end': {
        // Only the run the hub opened counts, once.
        if (!runId || m.runId !== runId) { send('result', { counted: false, reason: 'no-run', missions: [] }); break; }
        runId = null;
        var score = Math.max(0, Math.floor(Number(m.score) || 0));
        var stats = (m.stats && typeof m.stats === 'object') ? m.stats : {};
        stats.score = score;
        if (typeof m.playTimeMs === 'number') stats.playTimeMs = m.playTimeMs;   // overview §2 (optional)
        if (typeof m.eventsHash === 'string') stats.eventsHash = m.eventsHash;
        var fresh = NS.bingo.report(gameId, stats);   // missions + leaderboard submit
        send('result', { counted: true, score: score, missions: fresh });
        if (handlers.end) handlers.end({ gameId: gameId, score: score, stats: stats, missions: fresh });
        break;
      }

      case 'event':
        if (handlers.event) handlers.event({ name: m.name, data: m.data });
        break;

      case 'exit':
        if (handlers.exit) handlers.exit();
        break;
    }
  }
  window.addEventListener('message', onMessage);

  NS.host = {
    games: GAMES,
    origins: ORIGINS,

    /** Put registry entry `key` into `container`. Returns false when the build is missing. */
    embed: function (container, key) {
      entry = GAMES[key];
      if (!entry || !entry.src) return false;
      gameId = entry.gameId || key;
      var url = /^https:\/\//.test(entry.src) ? entry.src : NS.url(entry.src);
      targetOrigin = new URL(url, window.location.href).origin;
      if (ORIGINS.indexOf(targetOrigin) < 0) return false;
      frame = document.createElement('iframe');
      frame.className = 'cv-host__frame';
      frame.title = entry.name;
      frame.allow = 'autoplay; fullscreen';
      frame.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'hubOrigin=' + encodeURIComponent(window.location.origin);
      container.appendChild(frame);
      return true;
    },

    gameId: function () { return gameId; },
    on: function (name, fn) { handlers[name] = fn; }
  };
})(window.CAVIAR = window.CAVIAR || {});
