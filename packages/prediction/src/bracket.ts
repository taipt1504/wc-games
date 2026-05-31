/**
 * @wc/prediction — Bracket Predictor service (DEPTH-01).
 * Source of truth: PRD §06.
 * Picks shape: { CHAMPION?: number; FINALISTS?: number[]; SEMIS?: number[] }
 */
import type { PrismaClient } from '@wc/db';

export interface BracketPicks {
  CHAMPION?: number;
  FINALISTS?: number[];
  SEMIS?: number[];
}

export interface BracketResult {
  picks: BracketPicks;
  lockedAt: Date | null;
  score: number;
}

function validatePicks(picks: unknown): BracketPicks {
  if (typeof picks !== 'object' || picks === null || Array.isArray(picks)) {
    throw new Error('INVALID_PICKS');
  }
  const p = picks as Record<string, unknown>;

  if ('CHAMPION' in p && p.CHAMPION !== undefined) {
    if (typeof p.CHAMPION !== 'number' || !Number.isInteger(p.CHAMPION)) throw new Error('INVALID_PICKS');
  }
  if ('FINALISTS' in p && p.FINALISTS !== undefined) {
    if (!Array.isArray(p.FINALISTS) || p.FINALISTS.length > 2) throw new Error('INVALID_PICKS');
    if (p.FINALISTS.some((x) => typeof x !== 'number' || !Number.isInteger(x))) throw new Error('INVALID_PICKS');
  }
  if ('SEMIS' in p && p.SEMIS !== undefined) {
    if (!Array.isArray(p.SEMIS) || p.SEMIS.length > 4) throw new Error('INVALID_PICKS');
    if (p.SEMIS.some((x) => typeof x !== 'number' || !Number.isInteger(x))) throw new Error('INVALID_PICKS');
  }

  const result: BracketPicks = {};
  if (typeof p.CHAMPION === 'number') result.CHAMPION = p.CHAMPION;
  if (Array.isArray(p.FINALISTS)) result.FINALISTS = p.FINALISTS as number[];
  if (Array.isArray(p.SEMIS)) result.SEMIS = p.SEMIS as number[];
  return result;
}

export async function getBracket(
  prisma: PrismaClient,
  userId: bigint,
): Promise<BracketResult> {
  const row = await prisma.bracket.findUnique({ where: { userId } });
  if (!row) return { picks: {}, lockedAt: null, score: 0 };
  return {
    picks: row.picks as BracketPicks,
    lockedAt: row.lockedAt,
    score: row.score,
  };
}

export async function saveBracket(
  prisma: PrismaClient,
  userId: bigint,
  picks: unknown,
): Promise<BracketResult> {
  const existing = await prisma.bracket.findUnique({ where: { userId } });
  if (existing?.lockedAt != null) throw new Error('BRACKET_LOCKED');

  const validated = validatePicks(picks);

  const picksJson = validated as Parameters<typeof prisma.bracket.create>[0]['data']['picks'];
  const row = await prisma.bracket.upsert({
    where: { userId },
    create: { userId, picks: picksJson },
    update: { picks: picksJson },
  });

  return {
    picks: row.picks as BracketPicks,
    lockedAt: row.lockedAt,
    score: row.score,
  };
}
