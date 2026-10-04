// Bridge between the static pages and the Verse8 game server (@agent8/gameserver).
// Vite bundles this to shared/cv-server.js (see vite.config.ts); every page loads it as
// a module and gets window.CAVIAR.server. Classic scripts wait for it via
// CAVIAR.whenServer() (shared/cv-storage.js) — it may never arrive (local preview).
import { GameServer } from "@agent8/gameserver";

type Me = {
  nickname: string; hasEmail: boolean; order: Record<string, string> | null; presaved: boolean; tickets: number; referrals: number;
  days: number; lines: string[]; inviteCode: string; playsToday: Record<string, number>;
  dailyLimit: number; booster: number; multiplier: number; v8: boolean; lifeTokens: number; streak: number; season: string;
};
type LeaderRow = { rank: number; nickname: string; score: number; me?: boolean };
type Participant = {
  account: string; nickname: string; email: string; joinedAt: number; tickets: number;
  presaved: boolean; referrals: number; days: number; lines: number; v8: boolean;
};
type AdminRoster = { fixed: string[]; added: { account: string; name: string; addedBy: string; at: number }[] };

const server = new GameServer();
let pending: Promise<boolean> | null = null;

// Connects, or reconnects after the socket dropped; resolves whether the server is reachable.
function connect(): Promise<boolean> {
  if (server.connected) return Promise.resolve(true);
  if (!pending) {
    pending = server
      .connect()
      .then((ok) => !!ok)
      .catch((err: unknown) => {
        console.warn("[cv-server] connect failed", err);
        return false;
      })
      .finally(() => { pending = null; });
  }
  return pending;
}

async function call<T>(fn: string, args: unknown[] = []): Promise<T> {
  if (!(await connect())) throw new Error("offline");
  return server.remoteFunction(fn, args) as Promise<T>;
}

const api = {
  account: server.account,
  accountId: () => server.account,   // read when asked (set once the SDK knows the guest)
  connect,
  connected: () => server.connected,
  setProfile: (p: { nickname: string; email: string; emailHash: string; ref?: string; order?: Record<string, string | null> }) => call<Me>("setProfile", [p]),
  getMe: () => call<Me>("getMe"),
  markLogin: () => call<Me>("markLogin"),
  getStats: () => call<{ participants: number; season: string }>("getStats"),
  claimShare: (gameId: string) => call<Me & { granted: number }>("claimShare", [gameId]),
  markPresave: () => call<Me>("markPresave"),
  getBingo: () =>
    call<{ done: string[]; lines: string[]; status: Record<string, unknown>; me: Me }>("getBingo"),
  startRun: (gameId: string) =>
    call<{ ok: boolean; reason?: string; runId?: string; playsLeft: number; multiplier?: number; extraLife?: number }>("startRun", [gameId]),
  submitScore: (gameId: string, score: number, runId: string) =>
    call<{ counted: boolean; reason?: string; score?: number; boosted?: boolean; best?: number; improved?: boolean; rank?: number; season?: string; playsLeft: number; grants?: { reason: string; n: number }[]; me?: Me }>(
      "submitScore", [gameId, score, runId]),
  getLeaderboard: (gameId: string, limit = 10, season?: string) =>
    call<{ season: string; top: LeaderRow[]; mine: LeaderRow | null }>("getLeaderboard", [gameId, limit, season]),
  // Admin: participant list and the admin roster (the server checks the caller).
  whoAmI: () => call<{ account: string; admin: boolean }>("whoAmI"),
  adminParticipants: (after?: number | null, limit?: number) =>
    call<{ rows: Participant[]; next: number | null }>("adminParticipants", [after || 0, limit]),
  adminListAdmins: () => call<AdminRoster>("adminListAdmins"),
  adminAddAdmin: (account: string, name?: string) => call<AdminRoster>("adminAddAdmin", [account, name]),
  adminRemoveAdmin: (account: string) => call<AdminRoster>("adminRemoveAdmin", [account]),
  adminResetBoards: (which: "escape") => call<{ removed: number }>("adminResetBoards", [which]),
};

const w = window as unknown as { CAVIAR?: Record<string, unknown> };
w.CAVIAR = w.CAVIAR || {};
w.CAVIAR.server = api;
window.dispatchEvent(new Event("caviar-server-ready"));
connect();
