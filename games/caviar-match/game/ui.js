/* CAVIAR MATCH — DOM UI: HUD, collection strip, title and result cards.
   Knows nothing about rules — it is handed plain values. */
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
        resultEyebrow: $('result-eyebrow'),
        resultTitle: $('result-title'),
        resultScore: $('result-score'),
        resultBest: $('result-best'),
        resultNew: $('result-new'),
        resultCombo: $('result-combo'),
        resultTypes: $('result-types'),
      };
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
    }

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
      this._set('score', this.el.score, pad(h.score, 5));
      if (this.cache.combo !== h.combo) {
        const up = h.combo > (this.cache.combo || 0);
        this._set('combo', this.el.combo, String(h.combo));
        if (up && h.combo >= 2) {
          this.el.comboItem.classList.remove('is-flash');
          void this.el.comboItem.offsetWidth;
          this.el.comboItem.classList.add('is-flash');
        }
      }
      if (this.cache.alert !== h.alert) {
        this.cache.alert = h.alert;
        this.el.timeItem.classList.toggle('is-alert', h.alert);
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
      clearTimeout(s.timer);
      s.timer = setTimeout(() => s.slot.classList.remove('is-bump'), 260);
    }

    /** Centre of a collection slot's pearl, in CSS px relative to #app. */
    slotCenter(type) {
      const r = this.slots[type].icon.getBoundingClientRect();
      const a = this.app.getBoundingClientRect();
      return { x: r.left + r.width / 2 - a.left, y: r.top + r.height / 2 - a.top, r: r.width / 2 };
    }

    showResult(d) {
      const e = this.el;
      e.resultEyebrow.textContent = '스테이지 ' + pad(d.stage, 2) + ' 결과';
      e.resultTitle.textContent = d.reason === 'overflow' ? '게임 오버' : '시간 종료';
      e.resultScore.textContent = pad(d.score, 5);   // same format as the other games
      e.resultBest.textContent = pad(d.best, 5);
      e.resultNew.hidden = !d.newBest;
      e.resultCombo.textContent = String(d.maxCombo);

      const list = e.resultTypes;
      list.innerHTML = '';
      this.cfg.types.forEach((t, i) => {
        const li = el('li');
        li.append(
          pearl(t, this.cfg.assetRoot),
          el('span', 'cm-result-types__name', t.name),
          el('span', 'cm-result-types__count', String(d.collected[i]))
        );
        list.append(li);
      });
      list.classList.remove('is-aligning');
      void list.offsetWidth;
      list.classList.add('is-aligning');

      this.setBest(d.best);
      this.show('result');
    }
  }

  return UI;
})();
