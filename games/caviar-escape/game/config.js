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
    slowmo: { time: 0.25, factor: 0.35 },   // close call: game runs at 35% for 0.25 s

    worldMin: 360,

    // Path from this game's index.html to the repo root (shared assets live there).
    assetRoot: '../../',

    player: {
      radius: 13,          // half width (edge clamp)
      halfHeight: 26,      // half height of the standing chibi (edge clamp)
      spriteHeight: 52,    // on-screen body height of the member sprite
      hitRadius: 9,        // hitbox = vertical capsule, a bit inside the visual
      hitSpan: 12,         // capsule half-length (head to knees)
      maxSpeed: 190,
      response: 9,         // how quickly velocity follows input
      knockback: 230,
      pickRadius: 22       // reach for pearls (from the capsule axis)
    },

    shark: {
      length: 58,
      radius: 11,
      size: 0.82,          // the hunting shark (length and radius x size; dash and pack have their own size)
      baseSpeed: 86,
      speedGain: 2.7,      // + units/s per second elapsed
      turnRate: 1.75,      // rad/s — limited turning is what makes dodging possible
      turnGain: 0.025,
      trackTime: [3.2, 4.8], // seconds a shark hunts before swimming off
      warnTime: 0.75       // edge marker before it enters
    },

    // Dash shark (wave 2 on): aims from the edge, locks its line, then charges straight across.
    dash: { size: 1.15, aimTime: 1.0, lockTime: 0.3, speed: 430, every: [3.6, 5.2] },

    // Shark pack (final wave): small sharks in a column crossing the screen, no tracking.
    pack: { size: 0.62, count: 3, gap: 34, speed: 165, warnTime: 0.9, every: [4.2, 6.0] },

    waves: [
      { at: 0 },
      { at: 10, label: 'WAVE 2', sub: '돌진 상어 등장' },
      { at: 20, label: 'FINAL WAVE', sub: '상어 떼가 몰려와요' }
    ],

    spawn: {
      first: 0.6,
      intervalStart: 2.4,
      intervalEnd: 1.05,
      maxStart: 1,         // concurrent hunting sharks at t=0
      maxEnd: 4            // ... at the end (dash sharks and the pack add to this)
    },

    score: {
      perSecond: 100,
      nearMiss: 150,
      nearMissDist: 20,    // gap (units) that counts as a close call
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
