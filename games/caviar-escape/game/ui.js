/* CAVIAR ESCAPE — DOM UI: HUD, callouts, title card, result card.
   Only reads game state; user actions are reported through on(name, fn).
   The look is the campaign's menu card (cv-theme.css); what makes it feel like a game is motion
   (shared/cv-juice.js): cards unfold and their lines rise in turn, the score rolls, the result
   counts up and a new record is sealed with a wax stamp. */
(function (NS) {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function pad(n, len) { var s = String(Math.max(0, Math.floor(n))); while (s.length < len) s = '0' + s; return s; }
  // Records are hundredths of a second: '23.45초' (cards), '23.4' (HUD, one decimal while it runs).
  function secs(cs) { return NS.campaign.fmtScore('caviar-escape', cs); }
  function tenths(cs) { return (Math.floor(Math.max(0, cs) / 10) / 10).toFixed(1); }
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
    this.waveBanner = NS.juice.banner(this.el.stage);
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
    // Wave · time survived · best record; the sub-bar: life and shields.
    this._set('stage', el.stageNum, pad(game.wave + 1, 2));
    this._set('time', el.time, tenths(game.getScore()));
    this._set('score', el.score, tenths(Math.max(best, game.getScore())));
    this._set('best', el.best, String(game.shields));
    if (this.cache.shieldOn !== game.shields > 0) {
      this.cache.shieldOn = game.shields > 0;
      el.best.parentNode.classList.toggle('is-on', game.shields > 0);
    }

    if (this.cache.lives !== game.lives) {
      this.cache.lives = game.lives;
      // A +1 life booster adds a pearl for this run.
      while (el.lives.length < game.lives) {
        var pearl = document.createElement('span');
        pearl.className = 'cv-pearl cv-pearl--gold';
        el.lives[0].parentNode.appendChild(pearl);
        el.lives.push(pearl);
      }
      for (var i = 0; i < el.lives.length; i++) {
        var pearl = el.lives[i], lost = i >= game.lives;
        clearTimeout(pearl._lostTimer);
        if (lost && !pearl.classList.contains('is-empty') && game.phase === 'play') {
          // the pearl drops and dims first, then its place is left empty
          NS.juice.restart(pearl, 'cv-lost');
          pearl._lostTimer = setTimeout(function (p) { p.classList.add('is-empty'); p.classList.remove('cv-lost'); }.bind(null, pearl), 560);
        } else {
          pearl.classList.remove('cv-lost');
          pearl.classList.toggle('is-empty', lost);
        }
      }
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
      text = '게임 오버';
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
    restartClass(this.el.score, 'cv-pop');
  };

  /* Wave banner (shared): a gold-ruled band across the stage. */
  P.banner = function (label, sub) { this.waveBanner.show(label, sub, 1800); };
  P.hideBanner = function () { this.waveBanner.hide(); };

  /* ---------- screens ---------- */
  P.showTitle = function (best) {
    this.hideBanner();
    this.el.titleBest.textContent = secs(best);
    this.el.result.classList.remove('is-open');
    this.el.title.classList.add('is-open');
    NS.juice.enter(this.el.title);
    this._focusLater(this.el.btnStart);
  };

  P.hideScreens = function () {
    this.hideBanner();
    this.el.title.classList.remove('is-open');
    this.el.result.classList.remove('is-open');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  };

  /* data: { score, best, isNewBest } — times in 1/100 s.
     The time counts up from zero; a new record is then sealed with the wax stamp. */
  P.showResult = function (d) {
    var el = this.el;
    el.resultTitle.textContent = '게임 오버';
    el.resultBest.textContent = secs(d.best);
    el.resultNew.hidden = true;

    el.title.classList.remove('is-open');
    el.result.classList.add('is-open');
    NS.juice.enter(el.result);
    this._focusLater(el.btnRetry);
    NS.juice.countUp(el.resultScore, d.score, 5, secs).then(function () {
      if (!d.isNewBest || !el.result.classList.contains('is-open')) return;
      el.resultNew.hidden = false;
      NS.juice.seal(el.result.querySelector('.cv-panel'));
    });
  };

  // Focus for keyboard players (Enter / Space) without flashing a ring on touch.
  P._focusLater = function (btn) {
    setTimeout(function () { try { btn.focus({ preventScroll: true }); } catch (e) { btn.focus(); } }, 60);
  };

  NS.UI = UI;
})(window.CAVIAR = window.CAVIAR || {});
