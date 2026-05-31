/* ============================================================
   GOLAZO — web data layer.
   Tournament reference data (teams/matches/odds/venues/squads) comes from
   @wc/fixtures (single source, shared with the DB seed so ids/odds align) — this is
   the real reference data the app + seed both use.
   All user/social/admin state below is EMPTY by design: production reads it from the
   live APIs (GET /me, /me/*, /leaderboard, /lobbies, /news, /admin/*). These typed-empty
   stubs only define the shapes + provide neutral first-paint defaults for guests; the
   app never renders fabricated user data.
   ============================================================ */
export * from '@wc/fixtures';
import {
  teams, byId, byGroup, GROUPS, venues, matches, upcoming, live, finished,
  fmtDate, matchById, squadFor, type Match, type Pick1X2, type Player,
} from '@wc/fixtures';

export interface Bet { mid: number; pick: Pick1X2; stake: number; odds: number; status: string; payout?: number }
export interface Lobby {
  id: number; name: string; scope: string; members: number; you: number | null; def: number;
  owner: string; borrow: boolean; pwd: boolean; hot: boolean; joined: boolean; public: boolean;
  code: string; matchIds: number[];
}
export interface LeaderRow { rank: number; name: string; roi: number; net: number; settled: number; won: number; tier: string; flag?: [string, string] }
export interface MissionRow { id?: number; code?: string; label: string; reward: number; done: number; total: number; claimed: boolean; icon?: string }
export interface AchievementRow { name: string; desc: string; unlocked: boolean; prog?: string; icon?: string }
export interface LobbyBoardRow { rank: number; userId: number; name: string; score: number; won: number; def: number; borrowed: number; you: boolean }
export interface LobbyChatRow { who: string; text: string; t: string }
export interface BorrowReq { id: number; who: string; amount: number; balance: number; msg: string; t: string; score: number; repeat?: boolean }
export interface NewsItem { id: number; tag: string; title: string; src: string; time: string; excerpt: string; hot?: boolean; match?: number }
export interface RiskLobby { id: number; name: string; members: number; risk: string; score: number; reasons: string[]; flagged: string }
export interface AdminUser { id: number; name: string; email: string; pts: number; ip: string; status: string; flags: number; joined: string }
export interface ReviewItem { id: number; title: string; tag: string; src: string; conf: number; status: string; warn?: boolean }
export interface AiJobRow { name: string; provider: string; status: string; last: string; latency: string; note?: string }

/** Neutral guest profile — first paint only; GET /me overrides on auth. No fabricated stats. */
export const me = {
  name: 'Guest', handle: '@guest', avatar: 'GA', country: '—',
  points: 0, rank: 0, roi: 0, won: 0, lost: 0, settled: 0,
  streak: 0, winStreak: 0, tier: 'Bronze', joined: '—',
};

// User/social/admin state — empty; populated from live APIs at runtime.
export const myBets: Bet[] = [];
export const ledger: { type: string; label: string; delta: number; when: string; bal: number }[] = [];
export const leaderboard: LeaderRow[] = [];
export const missions: MissionRow[] = [];
export const achievements: AchievementRow[] = [];
export const lobbies: Lobby[] = [];
export const lobbyBoard: LobbyBoardRow[] = [];
export const lobbyChat: LobbyChatRow[] = [];
export const borrowRequests: BorrowReq[] = [];
export const news: NewsItem[] = [];
export const riskLobbies: RiskLobby[] = [];
export const adminUsers: AdminUser[] = [];
export const reviewQueue: ReviewItem[] = [];
export const aiJobs: AiJobRow[] = [];

/** Resolve a lobby's selected matches (by id) against the fixtures. */
export function lobbyMatches(l: Lobby): Match[] {
  return (l.matchIds || []).map((id) => matches.find((m) => m.id === id)).filter(Boolean) as Match[];
}

export const WC = {
  teams, byId, byGroup, GROUPS, venues, matches, upcoming, live, finished,
  me, myBets, ledger, leaderboard, missions, achievements,
  lobbies, lobbyBoard, lobbyChat, borrowRequests, lobbyMatches, news,
  riskLobbies, adminUsers, reviewQueue, aiJobs, fmtDate, matchById, squadFor,
};
export type { Player };
