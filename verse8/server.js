// Verse8 (Agent8) game server — CAVIAR COURSE hub.
// Runs on the Verse8 server. Clients call these with server.remoteFunction(name, args).
// $global / $sender are provided by the runtime. Do not export the class.
//
// What the server decides (never the page):
//   profile + email de-dup, invite codes, pre-save record (+2 tickets, x1.2 booster, +1 run/day),
//   referral credit (only a NEW email that pre-saves counts), attendance days (a day counts
//   only with a finished run), runs per day, weekly leaderboard seasons (+ combined board),
//   tickets: pre-save +2, bingo line +3, per game first run +1 (once), a run +1 and a share +1
//   (each once per game per day).
//
// User state ($global user state — only this server reads it):
//   { nickname, email, emailHash, emailNew, ref, refCredited, inviteCode,
//     presaved, presavedAt, tickets, referrals, days: [YYYY-MM-DD], lines: [id],
//     plays: { date, counts: { gameId: n } }, lb: { 'gameId:season': itemId },
//     runs: { gameId: { id, at } | null },                 the run startRun opened, per game
//     ticketLog: { first: { gameId: true }, daily: { gameId: date }, share: { gameId: date } } }
// Collections:
//   emails            { hash, account, at }                  e-mail de-dup (hash only)
//   invites           { code, account }                      invite code -> account
//   lb-<game>-<season>, lb-total-<season>
//                     { account, nickname, score, updatedAt } one row per account
//
// NOTE email "암호화": the raw address is kept only in the private user state for the
// winner notice; encrypt-at-rest / 30-day deletion needs a Verse8 platform key or job.

const WEEKS = [
  { id: 'w1', start: '2026-10-26', end: '2026-11-01' },
  { id: 'w2', start: '2026-11-02', end: '2026-11-08' },
  { id: 'w3', start: '2026-11-09', end: '2026-11-15' },
];
// Score checks. The page reports the score, so the server only accepts one that the run
// could have reached: a run must be opened with startRun, and a score may grow at most
// maxScore / duration per second since then (countdown and result delay only add slack).
//   caviar-master-chef: 60 s, orders 3,4,5,6,6... steps at best ~15,300 with instant picks.
//   caviar-escape: 30 s, 3,000 survival + 1,500 lives + close calls.
//   caviar-match: a greedy bot aiming instantly, 1,200 runs: median ~20,000, best 49,950.
const GAMES = {
  'caviar-escape': { maxScore: 20000, duration: 30 },
  'caviar-match': { maxScore: 80000, duration: 60 },
  'caviar-master-chef': { maxScore: 20000, duration: 60 },
};
const MIN_RUN_MS = 3000;
const DAILY_PLAYS = 3;
const PRESAVE_BONUS_PLAYS = 1;
const BOOSTER = 1.2;
const TICKETS = { presave: 2, line: 3, firstRun: 1, dailyRun: 1, share: 1 };
const MAX_REFERRALS = 6;
const NICK_MAX = 12;
const TOTAL = 'total';

