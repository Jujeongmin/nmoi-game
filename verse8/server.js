// Verse8 (Agent8) game server — CAVIAR COURSE hub.
// Runs on the Verse8 server. Clients call these with server.remoteFunction(name, args).
// $global / $sender are provided by the runtime. Do not export the class.
//
// What the server decides (never the page):
//   profile + email de-dup, invite codes, pre-save record (+2 tickets, x1.2 booster, +1 run/day),
//   referral credit (only a NEW email that pre-saves counts, 5 a day), attendance days (a day
//   counts only with a finished run), runs per day, weekly leaderboard seasons (+ combined
//   board, + referral board), the bingo board (every cell, see BINGO) and its tickets:
//   pre-save +2, bingo line +3, per game first run +1 (once), a run +1 and a share +1 (each
//   once per game per day).
//
// User state ($global user state — only this server reads it):
//   { nickname, email, emailHash, emailNew, ref, refCredited, inviteCode,
//     presaved, presavedAt, tickets, referrals, days: [YYYY-MM-DD], lines: [id],
//     plays: { date, counts: { gameId: n } }, lb: { 'gameId:season': itemId },
//     runs: { gameId: { id, at } | null },                 the run startRun opened, per game
//     ticketLog: { first: { gameId: true }, daily: { gameId: date }, share: { gameId: date } },
//     order: { mood, caviar, eat, drink, member },           order sheet choices (restored on other devices)
//     refDay: { date, n },                                   referrals credited today (cap)
//     bingo: [cellId],                                       cells done (kept once done)
//     v8: bool, v8Week: season,                              V8 login; season of its x1.5 run
//     lifeTokens: n }                                        +1 life boosters (3-day streaks)
// Collections:
//   emails            { hash, account, at }                  e-mail de-dup (hash only)
//   invites           { code, account }                      invite code -> account
//   lb-<game>-<season>, lb-total-<season>, ref-<season>
//                     { account, nickname, score, updatedAt } one row per account
//                     (ref-: pre-saves credited to the account's invite link that week)
//
// NOTE email "암호화": the raw address is kept only in the private user state for the
// winner notice; encrypt-at-rest / 30-day deletion needs a Verse8 platform key or job.

const WEEKS = [
  { id: 'w1', start: '2026-10-26', end: '2026-11-01', game: 'caviar-escape' },       // shark
  { id: 'w2', start: '2026-11-02', end: '2026-11-08', game: 'caviar-match' },
  { id: 'w3', start: '2026-11-09', end: '2026-11-15', game: 'caviar-master-chef' },
];

// Bingo (overview §4): 16 = per week 5 cells (game score · game rank · referral rank ·
// referral count · attendance) x 3 + pre-save. Cell n (0..14 in MISSION order) = B-cut n.
// Game and referral-rank cells open with their week; referral count and attendance count
// from D1. Rank cells are judged when their week has ended (the final weekly board).
// Numbers are provisional until the alpha data (10/13) — keep shared/cv-campaign.js in step.
const BINGO = {
  score: { 'caviar-match': 5000, 'caviar-escape': 4000, 'caviar-master-chef': 5000 },  // booster score
  rankTopPct: 10,          // game rank cell: weekly top 10 %
  refRankTop: 10,          // referral rank cell: weekly top 10
  refNeed: [3, 5, 10],     // referral count cells (cumulative)
  attNeed: [7, 10, 14],    // attendance cells (days with a finished run, of 21)
  layout: [
    'w1-score', 'w1-refrank', 'w2-score', 'w2-refrank',
    'w1-rank', 'presave', 'w2-rank', 'w3-score',
    'w1-att', 'w2-att', 'w3-refrank', 'w3-rank',
    'w1-ref', 'w2-ref', 'w3-att', 'w3-ref',
  ],
};
const REF_DAILY_CAP = 5;
// Score checks. The page reports the score, so the server only accepts one that the run
// could have reached: a run must be opened with startRun, and a score may grow at most
// maxScore / duration per second since then (countdown and result delay only add slack).
//   caviar-master-chef: 60 s, orders 3,4,5,6,6... steps at best ~15,300 with instant picks.
//   caviar-escape: 30 s, 3,000 survival + 1,500 lives + close calls.
//   caviar-match: a greedy bot aiming instantly, 1,200 runs: median ~20,000, best 49,950.
const GAMES = {
  'caviar-escape': { maxScore: 20000, duration: 30, lives: true },   // lives: takes +1 life boosters
  'caviar-match': { maxScore: 80000, duration: 60 },
  'caviar-master-chef': { maxScore: 20000, duration: 60 },
};
const MIN_RUN_MS = 3000;
const DAILY_PLAYS = 3;
const DEMO_UNLIMITED_PLAYS = true;   // demo: no daily run limit — set false for launch (and campaign demo.unlimitedPlays)
const PRESAVE_BONUS_PLAYS = 1;
const BOOSTER = 1.2;
// Booster benefits beyond pre-save (overview §5):
const V8_WEEKLY_BOOSTER = 1.5;   // V8 login: the first counted run of each week scores x1.5
const REF_RUN_CAP = 3;           // +1 run a day per referral, at most +3
const STREAK_LIFE_EVERY = 3;     // every 3 days in a row with a finished run: one +1 life booster
const LEADERBOARD_TOP = 10;
const TICKETS = { presave: 2, line: 3, firstRun: 1, dailyRun: 1, share: 1 };
const NICK_MAX = 12;
const TOTAL = 'total';

