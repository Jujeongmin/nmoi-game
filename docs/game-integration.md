# CAVIAR COURSE — Game integration spec (v1)

The weekly games are built by the Verse8 game team. The hub (this repo) owns everything
that counts — week lock, runs per day, missions (bingo), leaderboard, pre-save — and
defines and verifies this spec. A game only **reports**.

```
hub page  pages/play/index.html?game=<key>        (shared/cv-host.js)
  └─ <iframe src="<game build>?hubOrigin=<hub origin>">
        game  + shared/cv-bridge.js  (drop-in, no dependencies)
```

Reference game: `pages/play/sample/index.html` (open `pages/play/index.html?game=sample`).

## Game checklist

1. Include `cv-bridge.js` (copy it into the build; it has no dependencies).
2. On load: `CaviarBridge.init({ gameId })` → hub config.
3. Before every run: `CaviarBridge.requestStart()`; start only when `allowed` is true.
4. When the run ends: `CaviarBridge.end({ score, stats })`.
5. Back / close button: `CaviarBridge.exit()`.
6. Portrait, fits 375×667 up to 430×932, no page scroll. Caviar never bursts or breaks.
7. Sound starts muted when `config.muted` is true.

Outside an iframe every bridge call resolves locally, so the build still runs standalone.

## Messages

All messages are objects with `source`, `v: 1` and `type`.
Game → hub: `source: 'caviar-game'`, plus `gameId`. Hub → game: `source: 'caviar-hub'`.

| Direction | type | Fields | Meaning |
|---|---|---|---|
| game → hub | `ready` | | Handshake. Hub answers `config`. |
| hub → game | `config` | `nickname, member, weekOpen, playsLeft, dailyLimit, presaved, booster, muted` | Guest and run budget. `member` = member id picked on the landing (nara, natalie, serin, tiya, yoon). |
| game → hub | `start` | | Ask for a run. |
| hub → game | `start-ok` | `runId, playsLeft, retries, multiplier, extraLife, missionScore` | Run granted (one run is used now). `multiplier` (x1.0 / x1.2 / x1.5) and `missionScore` (booster score of the open score mission, or null) are for the game's HUD; `extraLife` 1 = add one life if the game has lives. |
| hub → game | `start-denied` | `reason: 'locked' \| 'limit' \| 'offline'` | Week not open, today's runs are used up (hub shows the pre-save panel), or the Verse8 server is unreachable (hub asks to retry or reload). |
| game → hub | `end` | `runId, score, playTimeMs?, eventsHash?, stats?` | Run finished. `score` integer ≥ 0 (before the multiplier — the hub applies it). |
| hub → game | `result` | `counted, score, missions[]` or `counted: false, reason` | Missions completed by this run. Hub shows its result card + pre-save panel. |
| game → hub | `event` | `name, data` | Optional (analytics, sounds). Not counted. |
| game → hub | `exit` | | Hub returns to the caviar selection. |

## Bingo missions need only `score`

Every game cell of the bingo (overview §4) is judged from the score the hub records: per week a
score cell (booster score ≥ N) and a rank cell (weekly top N %, judged on the final weekly board).
`stats` is optional — extra fields are passed on to analytics and ignored by the missions.
Numbers: `bingo` in `shared/cv-campaign.js` and `BINGO` in `verse8/server.js`.

## Rules the hub enforces

- **Origin**: the hub accepts messages only from the embedded iframe and only from origins
  in `CAVIAR.host.origins`; the game posts only to `hubOrigin` (query param, else the referrer).
- **Registry**: builds are embedded from `CAVIAR.host.games` only, never from a URL in the query string.
- **Runs**: `end` counts only with the `runId` of the last `start-ok`, once. Daily limit 3
  (+1 after pre-save, +1 per referral up to +3), week lock from `shared/cv-campaign.js`; the
  Verse8 server re-checks both.
- **Score**: leaderboard score = score × multiplier (x1.2 after pre-save, x1.5 for a V8 login's
  first run of the week), applied on the server. Scores are client
  reported and cannot be verified, so they only earn light rewards (tickets); the top reward
  is a draw.

## Delivering a build

1. Host the build (same Verse8 site, or its own https origin).
2. Set `src` for the gameId in `shared/cv-host.js` (and add the origin to `ORIGINS` if external).
3. Point the landing can for that game at `pages/play/index.html?game=<gameId>` (`landing/config.js`).
4. Check with the sample flow: start → end → result card shows the missions.
