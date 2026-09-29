/* Shared local storage helper (prototype only — no server).
   Every read/write is guarded: private mode or blocked storage falls back to memory.
   Also defines CAVIAR.root / CAVIAR.url(): the site root is taken from where this very
   script was loaded, so runtime paths work no matter how the page URL looks
   (no trailing slash, proxied preview, CDN) — not from document.baseURI. */
(function (NS) {
  'use strict';

  var self = document.currentScript && document.currentScript.src;
  NS.root = self ? self.replace(/shared\/cv-storage\.js(?:[?#].*)?$/, '') : new URL('./', window.location.href).href;

  /** Runs fn(CAVIAR.server) once the Verse8 server bridge (module shared/cv-server.js,
      only present in the Verse8 build) has loaded. Never runs when it is absent. */
  NS.whenServer = function (fn) {
    if (NS.server) { fn(NS.server); return; }
    window.addEventListener('caviar-server-ready', function () { fn(NS.server); }, { once: true });
  };

  /** Absolute URL for a path from the repo/site root, e.g. url('assets/chibi/nara.webp'). */
  NS.url = function (path) {
    if (!path || /^(?:[a-z]+:|\/\/)/i.test(path)) return path;
    return NS.root + String(path).replace(/^(?:\.\.\/|\.\/|\/)+/, '');
  };

  var PREFIX = 'caviar-campaign:';
  var memory = {};

  function read(key) {
    try {
      var v = window.localStorage.getItem(PREFIX + key);
      return v === null ? memory[key] : v;
    } catch (e) {
      return memory[key];
    }
  }

  function write(key, value) {
    memory[key] = String(value);
    try { window.localStorage.setItem(PREFIX + key, String(value)); } catch (e) { /* memory only */ }
  }

  NS.storage = {
    scope: function (gameId) {
      return {
        get: function (key, fallback) {
          var raw = read(gameId + ':' + key);
          return raw === undefined ? fallback : raw;
        },
        getNumber: function (key, fallback) {
          var raw = read(gameId + ':' + key);
          var n = Number(raw);
          return raw !== undefined && isFinite(n) ? n : fallback;
        },
        set: function (key, value) { write(gameId + ':' + key, value); }
      };
    }
  };
})(window.CAVIAR = window.CAVIAR || {});
