/* Settings — one panel on every page (landing menu, game title cards, page headers).
     언어         ko · en · ja · 繁中 · 简中 (cv-i18n.js; the page reloads in the new language)
     사운드       on/off, BGM volume, effects volume (cv-sound.js, remembered)
     화면         reduce motion (follows the system setting until changed)
     내 정보      nickname / e-mail of the entry sheet, edit on the landing, privacy notice
     계정         V8 login state (placeholder until the Verse8 login is wired)
   CAVIAR.settings.open() / button(extraClass)
   Needs cv-storage, cv-i18n, cv-sound (and cv-hub, cv-account when present). */
(function (NS) {
  'use strict';

  var store = NS.storage.scope('settings');

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  /* ---------- reduce motion ---------- */

  function reduceMotion() {
    var v = store.get('motion', '');
    if (v) return v === 'reduce';
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function applyMotion() { document.documentElement.classList.toggle('cv-reduce-motion', reduceMotion()); }
  applyMotion();

  /* ---------- panel ---------- */

  var box = null;

  function section(panel, title) {
    var s = el('section', 'cv-settings__section');
    s.appendChild(el('h3', 'cv-settings__head', title));
    panel.appendChild(s);
    return s;
  }

  function slider(label, kind) {
    var row = el('label', 'cv-settings__row');
    row.appendChild(el('span', 'cv-settings__label', label));
    var input = el('input', 'cv-settings__range');
    input.type = 'range';
    input.min = '0';
    input.max = '100';
    input.step = '5';
    input.value = String(Math.round(NS.sound.volume(kind) * 100));
    input.setAttribute('aria-label', label);
    var out = el('output', 'cv-settings__value', input.value);
    input.addEventListener('input', function () {
      NS.sound.setVolume(kind, Number(input.value) / 100);
      out.textContent = input.value;
    });
    input.addEventListener('change', function () { if (kind === 'sfx') NS.sound.play('tap'); });
    row.appendChild(input);
    row.appendChild(out);
    return row;
  }

  function toggleRow(label, on, onChange) {
    var row = el('div', 'cv-settings__row');
    row.appendChild(el('span', 'cv-settings__label', label));
    var b = el('button', 'cv-settings__switch');
    b.type = 'button';
    b.setAttribute('role', 'switch');
    function render() { b.setAttribute('aria-checked', on ? 'true' : 'false'); b.textContent = on ? 'ON' : 'OFF'; }
    b.addEventListener('click', function () { on = !on; render(); onChange(on); });
    render();
    row.appendChild(b);
    return row;
  }

  function build() {
    box = el('div', 'cv-overlay cv-settings');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', '설정');
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    var panel = el('div', 'cv-panel cv-settings__panel');
    box.appendChild(panel);
    (document.getElementById('app') || document.body).appendChild(box);
    return panel;
  }

  function render() {
    var panel = box ? box.querySelector('.cv-settings__panel') : build();
    panel.innerHTML = '';
    panel.appendChild(el('p', 'cv-eyebrow', 'SETTINGS'));
    panel.appendChild(el('h2', 'cv-settings__title', '설정'));

    // Language
    var lang = section(panel, '언어');
    var langs = el('div', 'cv-settings__langs');
    NS.i18n.langs.forEach(function (l) {
      var b = el('button', 'cv-settings__lang' + (l.id === NS.i18n.lang ? ' is-on' : ''), l.label);
      b.type = 'button';
      b.lang = l.id;
      b.setAttribute('aria-pressed', l.id === NS.i18n.lang ? 'true' : 'false');
      b.addEventListener('click', function () { NS.i18n.set(l.id); });
      langs.appendChild(b);
    });
    lang.appendChild(langs);

    // Sound
    if (NS.sound) {
      var snd = section(panel, '사운드');
      snd.appendChild(toggleRow('사운드', !NS.sound.muted(), function (on) { if (on === NS.sound.muted()) NS.sound.toggle(); }));
      snd.appendChild(slider('배경음악', 'bgm'));
      snd.appendChild(slider('효과음', 'sfx'));
    }

    // Screen
    var scr = section(panel, '화면');
    scr.appendChild(toggleRow('모션 줄이기', reduceMotion(), function (on) { store.set('motion', on ? 'reduce' : 'full'); applyMotion(); }));

    // My info
    var info = section(panel, '내 정보');
    var order = NS.hub && NS.hub.getOrder && NS.hub.getOrder();
    var dl = el('dl', 'cv-menu cv-settings__info');
    [['닉네임', order && order.nickname], ['이메일', order && order.email]].forEach(function (r) {
      var row = el('div', 'cv-menu__row');
      row.appendChild(el('dt', '', r[0]));
      row.appendChild(el('dd', '', r[1] || '—'));
      dl.appendChild(row);
    });
    info.appendChild(dl);
    var links = el('div', 'cv-settings__links');
    var edit = el('a', 'cv-settings__link', order ? '주문서 다시 작성' : '주문서 작성하기');
    edit.href = NS.hub && NS.hub.link ? NS.hub.link('index.html') + '#order' : NS.url('index.html') + '#order';
    links.appendChild(edit);
    var privacy = el('button', 'cv-settings__link', '개인정보 처리 안내');
    privacy.type = 'button';
    privacy.addEventListener('click', function () { privacyNotice(info); privacy.remove(); });
    links.appendChild(privacy);
    info.appendChild(links);

    // Account
    if (NS.account) {
      var acc = section(panel, '계정');
      acc.appendChild(el('p', 'cv-settings__note', NS.account.loggedIn()
        ? 'V8 로그인됨 · 부스터·레퍼럴·출석이 기기를 바꿔도 유지돼요'
        : 'V8 로그인 전 · 로그인하면 기기를 바꿔도 진행이 유지되고 매주 첫 판 x' + NS.campaign.config.v8Booster));
    }

    var actions = el('div', 'cv-actions');
    var done = el('button', 'cv-btn cv-btn--primary', '닫기');
    done.type = 'button';
    done.addEventListener('click', close);
    actions.appendChild(done);
    panel.appendChild(actions);
    if (NS.admin) NS.admin.settings(panel);   // landing only: admin tools or "내 계정 ID"
  }

  function privacyNotice(host) {
    var dl = el('dl', 'cv-menu cv-settings__privacy');
    [
      ['수집 항목', '닉네임, 이메일 (가입·비밀번호 없음). 게임 점수와 미션 기록'],
      ['이용 목적', '이메일: 당첨 안내와 중복 참여 방지만. 닉네임: 리더보드 표시'],
      ['보관 기간', '캠페인 종료 후 30일 이내 파기']
    ].forEach(function (r) {
      var row = el('div', 'cv-menu__row');
      row.appendChild(el('dt', '', r[0]));
      row.appendChild(el('dd', '', r[1]));
      dl.appendChild(row);
    });
    host.appendChild(dl);
  }

  /* Games pause while the panel is open ('cv-settings' event, detail.open). */
  function isOpen() { return !!(box && box.classList.contains('is-open')); }
  function announce() { window.dispatchEvent(new CustomEvent('cv-settings', { detail: { open: isOpen() } })); }

  function open() {
    render();
    box.classList.add('is-open');
    announce();
    var first = box.querySelector('.cv-settings__lang.is-on');
    if (first) first.focus();
  }
  function close() { if (!isOpen()) return; box.classList.remove('is-open'); announce(); }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

  /* The icon: a fine gold gear around one caviar pearl — the gold-line, onyx and pearl
     vocabulary of the tins and cards, not a system emoji. */
  var GEAR = '<svg class="cv-settings-btn__icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">' +
    '<path d="M10.13 4.22L10.64 1.89L13.36 1.89L13.87 4.22A8.0 8.0 0 0 1 16.18 5.18L18.19 3.89L20.11 5.81L18.82 7.82A8.0 8.0 0 0 1 19.78 10.13L22.11 10.64L22.11 13.36L19.78 13.87A8.0 8.0 0 0 1 18.82 16.18L20.11 18.19L18.19 20.11L16.18 18.82A8.0 8.0 0 0 1 13.87 19.78L13.36 22.11L10.64 22.11L10.13 19.78A8.0 8.0 0 0 1 7.82 18.82L5.81 20.11L3.89 18.19L5.18 16.18A8.0 8.0 0 0 1 4.22 13.87L1.89 13.36L1.89 10.64L4.22 10.13A8.0 8.0 0 0 1 5.18 7.82L3.89 5.81L5.81 3.89L7.82 5.18A8.0 8.0 0 0 1 10.13 4.22Z" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/>' +
    '<circle cx="12" cy="12" r="4.7" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.6"/>' +
    '<circle cx="12" cy="12" r="2.4" fill="currentColor"/>' +
    '<circle cx="11.25" cy="11.2" r="0.75" fill="#fff" opacity="0.8"/></svg>';

  /** The settings button (icon only; the name is in aria-label / title). */
  function button(extraClass) {
    var b = el('button', 'cv-settings-btn' + (extraClass ? ' ' + extraClass : ''));
    b.type = 'button';
    b.setAttribute('aria-label', '설정');
    b.title = '설정';
    b.innerHTML = GEAR;
    b.addEventListener('click', function () { if (isOpen()) close(); else open(); });
    return b;
  }

  /* Always at the top of the screen:
     - games: the right end of the score bar, above the title / result cards and the board;
     - landing: the left of the top bar (the right holds 빙고 and the menu);
     - content pages and the game host: the header, before the bingo button. */
  var hud = document.querySelector('.cv-hud');
  if (hud) {
    var cols = hud.querySelectorAll('.cv-hud__item').length || 3;
    hud.style.gridTemplateColumns = 'repeat(' + cols + ', minmax(0, 1fr)) auto';
    hud.classList.add('has-settings');
    if (hud.parentNode) hud.parentNode.classList.add('cv-has-hud-settings');   // cards start below the button
    hud.appendChild(button('cv-settings-btn--hud'));
  }
  var lpBar = document.querySelector('.lp-bar');
  if (lpBar) {
    var left = el('div', 'lp-bar__left');
    lpBar.insertBefore(left, lpBar.firstChild);
    left.appendChild(button('cv-settings-btn--bar'));
    var prev = lpBar.querySelector('.lp-bar__prev');
    if (prev) left.appendChild(prev);
  }
  var bar = document.querySelector('.pg-bar, .cv-host__bar');
  if (bar) {
    var bingo = bar.querySelector('#btn-bingo');
    var holder = el('div', 'cv-settings__headbtns');
    if (bingo) { bingo.parentNode.insertBefore(holder, bingo); holder.appendChild(button('cv-settings-btn--bar')); holder.appendChild(bingo); }
    else bar.appendChild(button('cv-settings-btn--bar'));
  }

  NS.settings = { open: open, close: close, isOpen: isOpen, button: button, reduceMotion: reduceMotion };
})(window.CAVIAR = window.CAVIAR || {});
