# nmoi game

NMOI PRE-SAVE interactive page — "Caviar at a fine-dining restaurant".
A light restaurant flow (table → order → serving → caviar cans) leads into three mini games
that share one design system, one set of member sprites, a 4x4 mission bingo, a weekly Verse8
leaderboard and a Spotify pre-save push after every run. Portrait (세로형) only.

**CAVIAR COURSE** (the campaign): 3 weeks, one new game per week — W1 매치 10/26 · W2 훔쳐라 11/2 ·
W3 셰프 11/9, release 11/16. Every date and number lives in `shared/cv-campaign.js`.

| Tier | Needs | Gets |
|---|---|---|
| 0 · entry | nickname + email, one required consent (no sign-up) | games (3 runs/day each), weekly leaderboard, tickets |
| pre-save | one click (self-reported) | +2 tickets, score x1.2, +1 run/day, bingo centre cell |
| 1 · V8 login | Verse8 account (placeholder: `?account=` in the URL, or the demo switch) | bingo missions → B-cut cards, lines +3 tickets, full board → showcase draw |

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
  caviar-match/             W1 — 60 s caviar shooter puzzle
  caviar-escape/            W2 — 30 s shark-dodge survival
  caviar-master-chef/       W3 — 60 s order-memory plating
pages/play/                 game host: iframe + postMessage for Verse8-team builds (+ sample/)
docs/game-integration.md    the integration spec for those builds
shared/                     used by every page
  cv-theme.css              tokens + HUD, buttons, ivory panel, overlay, pearls, asset slots, splash
  cv-storage.js             guarded localStorage; CAVIAR.root / CAVIAR.url() (site-root URLs)
  cv-campaign.js            weeks, dates, limits, booster, links (one place for every number)
  cv-hub.js                 landing ⇄ game hand-off (order, ?from=hub, Verse8 ?account/auth kept)
  cv-account.js             tickets, pre-save, referrals, attendance, runs/day, leaderboard client
  cv-bingo.js / -ui.js      4x4 mission bingo (15 missions + pre-save) / board, login gate, cards
  cv-bridge.js / cv-host.js game integration: game side (drop-in) / hub side (pages/play)
  cv-bingo.css              bingo, pre-save panel, rank line styles
  cv-brand.js               asset slots (CAVIAR.assetSlot), runs the Verse8 splash, logo badge
  verse8-splash/            official Verse8 Splash Module (vendor, unmodified) + its README
  cv-presave.js             pre-save chip (home, cans, HUD), panel after each run, D-day switch
  cv-sound.js               synthesized effects, BGM loops, sound switch
  cv-frame.js               reports page size to the Verse8 parent frame
assets/
  brand/                    Verse8 logo (svg/png) + splash sting (from the Verse8 Splash Module)
  landing/ pages/ bingo/    generated art (GPT image) — replace freely
  caviar/                   caviar roe icons (generated) — used by .cv-pearl and the Match board
  chibi/                    256px member sheets (webp) + members.js (generated)
  source/                   originals: nmoi chibi exports, generated sheets before cropping
verse8/                     Verse8-only files copied by the sync script
  server.js                 profile, tickets, pre-save, referrals, runs/day, weekly leaderboard
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
| Spotify pre-save / streaming links | `shared/cv-campaign.js` → `links` |
| Album cover | `shared/cv-presave.js` |
| Verse8 login button | `shared/cv-bingo-ui.js` (gate) |
| Verse8-team game builds | `shared/cv-host.js` → `GAMES[...].src` |
| B-cuts (15), member handwriting, trailer videos (YouTube) | `pages/content.js` |
| Escape success / fail art (star chef, shark-hat member) | `games/caviar-escape/game/config.js` → `resultArt` |
| Table photo, tins, drinks, paper | `landing/config.js` |
| Caviar icons | `shared/cv-theme.css` (`.cv-pearl--*`), `games/caviar-match/game/config.js` |
| BGM files (replace the synthesized loops) | `shared/cv-sound.js` → `BGM` |

Paths are from the site root; `null` shows a labelled slot.

## Verse8 splash

