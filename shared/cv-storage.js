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

  /** Retargeting event (overview §6: pre-save click · share · play → Kreators pixel).
      Names: entry · booster_choice {choice} · presave_click {where} · share {game} ·
      play {game, score} · v8_login. Pushed to window.dataLayer (GTM) and, when Kreators'
      snippet is on the page, to fbq('trackCustom') / window.kreatorsPixel(name, data). */
  NS.track = function (name, data) {
    var prefix = (NS.campaign && NS.campaign.config.tracking && NS.campaign.config.tracking.prefix) || 'caviar_';
    var ev = { event: prefix + name };
    for (var k in data || {}) if (Object.prototype.hasOwnProperty.call(data, k)) ev[k] = data[k];
    try {
      (window.dataLayer = window.dataLayer || []).push(ev);
      if (typeof window.fbq === 'function') window.fbq('trackCustom', prefix + name, data || {});
      if (typeof window.kreatorsPixel === 'function') window.kreatorsPixel(name, data || {});
    } catch (e) { /* tracking never breaks the page */ }
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
