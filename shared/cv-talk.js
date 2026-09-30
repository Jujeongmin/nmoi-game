/* Member talk — speech bubbles in the games, the result-card conversation, the serving scene.
   Lines per member and language: shared/cv-talk-lines.js.
   CAVIAR.talk.line(key, vars, memberId)   the member's line in the current language
   CAVIAR.talk.reply(key)                  a guest reply label
   CAVIAR.talk.bubble(host, opts)          → { say(key | text, vars, ms) } a bubble in `host`
     opts.anchor: 'chibi' (above a chibi box) | 'top' (top of a play area, with the name)
   Keys: start oops good last10 · mission best ok low · again bingo presave · caviar drink.
   A bubble never repeats the same key within 4 s and never interrupts input (no pointer events).
   Needs cv-i18n, cv-chibi (member), cv-talk-lines. */
(function (NS) {
  'use strict';

  var COL = { ko: 0, en: 1, ja: 2, 'zh-Hant': 3, 'zh-Hans': 4 };
  function col() { return COL[(NS.i18n && NS.i18n.lang) || 'ko'] || 0; }
  // {name} → value; {name|을/를} → value + the particle that fits its last syllable (받침).
  function hasFinal(word) {
    var c = String(word).trim().slice(-1).charCodeAt(0);
    return c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 !== 0 : false;
  }
  function fill(s, vars) {
    if (!vars) return s;
    return s.replace(/\{(\w+)(?:\|([^/}]*)\/([^}]*))?\}/g, function (m, k, withFinal, without) {
      if (vars[k] === undefined) return m;
      return vars[k] + (withFinal === undefined ? '' : hasFinal(vars[k]) ? withFinal : without);
    });
  }
  function member(id) { return NS.chibi ? NS.chibi.member(id) : null; }
  function nick() {
    var o = NS.hub && NS.hub.getOrder && NS.hub.getOrder();
    return (o && o.nickname) || (NS.t ? NS.t('게스트') : '게스트');
  }

  function line(key, vars, memberId) {
    var m = member(memberId);
    var set = m && NS.talkLines && NS.talkLines[m.id];
    var row = set && set[key];
    if (!row) return '';
    var v = { nick: nick() };
    for (var k in vars || {}) v[k] = vars[k];
    return fill(row[col()] || row[0], v);
  }
  function reply(key) {
    var row = NS.talkReplies && NS.talkReplies[key];
    return row ? row[col()] || row[0] : key;
  }

  function bubble(host, opts) {
    opts = opts || {};
    var b = document.createElement('div');
    b.className = 'cv-talk cv-talk--' + (opts.anchor || 'chibi');
    b.setAttribute('role', 'status');
    b.setAttribute('aria-live', 'polite');
    host.appendChild(b);
    var timer = null, last = {};
    return {
      el: b,
      say: function (key, vars, ms) {
        var text = NS.talkLines && /^[a-z0-9]+$/.test(key) ? line(key, vars) : key;
        if (!text) return;
        var now = Date.now();
        if (last[key] && now - last[key] < 4000) return;
        last[key] = now;
        b.textContent = '';
        if (opts.anchor === 'top') {
          var m = member();
          if (m) { var n = document.createElement('b'); n.textContent = m.name; b.appendChild(n); }
        }
        b.appendChild(document.createTextNode(text));
        b.classList.remove('is-on');
        void b.offsetWidth;
        b.classList.add('is-on');
        clearTimeout(timer);
        timer = setTimeout(function () { b.classList.remove('is-on'); }, ms || 2200);
      },
      hide: function () { clearTimeout(timer); b.classList.remove('is-on'); }
    };
  }

  NS.talk = { line: line, reply: reply, bubble: bubble };
})(window.CAVIAR = window.CAVIAR || {});
