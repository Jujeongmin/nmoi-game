/* Verse8 branding + asset slots. Needs cv-storage.js (CAVIAR.url).

   CAVIAR.assetSlot({ name, spec, src, className })
     -> <img> when `src` is set, otherwise a labelled placeholder frame that shows
        where the real asset goes (for demos: "이 자리에 ○○ 이미지가 들어옵니다").

   CAVIAR.brand.splash({ once })   Verse8 splash over the page (tap to skip) — shown when a game opens.
   CAVIAR.brand.badge(panel)       Verse8 logo line at the bottom of a result card.

   Real files: set BRAND.splash / BRAND.logo (paths from the site root). */
(function (NS) {
  'use strict';

  var BRAND = {
    splash: null,   // e.g. 'assets/brand/verse8-splash.png'  (portrait, 1080x1920 recommended)
    logo: null,     // e.g. 'assets/brand/verse8-logo.png'    (transparent, wide)
    splashMs: 1500
  };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  NS.assetSlot = function (o) {
    if (o.src) {
      var img = el('img', 'cv-asset-img' + (o.className ? ' ' + o.className : ''));
      img.src = NS.url(o.src);
      img.alt = o.alt || '';
      return img;
    }
    var box = el('div', 'cv-asset' + (o.className ? ' ' + o.className : ''));
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label', o.name + ' (에셋 자리)');
    box.appendChild(el('span', 'cv-asset__tag', 'ASSET'));
    box.appendChild(el('span', 'cv-asset__name', o.name));
    if (o.spec) box.appendChild(el('span', 'cv-asset__spec', o.spec));
    return box;
  };

  function host() { return document.getElementById('app') || document.body; }

  NS.brand = {
    config: BRAND,

    /** Full-screen Verse8 splash. once: session key — shown only the first time. */
    splash: function (opts) {
      opts = opts || {};
      if (opts.once) {
        try {
          if (sessionStorage.getItem('cv-splash:' + opts.once)) return;
          sessionStorage.setItem('cv-splash:' + opts.once, '1');
        } catch (e) { /* storage blocked: show it */ }
      }
      var wrap = el('div', 'cv-splash');
      wrap.setAttribute('role', 'presentation');
      wrap.appendChild(NS.assetSlot({
        name: 'Verse8 Splash Image',
        spec: '게임 시작 시 노출 · 세로 1080×1920 권장',
        src: BRAND.splash,
        className: 'cv-splash__art'
      }));
      wrap.appendChild(el('p', 'cv-splash__skip', '화면을 누르면 넘어갑니다'));
      var done = false;
      function close() {
        if (done) return;
        done = true;
        wrap.classList.add('is-leaving');
        setTimeout(function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 450);
      }
      wrap.addEventListener('click', close);
      host().appendChild(wrap);
      setTimeout(close, opts.ms || BRAND.splashMs);
    },

    /** "Verse8" line under a result card. */
    badge: function (panel) {
      if (!panel || panel.querySelector('.cv-brand-badge')) return;
      var row = el('div', 'cv-brand-badge');
      row.appendChild(el('span', 'cv-brand-badge__label', 'POWERED BY'));
      row.appendChild(BRAND.logo
        ? NS.assetSlot({ src: BRAND.logo, className: 'cv-brand-badge__logo', alt: 'Verse8' })
        : NS.assetSlot({ name: 'Verse8 로고', className: 'cv-asset--inline' }));
      panel.appendChild(row);
    }
  };

  // Verse8 splash only when a game starts (every game page has #screen-title); not on the landing or content pages.
  if (document.getElementById('screen-title')) NS.brand.splash();
})(window.CAVIAR = window.CAVIAR || {});
