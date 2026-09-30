/* Sound: synthesized effects (Web Audio, no files), BGM slots, on/off switch.
   Needs cv-storage.js. Audio starts on the first tap/click (browser autoplay rules).

   CAVIAR.sound.event(gameId, type, data)  map a game event to an effect (see MAP)
   CAVIAR.sound.play(name)                 tap | shoot | collect | combo | success | fail | hit | near | wrong | order | drop
   CAVIAR.sound.bgm(key) / stopBgm()       key = gameId or 'landing'
   CAVIAR.sound.toggle() / muted()
   CAVIAR.sound.volume('bgm' | 'sfx') / setVolume(kind, 0..1)   (settings sliders, remembered)

   BGM: picked in the Caviar Sound Room (claude.ai artifact 2pKoSYb7wwRdDQk135rUTE):
   레스토랑 L1 라운지 피아노 · 훔쳐라 E1 8bit 추격 A · 매치 M3 뮤직박스 왈츠 · 셰프 C1 스윙 키친.
   They are synthesized loops (LOOPS below). When the real inst tracks arrive, set
   BGM[key] to a file path from the site root (mp3/ogg) — a file always wins over the loop.
   Effects: all A (the originals) were picked. */
(function (NS) {
  'use strict';

  var BGM = {
    'landing': null,              // e.g. 'assets/audio/lounge.mp3'
    'pages': null,
    'caviar-escape': null,        // e.g. 'assets/audio/escape-8bit-inst.mp3'
    'caviar-match': null,
    'caviar-master-chef': null
  };

  var MAP = {
    'caviar-escape': {
      go: 'start', hit: 'hit', nearMiss: 'near',
      end: function (d) { return d && d.result === 'clear' ? 'success' : 'fail'; }
    },
    'caviar-match': {
      start: 'start', fire: 'shoot', drop: 'drop', stageClear: 'success',
      collect: function (d) { return d && d.combo >= 2 ? 'combo' : 'collect'; },
      end: function (d) { return d && d.reason === 'overflow' ? 'fail' : 'success'; }
    },
    'caviar-master-chef': {
      start: 'start', order: 'order', correct: 'tap', wrong: 'wrong',
      complete: function (d) { return d && d.perfect ? 'combo' : 'collect'; },
      end: 'success'
    }
  };
  var STARTS = { go: true, start: true };

  var store = NS.storage.scope('sound');
  var muted = store.get('muted', '0') === '1';
  var vol = { bgm: readVol('bgm'), sfx: readVol('sfx') };
  var ctx = null, master = null, fxBus = null, bgmNode = null, bgmKey = null, seq = null, pendingBgm = null, fileBgm = null;
  var BGM_LEVEL = 0.9, FILE_LEVEL = 0.45;

  function readVol(kind) {
    var v = parseFloat(store.get(kind + 'Vol', '1'));
    return isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
  }

  function ac() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(ctx.destination);
    fxBus = ctx.createGain();
    fxBus.gain.value = vol.sfx;
    fxBus.connect(master);
    return ctx;
  }

  // Unlock on the first gesture, then start any BGM that was requested before it.
  function unlock() {
    var c = ac();
    if (c && c.state === 'suspended') c.resume();
    if (pendingBgm) { var k = pendingBgm; pendingBgm = null; startBgm(k); }
  }
  ['pointerdown', 'keydown'].forEach(function (t) { window.addEventListener(t, unlock, { passive: true }); });

  function tone(freq, t0, dur, type, vol, glideTo) {
    var c = ctx;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(fxBus);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  // A soft bell: fundamental + a quiet octave-and-fifth partial.
  function bell(freq, t0, dur, vol) {
    tone(freq, t0, dur, 'sine', vol);
    tone(freq * 3, t0, dur * 0.6, 'sine', (vol || 0.2) * 0.18);
  }

  var FX = {
    tap: function (t) { tone(880, t, 0.06, 'triangle', 0.08); },
    start: function (t) { bell(784, t, 0.35, 0.14); bell(1175, t + 0.09, 0.4, 0.12); },
    shoot: function (t) { tone(520, t, 0.14, 'sine', 0.1, 900); },
    collect: function (t) { bell(1047, t, 0.5, 0.14); bell(1319, t + 0.07, 0.5, 0.11); },
    combo: function (t) { [1047, 1319, 1568, 2093].forEach(function (f, i) { bell(f, t + i * 0.06, 0.45, 0.11); }); },
    success: function (t) { [784, 988, 1175, 1568].forEach(function (f, i) { bell(f, t + i * 0.11, 0.7, 0.14); }); },
    fail: function (t) { tone(392, t, 0.35, 'triangle', 0.12, 330); tone(294, t + 0.25, 0.5, 'triangle', 0.1, 247); },
    hit: function (t) { tone(180, t, 0.18, 'square', 0.08, 90); },
    near: function (t) { tone(1568, t, 0.08, 'triangle', 0.06); },
    wrong: function (t) { tone(220, t, 0.16, 'square', 0.06); tone(208, t + 0.08, 0.16, 'square', 0.05); },
    order: function (t) { bell(1319, t, 0.3, 0.09); },
    drop: function (t) { tone(330, t, 0.25, 'sine', 0.09, 196); }
  };

  function play(name) {
    if (muted || !FX[name]) return;
    var c = ac();
    if (!c || c.state !== 'running') return;
    FX[name](c.currentTime + 0.005);
  }

  /* ---------- BGM ---------- */

  /* ---------- BGM loops (step sequencer, 16 steps per bar) ---------- */

  var NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function hz(name) {   // "C4", "F#3"
    var r = /^([A-G])([#b]?)(-?\d)$/.exec(name);
    var n = 12 * (Number(r[3]) + 1) + NOTE[r[1]] + (r[2] === '#' ? 1 : r[2] === 'b' ? -1 : 0);
    return 440 * Math.pow(2, (n - 69) / 12);
  }
  function seqOf(len, map) {
    var a = new Array(len).fill(0);
    Object.keys(map).forEach(function (k) { a[Number(k)] = map[k]; });
    return a;
  }
  function line(list, spacing) {
    var map = {};
    list.forEach(function (n, i) { if (n) map[i * spacing] = n; });
    return map;
  }
  function chords(list, hits) {
    var map = {};
    list.forEach(function (c, bar) { hits.forEach(function (h) { map[bar * 16 + h] = c; }); });
    return seqOf(list.length * 16, map);
  }

  // Sustained voice (for keys and bass): attack, hold, release.
  function voice(f, t0, dur, type, vol, attack) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.setValueAtTime(vol, t0 + Math.max(attack, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(bgmBus);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  var noiseBuf = null;
  function hat(t0, vol) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 7000;
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.04);
    s.connect(f); f.connect(g); g.connect(bgmBus);
    s.start(t0); s.stop(t0 + 0.06);
  }

  var INST = {
    epiano: function (f, t, d, v) { voice(f, t, d, 'sine', v, 0.01); voice(f * 2, t, d * 0.5, 'sine', v * 0.22, 0.005); },
    bell: function (f, t, d, v) { voice(f, t, d, 'sine', v, 0.005); voice(f * 2.76, t, d * 0.45, 'sine', v * 0.16, 0.005); voice(f * 5.4, t, d * 0.2, 'sine', v * 0.06, 0.005); },
    pluck: function (f, t, d, v) { voice(f, t, d, 'triangle', v, 0.004); voice(f * 2, t, d * 0.4, 'sine', v * 0.25, 0.004); },
    sub: function (f, t, d, v) { voice(f, t, d, 'sine', v, 0.01); },
    bass: function (f, t, d, v) { voice(f, t, d, 'triangle', v, 0.01); },
    square: function (f, t, d, v) { voice(f, t, d, 'square', v, 0.004); },
    tri8: function (f, t, d, v) { voice(f, t, d, 'triangle', v, 0.004); },
    hat: function (f, t, d, v) { hat(t, v); }
  };

  var LOOPS = {
    // L1 라운지 피아노 — Rhodes jazz chords, 84 BPM
    'landing': { bpm: 84, tracks: [
      { inst: 'epiano', len: 14, vol: 0.06, seq: chords(['C4+E4+G4+B4', 'A3+C4+E4+G4', 'D4+F4+A4+C5', 'G3+B3+D4+F4'], [0, 10]) },
      { inst: 'sub', len: 6, vol: 0.12, seq: chords(['C2', 'A1', 'D2', 'G1'], [0, 8]) },
      { inst: 'bell', len: 6, vol: 0.035, seq: seqOf(64, (function () { var m = line(['E5', 0, 'G5', 'B5', 0, 'A5', 0, 'G5'], 8), o = {}; Object.keys(m).forEach(function (k) { o[Number(k) + 4] = m[k]; }); return o; })()) }
    ] },
    // E1 8bit 추격 A — major chase, 152 BPM
    'caviar-escape': { bpm: 152, tracks: [
      { inst: 'square', len: 1.8, vol: 0.03, seq: ['E5', 0, 'G5', 'E5', 'A5', 0, 'G5', 'E5', 'D5', 0, 'E5', 'D5', 'C5', 'D5', 'E5', 0, 'E5', 0, 'G5', 'A5', 'B5', 0, 'A5', 'G5', 'E5', 0, 'D5', 'C5', 'D5', 0, 0, 0] },
      { inst: 'tri8', len: 3.6, vol: 0.06, seq: seqOf(32, line(['A2', 'A2', 'E3', 'A2', 'G2', 'G2', 'D3', 'G2', 'F2', 'F2', 'C3', 'F2', 'E2', 'E2', 'B2', 'E2'], 2)) }
    ] },
    // M3 뮤직박스 왈츠 — music box in 3/4, 96 BPM
    'caviar-match': { bpm: 96, tracks: [
      { inst: 'bell', len: 4, vol: 0.05, seq: seqOf(48, line(['G5', 'E5', 'C5', 'A5', 'F5', 'C5', 'B5', 'G5', 'D5', 'C6', 'G5', 'E5'], 4)) },
      { inst: 'pluck', len: 4, vol: 0.05, seq: seqOf(48, line(['C4', 'E4+G4', 'E4+G4', 'F3', 'A3+C4', 'A3+C4', 'G3', 'B3+D4', 'B3+D4', 'C4', 'E4+G4', 'E4+G4'], 4)) }
    ] },
    // C1 스윙 키친 — walking bass + swing, 132 BPM
    'caviar-master-chef': { bpm: 132, swing: 0.28, tracks: [
      { inst: 'bass', len: 3.4, vol: 0.12, seq: seqOf(64, line(['C3', 'E3', 'G3', 'A3', 'F2', 'A2', 'C3', 'D3', 'G2', 'B2', 'D3', 'F3', 'C3', 'G2', 'A2', 'B2'], 4)) },
      { inst: 'epiano', len: 2, vol: 0.045, seq: chords(['E4+G4+B4', 'A3+C4+E4', 'F4+A4+B4', 'E4+G4+B4'], [2, 6, 10, 14]) },
      { inst: 'hat', len: 1, vol: 0.02, seq: seqOf(8, { 0: 1, 3: 1, 4: 1, 7: 1 }) }
    ] }
  };
  LOOPS['pages'] = LOOPS['landing'];   // recipe book + trailer use the restaurant loop

  var bgmBus = null;
  function playLoop(loop) {
    var c = ctx;
    if (!bgmBus) { bgmBus = c.createGain(); bgmBus.gain.value = BGM_LEVEL * vol.bgm; bgmBus.connect(master); }
    var stepDur = 60 / loop.bpm / 4, step = 0, next = c.currentTime + 0.06;
    var timer = setInterval(function () {
      while (next < c.currentTime + 0.15) {
        var swing = loop.swing && step % 2 === 1 ? loop.swing * stepDur : 0;
        loop.tracks.forEach(function (tr) {
          var v = tr.seq[step % tr.seq.length];
          if (!v) return;
          var fs = v === 1 ? [0] : String(v).split('+').map(hz);
          fs.forEach(function (f) { INST[tr.inst](f, next + swing, tr.len * stepDur, tr.vol); });
        });
        step++; next += stepDur;
      }
    }, 25);
    return { stop: function () { clearInterval(timer); } };
  }

  function startBgm(key) {
    stopBgm();
    bgmKey = key;
    if (muted) return;
    var src = BGM[key];
    if (src) {
      var a = new Audio(NS.url(src));
      a.loop = true;
      a.volume = FILE_LEVEL * vol.bgm;
      fileBgm = a;
      a.play().catch(function () { pendingBgm = key; });
      bgmNode = { stop: function () { a.pause(); a.src = ''; } };
    } else if (LOOPS[key]) {
      var c = ac();
      if (!c || c.state !== 'running') { pendingBgm = key; return; }
      bgmNode = playLoop(LOOPS[key]);
    }
  }

  function stopBgm() {
    if (bgmNode) { bgmNode.stop(); bgmNode = null; }
  }

  /* ---------- switch ---------- */

  var buttons = [];
  function label() { return muted ? '사운드 꺼짐' : '사운드 켜짐'; }
  function refresh() {
    buttons.forEach(function (b) {
      b.textContent = '♪ ' + label();
      b.setAttribute('aria-pressed', muted ? 'false' : 'true');
      b.classList.toggle('is-off', muted);
    });
  }

  function setVolume(kind, v) {
    if (kind !== 'bgm' && kind !== 'sfx') return;
    vol[kind] = Math.max(0, Math.min(1, Number(v) || 0));
    store.set(kind + 'Vol', String(vol[kind]));
    if (kind === 'sfx' && fxBus) fxBus.gain.value = vol.sfx;
    if (kind === 'bgm') {
      if (bgmBus) bgmBus.gain.value = BGM_LEVEL * vol.bgm;
      if (fileBgm) fileBgm.volume = FILE_LEVEL * vol.bgm;
    }
  }

  function toggle() {
    muted = !muted;
    store.set('muted', muted ? '1' : '0');
    if (master) master.gain.value = muted ? 0 : 0.8;
    if (muted) stopBgm();
    else if (bgmKey) startBgm(bgmKey);
    refresh();
    return muted;
  }

  function button() {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'cv-sound-toggle';
    b.addEventListener('click', function () { unlock(); toggle(); });
    buttons.push(b);
    refresh();
    return b;
  }

  NS.sound = {
    bgmFiles: BGM,
    play: play,
    bgm: function (key) { if (ctx && ctx.state === 'running') startBgm(key); else { bgmKey = key; pendingBgm = key; } },
    stopBgm: function () { stopBgm(); bgmKey = null; pendingBgm = null; },
    toggle: toggle,
    muted: function () { return muted; },
    volume: function (kind) { return vol[kind]; },
    setVolume: setVolume,
    button: button,

    /** Map a game event to an effect; also starts / stops that game's BGM. */
    event: function (gameId, type, data) {
      var m = MAP[gameId] && MAP[gameId][type];
      if (STARTS[type]) NS.sound.bgm(gameId);
      if (type === 'end') NS.sound.stopBgm();
      if (!m) return;
      play(typeof m === 'function' ? m(data) : m);
    }
  };

  // Every button on the shared design system clicks softly.
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('.cv-btn, .lp-can, .lp-opt, .cv-bingo__cell, .pg-spot')) play('tap');
  });

  // Game title cards get the switch automatically.
  var title = document.querySelector('#screen-title .cv-panel');
  if (title) {
    var actions = title.querySelector('.cv-actions');
    var b = button();
    if (actions) title.insertBefore(b, actions); else title.appendChild(b);
  }
})(window.CAVIAR = window.CAVIAR || {});
