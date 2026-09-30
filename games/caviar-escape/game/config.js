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
    countdown: 1.8,        // 3-2-1 before play
    resultDelay: 1.3,      // pause between end and result modal

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
      knockback: 230
    },

    shark: {
      length: 58,
      radius: 11,
      baseSpeed: 86,
      speedGain: 2.7,      // + units/s per second elapsed
      turnRate: 1.75,      // rad/s — limited turning is what makes dodging possible
      turnGain: 0.025,
      trackTime: [3.2, 4.8], // seconds a shark hunts before swimming off
      warnTime: 0.75       // edge marker before it enters
    },

    spawn: {
      first: 0.6,
      intervalStart: 2.4,
      intervalEnd: 0.85,
      maxStart: 1,         // concurrent hunting sharks at t=0
      maxEnd: 5            // ... at the end
    },

    score: {
      perSecond: 100,
      nearMiss: 150,
      nearMissDist: 20,    // gap (units) that counts as a close call
      clearPerLife: 500
    },

    /* Member sprites come from assets/chibi/members.js (CAVIAR.members).
       Remaining asset slots: leave null to use the Canvas placeholder,
       or set an image URL. Sprites are drawn centred, facing right (+x). */
    assets: {
      shark: '../../assets/escape/shark.webp'   // tools/gen-art.py (top-down, facing right)
    },

    /* Result-card art (paths from the site root; null = labelled placeholder slot). */
    resultArt: {
      clear: null,   // 성공: 스타 셰프가 멋진 캐비어 요리를 서빙하는 이미지
      over: null     // 실패: 상어 모자를 쓴 멤버 이미지
    }
  };
})(window.CAVIAR = window.CAVIAR || {});
