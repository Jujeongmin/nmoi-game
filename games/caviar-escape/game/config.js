/* CAVIAR ESCAPE — tuning & asset slots.
   World units: the shorter side of the play area is always 360 units,
   so difficulty feels the same on a 360px phone and a desktop window. */
(function (NS) {
  'use strict';

  NS.config = {
    gameId: 'caviar-escape',
    stage: 1,
    duration: 30,          // seconds
    lives: 3,
    invulnTime: 1.0,       // seconds after a hit
    countdown: 2.4,        // 3-2-1 before play (0.8 s per number)
    resultDelay: 1.6,      // pause between end and result modal

    worldMin: 360,

    // Path from this game's index.html to the repo root (shared assets live there).
    assetRoot: '../../',

    player: {
      // Small, like the hero of 죽림고수: lots of room between the sharks.
      radius: 7,           // half width (edge clamp)
      halfHeight: 15,      // half height of the standing chibi (edge clamp)
      spriteHeight: 30,    // on-screen body height of the member sprite (renderer scales its trims by it)
      hitRadius: 4.5,      // hitbox = vertical capsule, a bit inside the visual
      hitSpan: 7,          // capsule half-length (head to knees)
      maxSpeed: 190,
      response: 20,        // keyboard: how quickly velocity follows input (high = immediate)
      dragGain: 1.15,      // finger drag: member moves 1.15x the finger distance
      dragMax: 2400,       // ... at most this many units/s; a faster flick catches up over the next frames
      knockback: 170,
      pickRadius: 15       // reach for pearls (from the capsule axis)
    },

    shark: {
      length: 58,
      radius: 11,
      size: 0.48,          // the hunting shark (length and radius x size; dart, dash and pack have their own size)
      baseSpeed: 72,
      speedGain: 2.2,      // + units/s per second elapsed
      turnRate: 1.75,      // rad/s — limited turning is what makes dodging possible
      turnGain: 0.025,
      trackTime: [3.2, 4.8], // seconds a shark hunts before swimming off
      warnTime: 0.75       // edge marker before it enters
    },

    // Darts: small sharks shot straight across from every edge at where the player is,
    // from the start and ever thicker (one every `every[0]` s at first, `every[1]` s at the end).
    // aimed: share shot at the player; the rest cross on their own line, `wavy` of them swaying.
    // ease: the ramp is slow at first (a beginner gets well past 10 s) and steep at the end.
    dart: { size: 0.34, first: 0.8, every: [0.8, 0.1], speed: [105, 200], ease: 2.0, spread: 0.16,
            aimed: 0.35, wavy: 0.5, waveAmp: [14, 30] },

    // Dash shark (wave 2 on): aims from the edge, locks its line, then charges straight across.
    dash: { size: 0.62, aimTime: 1.0, lockTime: 0.3, speed: 360, every: [3.6, 5.2] },

    // Shark pack (final wave): small sharks in a column crossing the screen, no tracking.
    pack: { size: 0.38, count: 5, gap: 20, speed: 140, warnTime: 0.9, every: [4.2, 6.0] },

    waves: [
      { at: 0 },
      { at: 10, label: 'WAVE 2', sub: '돌진 상어 등장' },
      { at: 20, label: 'FINAL WAVE', sub: '상어 떼가 몰려와요' }
    ],

    spawn: {
      first: 0.6,
      intervalStart: 2.4,
      intervalEnd: 1.05,
      maxStart: 0,         // concurrent hunting sharks at t=0 (none: the first one comes with wave 2)
      maxEnd: 2            // ... at the end (darts, dash sharks and the pack add to this)
    },

    score: {
      perSecond: 100,
      nearMiss: 150,
      nearMissDart: 40,    // a dart brushing by (they come by the dozen)
      nearMissDist: 11,    // gap (units) that counts as a close call
      clearPerLife: 500
    },

    // Pickups. Points are multiplied by the combo multiplier.
    pearls: { first: 1.2, every: [1.3, 2.1], max: 3, life: 6.5, points: 60 },

    // Pearls and close calls within `window` seconds chain; every `step` links adds x1, up to maxMult.
    combo: { window: 2.6, step: 3, maxMult: 5 },

    /* Member sprites come from assets/chibi/members.js (CAVIAR.members).
       Remaining asset slots: leave null to use the Canvas placeholder,
       or set an image URL. Sprites are drawn centred, facing right (+x). */
    assets: {
      shark: '../../assets/escape/shark.webp',   // tools/gen-art.py (side view, facing right)
      tin: '../../assets/bingo/tin-platinum.webp',   // the caviar tin the member carries
      // Generated scene + effects (GPT, cut by tools/make-escape-art.py).
      bg: '../../assets/escape/bg/base.webp',
      rays: '../../assets/escape/bg/rays.webp',
      kelpLeft: '../../assets/escape/bg/kelp-left.webp',
      kelpRight: '../../assets/escape/bg/kelp-right.webp',
      pearl: '../../assets/escape/fx/pearl.webp',
      twinkle: '../../assets/escape/fx/twinkle.webp',
      bubble: '../../assets/escape/fx/bubble.webp',
      ring: '../../assets/menu/ring.webp',
      glow: '../../assets/escape/fx/glow.webp',
      warn: '../../assets/escape/fx/warn.webp',
      reticle: '../../assets/escape/fx/reticle.webp',
      chevron: '../../assets/escape/fx/chevron.webp',
      confetti: '../../assets/escape/fx/confetti.webp',
      'pearl-burst': '../../assets/escape/fx/pearl-burst.webp',
      sparks: '../../assets/escape/fx/sparks.webp',
      'gold-leaf': '../../assets/menu/gold-leaf.webp'
    }
  };
})(window.CAVIAR = window.CAVIAR || {});
