# nmoi game

NMOI PRE-SAVE interactive page — "Caviar at a fine-dining restaurant".
A light restaurant flow (table → order → serving → caviar cans) leads into three mini games
that share one design system, one set of member sprites, a 4x4 mission bingo, a Verse8
leaderboard and a Spotify pre-save push after every run. Portrait (세로형) only.

Static web, no build step. Serve the repo root with any static server:

```
npx http-server -c-1
# http://localhost:8080/                      landing
# http://localhost:8080/games/caviar-escape/  a game on its own
```

Deploy target is the Verse8 repo (see **Verse8 deploy**). The leaderboard only works there.

## Structure

```
index.html                  landing: table → order → serving → caviar cans → game
landing/                    config (copy, questions, mappings), flow, ui, menu, main, css
pages/                      recipe (B-cut book), trailer (basket) + content.js (all placeholder content)
games/
  caviar-escape/            mini game 01 — 30 s shark-dodge survival
  caviar-match/             mini game 02 — 60 s caviar shooter puzzle
  caviar-master-chef/       mini game 03 — 60 s order-memory plating
shared/                     used by every page
  cv-theme.css              tokens + HUD, buttons, ivory panel, overlay, pearls, asset slots, splash
  cv-storage.js             guarded localStorage; CAVIAR.root / CAVIAR.url() (site-root URLs)
  cv-hub.js                 landing ⇄ game hand-off (order, ?from=hub, Verse8 ?account/auth kept)
  cv-bingo.js / -ui.js      4x4 bingo: quests, board, rewards / board overlay + quest blocks
  cv-bingo.css              bingo, pre-save panel, rank line styles
  cv-brand.js               asset slots (CAVIAR.assetSlot), Verse8 splash + logo
  cv-presave.js             Spotify pre-save link + full-screen panel after each run
  cv-leaderboard.js         nickname sync, score submit, rank line (opt-in)
  cv-sound.js               synthesized effects, BGM loops, sound switch
  cv-frame.js               reports page size to the Verse8 parent frame
assets/
  landing/ pages/ bingo/    generated art (GPT image) — replace freely
  caviar/                   caviar roe icons (generated) — used by .cv-pearl and the Match board
  chibi/                    256px member sheets (webp) + members.js (generated)
  source/                   originals: nmoi chibi exports, generated sheets before cropping
verse8/                     Verse8-only files copied by the sync script
  server.js                 leaderboard server (setNickname / submitScore / getLeaderboard)
  src/cv-server.ts          client bridge -> built to shared/cv-server.js
  vite.config.ts            emits the bridge at a fixed path
tools/
  make-chibi.py             source/nmoi -> chibi/ (needs Pillow)
  sync-verse8.py            copy the site into the Verse8 (Vite) repo
```

A new game goes in `games/<name>/`, links `../../shared/cv-theme.css`, loads the shared
scripts in the same order as the existing games and sets `assetRoot: '../../'` in its config.

## Where the placeholders are ("ASSET" slots)

| Asset | File |
|---|---|
| Spotify pre-save URL, album cover | `shared/cv-presave.js` |
| Verse8 splash, logo | `shared/cv-brand.js` |
| B-cuts (15), member handwriting, trailer videos (YouTube) | `pages/content.js` |
| Escape success / fail art (star chef, shark-hat member) | `games/caviar-escape/game/config.js` → `resultArt` |
| Table photo, tins, drinks, paper | `landing/config.js` |
| Caviar icons | `shared/cv-theme.css` (`.cv-pearl--*`), `games/caviar-match/game/config.js` |
| BGM files (replace the synthesized loops) | `shared/cv-sound.js` → `BGM` |

Paths are from the site root; `null` shows a labelled slot.

## Landing (index.html)

1. **Table** — photo with the closed CAVIAR MENU; tap and it zooms open.
2. **Order** — nickname, mood, favourite caviar (5), how you eat caviar (4), drink (4),
   optional consent to show nickname + best score on the leaderboard (+ privacy notice draft).
3. **Serving** — the member for the chosen caviar greets the guest by nickname; eating
   answers 1–3 → idle face, 4 → frown. Caviar tin + drink cards.
