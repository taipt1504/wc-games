/**
 * @wc/core — Scoring engine (pure, no deps). Source of truth: PRD §04 + Prediction Service Design §8.
 * Point dùng `number` (số nguyên, < 2^53 an toàn); lớp DB tự chuyển sang BigInt nếu cần.
 */

export type Pick1X2 = '1' | 'X' | '2'; // 1=home win, X=draw, 2=away win

/** Kết quả 90' từ tỉ số (không tính ET/penalty). PRD §04.4 */
export function result1x2(homeGoals: number, awayGoals: number): Pick1X2 {
  if (homeGoals > awayGoals) return '1';
  if (homeGoals < awayGoals) return '2';
  return 'X';
}

/** Payout kèo 1X2: đúng → round(stake*(1+odds)); sai → 0. PRD §04.3 */
export function payout1x2(stake: number, odds: number, pick: Pick1X2, result: Pick1X2): number {
  return pick === result ? Math.round(stake * (1 + odds)) : 0;
}

/** Bonus tỉ số chính xác (CHỈ knockout): đúng 1X2 VÀ đúng tỉ số 90' → +round(stake*bonusRate). PRD §04.5 */
export function knockoutExactBonus(
  stake: number,
  won1x2: boolean,
  exactCorrect: boolean,
  bonusRate = 1.0,
): number {
  return won1x2 && exactCorrect ? Math.round(stake * bonusRate) : 0;
}

export interface SettleInput {
  stake: number;
  odds: number; // snapshot tại thời điểm đặt kèo
  pick: Pick1X2;
  homeGoals: number; // 90'
  awayGoals: number; // 90'
  knockout?: boolean;
  exactPick?: { home: number; away: number };
  bonusRate?: number;
}

export interface SettleResult {
  result: Pick1X2;
  won: boolean;
  payout: number;
  netProfit: number;
}

/** Settle 1 kèo: 1X2 + bonus knockout (nếu có). PRD §04.3/04.5/04.7 */
export function settleBet(i: SettleInput): SettleResult {
  const result = result1x2(i.homeGoals, i.awayGoals);
  const won = i.pick === result;
  let payout = payout1x2(i.stake, i.odds, i.pick, result);
  if (i.knockout && i.exactPick) {
    const exactCorrect = i.exactPick.home === i.homeGoals && i.exactPick.away === i.awayGoals;
    payout += knockoutExactBonus(i.stake, won, exactCorrect, i.bonusRate ?? 1.0);
  }
  return { result, won, payout, netProfit: payout - i.stake };
}

/** VOID (trận huỷ): hoàn lại stake, không lãi/lỗ. PRD §04.8 */
export function voidRefund(stake: number): number {
  return stake;
}

/** ROI% = (returned - staked) / staked. Guard chia 0 → 0. PRD §04.9 / OQ-04 */
export function roiPercent(totalStaked: number, totalReturned: number): number {
  if (totalStaked <= 0) return 0;
  return (totalReturned - totalStaked) / totalStaked;
}

/** Điều kiện vào leaderboard ROI global: đủ tối thiểu N kèo đã settle (chống mẫu nhỏ). */
export function qualifiesForLeaderboard(settledCount: number, min = 10): boolean {
  return settledCount >= min;
}

/** Điểm lobby = winnings + default − borrowed. PRD §04.6 */
export function lobbyScore(winnings: number, defaultPoints: number, borrowed: number): number {
  return winnings + defaultPoints - borrowed;
}

/** Underdog: cửa được coi là "cửa dưới" khi odds >= threshold. PRD §06 DEPTH-03 / OQ-09 */
export function isUnderdog(odds: number, threshold = 2.0): boolean {
  return odds >= threshold;
}
