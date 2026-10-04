/* CAVIAR ESCAPE — tuning & asset slots.
   World units: the shorter side of the play area is always 360 units,
   so difficulty feels the same on a 360px phone and a desktop window. */
(function (NS) {
  'use strict';

  NS.config = {
    gameId: 'caviar-escape',
    stage: 1,
    // A survival run: no clock. The record is the time survived; one life (a +1 life booster
    // adds one), and a pre-save shield takes one hit (2 with the V8 weekly booster).
    lives: 1,
    ramp: 35,              // seconds for the sharks to reach full strength; past it they keep thickening slowly
    invulnTime: 1.0,       // seconds after a hit (or a shield break)
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
      maxSpeed: 160,       // keys and stick (the member is small: a slower top speed aims better)
      response: 0,         // 0 = keys and stick move and stop the member at once (no glide)
      knockback: 170,
      pickRadius: 15       // reach for pearls (from the capsule axis)
    },

    shark: {
      length: 58,
      radius: 11,
      size: 0.48,          // the hunting shark (length and radius x size; dart, dash and pack have their own size)
      baseSpeed: 72,
      speedGain: 1.8,      // + units/s per second elapsed, up to the ramp
      turnRate: 1.75,      // rad/s — limited turning is what makes dodging possible
      turnGain: 0.025,
      trackTime: [3.2, 4.8], // seconds a shark hunts before swimming off
      warnTime: 0.75       // edge marker before it enters
    },

    // Darts: small sharks from every edge, ever thicker (one every `every[0]` s at first,
    // `every[1]` s at full strength). aimed: share shot at the player; the rest cross on their
    // own line, `wavy` of them swaying. ease: slow at first (a beginner gets past 20 s), steep
    // later. Past the ramp: gap / (1 + overtime x s), speed x (1 + speedOvertime x s).
    dart: { size: 0.34, first: 0.5, every: [0.42, 0.09], speed: [125, 205], ease: 1.4, spread: 0.16,
            aimed: 0.35, wavy: 0.5, waveAmp: [14, 30], overtime: 0.02, speedOvertime: 0.006 },

    // Dash shark (wave 2 on): aims from the edge, locks its line, then charges straight across.
    dash: { size: 0.62, aimTime: 1.0, lockTime: 0.3, speed: 360, every: [3.6, 5.2] },

    // Shark pack (wave 3 on): small sharks in a column crossing the screen, no tracking.
    pack: { size: 0.38, count: 5, gap: 20, speed: 140, warnTime: 0.9, every: [4.2, 6.0] },

    waves: [
      { at: 0 },
      { at: 12, label: 'WAVE 2', sub: '돌진 상어 등장' },
      { at: 25, label: 'WAVE 3', sub: '상어 떼가 몰려와요' },
      { at: 40, label: 'DEEP SEA', sub: '상어가 점점 빨라져요' }
    ],

    spawn: {
      first: 0.6,
      intervalStart: 2.4,
      intervalEnd: 1.05,
      maxStart: 0,         // concurrent hunting sharks at t=0 (none: the first one comes about wave 2)
      maxEnd: 1            // ... at full strength (darts, dash sharks and the pack add to this)
    },

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
