/**
 * @wc/pipeline — schedule-job config layer. Reads the ScheduleJob registry (DB) and merges each
 * job's stored config over the constant defaults, clamping every numeric field to a safe range.
 * All reads fall back to the defaults and NEVER throw, so a missing/bad row degrades to today's
 * hardcoded behavior rather than breaking the worker. The schedule.ts constants are the defaults.
 */
import type { PrismaClient } from '@wc/db';
import { LINEUP_LEAD_MS, FIRST_RESULT_CHECK_MS, RESULT_RECHECK_MS, MAX_RESULT_ATTEMPTS } from './schedule';

export type JobKey = 'lock_betting' | 'lineup' | 'result_check' | 'livescore' | 'scheduler_scan' | 'news' | 'fd_sync' | 'enrich_lineups';

export interface JobConfigs {
  lock_betting: { leadMinutes: number };
  lineup: { leadMinutes: number };
  result_check: { firstDelayMinutes: number; recheckMinutes: number; maxAttempts: number };
  livescore: { intervalSeconds: number };
  scheduler_scan: { rescanMinutes: number; scanAheadHours: number; scanBehindHours: number };
  news: { publishIntervalSeconds: number };
  fd_sync: { intervalMinutes: number; teamsEveryRuns: number };
  enrich_lineups: Record<string, never>;
}

export const JOB_DEFAULTS: JobConfigs = {
  lock_betting: { leadMinutes: 0 },
  lineup: { leadMinutes: LINEUP_LEAD_MS / 60_000 },
  result_check: {
    firstDelayMinutes: FIRST_RESULT_CHECK_MS / 60_000,
    recheckMinutes: RESULT_RECHECK_MS / 60_000,
    maxAttempts: MAX_RESULT_ATTEMPTS,
  },
  livescore: { intervalSeconds: 45 },
  scheduler_scan: { rescanMinutes: 60, scanAheadHours: 36, scanBehindHours: 6 },
  news: { publishIntervalSeconds: 60 },
  fd_sync: { intervalMinutes: 45, teamsEveryRuns: 16 },
  enrich_lineups: {},
};

export const JOB_LABELS: Record<JobKey, string> = {
  lock_betting: 'Lock betting', lineup: 'Lineup crawl', result_check: 'Result check',
  livescore: 'Live score poll', scheduler_scan: 'Scheduler scan', news: 'News publish',
  fd_sync: 'Football-data sync',
  enrich_lineups: 'Lineup enrichment',
};

export const JOB_KEYS = Object.keys(JOB_DEFAULTS) as JobKey[];

const BOUNDS: Record<string, [number, number]> = {
  leadMinutes: [0, 240], firstDelayMinutes: [0, 600], recheckMinutes: [1, 240], maxAttempts: [0, 50],
  intervalSeconds: [10, 3600], rescanMinutes: [1, 1440], scanAheadHours: [1, 168], scanBehindHours: [0, 72],
  publishIntervalSeconds: [10, 3600], intervalMinutes: [5, 1440], teamsEveryRuns: [1, 1000],
};

function clampField(name: string, val: number): number {
  const b = BOUNDS[name];
  if (!b) return val;
  return Math.min(b[1], Math.max(b[0], val));
}

/** Merge a (possibly partial/invalid) config over the defaults, clamping each numeric field. Never throws. */
export function clampConfig<K extends JobKey>(key: K, cfg: Record<string, unknown>): JobConfigs[K] {
  const out: Record<string, number> = { ...(JOB_DEFAULTS[key] as Record<string, number>) };
  for (const field of Object.keys(out)) {
    const v = cfg[field];
    if (typeof v === 'number' && Number.isFinite(v)) out[field] = clampField(field, v);
  }
  return out as JobConfigs[K];
}

/** Validate + clamp a PATCH patch; throws UNKNOWN_FIELD on stray keys. */
export function mergeJobConfig<K extends JobKey>(key: K, patch: Record<string, unknown>): JobConfigs[K] {
  const allowed = Object.keys(JOB_DEFAULTS[key]);
  for (const k of Object.keys(patch)) if (!allowed.includes(k)) throw new Error(`UNKNOWN_FIELD:${k}`);
  return clampConfig(key, patch);
}

export async function getJobConfig<K extends JobKey>(prisma: PrismaClient, key: K): Promise<JobConfigs[K]> {
  try {
    const row = await prisma.scheduleJob.findUnique({ where: { key } });
    return clampConfig(key, (row?.config ?? {}) as Record<string, unknown>);
  } catch {
    return JOB_DEFAULTS[key];
  }
}

export async function isJobEnabled(prisma: PrismaClient, key: JobKey): Promise<boolean> {
  try {
    const row = await prisma.scheduleJob.findUnique({ where: { key }, select: { enabled: true } });
    return row?.enabled ?? true;
  } catch {
    return true;
  }
}

export async function recordJobRun(
  prisma: PrismaClient, key: JobKey, status: 'OK' | 'ERROR' | 'SKIPPED', note?: string,
): Promise<void> {
  try {
    await prisma.scheduleJob.update({
      where: { key },
      data: { lastRunAt: new Date(), lastRunStatus: status, lastRunNote: note?.slice(0, 300) ?? null },
    });
  } catch { /* best-effort */ }
}
