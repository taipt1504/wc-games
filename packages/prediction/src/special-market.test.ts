import { describe, it, expect } from 'vitest';
import { specialPayout } from './special-market';

describe('specialPayout', () => {
  it('win → stake + round(stake×odds); loss → 0', () => {
    expect(specialPayout(100, 1.5, true)).toBe(250);
    expect(specialPayout(100, 1.8, true)).toBe(280);
    expect(specialPayout(100, 1.5, false)).toBe(0);
    expect(specialPayout(33, 1.9, true)).toBe(33 + Math.round(33 * 1.9));
  });
});
