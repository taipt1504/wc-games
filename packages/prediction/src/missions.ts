/**
 * @wc/prediction — Daily Mission service (ENG-03).
 * Source of truth: PRD §05. "Today" = UTC+7 calendar day.
 * Progress is computed on-read from real Prediction rows (compute-on-read).
 */
import type { PrismaClient } from '@wc/db';

const TZ_OFFSET_MS = 7 * 3600 * 1000; // UTC+7 (PRD OQ-07)
const DAY_MS = 24 * 3600 * 1000;

/**
 * Returns the UTC+7 calendar date stored as a UTC midnight Date, suitable
 * for writing into a @db.Date column and for equality comparisons.
 *
 * e.g. when now = 2026-05-31T03:00:00Z  (= 2026-05-31 10:00 UTC+7)
 *   => new Date('2026-05-31T00:00:00.000Z')
 */
function dateKeyUtc7(now: Date): Date {
  const shifted = new Date(now.getTime() + TZ_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

/**
 * Returns the UTC instant that corresponds to 00:00 UTC+7 of the same
 * calendar day (i.e. the start of the 24-hour window for Prediction queries).
 *
 * e.g. dateKey = 2026-05-31T00:00:00Z  => windowStart = 2026-05-30T17:00:00Z
 */
function windowStart(dateKey: Date): Date {
  return new Date(dateKey.getTime() - TZ_OFFSET_MS);
}

export interface MissionDef {
  code: string;
  label: string;
  reward: number;
  target: number;
  icon: string;
}

export const MISSIONS: MissionDef[] = [
  { code: 'PLACE_3', label: 'Place 3 bets today', reward: 100, target: 3, icon: 'target' },
  { code: 'UNDERDOG', label: 'Back an underdog (odds ≥ 2.0)', reward: 150, target: 1, icon: 'trending' },
  { code: 'WIN_1', label: 'Win a bet today', reward: 200, target: 1, icon: 'trophy' },
];

/** Upsert the 3 Mission rows. Idempotent — safe to call on every server start. */
export async function ensureMissions(prisma: PrismaClient): Promise<void> {
  for (const m of MISSIONS) {
    await prisma.mission.upsert({
      where: { code: m.code },
      create: { code: m.code, rule: { target: m.target }, reward: BigInt(m.reward) },
      update: { rule: { target: m.target }, reward: BigInt(m.reward) },
    });
  }
}

export interface MissionStatus {
  code: string;
  label: string;
  reward: number;
  progress: number;
  target: number;
  complete: boolean;
  claimed: boolean;
  icon: string;
}

/** Compute today's progress for a single mission code. */
async function computeProgress(
  prisma: PrismaClient,
  userId: bigint,
  code: string,
  wStart: Date,
  wEnd: Date,
): Promise<number> {
  if (code === 'PLACE_3') {
    const count = await prisma.prediction.count({
      where: { userId, createdAt: { gte: wStart, lt: wEnd } },
    });
    return count;
  }
  if (code === 'UNDERDOG') {
    const hit = await prisma.prediction.findFirst({
      where: { userId, createdAt: { gte: wStart, lt: wEnd }, oddsSnapshot: { gte: 2.0 } },
    });
    return hit ? 1 : 0;
  }
  if (code === 'WIN_1') {
    const hit = await prisma.prediction.findFirst({
      where: { userId, status: 'WON', settledAt: { gte: wStart, lt: wEnd } },
    });
    return hit ? 1 : 0;
  }
  return 0;
}

/**
 * Ensure missions exist, compute today's progress per the defined rules,
 * and return the full mission list with progress/claimed state.
 */
export async function listMissions(
  prisma: PrismaClient,
  userId: bigint,
  now: Date = new Date(),
): Promise<MissionStatus[]> {
  await ensureMissions(prisma);

  const dk = dateKeyUtc7(now);
  const wStart = windowStart(dk);
  const wEnd = new Date(wStart.getTime() + DAY_MS);

  // Fetch mission rows + today's progress rows in one go
  const [missions, progressRows] = await Promise.all([
    prisma.mission.findMany(),
    prisma.missionProgress.findMany({ where: { userId, date: dk } }),
  ]);

  const progressByMissionId = new Map<bigint, { progress: number; claimed: boolean }>();
  for (const row of progressRows) {
    progressByMissionId.set(row.missionId, { progress: row.progress, claimed: row.claimed });
  }

  const result: MissionStatus[] = [];
  for (const def of MISSIONS) {
    const mission = missions.find((m) => m.code === def.code);
    if (!mission) continue;

    const progress = await computeProgress(prisma, userId, def.code, wStart, wEnd);
    const savedRow = progressByMissionId.get(mission.id);
    const claimed = savedRow?.claimed ?? false;
    const complete = progress >= def.target;

    result.push({
      code: def.code,
      label: def.label,
      reward: def.reward,
      progress,
      target: def.target,
      complete,
      claimed,
      icon: def.icon,
    });
  }
  return result;
}

/**
 * Claim a completed mission reward for today.
 * Throws 'NOT_COMPLETE' if mission not finished.
 * Throws 'ALREADY_CLAIMED' if already claimed today.
 * Credits GLOBAL wallet + writes BONUS ledger row.
 */
export async function claimMission(
  prisma: PrismaClient,
  userId: bigint,
  code: string,
  now: Date = new Date(),
): Promise<{ reward: number; balance: bigint }> {
  await ensureMissions(prisma);

  const def = MISSIONS.find((m) => m.code === code);
  if (!def) throw new Error('MISSION_NOT_FOUND');

  const mission = await prisma.mission.findUniqueOrThrow({ where: { code } });

  const dk = dateKeyUtc7(now);
  const wStart = windowStart(dk);
  const wEnd = new Date(wStart.getTime() + DAY_MS);

  // Compute progress outside tx (read-only)
  const progress = await computeProgress(prisma, userId, code, wStart, wEnd);
  if (progress < def.target) throw new Error('NOT_COMPLETE');

  return prisma.$transaction(async (tx) => {
    // Find or create MissionProgress row for today
    const existing = await tx.missionProgress.findUnique({
      where: { userId_missionId_date: { userId, missionId: mission.id, date: dk } },
    });

    if (existing?.claimed) throw new Error('ALREADY_CLAIMED');

    // Credit GLOBAL wallet
    const wallet = await tx.wallet.findFirstOrThrow({
      where: { userId, contextType: 'GLOBAL', contextId: null },
    });
    const reward = mission.reward;
    const newBal = wallet.balance + reward;
    await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBal } });

    // Write BONUS ledger row
    await tx.pointLedger.create({
      data: {
        userId,
        contextType: 'GLOBAL',
        type: 'BONUS',
        amount: reward,
        balanceAfter: newBal,
        refType: 'MISSION',
        refId: mission.id,
      },
    });

    // Upsert MissionProgress with claimed=true
    if (existing) {
      await tx.missionProgress.update({
        where: { id: existing.id },
        data: { claimed: true, progress },
      });
    } else {
      await tx.missionProgress.create({
        data: { userId, missionId: mission.id, date: dk, progress, claimed: true },
      });
    }

    return { reward: Number(reward), balance: newBal };
  });
}
