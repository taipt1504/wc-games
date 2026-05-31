/**
 * @wc/prediction — Achievements service (ENG-04).
 * Compute-on-read from real Prediction / Wallet / PredictionUserStats.
 * On first unlock, persists a UserAchievement row (idempotent).
 */
import type { PrismaClient } from '@wc/db';

export interface AchievementDef {
  code: string;
  name: string;
  desc: string;
  icon: string;
  target: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    code: 'FIRST_BLOOD',
    name: 'First Blood',
    desc: 'Win your first bet',
    icon: 'trophy',
    target: 1,
  },
  {
    code: 'GIANT_KILLER',
    name: 'Giant Killer',
    desc: 'Win a bet at odds ≥ 2.5',
    icon: 'zap',
    target: 1,
  },
  {
    code: 'HOT_STREAK',
    name: 'Hot Streak',
    desc: 'Win 5 bets in a row',
    icon: 'flame',
    target: 5,
  },
  {
    code: 'MILLIONAIRE',
    name: 'Virtual Millionaire',
    desc: 'Reach 10,000 points',
    icon: 'coins',
    target: 10000,
  },
  {
    code: 'SHARP',
    name: 'Sharp',
    desc: 'Reach 25 settled bets',
    icon: 'target',
    target: 25,
  },
];

/** Upsert Achievement rows. Idempotent — safe to call on every request. */
export async function ensureAchievements(prisma: PrismaClient): Promise<Map<string, bigint>> {
  const codeToId = new Map<string, bigint>();
  for (const a of ACHIEVEMENTS) {
    const row = await prisma.achievement.upsert({
      where: { code: a.code },
      create: { code: a.code, condition: { target: a.target } },
      update: { condition: { target: a.target } },
    });
    codeToId.set(a.code, row.id);
  }
  return codeToId;
}

export interface AchievementStatus {
  code: string;
  name: string;
  desc: string;
  icon: string;
  unlocked: boolean;
  progress: number;
  target: number;
}

/** Compute progress for a single achievement code. */
async function computeProgress(
  prisma: PrismaClient,
  userId: bigint,
  code: string,
): Promise<number> {
  if (code === 'FIRST_BLOOD') {
    const hit = await prisma.prediction.findFirst({
      where: { userId, status: 'WON' },
    });
    return hit ? 1 : 0;
  }

  if (code === 'GIANT_KILLER') {
    const hit = await prisma.prediction.findFirst({
      where: { userId, status: 'WON', oddsSnapshot: { gte: 2.5 } },
    });
    return hit ? 1 : 0;
  }

  if (code === 'HOT_STREAK') {
    const settled = await prisma.prediction.findMany({
      where: { userId, settledAt: { not: null } },
      orderBy: { settledAt: 'asc' },
      select: { status: true },
    });
    let best = 0;
    let current = 0;
    for (const p of settled) {
      if (p.status === 'WON') {
        current++;
        if (current > best) best = current;
      } else {
        current = 0;
      }
    }
    return best;
  }

  if (code === 'MILLIONAIRE') {
    const wallet = await prisma.wallet.findFirst({
      where: { userId, contextType: 'GLOBAL', contextId: null },
      select: { balance: true },
    });
    return wallet ? Number(wallet.balance) : 0;
  }

  if (code === 'SHARP') {
    const stats = await prisma.predictionUserStats.findUnique({
      where: { userId },
      select: { settledCount: true },
    });
    return stats?.settledCount ?? 0;
  }

  return 0;
}

/**
 * Ensure achievements exist, compute progress per user, persist new unlocks,
 * and return the full achievement list.
 */
export async function listAchievements(
  prisma: PrismaClient,
  userId: bigint,
): Promise<AchievementStatus[]> {
  const codeToId = await ensureAchievements(prisma);

  // Fetch already-earned rows
  const earned = await prisma.userAchievement.findMany({ where: { userId } });
  const earnedIds = new Set(earned.map((e) => e.achievementId));

  const result: AchievementStatus[] = [];
  for (const def of ACHIEVEMENTS) {
    const achievementId = codeToId.get(def.code)!;
    const alreadyUnlocked = earnedIds.has(achievementId);

    const progress = await computeProgress(prisma, userId, def.code);
    const computedNow = progress >= def.target;
    const unlocked = alreadyUnlocked || computedNow;

    // Persist on first unlock (idempotent upsert)
    if (computedNow && !alreadyUnlocked) {
      await prisma.userAchievement.upsert({
        where: { userId_achievementId: { userId, achievementId } },
        create: { userId, achievementId },
        update: {},
      });
    }

    result.push({
      code: def.code,
      name: def.name,
      desc: def.desc,
      icon: def.icon,
      unlocked,
      progress,
      target: def.target,
    });
  }
  return result;
}
