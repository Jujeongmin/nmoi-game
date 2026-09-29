// Verse8 (Agent8) game server — CAVIAR COURSE hub.
// Runs on the Verse8 server. Clients call these with server.remoteFunction(name, args).
// $global / $sender are provided by the runtime. Do not export the class.
//
// What the server decides (never the page):
//   profile + email de-dup, invite codes, pre-save record (+2 tickets, x1.2 booster, +1 run/day),
//   referral credit (only a NEW email that pre-saves counts), attendance days, runs per day,
//   weekly leaderboard seasons (+ combined board), line tickets (+3, once per line).
//
// User state ($global user state — only this server reads it):
//   { nickname, email, emailHash, emailNew, ref, refCredited, inviteCode,
//     presaved, presavedAt, tickets, referrals, days: [YYYY-MM-DD], lines: [id],
//     plays: { date, counts: { gameId: n } }, lb: { 'gameId:season': itemId } }
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
const GAMES = {
  'caviar-escape': { maxScore: 20000 },
  'caviar-match': { maxScore: 300000 },
  'caviar-master-chef': { maxScore: 300000 },
};
const DAILY_PLAYS = 3;
const PRESAVE_BONUS_PLAYS = 1;
const BOOSTER = 1.2;
const TICKETS = { presave: 2, line: 3 };
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
  const above = await $global.getCollectionItems(col, {
    filters: [{ field: 'score', operator: '>', value: score }],
    limit: 1000,
  });
  return above.length + 1;
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
    dailyLimit: DAILY_PLAYS + (me.presaved ? PRESAVE_BONUS_PLAYS : 0),
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

  // Attendance: one mark per KST day.
  async checkIn() {
    const me = await myState();
    const today = kstDate();
    const days = me.days || [];
    if (!days.includes(today)) {
      days.push(today);
      await $global.updateMyState({ days });
    }
    return summary(Object.assign({}, me, { days }));
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

  // One finished run. Counts against today's runs, applies the booster, updates the
  // current season's game board and combined board. Returns rank info.
  async submitScore(gameId, score) {
    if (!GAMES[gameId]) throw new Error('unknown game');
    const raw = Math.floor(Number(score));
    if (!Number.isFinite(raw) || raw < 0 || raw > GAMES[gameId].maxScore) throw new Error('invalid score');

    const me = await myState();
    const plays = playsToday(me);
    const limit = DAILY_PLAYS + (me.presaved ? PRESAVE_BONUS_PLAYS : 0);
    const used = plays.counts[gameId] || 0;
    if (used >= limit) return { counted: false, reason: 'limit', playsLeft: 0 };
    plays.counts[gameId] = used + 1;

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

    await $global.updateMyState({ lb, plays });
    return {
      counted: true,
      score: boosted,
      boosted: boosted !== raw,
      best: res.best,
      improved: res.improved,
      rank: await rankOf(col, res.best),
      season,
      playsLeft: limit - plays.counts[gameId],
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
