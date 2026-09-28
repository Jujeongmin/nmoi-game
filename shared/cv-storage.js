/* Shared local storage helper (prototype only — no server).
   Every read/write is guarded: private mode or blocked storage falls back to memory. */
(function (NS) {
  'use strict';

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
