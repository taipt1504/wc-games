import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mapRound, parseKickoff, mapStatus, mapGame, houseOdds, type WcGame, type WcTeam, type WcStadium } from './ingest';

const fx = (name: string) => JSON.parse(readFileSync(join(__dirname, '__fixtures__', `wc26-${name}.json`), 'utf8'));
const teams: WcTeam[] = fx('teams').teams;
const stadiums: WcStadium[] = fx('stadiums').stadiums;
const games: WcGame[] = fx('games').games;

describe('ingest mappers (captured worldcup26.ir fixtures)', () => {
  it('fixtures have the expected real counts', () => {
    expect(teams).toHaveLength(48);
    expect(stadiums).toHaveLength(16);
    expect(games).toHaveLength(104);
  });

  it('mapRound covers every type present and rejects unknown', () => {
    expect(mapRound('group')).toBe('GROUP');
    expect(mapRound('r32')).toBe('R32');
    expect(mapRound('third')).toBe('THIRD');
    expect(mapRound('final')).toBe('FINAL');
    expect(() => mapRound('quarter')).toThrow();
  });

  it('parseKickoff reads MM/DD/YYYY HH:MM as a UTC instant', () => {
    expect(parseKickoff('06/11/2026 13:00').toISOString()).toBe('2026-06-11T13:00:00.000Z');
  });

  it('mapStatus maps not-started/finished/live', () => {
    expect(mapStatus({ finished: 'FALSE', time_elapsed: 'notstarted' })).toBe('SCHEDULED');
    expect(mapStatus({ finished: 'TRUE', time_elapsed: '90' })).toBe('FINISHED');
    expect(mapStatus({ finished: 'FALSE', time_elapsed: '57' })).toBe('LIVE');
  });

  it('maps a real group game to Prisma shape', () => {
    const g = games.find((x) => x.type === 'group')!;
    const m = mapGame(g);
    expect(typeof m.id).toBe('bigint');
    expect(m.round).toBe('GROUP');
    expect(m.groupLetter).toBe(g.group);
    expect(m.homeTeamId).toBe(BigInt(g.home_team_id));
    expect(m.venueId).toBe(BigInt(g.stadium_id));
    expect(m.status).toBe('SCHEDULED'); // pre-tournament
    expect(m.scoreHome90).toBeNull();
    expect(m.result90).toBeNull();
  });

  it('maps a knockout game with undrawn teams (id 0, no group)', () => {
    const g = games.find((x) => x.type !== 'group')!;
    const m = mapGame(g);
    expect(m.round).not.toBe('GROUP');
    expect(m.groupLetter).toBeNull();
    expect(m.homeTeamId).toBe(0n);
    expect(m.awayTeamId).toBe(0n);
  });

  it('every fixture game maps without throwing', () => {
    expect(() => games.map(mapGame)).not.toThrow();
  });

  it('houseOdds is deterministic and in range', () => {
    const a = houseOdds(5n);
    const b = houseOdds(5n);
    expect(a).toEqual(b);
    expect(a.mHome).toBeGreaterThanOrEqual(1.55);
    expect(a.mHome).toBeLessThanOrEqual(2.05);
    expect(houseOdds(6n)).not.toEqual(a); // varies by id
  });
});
