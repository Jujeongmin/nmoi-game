// Verse8 (Agent8) game server — leaderboard for the three caviar games.
// Runs on the Verse8 server. Clients call these with server.remoteFunction(name, args).
// $global / $sender are provided by the runtime. Do not export the class.
//
// Storage
//   user state            { nickname, lb: { [gameId]: collectionItemId } }
//   collection lb-<game>  { account, nickname, score, updatedAt }  — one item per account

const GAMES = {
  'caviar-escape': { maxScore: 20000 },       // 30 s run: survival + close calls + life bonus
  'caviar-match': { maxScore: 300000 },
  'caviar-master-chef': { maxScore: 300000 },
};

const NICK_MAX = 12;

function cleanNickname(value) {
  if (typeof value !== 'string') return '';
  // collapse whitespace, strip control characters and angle brackets
  return value.replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, NICK_MAX);
}

const TOTAL = 'total';   // combined board: sum of the account's best score in each game

function collectionOf(gameId, allowTotal) {
  if (allowTotal && gameId === TOTAL) return 'lb-' + TOTAL;
  if (!GAMES[gameId]) throw new Error('unknown game');
  return 'lb-' + gameId;
}

async function rankOf(col, score) {
  const above = await $global.getCollectionItems(col, {
    filters: [{ field: 'score', operator: '>', value: score }],
    limit: 1000,
  });
  return above.length + 1;
}

// Recompute the caller's combined score from their per-game rows and upsert it.
async function updateTotal(me, nickname) {
  const lb = me.lb || {};
  let total = 0;
  for (const gameId of Object.keys(GAMES)) {
    if (!lb[gameId]) continue;
    try {
      const item = await $global.getCollectionItem(collectionOf(gameId), lb[gameId]);
      total += (item && item.score) || 0;
    } catch (e) { /* missing row counts as 0 */ }
  }
  const col = collectionOf(TOTAL, true);
  if (lb[TOTAL]) {
    await $global.updateCollectionItem(col, { __id: lb[TOTAL], score: total, nickname, updatedAt: Date.now() });
  } else {
    const added = await $global.addCollectionItem(col, { account: $sender.account, nickname, score: total, updatedAt: Date.now() });
    lb[TOTAL] = added.__id;
    await $global.updateMyState({ lb });
  }
}

class Server {
  // Nickname from the order sheet ("고객님 성함은?"). Also renames existing rows.
  async setNickname(nickname) {
    const nick = cleanNickname(nickname);
    if (!nick) throw new Error('닉네임을 입력해주세요');
    const me = (await $global.getMyState()) || {};
    await $global.updateMyState({ nickname: nick });

    const lb = me.lb || {};
    for (const gameId of Object.keys(lb)) {
      if ((!GAMES[gameId] && gameId !== TOTAL) || !lb[gameId]) continue;
      try {
        await $global.updateCollectionItem(collectionOf(gameId, true), { __id: lb[gameId], nickname: nick });
      } catch (e) {
        console.warn('rename failed', gameId, e && e.message);
      }
    }
    return nick;
  }

  // Keeps only the best score per account. Returns { best, improved, rank }.
  async submitScore(gameId, score) {
    const col = collectionOf(gameId);
    const value = Math.floor(Number(score));
    if (!Number.isFinite(value) || value < 0 || value > GAMES[gameId].maxScore) {
      throw new Error('invalid score');
    }

    const account = $sender.account;
    const me = (await $global.getMyState()) || {};
    const nickname = cleanNickname(me.nickname) || 'Guest';
    const lb = me.lb || {};

    let item = null;
    if (lb[gameId]) {
      try { item = await $global.getCollectionItem(col, lb[gameId]); } catch (e) { item = null; }
    }

    let best = value;
    let improved = true;
    if (item) {
      if (value > (item.score || 0)) {
        await $global.updateCollectionItem(col, { __id: item.__id, score: value, nickname, updatedAt: Date.now() });
      } else {
        best = item.score || 0;
        improved = false;
      }
    } else {
      const added = await $global.addCollectionItem(col, { account, nickname, score: value, updatedAt: Date.now() });
      lb[gameId] = added.__id;
      await $global.updateMyState({ lb });
    }

    if (improved) {
      try { await updateTotal({ lb }, nickname); } catch (e) { console.warn('total update failed', e && e.message); }
    }
    return { best, improved, rank: await rankOf(col, best) };
  }

  // Top rows for one game, plus the caller's own row/rank when they have one.
  async getLeaderboard(gameId, limit) {
    const col = collectionOf(gameId, true);
    const n = Math.max(1, Math.min(50, Math.floor(Number(limit) || 20)));
    const rows = await $global.getCollectionItems(col, {
      orderBy: [{ field: 'score', direction: 'desc' }],
      limit: n,
    });
    const account = $sender.account;
    const top = rows.map((r, i) => ({ rank: i + 1, nickname: r.nickname || 'Guest', score: r.score || 0, me: r.account === account }));

    let mine = null;
    const me = (await $global.getMyState()) || {};
    const id = me.lb && me.lb[gameId];
    if (id) {
      try {
        const item = await $global.getCollectionItem(col, id);
        if (item) mine = { rank: await rankOf(col, item.score || 0), nickname: item.nickname, score: item.score || 0 };
      } catch (e) { mine = null; }
    }
    return { top, mine };
  }
}
