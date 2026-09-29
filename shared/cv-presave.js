/* NMOI Spotify pre-save — the campaign's goal. Links live in cv-campaign.js (links.presave /
   links.stream). Shown in four places (overview: 선택 · HUD · 결과 · 홈):
     selection   the caviar-can screen of the landing
     HUD         a slim bar under every game's HUD (injected here)
     result      CTA on the result card + this full-screen panel after every run
     home        the landing's table screen
   Click-based (no Spotify check): the click records the pre-save on the server
   (+2 tickets, score x1.2, +1 run per day) and fills the bingo cell.
   From the release date (campaign.releaseDate) every button becomes "listen on Spotify".
   Needs cv-storage, cv-campaign, cv-account, cv-bingo, cv-brand. Styles: cv-bingo.css. */
(function (NS) {
  'use strict';

  var CFG = NS.campaign.config;
  var PRESAVE = {
    albumArt: null,   // e.g. 'assets/brand/album-cover.jpg' (1:1)
    closeAfter: 3     // seconds before the panel can be closed (interstitial feel)
  };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function released() { return NS.campaign.isReleased(); }
  function done() { return !!(NS.account && NS.account.presaved()); }
  function url() { return released() ? CFG.links.stream : CFG.links.presave; }
  function complete() { if (NS.bingo) NS.bingo.completePresave(); else if (NS.account) NS.account.presave(); }
  function ctaLabel() { return released() ? 'Spotify에서 듣기' : 'Spotify에서 Pre-save'; }
  function rewardText() {
    return '응모권 +' + CFG.tickets.presave + ' · 점수 x' + CFG.booster + ' · 하루 1판 더';
  }

  /** Opens Spotify (new tab) and records the click. Returns false when no link yet. */
  function open() {
    var u = url();
    if (!u) return false;
    window.open(u, '_blank', 'noopener');
    if (!released()) complete();
    return true;
  }

  /** Button + (while the link is missing) a labelled empty slot and a demo switch. */
  function linkBlock(onDone) {
    var wrap = el('div', 'cv-presave-link');
    var btn = el('button', 'cv-btn cv-btn--primary cv-presave-link__btn', '▶ ' + ctaLabel());
    btn.type = 'button';
    wrap.appendChild(btn);
    if (!url()) {
      wrap.appendChild(NS.assetSlot({
        name: released() ? 'Spotify 스트리밍 링크 연결 자리' : 'Spotify Pre-save 스마트링크 연결 자리',
        spec: '링크가 들어오면 이 버튼이 Spotify로 연결됩니다 (cv-campaign.js)',
        className: 'cv-presave-link__slot'
      }));
      if (!released()) {
        var demo = el('button', 'cv-presave-link__demo', '데모: 프리세이브 완료로 처리');
        demo.type = 'button';
        demo.addEventListener('click', function () { complete(); if (onDone) onDone(); });
        wrap.appendChild(demo);
      }
    }
    btn.addEventListener('click', function () {
      if (open()) { if (onDone) onDone(); }
      else wrap.classList.add('is-nudge');
    });
    return wrap;
  }

  /** Full-screen panel after a run. */
  function interstitial() {
    var host = document.getElementById('app') || document.body;
    var old = host.querySelector('.cv-presave-ad');
    if (old) old.remove();

    var ad = el('div', 'cv-presave-ad');
    ad.setAttribute('role', 'dialog');
    ad.setAttribute('aria-label', released() ? 'NMOI Spotify' : 'NMOI Spotify 프리세이브');

    var close = el('button', 'cv-presave-ad__close', String(PRESAVE.closeAfter));
    close.type = 'button';
    close.disabled = true;
    close.setAttribute('aria-label', '닫기');
    ad.appendChild(close);

    var body = el('div', 'cv-presave-ad__body');
    body.appendChild(el('p', 'cv-presave-ad__eyebrow', released() ? 'NMOI · OUT NOW' : 'NMOI · NEW RELEASE'));
    body.appendChild(NS.assetSlot({ name: '앨범 커버 이미지', spec: '정사각형 1:1', src: PRESAVE.albumArt, className: 'cv-presave-ad__art' }));
    body.appendChild(el('h2', 'cv-presave-ad__title', released() ? 'Listen on Spotify' : 'Pre-save on Spotify'));
    var sub = el('p', 'cv-presave-ad__sub');
    body.appendChild(sub);
    var after = el('div');
    body.appendChild(after);
    ad.appendChild(body);

    function render() {
      after.innerHTML = '';
      if (released()) {
        sub.textContent = 'NMOI 신곡이 나왔어요. 지금 Spotify에서 들어보세요.';
        after.appendChild(linkBlock());
      } else if (done()) {
        sub.textContent = '프리세이브 완료! 응모권 +' + CFG.tickets.presave + ' · 점수 x' + CFG.booster + ' 부스터가 적용됐어요.';
        var ok = el('button', 'cv-btn cv-btn--primary cv-presave-link__btn', '계속하기');
        ok.type = 'button';
        ok.addEventListener('click', dismiss);
        after.appendChild(ok);
        return;
      } else {
        sub.textContent = '발매 전에 미리 저장하면 ' + rewardText() + '!';
        after.appendChild(linkBlock(render));
      }
      var later = el('button', 'cv-presave-ad__later', '나중에 할게요');
      later.type = 'button';
      later.addEventListener('click', dismiss);
      after.appendChild(later);
    }

    function dismiss() {
      ad.classList.add('is-leaving');
      setTimeout(function () { ad.remove(); }, 350);
    }

    var left = PRESAVE.closeAfter;
    var timer = setInterval(function () {
      left -= 1;
      if (left > 0) { close.textContent = String(left); return; }
      clearInterval(timer);
      close.textContent = '×';
      close.disabled = false;
    }, 1000);
    close.addEventListener('click', dismiss);

    render();
    host.appendChild(ad);
  }

  /** Slim pre-save button for the selection screen, the home screen and game HUDs. */
  function chip(extraClass) {
    var b = el('button', 'cv-presave-chip' + (extraClass ? ' ' + extraClass : ''));
    b.type = 'button';
    function render() {
      b.innerHTML = '';
      b.classList.toggle('is-done', done() && !released());
      if (released()) {
        b.appendChild(el('b', '', '▶ SPOTIFY'));
        b.appendChild(el('span', '', 'NMOI 신곡 듣기'));
      } else if (done()) {
        b.appendChild(el('b', '', 'PRE-SAVED'));
        b.appendChild(el('span', '', '부스터 x' + CFG.booster + ' 적용 중 · 응모권 ' + NS.account.state().tickets + '장'));
      } else {
        b.appendChild(el('b', '', '▶ PRE-SAVE'));
        b.appendChild(el('span', '', rewardText()));
      }
    }
    b.addEventListener('click', function () { if (released() || !done()) interstitial(); });
    render();
    if (NS.account) NS.account.onChange(render);
    return b;
  }

  // HUD: every game page gets the pre-save bar right under its HUD.
  var hud = document.querySelector('.cv-app > .cv-hud');
  if (hud && document.getElementById('screen-title')) hud.insertAdjacentElement('afterend', chip('cv-presave-chip--hud'));

  NS.presave = { open: open, linkBlock: linkBlock, interstitial: interstitial, chip: chip, isDone: done, config: PRESAVE };
})(window.CAVIAR = window.CAVIAR || {});