function kstDate(ts) {
  return new Date((ts || Date.now()) + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function seasonOf(ts) {
  const day = kstDate(ts);
  for (const w of WEEKS) if (day >= w.start && day <= w.end) return w.id;
  return day < WEEKS[0].start ? 'pre' : 'post';
}

function cleanNickname(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, NICK_MAX);
}

function cleanSeason(value) {
  return ['pre', 'post', 'w1', 'w2', 'w3'].includes(value) ? value : seasonOf();
}

function collectionOf(gameId, season, allowTotal) {
  if (!(allowTotal && gameId === TOTAL) && !GAMES[gameId]) throw new Error('unknown game');
  return 'lb-' + gameId + '-' + season;
}

async function myState() {
  return (await $global.getMyState()) || {};
}

async function rankOf(col, score) {
  const above = await $global.countCollectionItems(col, {
    filters: [{ field: 'score', operator: '>', value: score }],
  });
  return above + 1;
}

function randomCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

function playsToday(me) {
  const today = kstDate();
  return me.plays && me.plays.date === today ? me.plays : { date: today, counts: {} };
}

function ticketLog(me) {
  const log = me.ticketLog || {};
  return { first: Object.assign({}, log.first), daily: Object.assign({}, log.daily), share: Object.assign({}, log.share) };
}

// A finished run: that day counts as attendance, and the run's tickets
// (first run of a game +1 once, a run +1 once per game per day). Returns the state patch.
function runRewards(me, gameId) {
  const today = kstDate();
  const days = (me.days || []).slice();
  if (!days.includes(today)) days.push(today);
  const log = ticketLog(me);
  const grants = [];
  if (!log.first[gameId]) { log.first[gameId] = true; grants.push({ reason: 'first', n: TICKETS.firstRun }); }
  if (log.daily[gameId] !== today) { log.daily[gameId] = today; grants.push({ reason: 'daily', n: TICKETS.dailyRun }); }
  const tickets = (me.tickets || 0) + grants.reduce((t, g) => t + g.n, 0);
  return { patch: { days, ticketLog: log, tickets }, grants };
}

function dailyLimit(me) {
  return DAILY_PLAYS + (me.presaved ? PRESAVE_BONUS_PLAYS : 0);
}

function summary(me) {
  const plays = playsToday(me);
  return {
    nickname: me.nickname || '',
    hasEmail: !!me.emailHash,
    presaved: !!me.presaved,
    tickets: me.tickets || 0,
    referrals: me.referrals || 0,
    days: (me.days || []).length,
    lines: me.lines || [],
    inviteCode: me.inviteCode || '',
    playsToday: plays.counts,
    dailyLimit: dailyLimit(me),
    booster: me.presaved ? BOOSTER : 1,
    season: seasonOf(),
  };
}

// Best score per account in one collection; returns { best, improved, itemId }.
async function upsertBest(col, itemId, score, nickname) {
  let item = null;
  if (itemId) {
    try { item = await $global.getCollectionItem(col, itemId); } catch (e) { item = null; }
  }
  if (item) {
    if (score > (item.score || 0)) {
      await $global.updateCollectionItem(col, { __id: item.__id, score, nickname, updatedAt: Date.now() });
      return { best: score, improved: true, itemId: item.__id };
    }
    return { best: item.score || 0, improved: false, itemId: item.__id };
  }
  const added = await $global.addCollectionItem(col, { account: $sender.account, nickname, score, updatedAt: Date.now() });
  return { best: score, improved: true, itemId: added.__id };
}

class Server {
  // Entry (TIER 0): nickname + email, one-line consent on the page. No sign-up.
  // emailHash = SHA-256(lower-cased trimmed email) computed by the page, used for de-dup.
  async setProfile(profile) {
    const p = profile || {};
    const nick = cleanNickname(p.nickname);
    if (!nick) throw new Error('닉네임을 입력해주세요');
    const email = typeof p.email === 'string' ? p.email.trim().toLowerCase().slice(0, 120) : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('이메일을 확인해주세요');
    const hash = typeof p.emailHash === 'string' && /^[0-9a-f]{64}$/.test(p.emailHash) ? p.emailHash : '';
    if (!hash) throw new Error('invalid email hash');

    const me = await myState();
    const patch = { nickname: nick };

    if (me.emailHash !== hash) {
      const seen = await $global.getCollectionItems('emails', {
        filters: [{ field: 'hash', operator: '==', value: hash }],
        limit: 1,
      });
      const isNew = seen.length === 0;
      if (isNew) await $global.addCollectionItem('emails', { hash, account: $sender.account, at: Date.now() });
      patch.email = email;
      patch.emailHash = hash;
      // Only the first email this account registers can make it a referral.
      if (me.emailNew === undefined) patch.emailNew = isNew;
    }

    if (!me.inviteCode) {
      let code = randomCode();
      for (let i = 0; i < 4; i++) {
        const taken = await $global.getCollectionItems('invites', { filters: [{ field: 'code', operator: '==', value: code }], limit: 1 });
        if (!taken.length) break;
        code = randomCode();
      }
      await $global.addCollectionItem('invites', { code, account: $sender.account });
      patch.inviteCode = code;
    }

    const ref = typeof p.ref === 'string' ? p.ref.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) : '';
    if (ref && !me.ref && ref !== (me.inviteCode || patch.inviteCode)) patch.ref = ref;

    await $global.updateMyState(patch);

    // Rename this account's leaderboard rows.
    const lb = me.lb || {};
    for (const key of Object.keys(lb)) {
      const [gameId, season] = key.split(':');
      try {
        await $global.updateCollectionItem(collectionOf(gameId, season, true), { __id: lb[key], nickname: nick });
      } catch (e) { /* row may be gone */ }
    }
    return summary(Object.assign({}, me, patch));
  }

  async getMe() {
    return summary(await myState());
  }

  // Pre-save is click-based (no Spotify check): +2 tickets once, booster, +1 run/day,
  // and — for a NEW email that came from an invite link — one referral for the inviter.
  async markPresave() {
    const me = await myState();
    if (me.presaved) return summary(me);
    const patch = { presaved: true, presavedAt: Date.now(), tickets: (me.tickets || 0) + TICKETS.presave };

    if (me.ref && me.emailNew === true && !me.refCredited) {
      const inv = await $global.getCollectionItems('invites', { filters: [{ field: 'code', operator: '==', value: me.ref }], limit: 1 });
      const inviter = inv[0] && inv[0].account;
      if (inviter && inviter !== $sender.account) {
        const other = (await $global.getUserState(inviter)) || {};
        await $global.updateUserState(inviter, { referrals: Math.min(MAX_REFERRALS, (other.referrals || 0) + 1) });
        patch.refCredited = true;
      }
    }
    await $global.updateMyState(patch);
    return summary(Object.assign({}, me, patch));
  }

  // Bingo line reward: +3 tickets, once per line id (r0-r3 rows, c0-c3 columns, d0-d1 diagonals).
  // Lines are judged on the page (small reward, "검증 못 하면 작게 준다").
  async claimLine(lineId) {
    if (typeof lineId !== 'string' || !/^(r[0-3]|c[0-3]|d[01])$/.test(lineId)) throw new Error('invalid line');
    const me = await myState();
    const lines = me.lines || [];
    if (lines.includes(lineId)) return summary(me);
    lines.push(lineId);
    const patch = { lines, tickets: (me.tickets || 0) + TICKETS.line };
    await $global.updateMyState(patch);
    return summary(Object.assign({}, me, patch));
  }

  // Result-screen share (the page cannot verify it): +1 ticket once per game per day.
  async claimShare(gameId) {
    if (!GAMES[gameId]) throw new Error('unknown game');
    const me = await myState();
    const log = ticketLog(me);
    const today = kstDate();
    if (log.share[gameId] === today) return Object.assign(summary(me), { granted: 0 });
    log.share[gameId] = today;
    const patch = { ticketLog: log, tickets: (me.tickets || 0) + TICKETS.share };
    await $global.updateMyState(patch);
    return Object.assign(summary(Object.assign({}, me, patch)), { granted: TICKETS.share });
  }

  // A run starts (start / retry button): counts against today's runs and opens the run
  // that submitScore will accept. A new start replaces an unfinished run of the same game.
  async startRun(gameId) {
    if (!GAMES[gameId]) throw new Error('unknown game');
    const me = await myState();
    const plays = playsToday(me);
    const limit = dailyLimit(me);
    const used = plays.counts[gameId] || 0;
    if (used >= limit) return { ok: false, reason: 'limit', playsLeft: 0 };
    plays.counts[gameId] = used + 1;

    const runId = randomCode() + randomCode();
    const runs = Object.assign({}, me.runs, { [gameId]: { id: runId, at: Date.now() } });
    await $global.updateMyState({ plays, runs });
    return { ok: true, runId, playsLeft: limit - plays.counts[gameId] };
  }

  // The run opened by startRun finished. Accepted once per run, and only a score the run
  // could have reached in its time (see GAMES). Applies the booster, updates the current
  // season's game board and combined board. Returns rank info.
  async submitScore(gameId, score, runId) {
    if (!GAMES[gameId]) throw new Error('unknown game');
    const raw = Math.floor(Number(score));
    if (!Number.isFinite(raw) || raw < 0) throw new Error('invalid score');

    const me = await myState();
    const plays = playsToday(me);
    const limit = dailyLimit(me);
    const playsLeft = Math.max(0, limit - (plays.counts[gameId] || 0));
    const run = me.runs && me.runs[gameId];
    if (!run || typeof runId !== 'string' || run.id !== runId) return { counted: false, reason: 'no-run', playsLeft };

    const runs = Object.assign({}, me.runs, { [gameId]: null });
    const game = GAMES[gameId];
    const elapsed = Date.now() - run.at;
    const cap = Math.floor(game.maxScore * Math.min(1, elapsed / (game.duration * 1000)));
    // Close the run first, so the same run cannot be submitted twice.
    if (elapsed < MIN_RUN_MS || raw > cap) {
      await $global.updateMyState({ runs });
      return { counted: false, reason: 'rejected', playsLeft };
    }
    const reward = runRewards(me, gameId);
    await $global.updateMyState(Object.assign({ runs }, reward.patch));
    Object.assign(me, reward.patch);

    const boosted = me.presaved ? Math.floor(raw * BOOSTER) : raw;
    const season = seasonOf();
    const nickname = cleanNickname(me.nickname) || 'Guest';
    const lb = me.lb || {};

    const col = collectionOf(gameId, season);
    const key = gameId + ':' + season;
    const res = await upsertBest(col, lb[key], boosted, nickname);
    lb[key] = res.itemId;

    if (res.improved) {
      let total = 0;
      for (const g of Object.keys(GAMES)) {
        const id = lb[g + ':' + season];
        if (!id) continue;
        try {
          const item = await $global.getCollectionItem(collectionOf(g, season), id);
          total += (item && item.score) || 0;
        } catch (e) { /* missing row counts as 0 */ }
      }
      const tkey = TOTAL + ':' + season;
      const t = await upsertBest(collectionOf(TOTAL, season, true), lb[tkey], total, nickname);
      lb[tkey] = t.itemId;
    }

    await $global.updateMyState({ lb });
    return {
      counted: true,
      score: boosted,
      boosted: boosted !== raw,
      best: res.best,
      improved: res.improved,
      rank: await rankOf(col, res.best),
      season,
      playsLeft,
      grants: reward.grants,
      me: summary(me),
    };
  }

  // Top rows for one game (or 'total') in a season (default: the current week).
  async getLeaderboard(gameId, limit, season) {
    const s = cleanSeason(season);
    const col = collectionOf(gameId, s, true);
    const n = Math.max(1, Math.min(50, Math.floor(Number(limit) || 20)));
    const rows = await $global.getCollectionItems(col, { orderBy: [{ field: 'score', direction: 'desc' }], limit: n });
    const account = $sender.account;
    const top = rows.map((r, i) => ({ rank: i + 1, nickname: r.nickname || 'Guest', score: r.score || 0, me: r.account === account }));

    let mine = null;
    const me = await myState();
    const id = me.lb && me.lb[gameId + ':' + s];
    if (id) {
      try {
        const item = await $global.getCollectionItem(col, id);
        if (item) mine = { rank: await rankOf(col, item.score || 0), nickname: item.nickname, score: item.score || 0 };
      } catch (e) { mine = null; }
    }
    return { season: s, top, mine };
  }
}
