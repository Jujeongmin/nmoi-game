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
  caviar-match/             mini game 02 — 60 s caviar shooter puzzle
    index.html
    game/                   config, board, logic, caviar-art, renderer, fx, ui, main, game.css
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

## Caviar Match (games/caviar-match)

- Bubble-shooter loop: aim, send, bounce off walls, settle on the hex grid, match 3+.
- Matched caviar glow softly, then glide into the Collection strip — nothing bursts.
  Caviar left without a hold on the top are gathered too.
- 60 s. Board steps down every 14 s (faster per stage) and after 5 shots without a match;
  crossing the dotted line ends the run. Clearing the board starts the next stage.
- Score: +100 per caviar, +150 per caviar gathered after losing its hold,
  +150 x (combo - 1) from the second consecutive match, +2000 per cleared board.
- Controls: drag and release (touch), move and click (mouse). Releasing below the
  shooter cancels the shot.
- Code split: `board.js` + `logic.js` are rules only (no DOM); `renderer.js`, `fx.js`
  and `ui.js` only read state and listen to game events.
- Caviar art slot: `config.types[].image` (path from repo root; null = canvas pearl).
  Canvas pearls and DOM icons both switch.
- Tuning: `games/caviar-match/game/config.js`.
