import type { Match, Bet, Pick1X2 } from '@/lib/wc';
import type { ToastData } from '@/components/ui';

export interface BetSlipState {
  match: Match;
  pick: Pick1X2;
  odds: number;
}

export interface LedgerEntry {
  type: string;
  label: string;
  delta: number;
  when: string;
  bal: number;
}

/** Current user's display profile (from GET /api/v1/me). Neutral defaults until authed. */
export interface MeProfile {
  name: string;
  handle: string;
  avatar: string;
  country: string;
  rank: number | null;
  roi: number;
  won: number;
  lost: number;
  settled: number;
  joined: string;
}

/** Global app store passed as `s` to every screen (ported from design app.jsx). */
export interface Store {
  route: string;
  param: Record<string, unknown>;
  me: MeProfile;
  points: number;
  role: string;
  tier: string;
  bets: Bet[];
  ledger: LedgerEntry[];
  streak: number;
  winStreak: number;
  checkedIn: boolean;
  betSlip: BetSlipState | null;
  borrowOpen: boolean;
  toast: ToastData | null;
  authed: boolean;
  go: (r: string, p?: Record<string, unknown>) => void;
  back: () => void;
  toastMsg: (msg: string, icon?: string, color?: string) => void;
  login: (email?: string, password?: string, mode?: string) => void;
  logout: () => void;
  refreshUser: () => void;
  checkin: () => void;
  claimMission: (code: string) => Promise<void>;
  pickFor: (mid: number) => string | undefined;
  openBet: (match: Match, pick: Pick1X2, odds: number) => void;
  setSlipPick: (pick: Pick1X2, odds: number) => void;
  closeBet: () => void;
  confirmBet: (stake: number, exact?: { home: number; away: number }, powerUp?: string) => void;
  openBorrow: () => void;
  closeBorrow: () => void;
}

export type ScreenProps = { s: Store };
