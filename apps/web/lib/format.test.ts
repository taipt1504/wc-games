import { describe, it, expect } from 'vitest';
import { pctSigned } from './format';

describe('pctSigned', () => {
  it('positive gets +, negative keeps its own -, zero is plain', () => {
    expect(pctSigned(24.1)).toBe('+24.1%');
    expect(pctSigned(-6.5)).toBe('-6.5%');
    expect(pctSigned(0)).toBe('0%');
    expect(pctSigned(100)).toBe('+100%');
  });
  it('rounds to one decimal (sub-0.05 → 0%)', () => {
    expect(pctSigned(0.04)).toBe('0%');
    expect(pctSigned(24.16)).toBe('+24.2%');
  });
});
