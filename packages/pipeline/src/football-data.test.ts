import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  mapFdStatus, mapFdStage, mapFdGroup, mapFdPosition, mapFdScore,
  type FdTeam, type FdMatch,
} from './football-data';

const fx = (name: string) => JSON.parse(readFileSync(join(__dirname, '__fixtures__', `fd-${name}.json`), 'utf8'));
const teams: FdTeam[] = fx('teams').teams;
const matches: FdMatch[] = fx('matches').matches;

describe('football-data scalar mappers', () => {
  it('fixtures load with expected counts', () => {
    expect(teams).toHaveLength(2);
    expect(matches).toHaveLength(2);
  });

  it('mapFdStatus collapses the FD workflow onto our enum', () => {
    expect(mapFdStatus('SCHEDULED')).toBe('SCHEDULED');
    expect(mapFdStatus('TIMED')).toBe('SCHEDULED');
    expect(mapFdStatus('IN_PLAY')).toBe('LIVE');
    expect(mapFdStatus('PAUSED')).toBe('LIVE');
    expect(mapFdStatus('FINISHED')).toBe('FINISHED');
    expect(mapFdStatus('AWARDED')).toBe('FINISHED');
    expect(mapFdStatus('POSTPONED')).toBe('POSTPONED');
    expect(mapFdStatus('SUSPENDED')).toBe('CANCELLED');
    expect(mapFdStatus('CANCELLED')).toBe('CANCELLED');
  });

  it('mapFdStage maps every WC stage and throws on unknown', () => {
    expect(mapFdStage('GROUP_STAGE')).toBe('GROUP');
    expect(mapFdStage('LAST_32')).toBe('R32');
    expect(mapFdStage('LAST_16')).toBe('R16');
    expect(mapFdStage('QUARTER_FINALS')).toBe('QF');
    expect(mapFdStage('SEMI_FINALS')).toBe('SF');
    expect(mapFdStage('THIRD_PLACE')).toBe('THIRD');
    expect(mapFdStage('FINAL')).toBe('FINAL');
    expect(() => mapFdStage('PRELIMINARY')).toThrow();
  });

  it('mapFdGroup strips the GROUP_ prefix; null stays null', () => {
    expect(mapFdGroup('GROUP_A')).toBe('A');
    expect(mapFdGroup('GROUP_L')).toBe('L');
    expect(mapFdGroup(null)).toBeNull();
  });

  it('mapFdPosition collapses coarse FD roles onto GK/DEF/MID/FWD', () => {
    expect(mapFdPosition('Goalkeeper')).toBe('GK');
    expect(mapFdPosition('Defence')).toBe('DEF');
    expect(mapFdPosition('Centre-Back')).toBe('DEF');
    expect(mapFdPosition('Midfield')).toBe('MID');
    expect(mapFdPosition('Offence')).toBe('FWD');
    expect(mapFdPosition('Centre-Forward')).toBe('FWD');
    expect(mapFdPosition(null)).toBeNull();
    expect(mapFdPosition('Unknown role')).toBeNull();
  });

  it('mapFdScore reads fullTime + winner; nulls when unplayed', () => {
    const unplayed = matches[0].score;
    expect(mapFdScore(unplayed)).toEqual({ scoreHome90: null, scoreAway90: null, result90: null });
    expect(mapFdScore({ winner: 'HOME_TEAM', duration: 'REGULAR', fullTime: { home: 2, away: 1 } }))
      .toEqual({ scoreHome90: 2, scoreAway90: 1, result90: 'HOME' });
    expect(mapFdScore({ winner: 'DRAW', duration: 'REGULAR', fullTime: { home: 1, away: 1 } }))
      .toEqual({ scoreHome90: 1, scoreAway90: 1, result90: 'DRAW' });
    expect(mapFdScore({ winner: 'AWAY_TEAM', duration: 'PENALTY_SHOOTOUT', fullTime: { home: 1, away: 1 } }))
      .toEqual({ scoreHome90: 1, scoreAway90: 1, result90: 'AWAY' });
  });
});
