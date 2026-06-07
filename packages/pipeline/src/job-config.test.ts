import { describe, it, expect } from 'vitest';
import { JOB_DEFAULTS, clampConfig, mergeJobConfig } from './job-config';

describe('clampConfig', () => {
  it('missing fields fall back to defaults', () => {
    expect(clampConfig('result_check', {})).toEqual(JOB_DEFAULTS.result_check);
  });
  it('out-of-range clamps (intervalSeconds min 10)', () => {
    expect(clampConfig('livescore', { intervalSeconds: 1 })).toEqual({ intervalSeconds: 10 });
  });
  it('over-max clamps (maxAttempts max 50)', () => {
    expect(clampConfig('result_check', { maxAttempts: 999 }).maxAttempts).toBe(50);
  });
  it('valid value kept', () => {
    expect(clampConfig('lock_betting', { leadMinutes: 5 })).toEqual({ leadMinutes: 5 });
  });
  it('non-numeric ignored → default', () => {
    expect(clampConfig('lock_betting', { leadMinutes: 'x' as unknown as number })).toEqual({ leadMinutes: 0 });
  });
});

describe('mergeJobConfig', () => {
  it('rejects unknown field', () => {
    expect(() => mergeJobConfig('lock_betting', { bogus: 1 })).toThrow(/UNKNOWN_FIELD/);
  });
  it('clamps a valid patch', () => {
    expect(mergeJobConfig('scheduler_scan', { rescanMinutes: 0 }).rescanMinutes).toBe(1);
  });
});
