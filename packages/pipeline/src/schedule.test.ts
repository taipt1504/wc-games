import { describe, it, expect } from 'vitest';
import {
  lineupDelayMs, firstResultCheckDelayMs, decideResultCheck,
  LINEUP_LEAD_MS, FIRST_RESULT_CHECK_MS, MAX_RESULT_ATTEMPTS,
} from './schedule';

const KICK = new Date('2026-06-11T18:00:00.000Z');
const t = (offsetMin: number) => KICK.getTime() + offsetMin * 60_000;

describe('lineupDelayMs', () => {
  it('schedules 15min before kickoff', () => {
    expect(lineupDelayMs(KICK, t(-60))).toBe(45 * 60_000); // 60min out → fires in 45min (at T-15)
    expect(lineupDelayMs(KICK, KICK.getTime() - LINEUP_LEAD_MS)).toBe(0); // exactly T-15 → now
  });
  it('clamps to 0 once the lead time has passed', () => {
    expect(lineupDelayMs(KICK, t(-5))).toBe(0); // already inside T-15
    expect(lineupDelayMs(KICK, t(120))).toBe(0); // long after kickoff
  });
});

describe('firstResultCheckDelayMs', () => {
  it('schedules at kickoff + 135min', () => {
    expect(firstResultCheckDelayMs(KICK, KICK.getTime())).toBe(FIRST_RESULT_CHECK_MS);
    expect(firstResultCheckDelayMs(KICK, t(135))).toBe(0); // exactly due
  });
  it('clamps to 0 when the match should already be over', () => {
    expect(firstResultCheckDelayMs(KICK, t(200))).toBe(0);
  });
});

describe('decideResultCheck', () => {
  const fin = { status: 'FINISHED', scoreHome90: 2, scoreAway90: 1 };
  const live = { status: 'LIVE', scoreHome90: 1, scoreAway90: 1 };
  const sched = { status: 'SCHEDULED', scoreHome90: null, scoreAway90: null };

  it('settles a FINISHED match with a score', () => {
    expect(decideResultCheck(fin, 0)).toBe('settle');
  });
  it('re-checks while still LIVE (ET/penalties) before the cap', () => {
    expect(decideResultCheck(live, 0)).toBe('recheck');
    expect(decideResultCheck(live, MAX_RESULT_ATTEMPTS - 1)).toBe('recheck');
  });
  it('does NOT settle a FINISHED match with no score yet', () => {
    expect(decideResultCheck({ status: 'FINISHED', scoreHome90: null, scoreAway90: null }, 0)).toBe('recheck');
  });
  it('stops after the attempt cap (hands off to admin)', () => {
    expect(decideResultCheck(live, MAX_RESULT_ATTEMPTS)).toBe('stop');
    expect(decideResultCheck(sched, MAX_RESULT_ATTEMPTS)).toBe('stop');
  });
});