// Admins see the participant list (nickname, e-mail, tickets ...) in the app. The first admins
// are written in by tools/sync-verse8.py from verse8/admins.local.json (kept out of the public
// repo); admins add the others in the app ('admins' collection).
const ADMINS = [/*ADMINS*/];
const ADMIN_PAGE = 200;
const ACCOUNT_RE = /^[A-Za-z0-9:_.@-]{4,128}$/;

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
// Referral (invite link): a friend counts for the inviter once they came through the link,
// registered a NEW e-mail on the order sheet and finished a run the server counted. Spotify
// does not tell anyone who pre-saved, so a pre-save cannot be the condition. Returns the patch
// for the friend's own state ({ refCredited: true } or {}).
async function creditReferral(me) {
  const patch = {};
  if (me.ref && me.emailNew === true && !me.refCredited) {
    const inv = await $global.getCollectionItems('invites', { filters: [{ field: 'code', operator: '==', value: me.ref }], limit: 1 });
    const inviter = inv[0] && inv[0].account;
    const other = inviter && inviter !== $sender.account ? ((await $global.getUserState(inviter)) || {}) : null;
    const today = kstDate();
    const refDay = other && other.refDay && other.refDay.date === today ? other.refDay : { date: today, n: 0 };
    if (other && refDay.n < REF_DAILY_CAP) {
      const upd = { referrals: (other.referrals || 0) + 1, refDay: { date: today, n: refDay.n + 1 } };
      // Weekly referral board (bingo referral-rank cells).
      const season = seasonOf();
      if (season !== 'pre' && season !== 'post') {
        const refLb = Object.assign({}, other.refLb);
        const col = 'ref-' + season;
        let row = null;
        if (refLb[season]) { try { row = await $global.getCollectionItem(col, refLb[season]); } catch (e) { row = null; } }
        if (row) await $global.updateCollectionItem(col, { __id: row.__id, score: (row.score || 0) + 1, updatedAt: Date.now() });
        else refLb[season] = (await $global.addCollectionItem(col, { account: inviter, nickname: cleanNickname(other.nickname) || 'Guest', score: 1, updatedAt: Date.now() })).__id;
        upd.refLb = refLb;
      }
      await $global.updateUserState(inviter, upd);
      patch.refCredited = true;
    }
  }
  return patch;
}

function runRewards(me, gameId) {
  const today = kstDate();
  const days = (me.days || []).slice();
  if (!days.includes(today)) days.push(today);
  const log = ticketLog(me);
  const grants = [];
  if (!log.first[gameId]) { log.first[gameId] = true; grants.push({ reason: 'first', n: TICKETS.firstRun }); }
  if (log.daily[gameId] !== today) { log.daily[gameId] = today; grants.push({ reason: 'daily', n: TICKETS.dailyRun }); }
  const tickets = (me.tickets || 0) + grants.reduce((t, g) => t + g.n, 0);
  const patch = { days, ticketLog: log, tickets };
  // A new attendance day that completes 3, 6, 9 ... days in a row: one +1 life booster.
  if (!(me.days || []).includes(today) && streakTo(days, today) % STREAK_LIFE_EVERY === 0) {
    patch.lifeTokens = (me.lifeTokens || 0) + 1;
    grants.push({ reason: 'streak', n: 0 });
  }
  return { patch, grants };
}

