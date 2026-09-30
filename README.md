# nmoi game

n Moi PRE-SAVE interactive page — "Caviar at a fine-dining restaurant".
A light restaurant flow (table → order → serving → caviar cans) leads into three mini games
that share one design system, one set of member sprites, a 4x4 mission bingo, a weekly Verse8
leaderboard and a Spotify pre-save push after every run. Portrait (세로형) only.

**Group name**: **n Moi** (lower-case n, space, capital M) — Korean **앤무아** (French *moi*).
Never NMOI / nMoi / 앤모아 in page text; `nmoi` only in code names and file names.

**CAVIAR COURSE** (the campaign): 3 weeks, one new game per week — W1 상어 (캐비어 이스케이프)
10/26 · W2 캐비어 매치 11/2 · W3 마스터 셰프 11/9, release 11/16. The game bodies
come from the Verse8 game team (iframe, `pages/play`); the repo games stand in for them.
Every date and number lives in `shared/cv-campaign.js`.

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
  cv-i18n.js / -dict.js     languages ko · en · ja · zh-Hant · zh-Hans (Korean text = key)
  cv-settings.js            settings panel: language, volumes, reduce motion, my info
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

4x4 = 15 missions + the n Moi pre-save cell (on a diagonal, so it counts for 3 lines). Overview §4:
per week 5 — game score (booster score ≥ N) · game rank (weekly top 10 %) · referral rank (weekly
top 10 of friends who came through my invite link and played) · referral count (3 / 5 / 10, cumulative) · attendance
(7 / 10 / 14 days with a finished run, of 21). Game and referral-rank cells open with their week
("11/2 공개"); referral count and attendance count from D1. Rank cells are judged on the final
weekly board after the week ends. Numbers are provisional (alpha data 10/13): `bingo` in
`shared/cv-campaign.js` and `BINGO` in `verse8/server.js`.
Each mission opens a B-cut card; a finished line → +3 tickets (once per line); the full board →
top tier (showcase invite draw). Real name only when a reward is claimed. Without V8 login the
board shows the login gate.
The Verse8 server judges every cell (`getBingo`, from its own leaderboards, referral boards,
attendance and pre-save records) and pays the line tickets; the page mirrors score, referral
count, attendance and pre-save so a local preview still fills the board. Referrals are credited
at most 5 per inviter per day. Games only report their score (`CAVIAR.bingo.report(gameId, stats)`).
Reset: menu → Demo Reset.

## Pre-save (shared/cv-presave.js)

A booster, not an ad (overview §5) — nothing interrupts a run:
- **S2 booster choice**, once before the first run: 기본 캔 (no booster) or 알마스 캔 (Spotify
  pre-save → x1.2, +1 run a day, invite link), skippable. Choosing 알마스 opens Spotify and then
  shows "알마스 캔 활성" with the invite link (S5).
- **HUD**: multiplier under every game HUD, x1.0 grey / x1.2 gold.
- **Result (S4)**, the only re-offer: "부스터였으면 N점 → 미션 달성이었어요" — N is the real score x1.2 —
  or how far the score mission still is, with the Spotify button. Pre-saved guests get their
  invite link there instead.
- Chips on the table and cans screens open the full pre-save panel; it never opens on its own.

Click-based (no Spotify check): +2 tickets, score x1.2, +1 run per day. From 11/16 every button
becomes "Spotify에서 듣기".

Tickets (응모권): pre-save +2, bingo line +3, and per game: first run +1 (once), a run +1 and a
result-screen share +1 (each once per game per day), and sending the invite link (copy / share on
the invite sheet, the bingo or the booster panel) +1 once a day. Attendance is a day with a finished run — a
visit alone does not count (the server marks it when it records the run).

More boosters (overview §5), all decided by the server:
- **V8 login**: the first counted run of each week scores x1.5 (instead of x1.2). The login is a
  placeholder (`?account=` / demo switch → `markLogin`) until the Verse8 login API is wired.
- **Referrals**: +1 run a day per referral, at most +3.
- **Attendance streak**: every 3 days in a row with a run → one +1 life booster, used by the next
  run of a game with lives (`lifeGames`; Caviar Escape shows a gold 4th pearl).
- The HUD shows the multiplier (x1.0 / x1.2 / x1.5) and the score mission's progress (S3).
- Home line (S1 / S6): a new guest sees how many joined and this week's game; a returning guest
  attendance, referrals and bingo toward their next step, and today's multiplier.

