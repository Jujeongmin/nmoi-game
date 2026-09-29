/* Verse8 branding + asset slots. Needs cv-storage.js (CAVIAR.url).

   CAVIAR.assetSlot({ name, spec, src, className })
     -> <img> when `src` is set, otherwise a labelled placeholder frame that shows
        where the real asset goes (for demos: "이 자리에 ○○ 이미지가 들어옵니다").

   CAVIAR.brand.splash()          official Verse8 splash (shared/verse8-splash, unmodified
                                  vendor module) — shown when a game page opens.
   CAVIAR.brand.badge(panel)      "POWERED BY Verse8" line at the bottom of a result card.

   Files (paths from the site root) are in BRAND below. */
(function (NS) {
  'use strict';

  var BRAND = {
    module: 'shared/verse8-splash/VerseSplash.js',   // Verse8 Splash Module (ESM, default export)
    logoSvg: 'assets/brand/verse8_logo_light.svg',   // animated wordmark + "8"
    logo: 'assets/brand/verse8_logo_light.png',      // white logo: used on a dark chip
    sound: 'assets/brand/splash.mp3'
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

  NS.brand = {
    config: BRAND,

    /** Official Verse8 splash (min 2.4 s, then fades into the page). */
    splash: function () {
      var html = document.documentElement;
      // Anti-flash: hide the page until the splash covers it (see .cv-app rule in cv-theme.css).
      html.setAttribute('data-splash-active', 'true');
      import(NS.url(BRAND.module)).then(function (mod) {
        var splash = new mod.default({
          logoSrc: NS.url(BRAND.logoSvg),
          soundSrc: NS.url(BRAND.sound),
          // our sound switch doubles as the "audio enabled" state
          isAudioEnabled: function () { return !(NS.sound && NS.sound.muted()); }
        });
        return splash.show().then(function () { return splash.hide(); });
      }).catch(function (err) {
        console.warn('[cv-brand] Verse8 splash unavailable:', err);
        html.removeAttribute('data-splash-active');   // never leave the game hidden
      });
    },

    /** "POWERED BY [Verse8]" under a result card or the bingo board. */
    badge: function (panel) {
      if (!panel || panel.querySelector('.cv-brand-badge')) return;
      var row = el('div', 'cv-brand-badge');
      row.appendChild(el('span', 'cv-brand-badge__label', 'POWERED BY'));
      var chip = el('span', 'cv-brand-badge__chip');
      chip.appendChild(NS.assetSlot({ src: BRAND.logo, className: 'cv-brand-badge__logo', alt: 'Verse8' }));
      row.appendChild(chip);
      panel.appendChild(row);
    }
  };

  // Verse8 splash only when a game opens (every game page has #screen-title);
  // not on the landing or the content pages.
  if (document.getElementById('screen-title')) NS.brand.splash();
})(window.CAVIAR = window.CAVIAR || {});
