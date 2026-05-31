import { describe, it, expect } from 'vitest';
import { squadFor } from './index';

describe('squadFor', () => {
  it('returns exactly 23 players', () => {
    expect(squadFor('BRA')).toHaveLength(23);
  });

  it('has exactly 3 GK', () => {
    expect(squadFor('BRA').filter((p) => p.pos === 'GK')).toHaveLength(3);
  });

  it('has exactly 8 DEF', () => {
    expect(squadFor('BRA').filter((p) => p.pos === 'DEF')).toHaveLength(8);
  });

  it('has exactly 7 MID', () => {
    expect(squadFor('BRA').filter((p) => p.pos === 'MID')).toHaveLength(7);
  });

  it('has exactly 5 FWD', () => {
    expect(squadFor('BRA').filter((p) => p.pos === 'FWD')).toHaveLength(5);
  });

  it('has unique shirt numbers', () => {
    const nums = squadFor('BRA').map((p) => p.num);
    expect(new Set(nums).size).toBe(23);
  });

  it('is deterministic (two calls deep-equal)', () => {
    expect(squadFor('BRA')).toEqual(squadFor('BRA'));
  });

  it('produces different squads for different teams', () => {
    const bra = squadFor('BRA');
    const ger = squadFor('GER');
    const braNames = bra.map((p) => p.name).join(',');
    const gerNames = ger.map((p) => p.name).join(',');
    expect(braNames).not.toBe(gerNames);
  });
});
