/* Trailer easter eggs: now and then a member peeks out from the edge of the screen; a tap
   finds her and unlocks her trailer in the Trailer basket (pages/trailer). The group trailer
   opens once all five are found.

   Never during play: on a game page a member only peeks while its description (title) or
   result card is open, and slips away as soon as a run starts.

   CAVIAR.eggs.found()            ['nara', ...] found member ids (this browser)
   CAVIAR.eggs.has(memberId)      found?
   CAVIAR.eggs.trailerOf(id)      trailer no ('01'..'05') for a member
   CAVIAR.eggs.allFound()
   CAVIAR.eggs.onFind(fn)         fn(memberId) after a find (the trailer page opens it)
   Needs cv-storage.js, cv-hub.js, members.js (CAVIAR.members), cv-sprite.js. Styles: cv-theme.css "Eggs". */
(function (NS) {
  'use strict';

  var EGGS = [
    { member: 'nara', trailer: '01' },
    { member: 'natalie', trailer: '02' },
    { member: 'serin', trailer: '03' },
    { member: 'tiya', trailer: '04' },
    { member: 'yoon', trailer: '05' }
  ];
  var FIRST = [6, 14];        // seconds before the first peek on a page
  var AGAIN = [35, 70];       // ... between later chances
  var CHANCE = 0.6;           // a chance turns into a peek this often
  var MAX_PER_PAGE = 3;
  var STAY = 7;               // seconds a member waits to be tapped

  var store = NS.storage.scope('eggs');
  var listeners = [];

  function found() {
    try {
      var list = JSON.parse(store.get('found', '[]'));
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }
  function has(id) { return found().indexOf(id) >= 0; }
  function trailerOf(id) {
    for (var i = 0; i < EGGS.length; i++) if (EGGS[i].member === id) return EGGS[i].trailer;
    return null;
  }
  function member(id) {
    var list = NS.members || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  /* ---------- when a peek is allowed ---------- */

  var isGame = !!document.querySelector('.cv-hud');
  function quietTime() {
    if (document.hidden) return false;
    if (NS.settings && NS.settings.isOpen && NS.settings.isOpen()) return false;
    if (document.querySelector('.cv-booster.is-open, .cv-presave-sheet.is-open, .cv-egg-found')) return false;
    if (!isGame) return true;
    // Games: only on the description or result card (never while a run is on).
    return !!document.querySelector('#screen-title.is-open, #screen-result.is-open');
  }

  /* ---------- the peek ---------- */

  var peek = null, shown = 0, timer = 0;

  function schedule(range) {
    clearTimeout(timer);
    if (shown >= MAX_PER_PAGE) return;
    timer = setTimeout(tryPeek, rand(range[0], range[1]) * 1000);
  }

  function tryPeek() {
    var left = EGGS.filter(function (e) { return !has(e.member) && member(e.member); });
    if (!left.length) return;
    if (!quietTime() || peek || Math.random() > CHANCE) { schedule(AGAIN); return; }
    show(left[Math.floor(Math.random() * left.length)].member);
    schedule(AGAIN);
  }

  function show(id) {
    var m = member(id);
    if (!m || !NS.sprite) return;
    shown++;
    var side = ['left', 'right', 'bottom'][Math.floor(Math.random() * 3)];
    var box = el('button', 'cv-egg cv-egg--' + side);
    box.type = 'button';
    box.setAttribute('aria-label', m.name + ' — 찾았다!');
    // Along an edge of the app's column (on a wide screen the portrait app sits in the middle;
    // the window's own edges would be outside it), clear of the corners (bars, gear, footer).
    // Bottom: near a corner, so the main buttons in the middle stay free.
    var app = document.getElementById('app') || document.body, r = app.getBoundingClientRect();
    var W = 108;   // the peek box (cv-theme.css .cv-egg)
    if (side === 'bottom') {
      box.style.left = Math.round(r.left + r.width * (Math.random() < 0.5 ? rand(0.12, 0.2) : rand(0.8, 0.88)) - W / 2) + 'px';
      box.style.marginLeft = '0';
    } else {
      box.style.top = Math.round(r.top + r.height * rand(0.28, 0.64)) + 'px';
      if (side === 'left') box.style.left = Math.round(r.left - 8) + 'px';
      else { box.style.right = 'auto'; box.style.left = Math.round(r.right - W + 8) + 'px'; }
    }
    var spr = el('span', 'cv-egg__spr');
    box.appendChild(spr);
    box.appendChild(el('span', 'cv-egg__spark', '!'));
    NS.sprite.show(spr, m, 'idle', { cell: 210, ox: 54 - (m.bounds.x + m.bounds.w / 2) * 210 / m.cell, oy: 4 - m.bounds.y * 210 / m.cell, play: true });
    box.addEventListener('click', function (e) { e.stopPropagation(); catchIt(id, box); });
    document.body.appendChild(box);
    requestAnimationFrame(function () { requestAnimationFrame(function () { box.classList.add('is-in'); }); });
    peek = { id: id, box: box, until: setTimeout(function () { hide(); }, STAY * 1000) };
  }

  function hide() {
    if (!peek) return;
    var box = peek.box;
    clearTimeout(peek.until);
    peek = null;
    box.classList.remove('is-in');
    setTimeout(function () { if (NS.sprite) NS.sprite.clear(box.firstChild); box.remove(); }, 450);
  }

  // A run started (the cards closed): she slips away.
  if (isGame) {
    var watch = function () { if (peek && !quietTime()) hide(); };
    var mo = window.MutationObserver ? new MutationObserver(watch) : null;
    ['screen-title', 'screen-result'].forEach(function (id) {
      var n = document.getElementById(id);
      if (n && mo) mo.observe(n, { attributes: true, attributeFilter: ['class'] });
    });
  }

  /* ---------- found ---------- */

  function catchIt(id, box) {
    var list = found();
    if (list.indexOf(id) < 0) { list.push(id); store.set('found', JSON.stringify(list)); }
    clearTimeout(peek && peek.until);
    peek = null;
    box.classList.add('is-caught');
    if (NS.sound) NS.sound.play('success');
    NS.track && NS.track('egg_found', { member: id, count: list.length });
    setTimeout(function () { if (NS.sprite) NS.sprite.clear(box.firstChild); box.remove(); }, 600);
    card(id, list.length);
    listeners.forEach(function (fn) { try { fn(id); } catch (e) {} });
  }

  function card(id, count) {
    var m = member(id), total = EGGS.length;
    var wrap = el('div', 'cv-overlay cv-egg-found is-open');
    wrap.setAttribute('role', 'dialog');
    var panel = el('div', 'cv-panel cv-egg-found__panel');
    panel.appendChild(el('p', 'cv-eyebrow', 'HIDDEN TRAILER ' + count + ' / ' + total));
    var spr = el('div', 'cv-egg-found__spr');
    panel.appendChild(spr);
    NS.sprite.show(spr, m, 'dance', { cell: 190, ox: 60 - (m.bounds.x + m.bounds.w / 2) * 190 / m.cell, oy: 6 - m.bounds.y * 190 / m.cell, play: true });
    panel.appendChild(el('h2', 'cv-egg-found__title', NS.t('{s}의 트레일러를 찾았어요!', { s: m.name })));
    panel.appendChild(el('p', 'cv-egg-found__desc', count >= total
      ? '다섯 멤버를 모두 찾았어요 · 단체 트레일러가 열렸어요'
      : '트레일러 바구니에서 언제든 다시 볼 수 있어요'));
    var actions = el('div', 'cv-actions');
    var go = el('a', 'cv-btn cv-btn--primary', '트레일러 보기');
    go.href = NS.hub.link('pages/trailer/index.html') + (/\?/.test(NS.hub.link('pages/trailer/index.html')) ? '&' : '?') + 'play=' + trailerOf(id);
    var stay = el('button', 'cv-btn', isGame ? '게임으로' : '계속 둘러보기');
    stay.type = 'button';
    function close() { wrap.remove(); NS.sprite.clear(spr); }
    stay.addEventListener('click', close);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    // On the trailer page itself the find opens the player there.
    if (listeners.length) { go.addEventListener('click', function (e) { e.preventDefault(); close(); listeners.forEach(function (fn) { fn(id, true); }); }); }
    actions.appendChild(go);
    actions.appendChild(stay);
    panel.appendChild(actions);
    wrap.appendChild(panel);
    document.body.appendChild(wrap);
  }

  NS.eggs = {
    list: EGGS,
    found: found,
    has: has,
    trailerOf: trailerOf,
    allFound: function () { return EGGS.every(function (e) { return has(e.member); }); },
    onFind: function (fn) { listeners.push(fn); },
    /** Demo / testing: a member peeks now (or `id`). */
    peekNow: function (id) {
      var left = EGGS.filter(function (e) { return !has(e.member); });
      if (peek) hide();
      if (id || left.length) show(id || left[0].member);
    },
    reset: function () { store.set('found', '[]'); }
  };

  schedule(FIRST);   // members are looked up when a peek comes (scripts load in any order)
  document.addEventListener('visibilitychange', function () { if (document.hidden && peek) hide(); });
})(window.CAVIAR = window.CAVIAR || {});
