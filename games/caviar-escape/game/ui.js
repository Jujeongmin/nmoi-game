/* CAVIAR ESCAPE — DOM UI: HUD, callouts, title card, result card.
   Only reads game state; user actions are reported through on(name, fn). */
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
      title: $('screen-title'),
      titleBest: $('title-best'),
      result: $('screen-result'),
      resultTitle: $('result-title'),
      resultScore: $('result-score'),
      resultBest: $('result-best'),
      resultNew: $('result-new'),
      resultDetail: $('result-detail'),
      picker: $('member-picker'),
      memberName: $('member-name'),
      btnStart: $('btn-start'),
      btnRetry: $('btn-retry'),
      btnBack: $('btn-back')
    };

    var self = this;
    this.el.stageNum.textContent = pad(config.stage, 2);
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
    this._set('score', el.score, pad(game.getScore(), 5));
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
  };

  P._updateCallout = function (game) {
    var text = '', kind = 'word';
    if (game.phase === 'countdown') {
      text = String(Math.max(1, Math.ceil(game.countdownLeft() / (this.cfg.countdown / 3))));
      kind = 'number';
    } else if (game.phase === 'play' && game.phaseTime < 0.8) {
      text = '출발';
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
  P.hitFeedback = function () { restartClass(this.el.stage, 'is-hit'); };
  P.bonusFeedback = function () { restartClass(this.el.scoreItem, 'is-flash'); };

  /* ---------- screens ---------- */
  P.showTitle = function (best) {
    this.el.titleBest.textContent = pad(best, 5);
    this.el.result.classList.remove('is-open');
    this.el.title.classList.add('is-open');
    this._focusLater(this.el.btnStart);
  };

  P.hideScreens = function () {
    this.el.title.classList.remove('is-open');
    this.el.result.classList.remove('is-open');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  };

  /* data: { result, score, best, isNewBest, survived, closeCalls, lifeBonus } */
  P.showResult = function (d) {
    var el = this.el, success = d.result === 'clear';
    el.resultTitle.textContent = success ? '성공' : '게임 오버';
    el.resultScore.textContent = pad(d.score, 5);
    el.resultBest.textContent = pad(d.best, 5);
    el.resultNew.hidden = !d.isNewBest;

    var parts = ['생존 ' + d.survived.toFixed(1) + '초', '아슬아슬 ' + d.closeCalls + '회'];
    if (success) parts.push('라이프 보너스 +' + d.lifeBonus);
    el.resultDetail.textContent = parts.join('  ·  ');

    // A vertical game: the success / fail scene fills the screen first (9:16), a tap
    // brings up the score card.
    el.title.classList.remove('is-open');
    var self = this;
    this._showScene(success, function () {
      el.result.classList.add('is-open');
      self._focusLater(el.btnRetry);
    });
  };

  /* Full-screen 9:16 result scene (real images in config.resultArt; placeholder until then). */
  P._showScene = function (success, next) {
    var s = this.scene;
    if (!s) {
      s = this.scene = document.createElement('div');
      s.className = 'cv-overlay ce-scene';
      s.setAttribute('role', 'dialog');
      s.setAttribute('aria-label', '결과 연출');
      s.innerHTML = '<div class="ce-scene__frame"></div>' +
        '<p class="ce-scene__title"></p>' +
        '<button class="cv-btn ce-scene__next" type="button">결과 보기 ›</button>';
      (document.getElementById('app') || document.body).appendChild(s);
      s.addEventListener('click', function () {
        if (!s.classList.contains('is-open')) return;
        s.classList.remove('is-open');
        var go = s._next; s._next = null;
        if (go) go();
      });
    }
    var frame = s.querySelector('.ce-scene__frame');
    frame.innerHTML = '';
    frame.appendChild(NS.assetSlot({
      name: success ? '성공 연출 · 스타 셰프가 캐비어 요리를 서빙하는 이미지' : '실패 연출 · 상어 모자를 쓴 멤버 이미지',
      spec: '세로 9:16 · 1080×1920',
      src: (this.cfg.resultArt || {})[success ? 'clear' : 'over'],
      className: 'ce-scene__art'
    }));
    s.querySelector('.ce-scene__title').textContent = success ? '성공' : '게임 오버';
    s._next = next;
    s.classList.add('is-open');
    this._focusLater(s.querySelector('.ce-scene__next'));
  };

  // Focus for keyboard players (Enter / Space) without flashing a ring on touch.
  P._focusLater = function (btn) {
    setTimeout(function () { try { btn.focus({ preventScroll: true }); } catch (e) { btn.focus(); } }, 60);
  };

  NS.UI = UI;
})(window.CAVIAR = window.CAVIAR || {});
