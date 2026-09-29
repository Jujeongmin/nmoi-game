/* NMOI Spotify pre-save: one place for the link, the full-screen panel shown after
   every game run, and the "open pre-save" action used by the bingo board.
   Needs cv-storage.js (+ cv-brand.js for asset slots). Styles: cv-bingo.css.

   The pre-save is self-reported for now (no Spotify API): opening the link fills the
   bingo cell. Leave URL empty to show the "link goes here" slot in the demo. */
(function (NS) {
  'use strict';

  var PRESAVE = {
    url: '',          // TODO: NMOI Spotify pre-save link
    albumArt: null,   // e.g. 'assets/brand/album-cover.jpg' (1:1)
    closeAfter: 3     // seconds before the panel can be closed (interstitial feel)
  };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function done() { return !!(NS.bingo && NS.bingo.isDone('presave')); }
  function complete() { if (NS.bingo) NS.bingo.completePresave(); }

  /** Opens Spotify (new tab) and fills the bingo cell. Returns false when no link yet. */
  function open() {
    if (!PRESAVE.url) return false;
    window.open(PRESAVE.url, '_blank', 'noopener');
    complete();
    return true;
  }

  /** The link slot: a real button when the URL exists, otherwise a labelled empty slot. */
  function linkBlock(onDone) {
    var wrap = el('div', 'cv-presave-link');
    var btn = el('button', 'cv-btn cv-btn--primary cv-presave-link__btn', 'Spotify에서 Pre-save');
    btn.type = 'button';
    wrap.appendChild(btn);
    if (!PRESAVE.url) {
      wrap.appendChild(NS.assetSlot({
        name: 'Spotify Pre-save 링크 연결 자리',
        spec: 'NMOI 프리세이브 URL이 들어오면 이 버튼이 Spotify로 연결됩니다',
        className: 'cv-presave-link__slot'
      }));
      var demo = el('button', 'cv-presave-link__demo', '데모: 프리세이브 완료로 처리');
      demo.type = 'button';
      demo.addEventListener('click', function () { complete(); if (onDone) onDone(); });
      wrap.appendChild(demo);
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
    ad.setAttribute('aria-label', 'NMOI Spotify 프리세이브');

    var close = el('button', 'cv-presave-ad__close', String(PRESAVE.closeAfter));
    close.type = 'button';
    close.disabled = true;
    close.setAttribute('aria-label', '닫기');
    ad.appendChild(close);

    var body = el('div', 'cv-presave-ad__body');
    body.appendChild(el('p', 'cv-presave-ad__eyebrow', 'NMOI · NEW RELEASE'));
    body.appendChild(NS.assetSlot({ name: '앨범 커버 이미지', spec: '정사각형 1:1', src: PRESAVE.albumArt, className: 'cv-presave-ad__art' }));
    body.appendChild(el('h2', 'cv-presave-ad__title', 'Pre-save on Spotify'));
    var sub = el('p', 'cv-presave-ad__sub');
    body.appendChild(sub);
    var after = el('div');
    body.appendChild(after);
    ad.appendChild(body);

    function render() {
      after.innerHTML = '';
      if (done()) {
        sub.textContent = '프리세이브 완료! 빙고 칸이 채워졌어요. 발매일에 가장 먼저 만나요.';
        var ok = el('button', 'cv-btn cv-btn--primary cv-presave-link__btn', '계속하기');
        ok.type = 'button';
        ok.addEventListener('click', dismiss);
        after.appendChild(ok);
      } else {
        sub.textContent = '발매 전에 미리 저장하고, 미션 빙고의 프리세이브 칸을 채워보세요.';
        after.appendChild(linkBlock(render));
        var later = el('button', 'cv-presave-ad__later', '나중에 할게요');
        later.type = 'button';
        later.addEventListener('click', dismiss);
        after.appendChild(later);
      }
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

  NS.presave = { config: PRESAVE, open: open, linkBlock: linkBlock, interstitial: interstitial, isDone: done };
})(window.CAVIAR = window.CAVIAR || {});
