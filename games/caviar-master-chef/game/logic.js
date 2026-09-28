/* CAVIAR MASTER CHEF — pure game logic. No DOM.
   Phases: idle → memorize → input → serving → memorize … → over
   Events are queued; main.js drains them each frame and hands them to the UI. */
(function (NS) {
  'use strict';

  function ChefGame(config, rng) {
    this.cfg = config;
    this.rng = rng || Math.random;
    this.events = [];
    this.idle();
  }

  var P = ChefGame.prototype;

  P.idle = function () {
    this.phase = 'idle';
    this.time = this.cfg.duration;
    this.score = 0;
    this.orderNo = 0;
    this.order = null;
    this.step = 0;
    this.mistakes = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.ordersCompleted = 0;
    this.perfectOrders = 0;
    this.phaseTime = 0;   // seconds left in memorize / serving
    this.overTime = 0;    // seconds since time up
    this.events.length = 0;
  };

  P.start = function () {
    this.idle();
    this._emit('start');
    this._nextOrder();
  };

  P.isOver = function () { return this.phase === 'over'; };

  P.drainEvents = function () {
    var out = this.events;
    this.events = [];
    return out;
  };

  P._emit = function (type, data) {
    var ev = data || {};
    ev.type = type;
    this.events.push(ev);
  };

  P._shuffle = function (list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(this.rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };

  P._makeOrder = function (length) {
    var ings = this.cfg.ingredients, cavs = this.cfg.caviars;
    var picks = this._shuffle(ings).slice(0, Math.min(length - 1, ings.length));
    var caviar = cavs[Math.floor(this.rng() * cavs.length)];
    var steps = picks.map(function (i) { return { kind: 'ingredient', id: i.id }; });
    steps.push({ kind: 'caviar', id: caviar.id });
    return { steps: steps };
  };

  P._nextOrder = function () {
    var lengths = this.cfg.orderLengths;
    var length = lengths[Math.min(this.orderNo, lengths.length - 1)];
    this.orderNo += 1;
    this.order = this._makeOrder(length);
    this.step = 0;
    this.mistakes = 0;
    this.phase = 'memorize';
    this.phaseTime = this.cfg.memorize.base + this.cfg.memorize.perStep * length;
    this._emit('order', { order: this.order, orderNo: this.orderNo, memorize: this.phaseTime });
  };

  P._beginInput = function () {
    if (this.phase !== 'memorize') return;
    this.phase = 'input';
    this._emit('input', { combo: this.combo });
  };

  P._complete = function () {
    var s = this.cfg.score;
    var perfect = this.mistakes === 0;
    var gained = s.orderComplete;
    if (perfect) {
      gained += s.perfectBonus;
      this.perfectOrders += 1;
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
    } else {
      this.combo = 0;
    }
    this.score += gained;
    this.ordersCompleted += 1;
    this.phase = 'serving';
    this.phaseTime = this.cfg.serveDelay;
    this._emit('complete', { perfect: perfect, gained: gained, combo: this.combo });
  };

  P._end = function () {
    this.time = 0;
    this.phase = 'over';
    this.overTime = 0;
    this._emit('end');
  };

  P.update = function (dt) {
    if (this.phase === 'idle') return;
    if (this.phase === 'over') { this.overTime += dt; return; }
    this.time -= dt;
    if (this.time <= 0) { this._end(); return; }
    if (this.phase === 'memorize' || this.phase === 'serving') {
      this.phaseTime -= dt;
      if (this.phaseTime <= 0) {
        if (this.phase === 'memorize') this._beginInput();
        else this._nextOrder();
      }
    }
  };

  // Player may skip the memorize time.
  P.ready = function () { this._beginInput(); };

  P.select = function (kind, id) {
    if (this.phase === 'memorize') this._beginInput();
    if (this.phase !== 'input') return;

    var expected = this.order.steps[this.step];
    if (expected.kind === kind && expected.id === id) {
      var index = this.step;
      this.step += 1;
      this.score += this.cfg.score.correct;
      this._emit('correct', { kind: kind, id: id, index: index, points: this.cfg.score.correct });
      if (this.step === this.order.steps.length) this._complete();
    } else {
      this.mistakes += 1;
      this.combo = 0;
      this.time = Math.max(0, this.time - this.cfg.wrongPenalty);
      this._emit('wrong', { kind: kind, id: id, penalty: this.cfg.wrongPenalty });
      if (this.time <= 0) this._end();
    }
  };

  NS.ChefGame = ChefGame;
})(window.CAVIAR = window.CAVIAR || {});
