import { describe, it, expect } from 'vitest';
import {
  result1x2,
  payout1x2,
  knockoutExactBonus,
  settleBet,
  voidRefund,
  roiPercent,
  qualifiesForLeaderboard,
  lobbyScore,
  isUnderdog,
} from './scoring';

describe('result1x2', () => {
  it('home win / draw / away win', () => {
    expect(result1x2(2, 1)).toBe('1');
    expect(result1x2(1, 1)).toBe('X');
    expect(result1x2(0, 2)).toBe('2');
  });
});

describe('payout1x2 — PRD France–Japan example (m_home=0.8, m_away=1.5)', () => {
  it('France win, stake 100 → 180', () => {
    expect(payout1x2(100, 0.8, '1', '1')).toBe(180);
  });
  it('Japan win, stake 100 → 250', () => {
    expect(payout1x2(100, 1.5, '2', '2')).toBe(250);
  });
  it('wrong pick → 0', () => {
    expect(payout1x2(100, 0.8, '1', '2')).toBe(0);
  });
  it('correct draw, m=1.1 → 210', () => {
    expect(payout1x2(100, 1.1, 'X', 'X')).toBe(210);
  });
  it('rounds to nearest integer', () => {
    expect(payout1x2(100, 0.855, '1', '1')).toBe(186); // 185.5 → 186
  });
});

describe('knockoutExactBonus', () => {
  it('won 1x2 + exact correct → stake*bonusRate', () => {
    expect(knockoutExactBonus(100, true, true, 1.0)).toBe(100);
  });
  it('won 1x2 but wrong exact → 0', () => {
    expect(knockoutExactBonus(100, true, false, 1.0)).toBe(0);
  });
  it('lost 1x2 → 0', () => {
    expect(knockoutExactBonus(100, false, true, 1.0)).toBe(0);
  });
});

describe('settleBet', () => {
  it('group win', () => {
    expect(settleBet({ stake: 100, odds: 0.8, pick: '1', homeGoals: 2, awayGoals: 1 })).toMatchObject({
      result: '1',
      won: true,
      payout: 180,
      netProfit: 80,
    });
  });
  it('knockout win + exact bonus (QF 2-1, m=0.9, bonus 1.0) → 290', () => {
    const r = settleBet({
      stake: 100,
      odds: 0.9,
      pick: '1',
      homeGoals: 2,
      awayGoals: 1,
      knockout: true,
      exactPick: { home: 2, away: 1 },
      bonusRate: 1.0,
    });
    expect(r.payout).toBe(290); // 190 (1X2) + 100 (bonus)
  });
  it('knockout win but wrong exact → no bonus (190)', () => {
    const r = settleBet({
      stake: 100,
      odds: 0.9,
      pick: '1',
      homeGoals: 3,
      awayGoals: 1,
      knockout: true,
      exactPick: { home: 2, away: 1 },
    });
    expect(r.payout).toBe(190);
  });
  it('lost → payout 0, netProfit -stake', () => {
    expect(settleBet({ stake: 100, odds: 0.8, pick: '1', homeGoals: 0, awayGoals: 2 })).toMatchObject({
      won: false,
      payout: 0,
      netProfit: -100,
    });
  });
});

describe('voidRefund', () => {
  it('returns stake', () => {
    expect(voidRefund(120)).toBe(120);
  });
});

describe('roiPercent', () => {
  it('staked 1000 returned 1180 → 0.18', () => {
    expect(roiPercent(1000, 1180)).toBeCloseTo(0.18, 5);
  });
  it('negative ROI', () => {
    expect(roiPercent(1000, 600)).toBeCloseTo(-0.4, 5);
  });
  it('guard divide-by-zero → 0', () => {
    expect(roiPercent(0, 0)).toBe(0);
  });
});

describe('qualifiesForLeaderboard', () => {
  it('9 < 10 → false, 10 → true', () => {
    expect(qualifiesForLeaderboard(9)).toBe(false);
    expect(qualifiesForLeaderboard(10)).toBe(true);
  });
});

describe('lobbyScore — PRD formula winnings + default − borrowed', () => {
  it('default 100, lost all (winnings −100), borrowed 200 → −200', () => {
    expect(lobbyScore(-100, 100, 200)).toBe(-200);
  });
  it('winnings 610 + default 1000 − borrowed 200 → 1410', () => {
    expect(lobbyScore(610, 1000, 200)).toBe(1410);
  });
});

describe('isUnderdog', () => {
  it('odds >= 2.0 is underdog', () => {
    expect(isUnderdog(2.0)).toBe(true);
    expect(isUnderdog(1.99)).toBe(false);
  });
});
