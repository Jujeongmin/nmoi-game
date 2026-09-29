/* CAVIAR COURSE — game-side bridge (drop-in, no dependencies).
   For games built outside this repo (Verse8 game team) that run inside the hub's
   iframe (pages/play/). Spec: docs/game-integration.md

     CaviarBridge.init({ gameId: 'caviar-match' }).then(function (config) { ... });
     CaviarBridge.requestStart().then(function (ok) { if (ok.allowed) startRun(); });
     CaviarBridge.end({ score: 5200, stats: { total: 24 } });
     CaviarBridge.event('stage-clear', { stage: 2 });   // optional
     CaviarBridge.exit();                                // back to the hub

   Outside an iframe (standalone test) every call resolves locally so the game still runs. */
(function (root) {
  'use strict';

  var VERSION = 1;
  var framed = window.parent && window.parent !== window;
  var hubOrigin = (function () {
    var q = /[?&]hubOrigin=([^&]+)/.exec(window.location.search);
    if (q) return decodeURIComponent(q[1]);
    try { return document.referrer ? new URL(document.referrer).origin : '*'; } catch (e) { return '*'; }
  })();

  var gameId = '';
  var runId = null;
  var waiting = {};     // reply type -> resolve
  var listeners = {};

  function post(type, data) {
    if (!framed) return;
    var msg = { source: 'caviar-game', v: VERSION, type: type, gameId: gameId };
    if (data) for (var k in data) if (Object.prototype.hasOwnProperty.call(data, k)) msg[k] = data[k];
    window.parent.postMessage(msg, hubOrigin);
  }

  function wait(types, fallback, ms) {
    return new Promise(function (resolve) {
      if (!framed) { resolve(fallback); return; }
      var t = setTimeout(function () { done(fallback); }, ms || 3000);
      function done(v) { clearTimeout(t); types.forEach(function (x) { delete waiting[x]; }); resolve(v); }
      types.forEach(function (x) { waiting[x] = done; });
    });
  }

  window.addEventListener('message', function (e) {
    var m = e.data;
    if (!m || m.source !== 'caviar-hub' || e.source !== window.parent) return;
    if (hubOrigin !== '*' && e.origin !== hubOrigin) return;
    if (m.type === 'start-ok') runId = m.runId;
    if (waiting[m.type]) waiting[m.type](m);
    (listeners[m.type] || []).forEach(function (fn) { try { fn(m); } catch (err) {} });
  });

  root.CaviarBridge = {
    framed: framed,

    /** Handshake. Resolves with the hub config (nickname, member, playsLeft, booster, ...). */
    init: function (opts) {
      gameId = String((opts && opts.gameId) || '');
      var p = wait(['config'], { standalone: true, playsLeft: Infinity, booster: 1 });
      post('ready');
      return p;
    },

    /** Ask the hub for a run (daily limit, week lock). Resolves { allowed, playsLeft, reason }. */
    requestStart: function () {
      var p = wait(['start-ok', 'start-denied'], { type: 'start-ok', runId: 'local' }).then(function (m) {
        return { allowed: m.type === 'start-ok', playsLeft: m.playsLeft, reason: m.reason || null };
      });
      post('start');
      return p;
    },

    /** Run finished. score: integer; stats: game-specific fields (see the spec). */
    end: function (result) {
      var r = result || {};
      var p = wait(['result'], { missions: [] }, 6000);
      post('end', { runId: runId, score: Math.max(0, Math.floor(Number(r.score) || 0)), stats: r.stats || {} });
      runId = null;
      return p;
    },

    event: function (name, data) { post('event', { name: String(name), data: data || null }); },
    exit: function () { post('exit'); },
    on: function (type, fn) { (listeners[type] = listeners[type] || []).push(fn); }
  };
})(window);
