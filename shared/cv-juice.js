/* Game feel for every campaign game, inside the menu-card look (styles in cv-theme.css, "Juice").
   Nothing here draws a picture: cards, type and the wax seal art do the looking, this moves them.

   CAVIAR.juice.enter(overlay)               the card unfolds like a menu, its lines rise in turn
   CAVIAR.juice.countUp(el, value, digits)   the result score counts up from zero (ticks), returns a promise
   CAVIAR.juice.seal(panel)                  a new record: the wax seal is pressed onto the card
   CAVIAR.juice.roller(el, digits)           .set(value, live) — a HUD number that rolls toward its value
   CAVIAR.juice.banner(host)                 .show(label, sub, ms) — a gold-ruled band across the stage
   CAVIAR.juice.restart(el, cls)             replay a CSS animation class
   Reduce motion (OS setting): everything lands in its end state at once. */
(function (NS) {
  'use strict';

  function calm() { return !!(NS.settings && NS.settings.reduceMotion && NS.settings.reduceMotion()); }
  function pad(n, len) { var s = String(Math.max(0, Math.floor(n))); while (s.length < len) s = '0' + s; return s; }
  function restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  function play(name) { if (NS.sound) NS.sound.play(name); }

  /* The seal art is shared by all games (assets/menu/seal.webp), loaded once. */
  var sealImg = null;
  function sealEl() {
    if (!sealImg) {
      sealImg = new Image();
      sealImg.className = 'cv-seal';
      sealImg.alt = '';
      sealImg.src = NS.url ? NS.url('assets/menu/seal.webp') : 'assets/menu/seal.webp';
    }
    return sealImg;
  }
  sealEl();

  function enter(overlay) {
    var panel = overlay && overlay.querySelector('.cv-panel');
    if (!panel) return;
    if (sealImg && sealImg.parentNode === panel) panel.removeChild(sealImg);
    var kids = panel.children;
    for (var i = 0; i < kids.length; i++) kids[i].style.setProperty('--i', i);
    restart(panel, 'is-entering');
  }

  // fmt(n): optional text for a value (a time record) instead of the zero-padded score.
  function countUp(el, value, digits, fmt) {
    digits = digits || 5;
    var show = fmt || function (n) { return pad(n, digits); };
    if (el._countRaf) cancelAnimationFrame(el._countRaf);
    var dur = calm() ? 0 : Math.min(1400, 500 + value / 12);
    if (!dur) { el.textContent = show(value); return Promise.resolve(); }
    return new Promise(function (resolve) {
      var start = 0, ticked = 0, done = false;
      el.textContent = show(0);
      function finish() {
        if (done) return;
        done = true;
        cancelAnimationFrame(el._countRaf);
        el._countRaf = 0;
        el.textContent = show(value);
        resolve();
      }
      function step(now) {
        if (done) return;
        if (!start) start = now;
        var q = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - q, 3);
        el.textContent = show(fmt ? Math.round(value * e) : value * e);
        if (now - ticked > 70 && q < 1) { ticked = now; play('tap'); }
        if (q < 1) el._countRaf = requestAnimationFrame(step); else finish();
      }
      el._countRaf = requestAnimationFrame(step);
      // Frames stop in a hidden tab: the real score is there anyway shortly after.
      setTimeout(finish, dur + 400);
    });
  }

  function seal(panel) {
    if (!panel) return;
    var s = sealEl();
    panel.appendChild(s);
    restart(s, 'is-stamped');
    restart(panel, 'is-thud');
    play('drop');
  }

  function roller(el, digits) {
    var shown = 0, last = 0, cache = null;
    return {
      set: function (value, live) {
        var now = performance.now(), dt = Math.min(0.1, (now - (last || now)) / 1000);
        last = now;
        if (value < shown || !live || calm()) shown = value;
        else shown = Math.min(value, shown + (value - shown) * Math.min(1, dt * 9) + 0.5);
        var text = pad(shown, digits || 5);
        if (text !== cache) { cache = text; el.textContent = text; }
      }
    };
  }

  /* A band across a stage: gold hairlines above and below, the menu divider under the label,
     a light passing over it. Shown for `ms`, then it folds away (timers, so reduce motion works). */
  function banner(host) {
    var b = document.createElement('div');
    b.className = 'cv-banner';
    b.setAttribute('aria-live', 'polite');
    b.innerHTML = '<span class="cv-banner__line" aria-hidden="true"></span>' +
      '<strong class="cv-banner__label"></strong>' +
      '<img class="cv-banner__rule" alt="" src="' + (NS.url ? NS.url('assets/menu/divider.webp') : 'assets/menu/divider.webp') + '">' +
      '<span class="cv-banner__sub"></span>';
    host.appendChild(b);
    var label = b.querySelector('.cv-banner__label'), sub = b.querySelector('.cv-banner__sub');
    var timers = [];
    function hide() {
      timers.forEach(clearTimeout); timers = [];
      b.classList.remove('is-shown', 'is-leaving');
    }
    return {
      el: b,
      show: function (text, subText, ms) {
        hide();
        label.textContent = text;
        sub.textContent = subText || '';
        sub.hidden = !subText;
        restart(b, 'is-shown');
        ms = ms || 1800;
        timers = [setTimeout(function () { b.classList.add('is-leaving'); }, ms),
                  setTimeout(hide, ms + 400)];
      },
      hide: hide
    };
  }

  NS.juice = { enter: enter, countUp: countUp, seal: seal, roller: roller, banner: banner, restart: restart, pad: pad };
})(window.CAVIAR = window.CAVIAR || {});
