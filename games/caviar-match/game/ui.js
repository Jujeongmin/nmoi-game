/* CAVIAR MATCH — DOM UI: HUD, collection strip, title and result cards.
   Knows nothing about rules — it is handed plain values.
   Game feel comes from shared/cv-juice.js: cards unfold, the score rolls, the result counts up,
   a new record is sealed, banners cross the table, the table takes a knock. */
window.CM = window.CM || {};

CM.UI = (function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const pad = (n, len) => String(Math.max(0, Math.floor(n))).padStart(len, '0');
  const fmt = (n) => n.toLocaleString('en-US');

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  /* Shared .cv-pearl icon; a type with an image swaps the CSS pearl for it. */
  function pearl(t, assetRoot) {
    const p = el('span', 'cv-pearl cv-pearl--' + t.pearl);
    if (t.image) {
      const url = CAVIAR.url(t.image);
      p.style.background = 'center / cover no-repeat url("' + url + '")';
      p.style.boxShadow = 'none';
    }
    return p;
  }

  class UI {
    constructor(cfg) {
      this.cfg = cfg;
      this.app = $('app');
      this.el = {
        stage: $('hud-stage'),
        time: $('hud-time'),
        timeItem: $('hud-time-item'),
        score: $('hud-score'),
        combo: $('hud-combo'),
        comboItem: $('hud-combo-item'),
        title: $('screen-title'),
        titleBest: $('title-best'),
        result: $('screen-result'),
        resultTitle: $('result-title'),
        resultScore: $('result-score'),
        resultBest: $('result-best'),
        resultNew: $('result-new'),
        table: $('stage'),   // the play area (stage: the HUD's stage number)
      };
      this.scoreRoll = CAVIAR.juice.roller(this.el.score, 5);
      this.tableBanner = CAVIAR.juice.banner(this.el.table);
      this.cache = {};
      this.counts = cfg.types.map(() => 0);
      this.slots = [];
      this.buildCollection();
      this.buildLegend();
    }

    buildCollection() {
      const host = $('collection');
      host.innerHTML = '';
      this.cfg.types.forEach((t) => {
        const slot = el('div', 'cm-slot');
        const icon = pearl(t, this.cfg.assetRoot);
        const text = el('div', 'cm-slot__text');
        const count = el('span', 'cv-value', '00');
        text.append(el('span', 'cm-slot__name', t.name), count);
        slot.append(icon, text);
        host.append(slot);
        this.slots.push({ slot, icon, count });
      });
    }

    buildLegend() {
      const host = $('legend');
      host.innerHTML = '';
      this.cfg.types.forEach((t) => {
        const li = el('li');
        li.append(pearl(t, this.cfg.assetRoot), el('span', '', t.name));
        host.append(li);
      });
    }

    on(id, fn) {
      $(id).addEventListener('click', fn);
    }

    /** 'title' | 'result' | 'game' */
    show(name) {
      this.el.title.classList.toggle('is-open', name === 'title');
      this.el.result.classList.toggle('is-open', name === 'result');
      if (name === 'title') CAVIAR.juice.enter(this.el.title);
      if (name !== 'game') { this.tableBanner.hide(); this.el.table.classList.remove('cv-hurry'); }
    }

    /** A gold-ruled band across the table (table cleared, big combos). */
    banner(label, sub) { this.tableBanner.show(label, sub, 1500); }

    /** The table takes a knock (the board stepped down). */
    knock() { CAVIAR.juice.restart(this.el.table, 'cv-knock'); }

    setBest(best) {
      this.el.titleBest.textContent = pad(best, 5);
    }

    _set(key, node, value) {
      if (this.cache[key] !== value) {
        this.cache[key] = value;
        node.textContent = value;
      }
    }

    /** Called every frame with plain numbers. */
    setHud(h) {
      this._set('stage', this.el.stage, pad(h.stage, 2));
      this._set('time', this.el.time, pad(Math.ceil(h.time), 2));
      this.scoreRoll.set(h.score, h.live);   // rolls toward the score instead of jumping
      if (this.cache.combo !== h.combo) {
        const up = h.combo > (this.cache.combo || 0);
        this._set('combo', this.el.combo, String(h.combo));
        if (up && h.combo >= 2) {
          CAVIAR.juice.restart(this.el.comboItem, 'is-flash');
          CAVIAR.juice.restart(this.el.combo, 'cv-pop');
        }
      }
      if (this.cache.alert !== h.alert) {
        this.cache.alert = h.alert;
        this.el.timeItem.classList.toggle('is-alert', h.alert);
        this.el.table.classList.toggle('cv-hurry', h.alert);   // the table frame breathes garnet
      }
    }

    resetCollection() {
      this.counts = this.cfg.types.map(() => 0);
      this.slots.forEach((s) => { s.count.textContent = '00'; });
    }

    bumpCollection(type) {
      const s = this.slots[type];
      if (!s) return;
      this.counts[type]++;
      s.count.textContent = pad(this.counts[type], 2);
      s.slot.classList.remove('is-bump');
      void s.slot.offsetWidth; // restart transition
      s.slot.classList.add('is-bump');
      CAVIAR.juice.restart(s.count, 'cv-pop');
      clearTimeout(s.timer);
      s.timer = setTimeout(() => s.slot.classList.remove('is-bump'), 260);
    }

    /** Centre of a collection slot's pearl, in CSS px relative to #app. */
    slotCenter(type) {
      const r = this.slots[type].icon.getBoundingClientRect();
      const a = this.app.getBoundingClientRect();
      return { x: r.left + r.width / 2 - a.left, y: r.top + r.height / 2 - a.top, r: r.width / 2 };
    }

    /** The score counts up from zero (same format as the other games); a new record is sealed. */
    showResult(d) {
      const e = this.el;
      e.resultTitle.textContent = d.reason === 'overflow' ? '게임 오버' : '시간 종료';
      e.resultBest.textContent = pad(d.best, 5);
      e.resultNew.hidden = true;
      this.setBest(d.best);
      this.show('result');
      CAVIAR.juice.enter(e.result);
      CAVIAR.juice.countUp(e.resultScore, d.score, 5).then(() => {
        if (!d.newBest || !e.result.classList.contains('is-open')) return;
        e.resultNew.hidden = false;
        CAVIAR.juice.seal(e.result.querySelector('.cv-panel'));
      });
    }
  }

  return UI;
})();
