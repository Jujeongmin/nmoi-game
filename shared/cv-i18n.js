/* i18n — ko (source) · en · ja · zh-Hant · zh-Hans.
   The Korean text in the markup and scripts is the key; shared/cv-i18n-dict.js holds the
   translations. Load right after cv-storage.js and the dictionary, on every page.

   CAVIAR.t(ko, vars)        translated string; {name} placeholders filled from vars
   CAVIAR.i18n.lang          current language id
   CAVIAR.i18n.set(id)       remember the language and reload the page in it
   CAVIAR.i18n.langs         [{ id, label }] for the settings

   Static and script-built text is translated in the DOM (text nodes and the placeholder /
   aria-label / alt / title attributes), also when it is inserted later:
     1. the whole text as a dictionary key
     2. "· text" / "text ·" pieces of a joined line
     3. "A · B" lines part by part
     4. templates: "지금 {n}위" — {n…} / {d…} take a number or a date, other names take text
   Canvas text, dialogs (confirm / prompt) and share texts call CAVIAR.t themselves.
   Language: ?lang= → the saved choice → the browser language → English. */
(function (NS) {
  'use strict';

  var LANGS = [
    { id: 'ko', label: '한국어' },
    { id: 'en', label: 'English' },
    { id: 'ja', label: '日本語' },
    { id: 'zh-Hant', label: '繁體中文' },
    { id: 'zh-Hans', label: '简体中文' }
  ];
  var COL = { en: 0, ja: 1, 'zh-Hant': 2, 'zh-Hans': 3 };
  var store = NS.storage.scope('settings');

  function normalize(code) {
    var c = String(code || '').toLowerCase();
    if (c.indexOf('ko') === 0) return 'ko';
    if (c.indexOf('ja') === 0) return 'ja';
    if (c.indexOf('zh') === 0) return /hant|tw|hk|mo/.test(c) ? 'zh-Hant' : 'zh-Hans';
    if (c.indexOf('en') === 0) return 'en';
    return null;
  }
  function detect() {
    var q = /[?&]lang=([A-Za-z-]+)/.exec(window.location.search);
    var fromQuery = q && normalize(q[1]);
    if (fromQuery) { store.set('lang', fromQuery); return fromQuery; }
    var saved = normalize(store.get('lang', ''));
    if (saved) return saved;
    var list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
    for (var i = 0; i < list.length; i++) { var n = normalize(list[i]); if (n) return n; }
    return 'en';
  }

  var lang = detect();
  var col = COL[lang];
  var DICT = NS.i18nDict || {};
  var HANGUL = /[가-힣]/;
  var NUMBER = '([0-9][0-9.,:/–-]*)';

  function escapeRe(s) { return s.replace(/[.*+?^$()|[\]\\]/g, '\\$&'); }

  var templates = [];
  Object.keys(DICT).forEach(function (ko) {
    if (ko.indexOf('{') < 0) return;
    var names = [];
    var src = ko.split(/(\{\w+\})/).map(function (piece) {
      var m = /^\{(\w+)\}$/.exec(piece);
      if (!m) return escapeRe(piece);
      names.push(m[1]);
      return /^[nd]\d*$/.test(m[1]) ? NUMBER : '(.+?)';
    }).join('');
    templates.push({ re: new RegExp('^' + src + '$'), names: names, ko: ko, weight: ko.replace(/\{\w+\}/g, '').length });
  });
  templates.sort(function (a, b) { return b.weight - a.weight; });

  function fill(s, vars) {
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, function (m, k) { return Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : m; });
  }
  function lookup(ko) {
    var row = DICT[ko];
    return row && row[col] ? row[col] : null;
  }

  function t(ko, vars) {
    if (lang === 'ko') return fill(ko, vars);
    return fill(lookup(ko) || ko, vars);
  }

  var cache = Object.create(null);
  function translate(text) {
    if (text in cache) return cache[text];
    var out = lookup(text);
    if (out === null) {
      var edge = /^(·\s*)([\s\S]+)$/.exec(text) || /^([\s\S]+?)(\s*·)$/.exec(text);
      if (edge) {
        var lead = edge[1].charAt(0) === '·';
        var inner = translate(lead ? edge[2] : edge[1]);
        if (inner !== null) out = lead ? edge[1] + inner : inner + edge[2];
      }
    }
    if (out === null) {
      var paren = /^\(([\s\S]+)\)$/.exec(text);
      if (paren) { var inside = translate(paren[1]); if (inside !== null) out = '(' + inside + ')'; }
    }
    if (out === null && text.indexOf(' · ') > 0) {
      var joined = text.split(' · ').map(translatePart).join(' · ');
      if (joined !== text) out = joined;
    }
    if (out === null) {
      for (var i = 0; i < templates.length; i++) {
        var m = templates[i].re.exec(text);
        if (!m) continue;
        var tr = lookup(templates[i].ko);
        if (!tr) continue;
        var vars = {};
        for (var k = 0; k < templates[i].names.length; k++) vars[templates[i].names[k]] = translatePart(m[k + 1]);
        out = fill(tr, vars);
        break;
      }
    }
    cache[text] = out;
    return out;
  }
  function translatePart(p) {
    if (!HANGUL.test(p)) return p;
    var core = p.trim();
    var tr = translate(core);
    return tr === null ? p : p.replace(core, tr);
  }

  function translateNodeText(node) {
    var v = node.nodeValue;
    if (!v || !HANGUL.test(v)) return;
    var core = v.trim();
    var tr = translate(core);
    if (tr !== null && tr !== core) node.nodeValue = v.replace(core, tr);
  }
  var ATTRS = ['placeholder', 'aria-label', 'alt', 'title'];
  function translateAttrs(el) {
    if (!el.getAttribute) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var v = el.getAttribute(ATTRS[i]);
      if (!v || !HANGUL.test(v)) continue;
      var tr = translate(v.trim());
      if (tr !== null) el.setAttribute(ATTRS[i], tr);
    }
  }
  /* "A · B · C" lines break at the dots: each short part is kept whole (a nowrap span), so
     "오늘 캐비어 이스케이프" or "하루 1판 더" never splits. Long parts (sentences) wrap as usual.
     Member lines are skipped (cv-bingo-ui.js rewrites that text node in place). */
  var SEP = ' · ', PART_MAX = 18;
  function keepParts(node) {
    var v = node.nodeValue, host = node.parentNode;
    if (!v || v.indexOf(SEP) < 0 || !host || host.nodeType !== 1) return;
    if (host.classList.contains('cv-part') || host.classList.contains('cv-parts') || host.closest('.cv-talk, .cv-result-member__line, .lp-bubble, [data-no-parts]')) return;
    var parts = v.split(SEP);
    if (!parts.some(function (p) { return p.trim() && p.trim().length <= PART_MAX; })) return;
    var frag = document.createDocumentFragment();
    parts.forEach(function (p, i) {
      if (i) frag.appendChild(document.createTextNode(SEP));
      var core = p.trim();
      if (!core || core.length > PART_MAX) { if (p) frag.appendChild(document.createTextNode(p)); return; }
      var lead = p.slice(0, p.indexOf(core)), tail = p.slice(p.indexOf(core) + core.length);
      if (lead) frag.appendChild(document.createTextNode(lead));
      var span = document.createElement('span');
      span.className = 'cv-part';
      span.textContent = core;
      frag.appendChild(span);
      if (tail) frag.appendChild(document.createTextNode(tail));
    });
    // In a flex / grid box every text run would become its own item: keep them in one span.
    var d = getComputedStyle(host).display;
    if (d.indexOf('flex') >= 0 || d.indexOf('grid') >= 0) {
      var wrap = document.createElement('span');
      wrap.className = 'cv-parts';
      wrap.appendChild(frag);
      frag = wrap;
    }
    host.replaceChild(frag, node);
  }

  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1 };
  var translating = lang !== 'ko';
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) {
      if (!(root.parentNode && SKIP[root.parentNode.tagName])) { if (translating) translateNodeText(root); keepParts(root); }
      return;
    }
    if (root.nodeType !== 1 || SKIP[root.tagName]) return;
    if (translating) translateAttrs(root);
    var w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
    var n, texts = [];
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) { if (!(n.parentNode && SKIP[n.parentNode.tagName])) texts.push(n); }
      else if (translating) translateAttrs(n);
    }
    // after the walk: keepParts replaces nodes, which would upset the tree walker
    texts.forEach(function (t) { if (translating) translateNodeText(t); keepParts(t); });
  }

  document.documentElement.lang = lang;
  if (translating && document.title && HANGUL.test(document.title)) document.title = translate(document.title) || document.title;
  {
    walk(document.body);
    // Our own edits are made while disconnected, so they never feed back into the observer.
    var OPTIONS = { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS };
    var observer = new MutationObserver(function (list) {
      observer.disconnect();
      try {
        for (var i = 0; i < list.length; i++) {
          var r = list[i];
          if (r.type === 'characterData') { if (translating) translateNodeText(r.target); if (r.target.parentNode) keepParts(r.target); }
          else if (r.type === 'attributes') { if (translating) translateAttrs(r.target); }
          else for (var k = 0; k < r.addedNodes.length; k++) walk(r.addedNodes[k]);
        }
      } finally {
        observer.observe(document.body, OPTIONS);
      }
    });
    observer.observe(document.body, OPTIONS);
  }

  NS.t = t;
  NS.i18n = {
    lang: lang,
    langs: LANGS,
    t: t,
    translate: function (text) { return lang === 'ko' ? text : (translate(String(text).trim()) || text); },
    set: function (id) {
      var next = normalize(id);
      if (!next || next === lang) return;
      store.set('lang', next);
      var url = window.location.href.replace(/([?&])lang=[A-Za-z-]+&?/, '$1').replace(/[?&](#|$)/, '$1');
      window.location.replace(url);
    }
  };
})(window.CAVIAR = window.CAVIAR || {});