4. **Cans** — ALMAS → Caviar Escape, IMPERIAL → Caviar Match, CLASSIC → Caviar Master Chef;
   shortcuts to the Recipe Book and Trailer.

Menu (☰): Recipe Book, Trailer, Mission Bingo, Ranking, Pre-save, Sound, Restart, Login (not built).
Debug: `CAVIAR.landing.go('order' | 'serve' | 'cans')`.

## Content pages (pages/)

- **Recipe Book** — B-cut polaroids (15, browse with ‹ ›), tap to view large and save
  (phones: share sheet → save image; desktop: file download; placeholder card until real B-cuts).
  Canapé recipe and four member handwriting notes.
- **Trailer** — basket photo with 8 hotspots (5 members, group, teaser and M/V locked);
  each opens a YouTube player or the video slot.

## Bingo (shared/cv-bingo.js)

4x4 = 5 quests per game x 3 + 1 NMOI pre-save cell (row 2, col 2). Games call
`CAVIAR.bingo.report(gameId, stats)` on their result; quests are judged there. Tins fill with
that game's caviar; finished lines get a gold rule; reward tiers (1/2/3 lines) are placeholders.
Progress is localStorage. Reset: `CAVIAR.bingo.reset()`.

## Pre-save (shared/cv-presave.js)

A full-screen panel after every game run (close appears after 3 s), plus the bingo cell and
the menu. Self-reported for now: opening the link fills the bingo cell.

## Leaderboard (Verse8 server)

`verse8/server.js` keeps one row per account per game (best score only) and a combined board
(sum of the three bests). Nickname = the order sheet's name, sent only with consent.
Scores are submitted from `cv-bingo.js` at each result. The server logic is plain JS: it can be
tested without Verse8 by passing an in-memory `$global` / `$sender` into the `Server` class.

## Sound (shared/cv-sound.js)

Picked in the Caviar Sound Room: restaurant L1 lounge piano, Escape E1 8-bit chase,
Match M3 music box waltz, Chef C1 swing kitchen; all effects A. Everything is synthesized
(Web Audio, no files), written for this project. Starts on the first tap; switch on title cards
and in the menu. Real inst tracks: set `BGM[key]` to a file path.

## Verse8 deploy

The Verse8 repo (GitLab, branch `develop`) is a Vite template; pushing it deploys.

```
python tools/sync-verse8.py ../verse8-web   # public/ ← shared, landing, games, pages, runtime assets;
                                            # index.html, server.js, src/cv-server.ts, vite.config.ts
cd ../verse8-web && npm run build           # local check: dist/ has index.html, shared/cv-server.js
```

Then commit and push `develop` in the Verse8 repo. Local scripts and stylesheets get `?v=<build>`
so a CDN never serves a stale config against renamed files.

## Members

나라 · 나탈리 · 세린 · 티야 · 유온 (`assets/chibi/members.js`).

- Sheets: rows idle / frown / dance, 256px cells (webp), with body bounds for placement.
- Rebuild after new art: `python tools/make-chibi.py`.

## Caviar Escape (games/caviar-escape)

- 30 s, 3 lives, 1 s invulnerability after a touch.
- Score: +100/s survived, +150 per close call, +500 per remaining life on success.
- Member: idle while swimming, frown on a touch, dance + orbiting caviar on success.
- Tuning: `games/caviar-escape/game/config.js`. Shark art slot: `config.assets.shark`.

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
- Tuning: `games/caviar-match/game/config.js`.

## Caviar Master Chef (games/caviar-master-chef)

- 60 s. Read the order ticket, it hides, then pick ingredients in the same
  order and finish with the Signature Caviar. Orders grow 3 → 4 → 5 → 6 steps.
- Score: +100 per correct pick, +500 per order, +300 perfect (no mistakes).
  Wrong pick: input cancelled, −2 s. Combo = consecutive perfect orders.
- Caviar is never placed on the food: the chosen caviar aligns in a separate
  signature dish beside the plate and the gold rims light up.
- Tuning and content: `games/caviar-master-chef/game/config.js`.
- Debug: `CAVIAR.debug.step(seconds)` / `CAVIAR.debug.game` in the console.
