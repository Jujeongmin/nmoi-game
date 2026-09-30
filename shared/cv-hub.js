/* Shared hand-off between the landing page (repo root index.html) and the games.
   - The landing stores the guest's order and opens a game with ?from=hub.
   - A game opened that way sends "back" to the can selection instead of its own title,
     and relabels its #btn-back button accordingly.
   Needs shared/cv-storage.js loaded first. */
(function (NS) {
  'use strict';

  var store = NS.storage.scope('hub');
  var fromHub = /(?:^|[?&])from=hub(?:&|$)/.test(window.location.search.slice(1));

  /* Verse8 passes the player's identity in the page URL (?account=&auth=). Carry it
     across every internal link so the landing and the games share one account
     (the leaderboard is per account). */
  var KEEP = ['account', 'auth', 'date'];   // date: demo walk-through (cv-campaign.js)
  var carried = (function () {
    var q = new URLSearchParams(window.location.search), out = [];
    KEEP.forEach(function (k) { if (q.get(k)) out.push(k + '=' + encodeURIComponent(q.get(k))); });
    return out.join('&');
  })();
  function withParams(url, extra) {
    var hashAt = url.indexOf('#');
    var hash = hashAt >= 0 ? url.slice(hashAt) : '';
    var base = hashAt >= 0 ? url.slice(0, hashAt) : url;
    var parts = [extra, carried].filter(Boolean).join('&');
    if (!parts) return url;
    return base + (base.indexOf('?') >= 0 ? '&' : '?') + parts + hash;
  }

  function getOrder() {
    try { return JSON.parse(store.get('order', 'null')); } catch (e) { return null; }
  }

  NS.hub = {
    /** true when this page was opened from the landing flow. */
    fromHub: fromHub,

    /** { nickname, caviar, eat, drink, member } or null. */
    getOrder: getOrder,
    setOrder: function (order) { store.set('order', JSON.stringify(order)); },

    /** Member id picked by the order (favourite caviar), or null. */
    memberId: function () {
      var o = getOrder();
      return o && o.member ? o.member : null;
    },

    /** Absolute URL of a game page opened from the landing (explicit index.html: static hosts may not serve folder indexes). */
    gameUrl: function (gamePath) { return withParams(NS.url(gamePath.replace(/\/?$/, '/') + 'index.html'), 'from=hub'); },

    /** Any internal page URL (from the site root), keeping the Verse8 account params. */
    link: function (path) { return withParams(NS.url(path)); },

    /** Leave a game and return to the can selection. */
    exit: function () {
      window.location.href = withParams(NS.url('index.html') + '#cans');
    },

    /** Leave a game for the landing's invite sheet (a referral = +1 run a day). */
    invite: function () {
      window.location.href = withParams(NS.url('index.html') + '#invite');
    },

    /** Wrap a game's own "back" handler: hub visitors return to the cans, others keep `fallback`. */
    backOr: function (fallback) {
      if (!fromHub) return fallback;
      return function () { NS.hub.exit(); };
    }
  };

  if (fromHub) {
    var btn = document.getElementById('btn-back');
    if (btn) btn.textContent = '캐비어 선택';
  }
})(window.CAVIAR = window.CAVIAR || {});
