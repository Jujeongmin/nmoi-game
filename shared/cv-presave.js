/* n Moi Spotify pre-save — the campaign's goal. Links live in cv-campaign.js (links.presave /
   links.stream). A booster, not an ad (overview §5) — never interrupts a run:
     S2 booster  before the first run, once: 기본 캔 vs 알마스 캔 (= pre-save) — boosterChoice()
     HUD         multiplier under every game's HUD: x1.0 grey / x1.2 gold (injected here)
     result      booster nudge on the result card (cv-bingo-ui.js) — the only re-offer
     home        the landing's table and can screens (chip)
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

  var store = NS.storage.scope('presave');

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
    NS.track(released() ? 'stream_click' : 'presave_click', {});
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

  /** Full-screen pre-save panel (opened from a chip or a CTA, never on its own). */
  function interstitial() {
    var host = document.getElementById('app') || document.body;
    var old = host.querySelector('.cv-presave-ad');
    if (old) old.remove();

    var ad = el('div', 'cv-presave-ad');
    ad.setAttribute('role', 'dialog');
    ad.setAttribute('aria-label', released() ? 'n Moi Spotify' : 'n Moi Spotify 프리세이브');

    var close = el('button', 'cv-presave-ad__close', String(PRESAVE.closeAfter));
    close.type = 'button';
    close.disabled = true;
    close.setAttribute('aria-label', '닫기');
    ad.appendChild(close);

    var body = el('div', 'cv-presave-ad__body');
    body.appendChild(el('p', 'cv-presave-ad__eyebrow', released() ? 'n Moi · OUT NOW' : 'n Moi · NEW RELEASE'));
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
        sub.textContent = 'n Moi 신곡이 나왔어요. 지금 Spotify에서 들어보세요.';
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

  /** S2 — before the first run, once: 기본 캔 (no booster) or 알마스 캔 (Spotify pre-save →
      x1.2, +1 run a day, invite link). Skippable. Resolves when the run may start. */
  function boosterChoice() {
    if (done() || released() || store.get('boosterAsked', '')) return Promise.resolve();
    store.set('boosterAsked', '1');
    return new Promise(function (resolve) {
      var host = document.getElementById('app') || document.body;
      var box = el('div', 'cv-overlay cv-booster is-open');
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-label', '부스터 선택');
      var panel = el('div', 'cv-panel');
      box.appendChild(panel);

      function finish() { box.remove(); resolve(); }

      function can(cls, art, name, sub) {
        var b = el('button', 'cv-booster__can ' + cls);
        b.type = 'button';
        var img = el('img', 'cv-booster__art');
        img.src = NS.url(art);
        img.alt = '';
        b.appendChild(img);
        b.appendChild(el('b', 'cv-booster__name', name));
        b.appendChild(el('span', 'cv-booster__sub', sub));
        return b;
      }

      function choose() {
        panel.innerHTML = '';
        panel.appendChild(el('p', 'cv-eyebrow', 'BOOSTER'));
        panel.appendChild(el('h2', 'cv-booster__title', '어떤 캔으로 시작할까요?'));
        var row = el('div', 'cv-booster__cans');
        var basic = can('is-basic', 'assets/bingo/tin-empty.webp', '기본 캔', '부스터 없이 바로 시작');
        var almas = can('is-almas', 'assets/bingo/tin-almas.webp', '알마스 캔', 'Spotify 프리세이브 10초 → 점수 x' + CFG.booster + ' · 하루 1판 더 · 내 초대 링크');
        basic.addEventListener('click', function () { NS.track('booster_choice', { choice: 'basic' }); finish(); });
        almas.addEventListener('click', function () {
          NS.track('booster_choice', { choice: 'almas' });
          if (!open()) complete();   // no smart link yet (demo): record the pre-save directly
          active();
        });
        row.appendChild(basic);
        row.appendChild(almas);
        panel.appendChild(row);
        var skip = el('button', 'cv-booster__skip', '건너뛰기');
        skip.type = 'button';
        skip.addEventListener('click', function () { NS.track('booster_choice', { choice: 'skip' }); finish(); });
        panel.appendChild(skip);
      }

      // S5 — back from Spotify: the booster is on, here is the invite link.
      function active() {
        panel.innerHTML = '';
        panel.appendChild(el('p', 'cv-eyebrow', 'ALMAS CAN'));
        panel.appendChild(el('h2', 'cv-booster__title', '알마스 캔 활성!'));
        panel.appendChild(el('p', 'cv-body cv-booster__text', '이제 매 판 점수 x' + CFG.booster + ' · 하루 1판 더 · 응모권 +' + CFG.tickets.presave +
          (url() ? '' : ' (데모: 스마트링크 연결 전이라 바로 완료 처리)')));
        var link = NS.account && NS.account.inviteLink();
        if (link && navigator.clipboard) {
          var copy = el('button', 'cv-booster__skip', '내 초대 링크 복사');
          copy.type = 'button';
          copy.addEventListener('click', function () {
            navigator.clipboard.writeText(link).then(function () { copy.textContent = '복사했어요'; }, function () {});
          });
          panel.appendChild(copy);
        }
        var go = el('div', 'cv-actions');
        var start = el('button', 'cv-btn cv-btn--primary', '게임 시작');
        start.type = 'button';
        start.addEventListener('click', finish);
        go.appendChild(start);
        panel.appendChild(go);
      }

      choose();
      host.appendChild(box);
    });
  }

  /** Slim pre-save button for the selection screen, the home screen and game HUDs. */
  function chip(extraClass) {
    var b = el('button', 'cv-presave-chip' + (extraClass ? ' ' + extraClass : ''));
    var hudChip = /cv-presave-chip--hud/.test(extraClass || '');
    var progress = el('em', 'cv-presave-chip__mission');
    b.type = 'button';
    if (hudChip) {
      (function tick() {
        var live = NS.live, need = live && NS.bingo && NS.bingo.scoreMission(live.gameId);
        var score = live && live.score();
        if (need && score !== null && score !== undefined) {
          var boosted = Math.floor(score * (NS.account ? NS.account.runMultiplier(live.gameId) : 1));
          progress.textContent = '미션 ' + Math.min(100, Math.floor(boosted / need.need * 100)) + '%';
        } else progress.textContent = '';
        requestAnimationFrame(tick);
      })();
    }
    function render() {
      b.innerHTML = '';
      b.classList.toggle('is-done', done() && !released());
      b.classList.toggle('is-off', hudChip && !done() && !released());
      if (hudChip) {
        // HUD (overview §5, S3): multiplier x1.0 grey / x1.2 gold / x1.5 V8 weekly, and the
        // score mission's progress while a run is on.
        var m = NS.account ? NS.account.multiplier() : 1;
        b.classList.toggle('is-off', m <= 1);
        b.appendChild(el('b', '', 'x' + m.toFixed(1)));
        b.appendChild(el('span', '', m === CFG.v8Booster ? 'V8 주간 첫 판 부스터' : m > 1 ? '알마스 캔 부스터 적용 중'
          : released() ? 'n Moi 신곡 듣기' : '프리세이브하면 매 판 x' + CFG.booster));
        b.appendChild(progress);
      } else if (released()) {
        b.appendChild(el('b', '', '▶ SPOTIFY'));
        b.appendChild(el('span', '', 'n Moi 신곡 듣기'));
      } else if (done()) {
        b.appendChild(el('b', '', 'PRE-SAVED'));
        b.appendChild(el('span', '', '부스터 x' + CFG.booster + ' 적용 중 · 응모권 ' + NS.account.state().tickets + '장'));
      } else {
        b.appendChild(el('b', '', '▶ PRE-SAVE'));
        b.appendChild(el('span', '', rewardText()));
      }
    }
    b.addEventListener('click', function () {
      if (released() || !done()) { NS.track('presave_panel', { where: hudChip ? 'hud' : 'chip' }); interstitial(); }
    });
    render();
    if (NS.account) NS.account.onChange(render);
    return b;
  }

  // HUD: every game page gets the pre-save bar right under its HUD.
  var hud = document.querySelector('.cv-app > .cv-hud');
  if (hud && document.getElementById('screen-title')) hud.insertAdjacentElement('afterend', chip('cv-presave-chip--hud'));

  NS.presave = { open: open, linkBlock: linkBlock, interstitial: interstitial, boosterChoice: boosterChoice, chip: chip, isDone: done, config: PRESAVE };
})(window.CAVIAR = window.CAVIAR || {});
