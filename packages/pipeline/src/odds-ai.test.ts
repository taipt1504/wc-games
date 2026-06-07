import { describe, it, expect } from 'vitest';
import { parseOddsJson, proposeOdds } from './odds-ai';
import type { LlmGateway } from '@wc/ai';

describe('parseOddsJson', () => {
  it('parses + rounds a valid object', () => {
    expect(parseOddsJson('{"mHome":1.555,"mDraw":2.3,"mAway":2.8}')).toEqual({ mHome: 1.56, mDraw: 2.3, mAway: 2.8 });
  });
  it('tolerates surrounding prose/fences', () => {
    expect(parseOddsJson('```json\n{"mHome":1.5,"mDraw":2.4,"mAway":3.0}\n```')).toEqual({ mHome: 1.5, mDraw: 2.4, mAway: 3.0 });
  });
  it('throws on out-of-range odds', () => {
    expect(() => parseOddsJson('{"mHome":0,"mDraw":2,"mAway":3}')).toThrow('ODDS_OUT_OF_RANGE');
    expect(() => parseOddsJson('{"mHome":99,"mDraw":2,"mAway":3}')).toThrow('ODDS_OUT_OF_RANGE');
  });
  it('throws when no JSON object', () => {
    expect(() => parseOddsJson('sorry, no odds')).toThrow('no JSON object');
  });
});

describe('proposeOdds', () => {
  it('returns the parsed line from the gateway', async () => {
    const gateway = { complete: async () => '{"mHome":1.6,"mDraw":2.3,"mAway":2.4}' } as unknown as LlmGateway;
    expect(await proposeOdds(gateway, { home: 'Brazil', away: 'Serbia' })).toEqual({ mHome: 1.6, mDraw: 2.3, mAway: 2.4 });
  });
});