function dailyLimit(me) {
  if (DEMO_UNLIMITED_PLAYS) return 9999;
  return DAILY_PLAYS + (me.presaved ? PRESAVE_BONUS_PLAYS : 0) + Math.min(REF_RUN_CAP, me.referrals || 0);
}

// Days in a row, ending with `day`, among the attendance days.
function streakTo(days, day) {
  let n = 0, t = Date.parse(day + 'T00:00:00Z');
  while (days.includes(new Date(t).toISOString().slice(0, 10))) { n++; t -= 24 * 3600 * 1000; }
  return n;
}

// The multiplier the next counted run gets: x1.5 for a V8 login's first run of the week,
// else x1.2 after pre-save.
function multiplierOf(me) {
  const season = seasonOf();
  if (me.v8 && me.v8Week !== season && season !== 'pre' && season !== 'post') return V8_WEEKLY_BOOSTER;
  return me.presaved ? BOOSTER : 1;
}

function summary(me) {
  const plays = playsToday(me);
  return {
    nickname: me.nickname || '',
    hasEmail: !!me.emailHash,
    order: me.emailHash && me.order ? me.order : null,   // order sheet choices, never the e-mail
    presaved: !!me.presaved,
    tickets: me.tickets || 0,
    referrals: me.referrals || 0,
    days: (me.days || []).length,
    lines: me.lines || [],
    inviteCode: me.inviteCode || '',
    playsToday: plays.counts,
    dailyLimit: dailyLimit(me),
    booster: me.presaved ? BOOSTER : 1,
    multiplier: multiplierOf(me),
    v8: !!me.v8,
    lifeTokens: me.lifeTokens || 0,
    streak: streakTo(me.days || [], kstDate()),
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

function bingoLines(done) {
  const n = 4, lines = [];
  for (let r = 0; r < n; r++) lines.push({ id: 'r' + r, cells: [0, 1, 2, 3].map(c => r * n + c) });
  for (let c = 0; c < n; c++) lines.push({ id: 'c' + c, cells: [0, 1, 2, 3].map(r => r * n + c) });
  lines.push({ id: 'd0', cells: [0, 5, 10, 15] }, { id: 'd1', cells: [3, 6, 9, 12] });
  return lines.filter(l => l.cells.every(k => done.includes(BINGO.layout[k]))).map(l => l.id);
}

// My row in a weekly board: { rank, total, cutoff } (cutoff = last rank that counts).
async function weeklyStanding(col, itemId, cutoffOf) {
  if (!itemId) return null;
  let item = null;
  try { item = await $global.getCollectionItem(col, itemId); } catch (e) { item = null; }
  if (!item || !(item.score > 0)) return null;
  const total = await $global.countCollectionItems(col, {});
  return { rank: await rankOf(col, item.score), total, cutoff: cutoffOf(total), score: item.score };
}

// Judges every bingo cell from the server's own records. Done cells stay done.
// Returns { done, status } — status: progress per open cell for the board's detail view.
async function judgeBingo(me) {
  const today = kstDate();
  const done = (me.bingo || []).slice();
  const status = {};
  const lb = me.lb || {};
  const mark = id => { if (!done.includes(id)) done.push(id); };

  if (me.presaved) mark('presave');
  for (let i = 0; i < WEEKS.length; i++) {
    const w = WEEKS[i], key = 'w' + (i + 1);
    const open = today >= w.start, ended = today > w.end;

    if ((me.referrals || 0) >= BINGO.refNeed[i]) mark(key + '-ref');
    if ((me.days || []).length >= BINGO.attNeed[i]) mark(key + '-att');
    if (!open) continue;

    // Game score: best booster score of the week's game in any season since it opened.
    if (!done.includes(key + '-score')) {
      let best = 0;
      for (const s of WEEKS.slice(i)) {
        const id = lb[w.game + ':' + s.id];
        if (!id) continue;
        try { const item = await $global.getCollectionItem(collectionOf(w.game, s.id), id); best = Math.max(best, (item && item.score) || 0); } catch (e) { /* gone */ }
      }
      if (best >= BINGO.score[w.game]) mark(key + '-score');
      else status[key + '-score'] = { best, need: BINGO.score[w.game] };
    }

    // Game rank: weekly top N % of that week's board, judged on the final board.
    if (!done.includes(key + '-rank')) {
      const st = await weeklyStanding(collectionOf(w.game, w.id), lb[w.game + ':' + w.id], t => Math.max(1, Math.ceil(t * BINGO.rankTopPct / 100)));
      if (st && ended && st.rank <= st.cutoff) mark(key + '-rank');
      else status[key + '-rank'] = Object.assign({ final: ended }, st || { rank: 0 });
    }

    // Referral rank: weekly top N of pre-saves credited to my invite link.
    if (!done.includes(key + '-refrank')) {
      const st = await weeklyStanding('ref-' + w.id, (me.refLb || {})[w.id], () => BINGO.refRankTop);
      if (st && ended && st.rank <= st.cutoff) mark(key + '-refrank');
      else status[key + '-refrank'] = Object.assign({ final: ended }, st || { rank: 0 });
    }
  }
  return { done, status };
}

// Wallet-style ids (0x + 40 hex) compare without case: the same account can arrive
// checksum-cased or lower-cased.
function normAccount(id) {
  const s = String(id || '').trim();
  return /^0x[0-9a-fA-F]{40}$/.test(s) ? s.toLowerCase() : s;
}
function isFixedAdmin(account) {
  const a = normAccount(account);
  return ADMINS.some((x) => normAccount(x) === a);
}

async function isAdmin(account) {
  if (!account) return false;
  if (isFixedAdmin(account)) return true;
  try {
    const rows = await $global.getCollectionItems('admins', { filters: [{ field: 'account', operator: '==', value: normAccount(account) }], limit: 1 });
    return rows.length > 0;
  } catch (e) {
    return false;   // no 'admins' collection yet
  }
}
async function requireAdmin() {
  if (!(await isAdmin($sender.account))) throw new Error('not admin');
}
async function adminRoster() {
  let rows = [];
  try { rows = await $global.getCollectionItems('admins', { limit: 100 }); } catch (e) { rows = []; }
  return {
    fixed: ADMINS.slice(),
    added: rows.map((r) => ({ account: r.account, name: r.name || '', addedBy: r.addedBy || '', at: r.at || 0 })),
  };
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

    // The order sheet's choices (no e-mail), so the same account skips the sheet on another device.
    if (p.order && typeof p.order === 'object') {
      const order = {};
      for (const k of ['mood', 'caviar', 'eat', 'drink', 'member']) {
        if (typeof p.order[k] === 'string' && /^[a-z]{1,16}$/.test(p.order[k])) order[k] = p.order[k];
      }
      patch.order = order;
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
    const refLb = me.refLb || {};
    for (const season of Object.keys(refLb)) {
      try { await $global.updateCollectionItem('ref-' + season, { __id: refLb[season], nickname: nick }); } catch (e) { /* row may be gone */ }
    }
    return summary(Object.assign({}, me, patch));
  }

  async getMe() {
    return summary(await myState());
  }

  // Entry screen (overview S1): how many guests have joined (entry emails, de-duplicated).
  async getStats() {
    return { participants: await $global.countCollectionItems('emails', {}), season: seasonOf() };
  }

  // TIER 1 · V8 login. PLACEHOLDER: the page reports it (like the click-based pre-save) until
  // the Verse8 login API is wired; then check the login here instead of trusting the page.
  async markLogin() {
    const me = await myState();
    if (me.v8) return summary(me);
    await $global.updateMyState({ v8: true });
    return summary(Object.assign({}, me, { v8: true }));
  }

  // Pre-save is click-based (no Spotify check): +2 tickets once, booster, +1 run/day.
  async markPresave() {
    const me = await myState();
    if (me.presaved) return summary(me);
    const patch = { presaved: true, presavedAt: Date.now(), tickets: (me.tickets || 0) + TICKETS.presave };

    await $global.updateMyState(patch);
    return summary(Object.assign({}, me, patch));
  }

  // The bingo board as the server judges it; a newly finished line pays +3 tickets once
  // (r0-r3 rows, c0-c3 columns, d0-d1 diagonals). Returns { done, lines, status, me }.
  async getBingo() {
    const me = await myState();
    const judged = await judgeBingo(me);
    const lines = bingoLines(judged.done);
    const paid = me.lines || [];
    const fresh = lines.filter(id => !paid.includes(id));
    const patch = {};
    if (judged.done.length !== (me.bingo || []).length) patch.bingo = judged.done;
    if (fresh.length) { patch.lines = paid.concat(fresh); patch.tickets = (me.tickets || 0) + fresh.length * TICKETS.line; }
    if (Object.keys(patch).length) await $global.updateMyState(patch);
    Object.assign(me, patch);
    return { done: judged.done, lines, status: judged.status, me: summary(me) };
  }

  // Result-screen share (the page cannot verify it): +1 ticket once per game per day.
  // Share (result card, per game) and 'invite' (sending the invite link from the invite
  // sheet, bingo or the booster panel): +1 ticket once a day each. A click cannot be verified,
  // so the reward is small and daily.
  async claimShare(gameId) {
    if (!GAMES[gameId] && gameId !== 'invite') throw new Error('unknown game');
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
    const patch = { plays, runs };
    // A game with lives uses one +1 life booster, if the guest has one.
    const extraLife = GAMES[gameId].lives && (me.lifeTokens || 0) > 0 ? 1 : 0;
    if (extraLife) patch.lifeTokens = me.lifeTokens - 1;
    await $global.updateMyState(patch);
    return { ok: true, runId, playsLeft: limit - plays.counts[gameId], multiplier: multiplierOf(me), extraLife };
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
    const multiplier = multiplierOf(me);
    const reward = runRewards(me, gameId);
    if (multiplier === V8_WEEKLY_BOOSTER) reward.patch.v8Week = seasonOf();   // the week's x1.5 is used
    Object.assign(reward.patch, await creditReferral(me));   // invited friend's first run
    await $global.updateMyState(Object.assign({ runs }, reward.patch));
    Object.assign(me, reward.patch);

    const boosted = Math.floor(raw * multiplier);
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
      multiplier,
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
  // ---- Admin (participant list) --------------------------------------------------------

  // Anyone: their own account id (to be added as an admin) and whether they are one.
  async whoAmI() {
    let admin = false;
    try { admin = await isAdmin($sender.account); } catch (e) { admin = false; }
    return { account: $sender.account, admin };
  }

  // One page of participants: everyone who registered an e-mail, oldest first. `after` is the
  // `next` of the previous page (a registration time). An account that changed its e-mail can
  // show up twice across pages; the page keeps the latest row.
  async adminParticipants(after, limit) {
    await requireAdmin();
    const n = Math.max(1, Math.min(ADMIN_PAGE, Math.floor(Number(limit) || ADMIN_PAGE)));
    const filters = Number(after) > 0 ? [{ field: 'at', operator: '>', value: Number(after) }] : [];
    const rows = await $global.getCollectionItems('emails', { filters, orderBy: [{ field: 'at', direction: 'asc' }], limit: n });
    const accounts = [...new Set(rows.map((r) => r.account).filter(Boolean))];
    const states = accounts.length ? await $global.getUserStates(accounts) : [];
    const byAccount = {};
    for (const st of states) if (st && st.account) byAccount[st.account] = st;
    const seen = new Set();
    const list = [];
    for (const r of rows) {
      if (!r.account || seen.has(r.account)) continue;
      seen.add(r.account);
      const s = byAccount[r.account] || {};
      list.push({
        account: r.account,
        nickname: s.nickname || '',
        email: s.email || '',
        joinedAt: r.at || 0,
        tickets: s.tickets || 0,
        presaved: !!s.presaved,
        referrals: s.referrals || 0,
        days: (s.days || []).length,
        lines: (s.lines || []).length,
        v8: !!s.v8,
      });
    }
    return { rows: list, next: rows.length === n ? rows[rows.length - 1].at : null };
  }

  async adminListAdmins() {
    await requireAdmin();
    return adminRoster();
  }

  async adminAddAdmin(account, name) {
    await requireAdmin();
    const id = normAccount(account);
    if (!ACCOUNT_RE.test(id)) throw new Error('계정 ID를 확인해주세요');
    if (!(await isAdmin(id))) {
      await $global.addCollectionItem('admins', {
        account: id, name: String(name || '').trim().slice(0, 30), addedBy: $sender.account, at: Date.now(),
      });
    }
    return adminRoster();
  }

  async adminRemoveAdmin(account) {
    await requireAdmin();
    const id = normAccount(account);
    if (isFixedAdmin(id)) throw new Error('기본 관리자는 앱에서 뺄 수 없어요');
    if (id === normAccount($sender.account)) throw new Error('자기 자신은 뺄 수 없어요');
    const rows = await $global.getCollectionItems('admins', { filters: [{ field: 'account', operator: '==', value: id }], limit: 10 });
    for (const r of rows) await $global.deleteCollectionItem('admins', r.__id);
    return adminRoster();
  }

  async getLeaderboard(gameId, limit, season) {
    const s = cleanSeason(season);
    const col = collectionOf(gameId, s, true);
    const n = Math.max(1, Math.min(50, Math.floor(Number(limit) || LEADERBOARD_TOP)));
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