The official Verse8 Splash Module plays once when the site is opened — on the first page of the
visit (normally the landing; a game opened by a direct link shows it there), never again while
moving between the landing, the games and the content pages (sessionStorage): min 2.4 s, the page stays hidden until it is covered (anti-flash), and the sting
is silent when the guest has turned sound off. Result cards and the bingo board show
"POWERED BY" + the logo on a dark chip (the logo is white).

## Landing (index.html)

1. **Table** — photo with the closed CAVIAR MENU; tap and it zooms open.
2. **Order** — nickname, email, mood, favourite caviar (5), how you eat caviar (4), drink (4),
   one required consent: email only for the winner notice and de-dup, deleted within 30 days
   after the campaign; nickname shown on the leaderboard (+ privacy notice draft).
3. **Serving** — the member for the chosen caviar greets the guest by nickname; eating
   answers 1–3 → idle face, 4 → frown. Caviar tin + drink cards.
4. **Cans** — IMPERIAL → Match (W1), ALMAS → Escape (W2), CLASSIC → Master Chef (W3), each
   with its week badge and locked until its week; pre-save chip, this week's mission bar + x1.2
   nudge; shortcuts to the Recipe Book and Trailer.

Menu (☰): Recipe Book, Trailer, Mission Bingo, Ranking (weekly tabs), Pre-save, Invite, Restart,
Sound, V8 Login (slot), Demo Reset.
Debug: `CAVIAR.landing.go('order' | 'serve' | 'cans')`.

**Demo**: `demo.unlockAllWeeks` (cv-campaign.js) opens every week. `?date=2026-11-03` pretends
that day (KST) and shows the real week locks — carried across pages.

## Content pages (pages/)

- **Recipe Book** — B-cut polaroids (15, browse with ‹ ›). B-cut n is the reward card of
  bingo mission n: locked until done ("미션 보기" opens the mission). Tap to view large and save
  (phones: share sheet → save image; desktop: file download; placeholder card until real B-cuts).
  Canapé recipe and four member handwriting notes.
- **Trailer** — basket photo with 8 hotspots (5 members, group, teaser and M/V locked);
  each opens a YouTube player or the video slot.

## Bingo (shared/cv-bingo.js) — TIER 1

4x4 = 15 missions + the NMOI pre-save cell. Per week 5 missions: 2 game, 2 referral, 1 attendance
(overall game 6 · referral 6 · attendance 3 · pre-save 1). Future weeks show "11/2 공개".
Each mission opens a B-cut card; a finished line → +3 tickets (once per line); the full board →
top tier (showcase invite draw). Real name only when a reward is claimed. Without V8 login the
board shows the login gate.
Games call `CAVIAR.bingo.report(gameId, stats)` on their result; referral / attendance come from
the account. Reset: menu → Demo Reset.

## Pre-save (shared/cv-presave.js)

Shown at 선택 · HUD · 결과 · 홈: chip on the table and cans screens, a bar under every game HUD,
a CTA on the result card and a full-screen panel after every run. Click-based (no Spotify check):
+2 tickets, score x1.2, +1 run per day. From 11/16 every button becomes "Spotify에서 듣기".

## Account + leaderboard (Verse8 server)

`verse8/server.js`: profile (nickname + email; email kept as a hash for de-dup), tickets,
pre-save, referrals (share link `?ref=CODE`; counted only when a **new** email pre-saves, max 6),
attendance, runs per day (3, +1 after pre-save), weekly leaderboards `lb-<game>-<w1|w2|w3>` +
a combined board, score x1.2 after pre-save. The page keeps a local mirror so everything works
in a preview; the server is the authority on Verse8. The server logic is plain JS: it can be
tested without Verse8 by passing an in-memory `$global` / `$sender` into the `Server` class.

## Game integration (pages/play, docs/game-integration.md)

The weekly games may come from the Verse8 game team as separate builds. They run in an iframe
on `pages/play/index.html?game=<id>` and report via postMessage (`shared/cv-bridge.js`): ready →
config, start → start-ok / start-denied, end → result. The hub owns week lock, runs, missions,
leaderboard and the pre-save panel. Try it: `pages/play/index.html?game=sample`.

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
