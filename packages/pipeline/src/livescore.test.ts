import { describe, it, expect } from 'vitest';
import { liveScoreUpdate, updateLiveScores, syncOneMatchResult } from './livescore';
import type { PrismaClient } from '@wc/db';
import type { WcGame } from './ingest';

const game = (over: Partial<WcGame>): WcGame => ({
  id: '1', home_team_id: '1', away_team_id: '2', home_score: '0', away_score: '0',
  group: 'A', matchday: '1', local_date: '06/11/2026 13:00', stadium_id: '1',
  finished: 'FALSE', time_elapsed: 'notstarted', type: 'group', ...over,
});

describe('liveScoreUpdate', () => {
  it('SCHEDULED → no scores, no result', () => {
    expect(liveScoreUpdate(game({}))).toEqual({ status: 'SCHEDULED', scoreHome90: null, scoreAway90: null, result90: null });
  });

  it('LIVE → running score, result still null', () => {
    const u = liveScoreUpdate(game({ time_elapsed: '57', home_score: '1', away_score: '0' }));
    expect(u).toEqual({ status: 'LIVE', scoreHome90: 1, scoreAway90: 0, result90: null });
  });

  it('FINISHED → final score + result90 (HOME/AWAY/DRAW)', () => {
    expect(liveScoreUpdate(game({ finished: 'TRUE', home_score: '2', away_score: '1' })).result90).toBe('HOME');
    expect(liveScoreUpdate(game({ finished: 'TRUE', home_score: '0', away_score: '3' })).result90).toBe('AWAY');
    expect(liveScoreUpdate(game({ finished: 'TRUE', home_score: '1', away_score: '1' })).result90).toBe('DRAW');
  });
});

describe('updateLiveScores', () => {
  it('skips admin-confirmed matches (source=ADMIN) — never reverts a manual result', async () => {
    const updates: { id: number }[] = [];
    const fakePrisma = {
      match: {
        findUnique: async ({ where }: { where: { id: bigint } }) =>
          where.id === 1n
            ? { status: 'FINISHED', scoreHome90: 2, scoreAway90: 1, source: 'ADMIN' }
            : { status: 'SCHEDULED', scoreHome90: null, scoreAway90: null, source: 'API' },
        update: async ({ where }: { where: { id: bigint } }) => { updates.push({ id: Number(where.id) }); return {}; },
      },
    } as unknown as PrismaClient;

    // Feed: match 1 (ADMIN-confirmed) still listed as upcoming; match 2 (API) goes LIVE.
    const fetchJson = (async () => ({
      games: [
        game({ id: '1' }),
        game({ id: '2', time_elapsed: '57', home_score: '1', away_score: '0' }),
      ],
    })) as unknown as Parameters<typeof updateLiveScores>[1];

    const res = await updateLiveScores(fakePrisma, fetchJson);
    expect(updates.map((u) => u.id)).toEqual([2]); // only the API match updated; ADMIN match skipped
    expect(res.updated).toBe(1);
  });
});

describe('syncOneMatchResult', () => {
  it('writes the feed score/status for one match (source API)', async () => {
    const updates: { id: number; data: Record<string, unknown> }[] = [];
    const fakePrisma = {
      match: { update: async ({ where, data }: { where: { id: bigint }; data: Record<string, unknown> }) => { updates.push({ id: Number(where.id), data }); return {}; } },
    } as unknown as PrismaClient;
    const fetchJson = (async () => ({
      games: [game({ id: '7', finished: 'TRUE', home_score: '2', away_score: '1' })],
    })) as unknown as Parameters<typeof syncOneMatchResult>[2];

    const res = await syncOneMatchResult(fakePrisma, 7n, fetchJson);
    expect(res).toMatchObject({ updated: true, status: 'FINISHED', scoreHome90: 2, scoreAway90: 1 });
    expect(updates[0].id).toBe(7);
    expect(updates[0].data).toMatchObject({ status: 'FINISHED', scoreHome90: 2, scoreAway90: 1, result90: 'HOME', source: 'API' });
  });

  it('throws when the match is not in the feed', async () => {
    const fakePrisma = { match: { update: async () => ({}) } } as unknown as PrismaClient;
    const fetchJson = (async () => ({ games: [game({ id: '1' })] })) as unknown as Parameters<typeof syncOneMatchResult>[2];
    await expect(syncOneMatchResult(fakePrisma, 999n, fetchJson)).rejects.toThrow('MATCH_NOT_IN_FEED');
  });
});
