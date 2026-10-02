/* CAVIAR MASTER CHEF — DOM UI: HUD, order ticket, plate, controls, title/result cards.
   Only reads game state and events; user actions are reported through on(name, fn).
   Game feel comes from shared/cv-juice.js: cards unfold, the score rolls, every ingredient lands
   with a few flakes of gold leaf, a perfect order is pressed with the chef's wax seal, a wrong pick
   knocks the pass, the result counts up. */
(function (NS) {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function pad(n, len) { var s = String(Math.max(0, Math.floor(n))); while (s.length < len) s = '0' + s; return s; }
  function restartClass(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  function indexBy(list) { var o = {}; list.forEach(function (x) { o[x.id] = x; }); return o; }

  // Hex cluster in the signature dish: pearls line up neatly, never touch the food.
  var PEARL_LAYOUT = [[50, 50]];
  for (var k = 0; k < 6; k++) {
    var a = (Math.PI / 3) * k - Math.PI / 2;
    PEARL_LAYOUT.push([50 + Math.cos(a) * 25, 50 + Math.sin(a) * 25]);
  }

  function pearlEl(cav) {
    var el = document.createElement('span');
    el.className = 'cv-pearl cv-pearl--' + cav.tone + (cav.image ? ' cm-mound' : '');
    if (cav.image) el.style.background = 'center / contain no-repeat url("' + cav.image + '")';
    return el;
  }

  function foodEl(item) {
    var el = document.createElement('div');
    el.className = 'cm-food cm-food--' + item.id;
    if (item.image) {
      var img = document.createElement('img');
      img.src = item.image;
      img.alt = item.label;
      el.appendChild(img);
    } else {
      el.appendChild(document.createElement('i'));
    }
    return el;
  }

  function UI(config) {
    this.cfg = config;
    this.handlers = {};
    this.byId = { ingredient: indexBy(config.ingredients), caviar: indexBy(config.caviars) };
    this.buttons = { ingredient: {}, caviar: {} };
    this.foodSlots = [];
    this.cache = {};
    this.el = {
      app: $('app'),
      order: $('hud-order'),
      time: $('hud-time'),
      timeItem: $('hud-time-item'),
      score: $('hud-score'),
      combo: $('hud-combo'),
      best: $('hud-best'),
      ticket: $('ticket'),
      ticketTitle: $('ticket-title'),
      ticketStatus: $('ticket-status'),
      ticketLines: $('ticket-lines'),
      ticketBar: $('ticket-bar'),
      plate: $('plate'),
      plateItems: $('plate-items'),
      signature: $('signature'),
      sigDish: $('sig-dish'),
      stage: $('stage'),
      fx: $('fx'),
      callout: $('callout'),
      ingredientRow: $('ingredient-row'),
      caviarRow: $('caviar-row'),
      title: $('screen-title'),
      titleBest: $('title-best'),
      result: $('screen-result'),
      resultScore: $('result-score'),
      resultBest: $('result-best'),
      resultNew: $('result-new')
    };

    this.scoreRoll = NS.juice.roller(this.el.score, 5);
    this.orderBanner = NS.juice.banner(this.el.stage);
    this.leaf = NS.url('assets/menu/gold-leaf.webp');

    var self = this;
    config.ingredients.forEach(function (item) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cv-btn cm-pick' + (item.image ? ' cm-pick--art' : '');
      if (item.image) {
        var art = document.createElement('img');
        art.className = 'cm-pick__art';
        art.src = item.image;
        art.alt = '';
        b.appendChild(art);
      }
      b.appendChild(document.createTextNode(item.label));
      b.addEventListener('click', function () { self._fire('select', { kind: 'ingredient', id: item.id }); });
      self.el.ingredientRow.appendChild(b);
      self.buttons.ingredient[item.id] = b;
    });
    config.caviars.forEach(function (cav) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cv-btn cm-pick cm-pick--caviar';
      b.appendChild(pearlEl(cav));
      b.appendChild(document.createTextNode(cav.label));
      b.addEventListener('click', function () { self._fire('select', { kind: 'caviar', id: cav.id }); });
      self.el.caviarRow.appendChild(b);
      self.buttons.caviar[cav.id] = b;
    });

    $('btn-ready').addEventListener('click', function () { self._fire('ready'); });
    $('btn-start').addEventListener('click', function () { self._fire('start'); });
    $('btn-retry').addEventListener('click', function () { self._fire('retry'); });
    $('btn-back').addEventListener('click', function () { self._fire('back'); });
  }

  var P = UI.prototype;

  P.on = function (name, fn) { this.handlers[name] = fn; };
  P._fire = function (name, arg) { if (this.handlers[name]) this.handlers[name](arg); };

  /* ---------- screens ---------- */
  P.showTitle = function (best) {
    this.el.titleBest.textContent = pad(best, 5);
    this.el.result.classList.remove('is-open');
    this.el.title.classList.add('is-open');
    NS.juice.enter(this.el.title);
    this.setLocked(true);
  };

  P.hideScreens = function () {
    this.el.title.classList.remove('is-open');
    this.el.result.classList.remove('is-open');
    this.el.callout.classList.remove('is-shown');
    this.el.stage.classList.remove('cv-hurry');
    this.orderBanner.hide();
  };

  /* The score counts up from zero; a new record is sealed. */
  P.showResult = function (d) {
    var el = this.el;
    el.resultBest.textContent = pad(d.best, 5);
    el.resultNew.hidden = true;
    el.title.classList.remove('is-open');
    el.result.classList.add('is-open');
    NS.juice.enter(el.result);
    NS.juice.countUp(el.resultScore, d.score, 5).then(function () {
      if (!d.isNewBest || !el.result.classList.contains('is-open')) return;
      el.resultNew.hidden = false;
      NS.juice.seal(el.result.querySelector('.cv-panel'));
    });
  };

  P.setLocked = function (locked) { this.el.app.classList.toggle('is-locked', locked); };

  /* ---------- per-frame HUD ---------- */
  P.update = function (game, best) {
    var c = this.cache, el = this.el;
    var t = Math.ceil(game.time);
    if (c.time !== t) {
      c.time = t;
      el.time.textContent = pad(t, 2);
      var hurry = t <= 10 && game.phase !== 'idle' && game.phase !== 'over';
      el.timeItem.classList.toggle('is-alert', hurry);
      el.stage.classList.toggle('cv-hurry', hurry);   // the pass frame breathes garnet
    }
    this.scoreRoll.set(game.score, game.phase !== 'idle' && game.phase !== 'over');
    if (c.order !== game.orderNo) { c.order = game.orderNo; el.order.textContent = pad(Math.max(1, game.orderNo), 2); }
    if (c.combo !== game.combo) {
      if (game.combo > (c.combo || 0) && game.combo >= 2) NS.juice.restart(el.combo, 'cv-pop');
      c.combo = game.combo;
      el.combo.textContent = game.combo;
    }
    if (c.best !== best) { c.best = best; el.best.textContent = pad(best, 5); }
  };

  /* ---------- helpers ---------- */
  P._flashButton = function (btn, cls) {
    btn.classList.remove('is-ok', 'is-bad');
    void btn.offsetWidth;
    btn.classList.add(cls);
    clearTimeout(btn._t);
    btn._t = setTimeout(function () { btn.classList.remove(cls); }, 320);
  };

  /* A few flakes of gold leaf drift off the plate where something landed (x, y in % of the plate). */
  P._leaf = function (x, y, n) {
    for (var i = 0; i < n; i++) {
      var f = document.createElement('img');
      f.className = 'cm-leaf';
      f.src = this.leaf;
      f.alt = '';
      f.style.left = x + '%';
      f.style.top = y + '%';
      f.style.setProperty('--dx', (Math.random() * 60 - 30) + 'px');
      f.style.setProperty('--dy', (Math.random() * 30 + 18) + 'px');
      f.style.setProperty('--r', (Math.random() * 300 - 150) + 'deg');
      f.style.animationDelay = (i * 40) + 'ms';
      this.el.plate.appendChild(f);
      setTimeout(function (node) { node.remove(); }.bind(null, f), 1000 + i * 40);
    }
  };

  P._float = function (text, bad) {
    var f = document.createElement('span');
    f.className = 'cm-float' + (bad ? ' cm-float--bad' : '');
    f.textContent = text;
    this.el.fx.appendChild(f);
    setTimeout(function () { f.remove(); }, 820);
  };

  P._renderTicket = function (order, orderNo) {
    var self = this;
    this.el.ticketTitle.textContent = 'ORDER No.' + pad(orderNo, 2);
    var frag = document.createDocumentFragment();
    order.steps.forEach(function (step, i) {
      var item = self.byId[step.kind][step.id];
      var isSig = step.kind === 'caviar';
      var li = document.createElement('li');
      if (isSig) li.className = 'is-signature';
      li.innerHTML =
        '<span class="num">' + (i + 1) + '</span>' +
        '<span class="name">' + (isSig ? '<em>시그니처 ·</em>' : '') + item.label + '</span>' +
        '<span class="mask">' + (isSig ? '시그니처 · · ·' : '· · ·') + '</span>' +
        '<span class="tick">✓</span>';
      frag.appendChild(li);
    });
    this.el.ticketLines.replaceChildren(frag);
  };

  P._setCurrentLine = function (index) {
    Array.prototype.forEach.call(this.el.ticketLines.children, function (li, i) {
      li.classList.toggle('is-current', i === index);
    });
  };

  P._layoutFood = function (count) {
    this.foodSlots = [];
    for (var i = 0; i < count; i++) {
      var x = count === 1 ? 44 : 22 + i * (48 / (count - 1));
      var y = 47 + (i % 2 ? 8 : -6);
      this.foodSlots.push([x, y]);
    }
  };

  P._clearPlate = function () {
    var el = this.el;
    clearTimeout(this.serveTimer);
    el.plateItems.classList.remove('is-serving');
    el.plateItems.replaceChildren();
    el.sigDish.replaceChildren();
    el.signature.classList.remove('is-set');
    el.plate.classList.remove('is-complete', 'is-thud');
    var seal = el.plate.querySelector('.cv-seal');
    if (seal) seal.remove();
    this.orderBanner.hide();
  };

  P._placeCaviar = function (cav) {
    var dish = this.el.sigDish;
    dish.replaceChildren();
    (cav.image ? [[50, 50]] : PEARL_LAYOUT).forEach(function (p, i) {
      var pearl = pearlEl(cav);
      pearl.style.setProperty('--x', p[0] + '%');
      pearl.style.setProperty('--y', p[1] + '%');
      pearl.style.setProperty('--d', (i * 45) + 'ms');
      dish.appendChild(pearl);
    });
    restartClass(this.el.signature, 'is-set');
  };

  /* ---------- game events ---------- */
  P.handle = function (ev, game) {
    var el = this.el;
    switch (ev.type) {
      case 'start':
        this.cache = {};
        this.setLocked(false);
        this._clearPlate();
        break;

      case 'order':
        this._clearPlate();
        this._renderTicket(ev.order, ev.orderNo);
        this._layoutFood(ev.order.steps.length - 1);
        el.ticket.classList.remove('is-hidden');
        el.ticketStatus.textContent = '주문 확인';
        el.ticketBar.style.animationDuration = ev.memorize + 's';
        restartClass(el.ticketBar, 'is-running');
        break;

      case 'input':
        el.ticket.classList.add('is-hidden');
        el.ticketStatus.textContent = '플레이팅';
        this._setCurrentLine(0);
        break;

      case 'correct':
        el.ticketLines.children[ev.index].classList.add('is-done');
        this._setCurrentLine(ev.index + 1);
        this._flashButton(this.buttons[ev.kind][ev.id], 'is-ok');
        this._float('+' + ev.points);
        if (ev.kind === 'ingredient') {
          var f = foodEl(this.byId.ingredient[ev.id]);
          var slot = this.foodSlots[ev.index] || [50, 50];
          f.style.setProperty('--x', slot[0] + '%');
          f.style.setProperty('--y', slot[1] + '%');
          f.style.zIndex = ev.index + 1;
          el.plateItems.appendChild(f);
          this._leaf(slot[0], slot[1], 3);
        } else {
          this._placeCaviar(this.byId.caviar[ev.id]);
          this._leaf(78, 74, 4);
        }
        break;

      case 'wrong':
        this._flashButton(this.buttons[ev.kind][ev.id], 'is-bad');
        restartClass(el.ticket, 'is-shake');
        NS.juice.restart(el.stage, 'cv-knock');
        this._float('−' + ev.penalty + '초', true);
        break;

      case 'complete':
        el.ticketStatus.textContent = '서빙 완료';
        restartClass(el.plate, 'is-complete');
        this.orderBanner.show(ev.perfect ? 'PERFECT ORDER' : 'ORDER COMPLETE',
          '+' + ev.gained + (ev.combo > 1 ? ' · ' + NS.t('콤보 {n}', { n: ev.combo }) : ''), 1100);
        if (ev.perfect) NS.juice.seal(el.plate);   // the chef's seal on a perfect plate
        var items = el.plateItems;
        this.serveTimer = setTimeout(function () { items.classList.add('is-serving'); }, 650);
        break;

      case 'end':
        this.setLocked(true);
        el.callout.textContent = '서비스 종료';
        restartClass(el.callout, 'is-shown');
        break;
    }
  };

  NS.UI = UI;
})(window.CAVIAR = window.CAVIAR || {});
