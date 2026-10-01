/* Verse8 branding + asset slots. Needs cv-storage.js (CAVIAR.url).

   CAVIAR.assetSlot({ name, spec, src, className })
     -> <img> when `src` is set, otherwise a labelled placeholder frame that shows
        where the real asset goes (for demos: "이 자리에 ○○ 이미지가 들어옵니다").

   CAVIAR.brand.splash()          official Verse8 splash (shared/verse8-splash, unmodified
                                  vendor module) — shown once when the site is opened.
   CAVIAR.brand.footer()          KREATORS. × VERSE8 strip fixed to the bottom of every page
                                  (added by this file on load).

   Files (paths from the site root) are in BRAND below. */
(function (NS) {
  'use strict';

  var BRAND = {
    module: 'shared/verse8-splash/VerseSplash.js',   // Verse8 Splash Module (ESM, default export)
    logoSvg: 'assets/brand/verse8_logo_light.svg',   // animated wordmark + "8"
    logo: 'assets/brand/verse8_logo_light.png',      // white logo: used on a dark chip
    sound: 'assets/brand/splash.mp3',
    kreators: 'assets/brand/kreators-white.png',     // partner logo, white (footer strip)
    verse8: 'assets/brand/verse8-white.png'          // Verse8 wordmark, white (footer strip)
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
    /* The partner strip: on every page, always at the bottom (the pages leave its height free). */
    footer: function () {
      if (document.querySelector('.cv-footer')) return;
      var bar = el('div', 'cv-footer');
      bar.setAttribute('role', 'contentinfo');
      var k = el('img', 'cv-footer__logo cv-footer__logo--kreators');
      k.src = NS.url(BRAND.kreators);
      k.alt = 'KREATORS.';
      var v = el('img', 'cv-footer__logo cv-footer__logo--verse8');
      v.src = NS.url(BRAND.verse8);
      v.alt = 'Verse8';
      bar.appendChild(k);
      bar.appendChild(el('span', 'cv-footer__x', '×'));
      bar.appendChild(v);
      document.body.appendChild(bar);
      document.documentElement.classList.add('cv-has-footer');
    }
  };

  if (document.body) NS.brand.footer();
  else document.addEventListener('DOMContentLoaded', function () { NS.brand.footer(); });

  // Verse8 splash once per visit: on the first page opened (normally the landing, or a
  // game opened by a direct link), never again when moving between pages of the site.
  var SHOWN = 'caviar-campaign:splash-shown';
  function splashShown() {
    try { return window.sessionStorage.getItem(SHOWN) === '1'; } catch (e) { return false; }
  }
  // Internal moves (?from=hub game links, the landing's #cans return) also count as
  // "already shown" so a blocked sessionStorage never replays it inside the site.
  var internal = (NS.hub && NS.hub.fromHub) || window.location.hash === '#cans';
  if (!splashShown() && !internal) {
    try { window.sessionStorage.setItem(SHOWN, '1'); } catch (e) { /* show once per page load */ }
    NS.brand.splash();
  }
})(window.CAVIAR = window.CAVIAR || {});
