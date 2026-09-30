// Bridge between the static pages and the Verse8 game server (@agent8/gameserver).
// Vite bundles this to shared/cv-server.js (see vite.config.ts); every page loads it as
// a module and gets window.CAVIAR.server. Classic scripts wait for it via
// CAVIAR.whenServer() (shared/cv-storage.js) — it may never arrive (local preview).
import { GameServer } from "@agent8/gameserver";

type Me = {
  nickname: string; hasEmail: boolean; presaved: boolean; tickets: number; referrals: number;
  days: number; lines: string[]; inviteCode: string; playsToday: Record<string, number>;
  dailyLimit: number; booster: number; season: string;
};
type LeaderRow = { rank: number; nickname: string; score: number; me?: boolean };

const server = new GameServer();
let ready: Promise<boolean> | null = null;

function connect(): Promise<boolean> {
  if (!ready) {
    ready = server
      .connect()
      .then(() => true)
      .catch((err: unknown) => {
        console.warn("[cv-server] connect failed", err);
        ready = null;
        return false;
      });
  }
  return ready;
}

async function call<T>(fn: string, args: unknown[] = []): Promise<T> {
  if (!(await connect())) throw new Error("offline");
  return server.remoteFunction(fn, args) as Promise<T>;
}

const api = {
  account: server.account,
  connect,
  setProfile: (p: { nickname: string; email: string; emailHash: string; ref?: string }) => call<Me>("setProfile", [p]),
  getMe: () => call<Me>("getMe"),
  checkIn: () => call<Me>("checkIn"),
  markPresave: () => call<Me>("markPresave"),
  claimLine: (lineId: string) => call<Me>("claimLine", [lineId]),
  startRun: (gameId: string) =>
    call<{ ok: boolean; reason?: string; runId?: string; playsLeft: number }>("startRun", [gameId]),
  submitScore: (gameId: string, score: number, runId: string) =>
    call<{ counted: boolean; reason?: string; score?: number; boosted?: boolean; best?: number; improved?: boolean; rank?: number; season?: string; playsLeft: number }>(
      "submitScore", [gameId, score, runId]),
  getLeaderboard: (gameId: string, limit = 20, season?: string) =>
    call<{ season: string; top: LeaderRow[]; mine: LeaderRow | null }>("getLeaderboard", [gameId, limit, season]),
};

const w = window as unknown as { CAVIAR?: Record<string, unknown> };
w.CAVIAR = w.CAVIAR || {};
w.CAVIAR.server = api;
window.dispatchEvent(new Event("caviar-server-ready"));
connect();
