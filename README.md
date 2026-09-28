# nmoi game

Caviar campaign mini games — "Caviar at a fine-dining restaurant".
Three games share one design system and one set of member sprites.

Static web, no build step. Serve the repo root with any static server and
open a game folder, e.g.:

```
npx http-server -c-1
# http://localhost:8080/games/caviar-escape/
```

For Verse8, upload the repo root (games reach shared files via `../../`).

## Structure

```
shared/                     campaign design system — used by every game
  cv-theme.css              tokens (colour, type) + HUD, buttons, ivory panel, overlay, pearls
  cv-storage.js             guarded localStorage (best score etc., prototype only)
assets/
  chibi/                    128px member sheets + members.js (generated)
  source/nmoi/              original chibi exports (sheets, gifs, manifests)
tools/
  make-chibi.py             source/nmoi -> chibi/ (needs Pillow)
games/
  caviar-escape/            mini game 01 — 30 s shark-dodge survival
    index.html
    game/                   config, logic, input, renderer, ui, main, game.css
```

A new game goes in `games/<name>/`, links `../../shared/cv-theme.css`, loads
`../../assets/chibi/members.js` and sets `assetRoot: '../../'` in its config.

## Members

나라 · 나탈리 · 세린 · 티야 · 유온 (`assets/chibi/members.js`).

- Sheets: rows idle / frown / dance, 128px cells, with body bounds for placement.
- Rebuild after new art: `python tools/make-chibi.py`. Korean names and the
  member list live at the top of that script.

## Caviar Escape (games/caviar-escape)

- 30 s, 3 lives, 1 s invulnerability after a touch.
- Score: +100/s survived, +150 per close call, +500 per remaining life on success.
- Member: idle while swimming, frown on a touch, dance + orbiting caviar on success.
- Tuning: `games/caviar-escape/game/config.js`.
- Shark art slot: `config.assets.shark` (null = canvas placeholder).
