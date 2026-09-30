/* PRE-SAVE LANDING — flow state. No DOM.
   table (01) → order (02) → serve (03) → cans (04) → game */
(function (NS) {
  'use strict';

  var STEPS = ['table', 'order', 'serve', 'cans'];

  function find(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function LandingFlow(cfg) {
    this.cfg = cfg;
    this.step = 'table';
    this.answers = { nickname: '', email: '', mood: null, caviar: null, eat: null, drink: null, consent: false };
  }

  var P = LandingFlow.prototype;

  P.steps = STEPS;
  P.index = function () { return STEPS.indexOf(this.step); };

  P.go = function (step) {
    if (STEPS.indexOf(step) < 0) return false;
    if ((step === 'serve' || step === 'cans') && !this.isComplete()) return false;
    this.step = step;
    return true;
  };

  P.prev = function () {
    var i = this.index();
    if (i > 0) this.step = STEPS[i - 1];
    return this.step;
  };

  P.set = function (key, value) {
    if (key === 'nickname') value = String(value || '').trim().slice(0, this.cfg.nicknameMax);
    if (key === 'email') { value = String(value || '').trim().toLowerCase(); if (value) this.answers.emailOnServer = false; }
    this.answers[key] = value;
  };

  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  P.emailOk = function () {
    var a = this.answers;
    if (!a.email && a.emailOnServer) return true;   // same account on another device: the server has it
    return EMAIL.test(a.email) && a.email.length <= 120;
  };

  P.isComplete = function () {
    var a = this.answers;
    return !!(a.nickname && this.emailOk() && a.consent && a.mood && a.caviar && a.eat && a.drink);
  };

  P.caviar = function () { return find(this.cfg.caviars, this.answers.caviar); };
  P.eat = function () { return find(this.cfg.eats, this.answers.eat); };
  P.drink = function () { return find(this.cfg.drinks, this.answers.drink); };
  P.can = function (id) { return find(this.cfg.cans, id); };

  /** What gets handed to the games (see shared/cv-hub.js). */
  P.toOrder = function () {
    var c = this.caviar();
    return {
      nickname: this.answers.nickname,
      email: this.answers.email,          // winner notice + de-dup only (hashed on the server side)
      emailOnServer: !!this.answers.emailOnServer && !this.answers.email,
      mood: this.answers.mood,
      caviar: this.answers.caviar,
      eat: this.answers.eat,
      drink: this.answers.drink,
      consent: !!this.answers.consent,   // required: email use + leaderboard name
      member: c ? c.member : null,
    };
  };

  /** Restore answers from a stored order (returning from a game). */
  P.restore = function (order) {
    if (!order) return false;
    var a = this.answers;
    a.nickname = order.nickname || '';
    a.email = order.email || '';
    a.emailOnServer = !!order.emailOnServer;
    a.mood = find(this.cfg.moods, order.mood) ? order.mood : null;
    a.caviar = find(this.cfg.caviars, order.caviar) ? order.caviar : null;
    a.eat = find(this.cfg.eats, order.eat) ? order.eat : null;
    a.drink = find(this.cfg.drinks, order.drink) ? order.drink : null;
    a.consent = !!order.consent;
    return this.isComplete();
  };

  NS.LandingFlow = LandingFlow;
})(window.CAVIAR = window.CAVIAR || {});