Retargeting events (overview §6) go through `CAVIAR.track(name, data)` (`shared/cv-storage.js`) to
`window.dataLayer`, and to `fbq` / `window.kreatorsPixel` when Kreators' snippet is on the page:
`entry` · `booster_choice {choice}` · `presave_click` · `presave_panel {where}` · `stream_click` ·
`share {game}` · `play {game}` · `v8_login`. Event definitions are still to be agreed with Kreators.

## Account + leaderboard (Verse8 server)

`verse8/server.js`: profile (nickname + email; email kept as a hash for de-dup), tickets,
pre-save, referrals (share link `?ref=CODE`; counted only when a **new** email finishes a first counted run — Spotify does not say who pre-saved, max 6),
attendance, runs per day (3, +1 after pre-save), weekly leaderboards `lb-<game>-<w1|w2|w3>` +
a combined board, score x1.2 after pre-save. A result card's rank line has "순위표 ›", which opens
the week's TOP 10 of that game over the card (`CAVIAR.leaderboard.open(gameId)`); the landing
menu → Ranking has every week and the combined board. The page keeps a local mirror so everything works
in a preview; the server is the authority on Verse8. The server logic is plain JS: it can be
tested without Verse8 by passing an in-memory `$global` / `$sender` into the `Server` class.

Score checks: the start / retry button opens a run on the server (`startRun`, which also counts
the run against today's limit) and the game starts only after that. If the server cannot be
reached (8 s), the page shows "서버에 연결되지 않았어요" with 다시 시도 / 새로고침 instead of starting.
A local preview has no server bridge and plays on the local mirror.
`submitScore` accepts one score per run, and only up to `maxScore x elapsed / duration` since
the start (`GAMES` in `verse8/server.js`; Caviar Match 80,000 from a bot that aims instantly,
best of 1,200 runs 49,950). Other scores are not recorded (`reason: 'no-run' | 'rejected'`).
Ranks are counted with `countCollectionItems` (no row limit).

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

## Settings + languages (shared/cv-settings.js, shared/cv-i18n.js)

Settings open from a button that is always at the top: the right end of the score bar in the games
(above the title / result cards; the game pauses while the panel is open), the left of the landing
top bar, and the header of the recipe / trailer / play pages; also from the landing menu (Settings).
The icon is drawn for the campaign (gold line gear around a caviar pearl on onyx), no emoji:
- **Language**: 한국어 · English · 日本語 · 繁體中文 · 简体中文. `?lang=en` also works; otherwise the
  saved choice, then the browser language, then English. Switching reloads the page.
- **Sound**: on/off, music volume, effects volume (remembered).
- **Display**: reduce motion (follows the system setting until changed).
- **My info**: nickname / e-mail of the order sheet, a link back to it, the privacy notice.
- **Account**: V8 login state.

i18n: the Korean text stays in the markup and scripts and is the key of
`shared/cv-i18n-dict.js` (`"한국어": [en, ja, zh-Hant, zh-Hans]`). Pages are translated in the DOM,
also text inserted later; lines with numbers use templates (`"지금 {n}위"`, `{n…}`/`{d…}` = number
or date) and `A · B` lines are translated part by part. Canvas text, dialogs and share texts call
`CAVIAR.t(ko, vars)`. **New Korean UI text needs a dictionary entry**, or it shows in Korean.
Member names stay in Hangul until the official romanization / kana / hanzi is given.

## Member talk (shared/cv-talk.js, shared/cv-talk-lines.js)

The guest's member (from the order sheet) talks: bubbles in the games (start, a mistake, a good
move, 10 s left), a short conversation on every result card (the member's line → the guest
answers 한 판 더 / 빙고 / 부스터 → the member replies and it happens), and the serving scene on
the landing (greeting → the caviar → the drink). Voices follow the Jellyfish artist profile;
lines are drafts in five languages, to be reviewed by the agency. Korean particles follow the
word: `{caviar|을/를}`.

## Game art (tools/gen-art.py)

`python tools/gen-art.py` generates the Master Chef plate, signature dish and ingredients and
the Escape shark with the OpenAI Images API (needs `OPENAI_API_KEY` in the environment; each
image is billed). Raw PNGs go to `assets/source/gen/`, trimmed WebPs to `assets/chef/` and
`assets/escape/`. Then point the game configs at them.

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
