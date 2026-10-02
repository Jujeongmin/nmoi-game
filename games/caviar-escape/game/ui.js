/* CAVIAR ESCAPE — DOM UI: HUD, callouts, title card, result card.
   Only reads game state; user actions are reported through on(name, fn).
   The look is the campaign's menu card (cv-theme.css); what makes it feel like a game is motion:
   cards unfold and their lines rise in turn, the score rolls, the result counts up and a new
   record is sealed with a wax stamp. */
(function (NS) {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function pad(n, len) { var s = String(Math.max(0, Math.floor(n))); while (s.length < len) s = '0' + s; return s; }
  function restartClass(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  /* Point a .ce-sprite element at one animation row of a member sheet.
     cellPx: display size of one cell; boxW: element width; top: px above the head. */
  var assetRoot = '';

  function applySprite(el, member, anim, cellPx, boxW, top, play) {
    var b = member.bounds, k = cellPx / member.cell;
    NS.sprite.show(el, member, anim, { cell: cellPx, ox: boxW / 2 - (b.x + b.w / 2) * k, oy: top - b.y * k, play: !!play });
  }

  function UI(config) {
    this.cfg = config;
    assetRoot = config.assetRoot || '';
    this.handlers = {};
    this.cache = {};
    this.el = {
      stage: $('stage'),
      stageNum: $('hud-stage'),
      time: $('hud-time'),
      timeItem: $('hud-time-item'),
      score: $('hud-score'),
      scoreItem: $('hud-score-item'),
      best: $('hud-best'),
      lives: Array.prototype.slice.call(document.querySelectorAll('#hud-lives .cv-pearl')),
      callout: $('callout'),
      banner: $('banner'),
      bannerLabel: $('banner-label'),
      bannerSub: $('banner-sub'),
      combo: $('combo'),
      comboMult: $('combo-mult'),
      comboBar: $('combo-bar'),
      title: $('screen-title'),
      titleBest: $('title-best'),
      result: $('screen-result'),
      resultTitle: $('result-title'),
      resultScore: $('result-score'),
      resultBest: $('result-best'),
      resultNew: $('result-new'),
      picker: $('member-picker'),
      memberName: $('member-name'),
      btnStart: $('btn-start'),
      btnRetry: $('btn-retry'),
      btnBack: $('btn-back')
    };

    var self = this;
    this.el.stageNum.textContent = pad(config.stage, 2);
    this.shownScore = 0;
    this.lastFrame = 0;
    this.seal = new Image();   // the wax seal for a new record (preloaded, stamped on the result card)
    this.seal.className = 'ce-seal';
    this.seal.alt = '';
    this.seal.src = assetRoot + 'assets/escape/fx/seal.webp';
    this.el.btnStart.addEventListener('click', function () { self._fire('start'); });
    this.el.btnRetry.addEventListener('click', function () { self._fire('retry'); });
    this.el.btnBack.addEventListener('click', function () { self._fire('back'); });
  }

  var P = UI.prototype;

  P.on = function (name, fn) { this.handlers[name] = fn; };
  P._fire = function (name, arg) { if (this.handlers[name]) this.handlers[name](arg); };

  /* ---------- member picker ---------- */
  P.buildPicker = function (members) {
    var self = this, row = this.el.picker;
    this.members = members;
    this.memberButtons = [];
    row.innerHTML = '';
    this.memberList = [];
    members.forEach(function (m) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ce-member';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', m.name);
      b.dataset.id = m.id;
      applySprite(b, m, 'idle', 88, 46, 4, false);
      b.addEventListener('click', function () { self._fire('member', m.id); });
      row.appendChild(b);
      self.memberButtons.push(b);
      self.memberList.push(m);
    });
  };

  P.setMember = function (member) {
    this.member = member;
    for (var i = 0; i < this.memberButtons.length; i++) {
      var b = this.memberButtons[i], on = b.dataset.id === member.id;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      applySprite(b, this.memberList[i], 'idle', 88, 46, 4, on);   // the chosen member breathes
    }
    this.el.memberName.textContent = member.name;
  };

  P._set = function (key, el, text) {
    if (this.cache[key] === text) return;
    this.cache[key] = text;
    el.textContent = text;
  };

  /* ---------- per-frame HUD ---------- */
  P.update = function (game, best) {
    var el = this.el;
    var playing = game.phase === 'play';
    var t = game.phase === 'idle' || game.phase === 'countdown' ? this.cfg.duration : Math.ceil(game.timeLeft);

    this._set('time', el.time, pad(t, 2));

    // The score rolls toward its value instead of jumping.
    var now = performance.now(), dt = Math.min(0.1, (now - (this.lastFrame || now)) / 1000);
    this.lastFrame = now;
    var target = game.getScore();
    if (target < this.shownScore || !playing) this.shownScore = target;
    else this.shownScore = Math.min(target, this.shownScore + (target - this.shownScore) * Math.min(1, dt * 9) + 0.5);
    this._set('score', el.score, pad(this.shownScore, 5));
    this._set('best', el.best, pad(best, 5));

    var low = playing && t <= 5;
    if (this.cache.low !== low) { this.cache.low = low; el.timeItem.classList.toggle('is-alert', low); }

    if (this.cache.lives !== game.lives) {
      this.cache.lives = game.lives;
      // A +1 life booster adds a pearl for this run.
      while (el.lives.length < game.lives) {
        var pearl = document.createElement('span');
        pearl.className = 'cv-pearl cv-pearl--gold';
        el.lives[0].parentNode.appendChild(pearl);
        el.lives.push(pearl);
      }
      for (var i = 0; i < el.lives.length; i++) el.lives[i].classList.toggle('is-empty', i >= game.lives);
    }

    this._updateCallout(game);
    this._updateCombo(game);
  };

  /* "×3 COMBO" under the HUD; the gold hairline under it is the time left in the chain. */
  P._updateCombo = function (game) {
    var el = this.el, on = game.phase === 'play' && game.combo >= 2;
    if (this.cache.comboOn !== on) { this.cache.comboOn = on; el.combo.classList.toggle('is-on', on); }
    if (!on) { this.cache.mult = 0; return; }
    var label = game.mult >= 2 ? '\u00d7' + game.mult : String(game.combo);
    if (this.cache.comboLabel !== label) {
      this.cache.comboLabel = label;
      el.comboMult.textContent = label;
      el.combo.classList.toggle('is-mult', game.mult >= 2);
    }
    if (this.cache.mult !== game.mult) {
      if (this.cache.mult && game.mult > this.cache.mult) restartClass(el.combo, 'is-pop');
      this.cache.mult = game.mult;
    }
    el.comboBar.style.transform = 'scaleX(' + game.comboLeft().toFixed(3) + ')';
  };

  /* 3-2-1 in the campaign's Roman capitals, then 출발; success / game over when the run ends. */
  P._updateCallout = function (game) {
    var text = '', kind = 'word';
    if (game.phase === 'countdown') {
      text = String(Math.max(1, Math.ceil(game.countdownLeft() / (this.cfg.countdown / 3))));
      kind = 'number';
    } else if (game.phase === 'play' && game.phaseTime < 0.8) {
      text = '출발';
      kind = 'go';
    } else if (game.isOver() && !this.el.result.classList.contains('is-open')) {
      text = game.phase === 'clear' ? '성공' : '게임 오버';
    }
    if (this.cache.callout === text) return;
    this.cache.callout = text;
    var c = this.el.callout;
    c.textContent = text;
    c.dataset.kind = kind;
    if (text) restartClass(c, 'is-shown'); else c.classList.remove('is-shown');
  };

  /* ---------- feedback ---------- */
  P.bonusFeedback = function () {
    restartClass(this.el.scoreItem, 'is-flash');
    restartClass(this.el.score, 'is-pop');
  };

  /* Wave banner: a band across the stage with gold hairlines above and below; a light sweeps
     across it and the label and the line under it slide in and out. */
  P.banner = function (label, sub) {
    var el = this.el, b = el.banner, self = this;
    this.hideBanner();
    el.bannerLabel.textContent = label;
    el.bannerSub.textContent = sub || '';
    restartClass(b, 'is-shown');
    this.bannerTimers = [
      setTimeout(function () { b.classList.add('is-leaving'); }, 1800),
      setTimeout(function () { self.hideBanner(); }, 2200)
    ];
  };
  P.hideBanner = function () {
    (this.bannerTimers || []).forEach(clearTimeout);
    this.bannerTimers = null;
    this.el.banner.classList.remove('is-shown', 'is-leaving');
  };

  /* ---------- screens ---------- */
  P.showTitle = function (best) {
    this.hideBanner();
    this.el.titleBest.textContent = pad(best, 5);
    this.el.result.classList.remove('is-open');
    this.el.title.classList.add('is-open');
    this._enter(this.el.title);
    this._focusLater(this.el.btnStart);
  };

  /* A card unfolds like a menu being opened, then its lines rise one after another. */
  P._enter = function (overlay) {
    var panel = overlay.querySelector('.cv-panel');
    if (!panel) return;
    var kids = panel.children;
    for (var i = 0; i < kids.length; i++) kids[i].style.setProperty('--i', i);
    restartClass(panel, 'is-entering');
  };

  P.hideScreens = function () {
    this.hideBanner();
    this.el.title.classList.remove('is-open');
    this.el.result.classList.remove('is-open');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  };

  /* data: { result, score, best, isNewBest, survived, closeCalls, lifeBonus }
     The score counts up from zero; a new record is then sealed with the wax stamp. */
  P.showResult = function (d) {
    var el = this.el, success = d.result === 'clear', self = this;
    el.resultTitle.textContent = success ? '성공' : '게임 오버';
    el.resultBest.textContent = pad(d.best, 5);
    el.resultNew.hidden = true;
    if (this.seal.parentNode) this.seal.parentNode.removeChild(this.seal);

    el.title.classList.remove('is-open');
    el.result.classList.add('is-open');
    this._enter(el.result);
    this._focusLater(el.btnRetry);

    var calm = NS.settings && NS.settings.reduceMotion && NS.settings.reduceMotion();
    var dur = calm ? 0 : Math.min(1400, 500 + d.score / 12), start = 0, ticked = 0;
    cancelAnimationFrame(this.countRaf);
    function done() {
      el.resultScore.textContent = pad(d.score, 5);
      if (!d.isNewBest) return;
      el.resultNew.hidden = false;
      var panel = el.result.querySelector('.cv-panel');
      panel.appendChild(self.seal);
      restartClass(self.seal, 'is-stamped');
      restartClass(panel, 'is-thud');
      if (NS.sound) NS.sound.play('drop');
    }
    if (!dur) { done(); return; }
    function step(now) {
      if (!start) start = now;
      var q = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - q, 3);
      el.resultScore.textContent = pad(d.score * e, 5);
      if (NS.sound && now - ticked > 70 && q < 1) { ticked = now; NS.sound.play('tap'); }
      if (q < 1) self.countRaf = requestAnimationFrame(step); else done();
    }
    el.resultScore.textContent = pad(0, 5);
    this.countRaf = requestAnimationFrame(step);
  };

  // Focus for keyboard players (Enter / Space) without flashing a ring on touch.
  P._focusLater = function (btn) {
    setTimeout(function () { try { btn.focus({ preventScroll: true }); } catch (e) { btn.focus(); } }, 60);
  };

  NS.UI = UI;
})(window.CAVIAR = window.CAVIAR || {});
