/* PRE-SAVE LANDING — DOM: builds the form from config, shows steps, fills the
   serving and can screens. Reports user actions through on(name, fn). */
(function (NS) {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function assetUrl(path) { return NS.url(path); }

  /* Point a .lp-sprite element at one row of a member sheet (format of assets/chibi/members.js).
     cellPx: display size of one cell; box: element size; the body is centred and stands on the floor. */
  function applySprite(node, member, anim, cellPx, boxW, boxH) {
    var b = member.bounds, k = cellPx / member.cell;
    NS.sprite.show(node, member, anim, {
      cell: cellPx,
      ox: boxW / 2 - (b.x + b.w / 2) * k,
      oy: boxH - 6 - (b.y + b.h) * k,
      play: true
    });
  }

  /* Caviar tin: CSS placeholder, or the configured image. */
  function fillTin(node, color, latin, image) {
    node.innerHTML = '';
    node.className = node.className.replace(/\blp-c--\w+/g, '').trim() + ' lp-c--' + color;
    node.classList.toggle('has-image', !!image);
    if (image) {
      var img = el('img');
      img.src = assetUrl(image);
      img.alt = '';
      node.appendChild(img);
      return;
    }
    node.appendChild(el('span', 'lp-tin__top'));
    node.appendChild(el('span', 'lp-tin__band', latin));
  }

  function UI(cfg) {
    this.cfg = cfg;
    this.handlers = {};
    this.el = {
      app: $('app'),
      stepNo: $('step-no'),
      screens: document.querySelectorAll('.lp-screen'),
      menu: $('menu-book'),
      sceneImg: $('scene-img'),
      backdrop: $('backdrop'),
      form: $('order-form'),
      nickname: $('nickname'),
      email: $('email'),
      submit: $('btn-submit'),
      serveLine: $('serve-line'),
      serveHost: $('serve-host'),
      serveName: $('serve-name'),
      serveTin: $('serve-tin'),
      serveCaviar: $('serve-caviar'),
      serveDrink: $('serve-drink'),
      serveDrinkName: $('serve-drink-name'),
      cans: $('cans'),
    };

    // copy from config
    var copy = cfg.copy;
    Array.prototype.forEach.call(document.querySelectorAll('[data-copy]'), function (n) {
      if (copy[n.dataset.copy]) n.textContent = copy[n.dataset.copy];
    });
    this.el.nickname.maxLength = cfg.nicknameMax;
    if (cfg.images.table) {
      var url = assetUrl(cfg.images.table);
      this.el.sceneImg.src = url;
      this.el.sceneImg.hidden = false;
      this.el.menu.classList.add('has-image');
      this.el.backdrop.style.backgroundImage = 'url("' + url + '")';
    }
    if (cfg.images.paper) {
      document.body.style.setProperty('--lp-paper-img', 'url("' + assetUrl(cfg.images.paper) + '")');
    }

    this._buildOptions('opts-mood', 'mood', cfg.moods, false);
    this._buildOptions('opts-caviar', 'caviar', cfg.caviars, true);
    this._buildOptions('opts-eat', 'eat', cfg.eats, false);
    this._buildOptions('opts-drink', 'drink', cfg.drinks, false);
    this._buildCans();
    this._bind();
  }

  var P = UI.prototype;

  P.on = function (name, fn) { this.handlers[name] = fn; };
  P._fire = function (name, arg) { if (this.handlers[name]) this.handlers[name](arg); };

  P._buildOptions = function (hostId, name, list, withPearl) {
    var host = $(hostId);
    host.innerHTML = '';
    list.forEach(function (item, i) {
      var label = el('label', 'lp-opt');
      var input = el('input');
      input.type = 'radio';
      input.name = name;
      input.value = item.id;
      label.appendChild(input);
      label.appendChild(el('span', 'lp-opt__no', (i + 1) + '.'));
      if (withPearl) {
        label.appendChild(el('span', 'cv-pearl cv-pearl--' + item.color));
      }
      label.appendChild(el('span', '', item.label));
      host.appendChild(label);
    });
  };

  P._buildCans = function () {
    var self = this, host = this.el.cans;
    host.innerHTML = '';
    this.cfg.cans.forEach(function (can) {
      var b = el('button', 'lp-can');
      b.type = 'button';
      b.dataset.id = can.id;
      b.setAttribute('aria-label', can.label + ' — ' + can.gameName + ' 시작');
      var tin = el('span', 'lp-tin');
      fillTin(tin, can.color, can.latin, can.image);
      b.appendChild(tin);
      b.appendChild(el('span', 'lp-can__name', can.label));
      b.appendChild(el('span', 'lp-can__sub', '(' + can.sub + ')'));
      b.appendChild(el('span', 'lp-can__game', can.gameName));
      b.addEventListener('click', function () { self._fire('can', can.id); });
      host.appendChild(b);
    });
  };

  P._bind = function () {
    var self = this, e = this.el;
    e.menu.addEventListener('click', function () { self._fire('open'); });
    $('btn-open').addEventListener('click', function () { self._fire('open'); });
    $('btn-prev').addEventListener('click', function () { self._fire('prev'); });
    $('btn-secret').addEventListener('click', function () { self._fire('secret'); });
    $('btn-bingo').addEventListener('click', function () { self._fire('bingo'); });
    $('btn-bingo-2').addEventListener('click', function () { self._fire('bingo'); });

    e.nickname.addEventListener('input', function () { self._fire('answer', { key: 'nickname', value: e.nickname.value }); });
    e.nickname.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); e.email.focus(); }
    });
    e.email.addEventListener('input', function () { self._fire('answer', { key: 'email', value: e.email.value }); });
    e.email.addEventListener('blur', function () { self._fire('emailBlur'); });
    e.email.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); e.email.blur(); }
    });
    e.form.addEventListener('change', function (ev) {
      var t = ev.target;
      if (t.type === 'checkbox' && t.name === 'consent') { self._fire('answer', { key: 'consent', value: t.checked }); return; }
      if (t.type !== 'radio') return;
      self._syncChecked(t.name);
      self._fire('answer', { key: t.name, value: t.value });
    });
    e.form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      self._fire('submit');
    });
  };

  P._syncChecked = function (name) {
    Array.prototype.forEach.call(this.el.form.querySelectorAll('input[name="' + name + '"]'), function (i) {
      i.parentNode.classList.toggle('is-checked', i.checked);
    });
  };

  /** Put stored answers back into the form (returning guest). */
  P.fillForm = function (answers) {
    var form = this.el.form;
    this.el.nickname.value = answers.nickname || '';
    this.el.email.value = answers.email || '';
    // Same account on another device: the server holds the e-mail, the field may stay empty.
    this.el.email.placeholder = !answers.email && answers.emailOnServer ? '등록된 이메일 사용 중' : 'name@example.com';
    $('consent').checked = !!answers.consent;
    ['mood', 'caviar', 'eat', 'drink'].forEach(function (name) {
      Array.prototype.forEach.call(form.querySelectorAll('input[name="' + name + '"]'), function (i) {
        i.checked = i.value === answers[name];
      });
      this._syncChecked(name);
    }, this);
  };

  P.setComplete = function (ok) { this.el.submit.disabled = !ok; };

  /** Email hint under the field: neutral, or a gentle error once the guest left it. */
  P.setEmailState = function (bad) {
    var hint = $('email-hint');
    this.el.email.classList.toggle('is-bad', !!bad);
    hint.classList.toggle('is-bad', !!bad);
    hint.textContent = bad ? '이메일 형식을 확인해주세요' : '가입 없이 이메일만 받아요 · 비밀번호 없음';
  };

  /** Week lock on the cans: a game opens on its week (shared/cv-campaign.js). */
  P.setCanLocks = function (fn) {
    Array.prototype.forEach.call(this.el.cans.children, function (b) {
      var info = fn(b.dataset.id);
      b.classList.toggle('is-locked', !info.open);
      b.setAttribute('aria-disabled', info.open ? 'false' : 'true');
      var badge = b.querySelector('.lp-can__week');
      if (!badge) { badge = el('span', 'lp-can__week'); b.insertBefore(badge, b.firstChild); }
      badge.textContent = info.badge;
      badge.classList.toggle('is-now', !!info.now);
    });
  };

  P.setBingo = function (filled, total, lines) {
    $('bingo-count').textContent = lines ? lines + '줄' : filled + '/' + total;
  };

  P.show = function (step, index, total) {
    this.el.app.dataset.step = step;
    Array.prototype.forEach.call(this.el.screens, function (s) {
      var on = s.dataset.screen === step;
      s.classList.toggle('is-active', on);
      s.setAttribute('aria-hidden', on ? 'false' : 'true');
      if ('inert' in s) s.inert = !on;
    });
    if (this.el.stepNo) this.el.stepNo.textContent = ('0' + (index + 1)).slice(-2) + ' / ' + ('0' + total).slice(-2);
    if (step === 'table') this.el.menu.classList.remove('is-opening');
  };

  /** 01 → 02: the cover swings open, then `done` runs. */
  P.openMenu = function (done) {
    var menu = this.el.menu;
    if (menu.classList.contains('is-opening')) return;
    menu.classList.add('is-opening');
    setTimeout(done, 820);
  };

  P.focusNickname = function () {
    var n = this.el.nickname;
    if (!n.value && window.matchMedia('(hover: hover) and (pointer: fine)').matches) n.focus({ preventScroll: true });
  };

  /** 03: the member talks — the greeting, then a line about the caviar and one about the
      drink (cv-talk.js). Tap the bubble or "다음 ›" to go on. */
  P._serveTalk = function (d, greetingHtml) {
    var e = this.el;
    if (!NS.talk || !d.member) return;
    var tr = function (s) { return NS.i18n ? NS.i18n.translate(s) : s; };
    var vars = { caviar: tr(d.caviar.label), drink: tr(d.drink.label) };
    var steps = [null, 'caviar', 'drink'], i = 0;
    var next = el('button', 'lp-bubble__next', NS.talk.reply('next'));
    next.type = 'button';
    function show() {
      if (i === 0) e.serveLine.innerHTML = greetingHtml;
      else e.serveLine.textContent = NS.talk.line(steps[i], vars, d.member.id);
      if (i < steps.length - 1) e.serveLine.appendChild(next);
      e.serveLine.classList.remove('is-new');
      void e.serveLine.offsetWidth;
      e.serveLine.classList.add('is-new');
    }
    function advance(ev) {
      if (ev) ev.stopPropagation();
      if (i >= steps.length - 1) return;
      i++;
      show();
    }
    next.addEventListener('click', advance);
    e.serveLine.onclick = advance;
    show();
  };

  /** 03: member, line, dish and drink from the order. */
  P.fillServe = function (d) {
    var e = this.el;
    var parts = (NS.t ? NS.t(this.cfg.copy.serve) : this.cfg.copy.serve).split('{name}');
    e.serveLine.textContent = '';
    e.serveLine.appendChild(document.createTextNode(parts[0]));
    e.serveLine.appendChild(el('b', '', d.nickname));
    e.serveLine.appendChild(document.createTextNode(parts.slice(1).join(d.nickname)));

    e.serveHost.innerHTML = '';
    if (d.member) {
      var sprite = el('div', 'lp-sprite');
      e.serveHost.appendChild(sprite);
      var w = e.serveHost.clientWidth || 150, h = e.serveHost.clientHeight || 168;
      var cell = Math.round(h / d.member.bounds.h * d.member.cell * 0.92);
      applySprite(sprite, d.member, d.anim, cell, w, h);
      e.serveName.textContent = d.member.name;
    } else {
      e.serveName.textContent = '';
    }

    this._serveTalk(d, e.serveLine.innerHTML);

    fillTin(e.serveTin, d.caviar.color, d.caviar.latin, d.caviar.image);
    e.serveCaviar.textContent = d.caviar.label;

    var drink = d.drink;
    e.serveDrink.className = 'lp-drink lp-drink--' + drink.glass;
    e.serveDrink.style.setProperty('--tint', drink.tint + 'cc');
    e.serveDrink.innerHTML = '';
    if (drink.image) {
      var img = el('img');
      img.src = assetUrl(drink.image);
      img.alt = '';
      e.serveDrink.appendChild(img);
    } else {
      e.serveDrink.appendChild(el('span', 'lp-drink__bowl'));
      e.serveDrink.appendChild(el('span', 'lp-drink__stem'));
      e.serveDrink.appendChild(el('span', 'lp-drink__base'));
    }
    e.serveDrinkName.textContent = drink.label;
  };

  /** 04: chosen can rises and glows, then `done` runs. */
  P.chooseCan = function (id, done) {
    var row = this.el.cans;
    if (row.classList.contains('has-choice')) return;
    row.classList.add('has-choice');
    Array.prototype.forEach.call(row.children, function (b) {
      b.classList.toggle('is-chosen', b.dataset.id === id);
    });
    setTimeout(done, 650);
  };

  /** Locked can: a short shake instead of starting the game. */
  P.nudgeCan = function (id) {
    Array.prototype.forEach.call(this.el.cans.children, function (b) {
      if (b.dataset.id !== id) return;
      b.classList.remove('is-nudge');
      void b.offsetWidth;
      b.classList.add('is-nudge');
    });
  };

  P.resetCans = function () {
    var row = this.el.cans;
    row.classList.remove('has-choice');
    Array.prototype.forEach.call(row.children, function (b) { b.classList.remove('is-chosen'); });
  };

  NS.LandingUI = UI;
})(window.CAVIAR = window.CAVIAR || {});
