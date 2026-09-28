/* CAVIAR MATCH — tunable data. Game logic and rendering read from here. */
window.CM = window.CM || {};

CM.CONFIG = {
  gameId: 'caviar-match',
  assetRoot: '../../',

  // Board geometry (world units; the view scales the world to the screen)
  cols: 9,
  radius: 20,              // world width = cols * 2 * radius = 360
  minWorldHeight: 560,     // view guarantees at least this much height
  maxWorldHeight: 700,     // extra height on very tall screens is letterboxed

  // Rules
  timeLimit: 60,
  startRows: 5,
  matchSize: 3,
  clusterChance: 0.45,     // chance a new caviar copies a neighbour (keeps boards playable)
  missesBeforeDrop: 5,     // shots without a match before the board steps down
  dropInterval: 14,        // seconds between timed steps (shrinks per stage)
  dropIntervalMin: 8,
  alertTime: 10,           // HUD time turns bright from here

  // Shooting
  shotSpeed: 1150,         // world units / second
  collideFactor: 0.8,      // <1 lets shots slip through tight gaps a little
  minAimDeg: 9,            // keeps aim off the horizontal

  score: {
    perCaviar: 100,
    perDetached: 150,      // caviar gathered because they lost their hold
    comboBonus: 150,       // x (combo - 1) from the second consecutive match
    clearBonus: 2000,
  },

  /* Caviar types. `base` matches the shared --cv-caviar-* tokens; `pearl` picks the
     shared .cv-pearl--* class for DOM icons. To use real art set `image` to a path
     relative to the repo root (square PNG, transparent), e.g. 'assets/caviar/almas.png'. */
  types: [
    { id: 'almas',    name: 'ALMAS',    pearl: 'white', light: '#fbf8f0', base: '#e6dfcf', shade: '#9d9582', rim: 'rgba(255, 248, 230, 0.55)', gloss: 0.8,  image: null },
    { id: 'imperial', name: 'IMPERIAL', pearl: 'green', light: '#939e6c', base: '#56603f', shade: '#232815', rim: 'rgba(214, 196, 140, 0.35)', gloss: 0.45, image: null },
    { id: 'classic',  name: 'CLASSIC',  pearl: 'black', light: '#57534c', base: '#22201d', shade: '#050404', rim: 'rgba(214, 190, 140, 0.5)',  gloss: 0.38, image: null },
    { id: 'platinum', name: 'PLATINUM', pearl: 'gold',  light: '#f4e5c2', base: '#c9ae78', shade: '#7a6337', rim: 'rgba(255, 240, 200, 0.5)',  gloss: 0.65, image: null },
  ],
};
