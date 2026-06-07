# Schedule Jobs Enhancement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.
>
> **Commits are HELD** this session (feature branch). Each task's "Commit" step is documentation of the boundary; stage the change but defer the actual `git commit` until the user approves a batch commit. Caveman mode is active (prose terse; code/commits normal).

**Goal:** Make the worker's schedule thresholds DB-backed and admin-editable, add an auto "lock betting at kickoff" job, and an admin module to manage (edit thresholds / enable-disable / view last-run / trigger) all six jobs.

**Architecture:** A `ScheduleJob` registry table (one row per job: `enabled` + `config` JSON + last-run status) is the single config source; `schedule.ts` constants become defaults/fallbacks. A `@wc/pipeline/job-config` layer reads/clamps config and records runs; the worker reads through it. A new `lock-betting` BullMQ delayed job + worker locks betting at kickoff−lead. A `job-control` queue + `ControlWorker` handles manual triggers. Admin web routes + an `AdmJobs` tab drive it.

**Tech Stack:** NestJS + BullMQ + Redis (worker), Prisma/Postgres, Next 15 route handlers (web), `@wc/realtime` SSE.

**Verification constraints (read before running anything):**
- Prisma: `wc_game` DB user lacks CREATE DATABASE → migrations are **hand-authored** SQL + `prisma migrate deploy` (NOT `migrate dev`). Prisma commands need `DATABASE_URL` exported from root `.env`.
- `@wc/db` exports a **guarded `PrismaClient`**: integration tests (`*.int.test.ts`) refuse to construct unless `DATABASE_URL === TEST_DATABASE_URL`. **Do NOT run `*.int.test.ts` against the dev DB** (it wipes tables). Use pure unit tests + the manual scripts described here.
- `@wc/*` packages build to `dist/` (commonjs); web/worker import `dist` → **rebuild the edited package** before web tsc / worker build / runtime.
- `publishEvent` is best-effort (try/catch, never throws).

---

## File Structure

| File | Responsibility |
|------|----------------|
| `packages/db/prisma/schema.prisma` | add `ScheduleJob` model |
| `packages/db/prisma/migrations/20260607120000_schedule_job/migration.sql` (new) | create table + seed 6 rows |
| `packages/pipeline/src/job-config.ts` (new) | `JobKey`/`JobConfigs`, `JOB_DEFAULTS`, `JOB_LABELS`, `clampConfig`, `getJobConfig`, `isJobEnabled`, `recordJobRun`, `mergeJobConfig` |
| `packages/pipeline/src/schedule.ts` | add `lockBettingDelayMs` (constants stay as defaults) |
| `packages/pipeline/src/index.ts` | export `./job-config` |
| `apps/worker/src/schedule/lock-betting.worker.ts` (new) | consume `lock-betting` queue → set `bettingLocked` + realtime |
| `apps/worker/src/schedule/control.worker.ts` (new) | consume `job-control` queue → dispatch manual triggers |
| `apps/worker/src/schedule/match-scheduler.service.ts` | config-driven scan: lock enqueue, remove/re-add, enabled gate, self-rescheduling timer; expose `scan()` |
| `apps/worker/src/livescore/livescore.worker.ts` | `runOnce()` + config interval + enabled + record |
| `apps/worker/src/news/news.worker.ts` | `runOnce()` + config interval + enabled + record |
| `apps/worker/src/schedule/lineup.worker.ts` | enabled gate + record |
| `apps/worker/src/schedule/result-check.worker.ts` | enabled gate + config `recheckMinutes`/`maxAttempts` + record |
| `apps/worker/src/app.module.ts` | register `LockBettingWorker`, `ControlWorker` |
| `apps/web/app/api/v1/admin/schedule-jobs/route.ts` (new) | GET list |
| `apps/web/app/api/v1/admin/schedule-jobs/[key]/route.ts` (new) | PATCH config/enabled |
| `apps/web/app/api/v1/admin/schedule-jobs/[key]/trigger/route.ts` (new) | POST trigger |
| `apps/web/components/screens-admin.tsx` | `AdmJobs` component + nav entry |

---

# PHASE S1 — Data model + config layer

### Task S1.1: `ScheduleJob` model + migration + seed

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20260607120000_schedule_job/migration.sql`

- [ ] **Step 1: Add the model** to `schema.prisma` (after the `Notification` model, or any top-level spot):

```prisma
model ScheduleJob {
  key           String    @id
  label         String
  enabled       Boolean   @default(true)
  config        Json
  lastRunAt     DateTime?
  lastRunStatus String?
  lastRunNote   String?
  updatedBy     BigInt?
  updatedAt     DateTime  @updatedAt
}
```

- [ ] **Step 2: Hand-author the migration** `migration.sql`:

```sql
CREATE TABLE "ScheduleJob" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "lastRunStatus" TEXT,
    "lastRunNote" TEXT,
    "updatedBy" BIGINT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScheduleJob_pkey" PRIMARY KEY ("key")
);

INSERT INTO "ScheduleJob" ("key","label","enabled","config","updatedAt") VALUES
    ('lock_betting',   'Lock betting',    true, '{"leadMinutes":0}',                                              now()),
    ('lineup',         'Lineup crawl',    true, '{"leadMinutes":15}',                                            now()),
    ('result_check',   'Result check',    true, '{"firstDelayMinutes":135,"recheckMinutes":30,"maxAttempts":8}', now()),
    ('livescore',      'Live score poll', true, '{"intervalSeconds":45}',                                        now()),
    ('scheduler_scan', 'Scheduler scan',  true, '{"rescanMinutes":60,"scanAheadHours":36,"scanBehindHours":6}',  now()),
    ('news',           'News publish',    true, '{"publishIntervalSeconds":60}',                                 now())
ON CONFLICT ("key") DO NOTHING;
```

- [ ] **Step 3: Apply migration + regenerate client**

```bash
cd /Users/taiphan/Documents/Projects/lab/wc-game
export DATABASE_URL="$(node -e "console.log(require('fs').readFileSync('.env','utf8').match(/^DATABASE_URL=(.*)$/m)[1].replace(/^[\"']|[\"']$/g,''))")"
pnpm --filter @wc/db exec prisma migrate deploy
pnpm --filter @wc/db exec prisma generate
```
Expected: "1 migration applied", "Generated Prisma Client".

- [ ] **Step 4: Verify the 6 rows exist** (read-only; uses raw `@prisma/client`, no VITEST → guard inert):

```bash
cd packages/db
node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.scheduleJob.findMany({select:{key:true,enabled:true,config:true}}).then(r=>{console.log(r.length,JSON.stringify(r));process.exit(0)})"
```
Expected: `6 [...]` with all six keys.

- [ ] **Step 5: Commit (held)** — `git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20260607120000_schedule_job/`

---

### Task S1.2: `lockBettingDelayMs` (pure, TDD)

**Files:**
- Modify: `packages/pipeline/src/schedule.ts`
- Test: `packages/pipeline/src/schedule.test.ts`

- [ ] **Step 1: Add failing test** to `schedule.test.ts`:

```ts
import { lockBettingDelayMs } from './schedule';

describe('lockBettingDelayMs', () => {
  const KO = new Date('2026-06-11T13:00:00Z');
  it('lead 0 → ms until kickoff', () => {
    expect(lockBettingDelayMs(KO, 0, KO.getTime() - 60_000)).toBe(60_000);
  });
  it('lead 5 → locks 5min before kickoff', () => {
    expect(lockBettingDelayMs(KO, 5, KO.getTime() - 10 * 60_000)).toBe(5 * 60_000);
  });
  it('past the lock moment → 0 (run now)', () => {
    expect(lockBettingDelayMs(KO, 0, KO.getTime() + 60_000)).toBe(0);
  });
});
```

- [ ] **Step 2: Run → fail.** `pnpm --filter @wc/pipeline exec vitest run schedule` → FAIL ("lockBettingDelayMs is not a function").

- [ ] **Step 3: Implement** — append to `schedule.ts`:

```ts
/** ms until betting should lock (kickoff − leadMinutes); 0 if already due/past. */
export function lockBettingDelayMs(kickoffAt: Date, leadMinutes: number, now: number): number {
  return Math.max(0, kickoffAt.getTime() - leadMinutes * 60_000 - now);
}
```

- [ ] **Step 4: Run → pass.** `pnpm --filter @wc/pipeline exec vitest run schedule` → all pass (incl. existing 8 + 3 new).

- [ ] **Step 5: Commit (held)** — `git add packages/pipeline/src/schedule.ts packages/pipeline/src/schedule.test.ts`

---

### Task S1.3: `job-config.ts` layer (TDD on pure parts)

**Files:**
- Create: `packages/pipeline/src/job-config.ts`
- Create: `packages/pipeline/src/job-config.test.ts`
- Modify: `packages/pipeline/src/index.ts`

- [ ] **Step 1: Failing test** `job-config.test.ts` (pure functions only — no DB):

```ts
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
```

- [ ] **Step 2: Run → fail.** `pnpm --filter @wc/pipeline exec vitest run job-config` → FAIL (module not found).

- [ ] **Step 3: Implement** `job-config.ts`:

```ts
import type { PrismaClient } from '@wc/db';
import { LINEUP_LEAD_MS, FIRST_RESULT_CHECK_MS, RESULT_RECHECK_MS, MAX_RESULT_ATTEMPTS } from './schedule';

export type JobKey = 'lock_betting' | 'lineup' | 'result_check' | 'livescore' | 'scheduler_scan' | 'news';

export interface JobConfigs {
  lock_betting: { leadMinutes: number };
  lineup: { leadMinutes: number };
  result_check: { firstDelayMinutes: number; recheckMinutes: number; maxAttempts: number };
  livescore: { intervalSeconds: number };
  scheduler_scan: { rescanMinutes: number; scanAheadHours: number; scanBehindHours: number };
  news: { publishIntervalSeconds: number };
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
};

export const JOB_LABELS: Record<JobKey, string> = {
  lock_betting: 'Lock betting', lineup: 'Lineup crawl', result_check: 'Result check',
  livescore: 'Live score poll', scheduler_scan: 'Scheduler scan', news: 'News publish',
};

export const JOB_KEYS = Object.keys(JOB_DEFAULTS) as JobKey[];

const BOUNDS: Record<string, [number, number]> = {
  leadMinutes: [0, 240], firstDelayMinutes: [0, 600], recheckMinutes: [1, 240], maxAttempts: [0, 50],
  intervalSeconds: [10, 3600], rescanMinutes: [1, 1440], scanAheadHours: [1, 168], scanBehindHours: [0, 72],
  publishIntervalSeconds: [10, 3600],
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
```

- [ ] **Step 4: Export** — add to `packages/pipeline/src/index.ts`: `export * from './job-config';`

- [ ] **Step 5: Run → pass + build.** `pnpm --filter @wc/pipeline exec vitest run job-config` (pass) then `pnpm --filter @wc/pipeline build` (clean).

- [ ] **Step 6: Commit (held)** — `git add packages/pipeline/src/job-config.ts packages/pipeline/src/job-config.test.ts packages/pipeline/src/index.ts`

**STOP — Phase S1 review.** Verify: migration applied + 6 rows; pipeline tests pass (schedule + job-config); pipeline builds.

---

# PHASE S2 — Worker integration

### Task S2.1: `LockBettingWorker` + scheduler enqueues lock job

**Files:**
- Create: `apps/worker/src/schedule/lock-betting.worker.ts`
- Modify: `apps/worker/src/schedule/match-scheduler.service.ts`
- Modify: `apps/worker/src/app.module.ts`

- [ ] **Step 1: Create `lock-betting.worker.ts`:**

```ts
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { prisma } from '@wc/db';
import { isJobEnabled, recordJobRun } from '@wc/pipeline';
import { publishEvent, channels } from '@wc/realtime';
import { connection } from '../redis';

interface LockJob { matchId: string }

/** LockBettingWorker — consumes "lock-betting" (scheduled at kickoff − leadMinutes). Hard-locks
 *  betting on a match. Idempotent: only acts on SCHEDULED, not-yet-locked matches. */
@Injectable()
export class LockBettingWorker implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(LockBettingWorker.name);
  private worker?: Worker;

  onModuleInit() {
    this.worker = new Worker<LockJob>(
      'lock-betting',
      async (job: Job<LockJob>) => {
        if (!(await isJobEnabled(prisma, 'lock_betting'))) {
          await recordJobRun(prisma, 'lock_betting', 'SKIPPED', 'disabled');
          return { skipped: true };
        }
        const id = BigInt(job.data.matchId);
        const match = await prisma.match.findUnique({ where: { id }, select: { status: true, bettingLocked: true } });
        if (match && match.status === 'SCHEDULED' && !match.bettingLocked) {
          await prisma.match.update({ where: { id }, data: { bettingLocked: true } });
          await publishEvent(channels.matches, { type: 'match.update', matchId: Number(id) });
          await recordJobRun(prisma, 'lock_betting', 'OK', `locked match ${id}`);
          this.log.log(`lock-betting: locked match ${id}`);
        } else {
          await recordJobRun(prisma, 'lock_betting', 'OK', `noop match ${id}`);
        }
        return { matchId: job.data.matchId };
      },
      { connection },
    );
    this.worker.on('failed', (job, err) => {
      this.log.error(`lock-betting job ${job?.id} failed: ${err.message}`);
      void recordJobRun(prisma, 'lock_betting', 'ERROR', err.message);
    });
    this.log.log('LockBettingWorker listening on queue "lock-betting".');
  }

  async onModuleDestroy() { await this.worker?.close(); }
}
```

- [ ] **Step 2: Rewrite `match-scheduler.service.ts`** to be config-driven (lock queue + remove/re-add + enabled gate + self-rescheduling + public `scan()`):

```ts
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { prisma } from '@wc/db';
import { lineupDelayMs, lockBettingDelayMs, getJobConfig, isJobEnabled, recordJobRun } from '@wc/pipeline';
import { connection } from '../redis';

@Injectable()
export class MatchSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(MatchSchedulerService.name);
  private readonly lineupQ = new Queue('lineup', { connection });
  private readonly resultQ = new Queue('result-check', { connection });
  private readonly lockQ = new Queue('lock-betting', { connection });
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;

  onModuleInit() {
    void this.loop();
    this.log.log('MatchScheduler: lineup + result-check + lock-betting jobs, config-driven rescan.');
  }

  private async loop() {
    if (this.stopped) return;
    await this.scan();
    const { rescanMinutes } = await getJobConfig(prisma, 'scheduler_scan');
    this.timer = setTimeout(() => void this.loop(), rescanMinutes * 60_000);
  }

  /** Public so ControlWorker can force a scan on manual trigger. */
  async scan() {
    const now = Date.now();
    try {
      const scan = await getJobConfig(prisma, 'scheduler_scan');
      const [lineupOn, resultOn, lockOn] = await Promise.all([
        isJobEnabled(prisma, 'lineup'), isJobEnabled(prisma, 'result_check'), isJobEnabled(prisma, 'lock_betting'),
      ]);
      const lineupCfg = await getJobConfig(prisma, 'lineup');
      const lockCfg = await getJobConfig(prisma, 'lock_betting');

      const matches = await prisma.match.findMany({
        where: {
          status: { in: ['SCHEDULED', 'LIVE'] },
          kickoffAt: {
            gte: new Date(now - scan.scanBehindHours * 3_600_000),
            lte: new Date(now + scan.scanAheadHours * 3_600_000),
          },
        },
        select: { id: true, kickoffAt: true },
      });

      for (const m of matches) {
        const id = m.id.toString();
        // remove + re-add so threshold edits propagate; skip (and clear) disabled jobs.
        await this.reschedule(this.lineupQ, `lineup:${id}`, lineupOn, 'lineup',
          { matchId: id }, lineupDelayMs(m.kickoffAt, now - (lineupCfg.leadMinutes * 60_000 - 15 * 60_000)));
        await this.reschedule(this.lockQ, `lock:${id}`, lockOn, 'lock',
          { matchId: id }, lockBettingDelayMs(m.kickoffAt, lockCfg.leadMinutes, now));
        // result-check first attempt: only ADD if absent (its recheck chain manages itself); remove if disabled.
        if (resultOn) {
          await this.resultQ.add('check', { matchId: id, attempt: 0 },
            { delay: Math.max(0, m.kickoffAt.getTime() + (await getJobConfig(prisma, 'result_check')).firstDelayMinutes * 60_000 - now), jobId: `result:${id}:0` });
        } else {
          await this.resultQ.remove(`result:${id}:0`).catch(() => {});
        }
      }
      await recordJobRun(prisma, 'scheduler_scan', 'OK', `ensured ${matches.length} match(es)`);
      if (matches.length) this.log.log(`MatchScheduler: ensured jobs for ${matches.length} match(es).`);
    } catch (err) {
      await recordJobRun(prisma, 'scheduler_scan', 'ERROR', (err as Error).message);
      this.log.warn(`MatchScheduler scan failed: ${(err as Error).message}`);
    }
  }

  private async reschedule(q: Queue, jobId: string, enabled: boolean, name: string, data: object, delay: number) {
    await q.remove(jobId).catch(() => {}); // safe for delayed (not active) jobs
    if (enabled) await q.add(name, data, { delay, jobId });
  }

  async onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await Promise.all([this.lineupQ.close(), this.resultQ.close(), this.lockQ.close()]);
  }
}
```

  > Note: `lineupDelayMs(kickoffAt, now)` is fixed at T−15 in `schedule.ts`. To honor the editable `lineup.leadMinutes` without changing that signature, the call computes an adjusted `now` so the effective lead = `lineupCfg.leadMinutes`. Equivalent simpler form the implementer MAY use instead: `delay = Math.max(0, m.kickoffAt.getTime() - lineupCfg.leadMinutes*60_000 - now)`. Prefer the simpler inline form; drop the `lineupDelayMs` import if so.

- [ ] **Step 2b (preferred simpler lineup delay):** replace the lineup `reschedule` call with the explicit form and remove the `lineupDelayMs` import:

```ts
await this.reschedule(this.lineupQ, `lineup:${id}`, lineupOn, 'lineup', { matchId: id },
  Math.max(0, m.kickoffAt.getTime() - lineupCfg.leadMinutes * 60_000 - now));
```

- [ ] **Step 3: Register workers** in `app.module.ts`:

```ts
import { LockBettingWorker } from './schedule/lock-betting.worker';
import { ControlWorker } from './schedule/control.worker';
// ...
  providers: [
    LlmGateway, SettlementWorker, NewsWorker, LiveScoreWorker,
    MatchSchedulerService, LineupWorker, ResultCheckWorker,
    LockBettingWorker, ControlWorker,
  ],
```
(`ControlWorker` is created in Task S2.4 — register both now; build happens after S2.4.)

- [ ] **Step 4: Commit (held)** — stage the three files.

---

### Task S2.2: `LiveScoreWorker` + `NewsWorker` → `runOnce()` + config + enabled + record

**Files:**
- Modify: `apps/worker/src/livescore/livescore.worker.ts`
- Modify: `apps/worker/src/news/news.worker.ts`

- [ ] **Step 1: Rewrite `livescore.worker.ts`:**

```ts
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { prisma } from '@wc/db';
import { updateLiveScores, getJobConfig, isJobEnabled, recordJobRun } from '@wc/pipeline';

@Injectable()
export class LiveScoreWorker implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(LiveScoreWorker.name);
  private timer?: ReturnType<typeof setTimeout>;
  private running = false;
  private stopped = false;

  onModuleInit() {
    void this.loop();
    this.log.log('LiveScoreWorker polling worldcup26 (config-driven cadence).');
  }

  /** One poll pass; also the manual-trigger entry point. Returns a short status note. */
  async runOnce(): Promise<string> {
    if (this.running) return 'busy';
    this.running = true;
    try {
      if (!(await isJobEnabled(prisma, 'livescore'))) { await recordJobRun(prisma, 'livescore', 'SKIPPED', 'disabled'); return 'disabled'; }
      const { updated, newlyFinished } = await updateLiveScores(prisma);
      const note = `updated ${updated}, finished [${newlyFinished.join(',')}]`;
      if (updated > 0) this.log.log(`live scores: ${note}`);
      await recordJobRun(prisma, 'livescore', 'OK', note);
      return note;
    } catch (err) {
      await recordJobRun(prisma, 'livescore', 'ERROR', (err as Error).message);
      this.log.warn(`live-score poll failed: ${(err as Error).message}`);
      return 'error';
    } finally {
      this.running = false;
    }
  }

  private async loop() {
    if (this.stopped) return;
    await this.runOnce();
    const { intervalSeconds } = await getJobConfig(prisma, 'livescore');
    this.timer = setTimeout(() => void this.loop(), intervalSeconds * 1000);
  }

  onModuleDestroy() { this.stopped = true; if (this.timer) clearTimeout(this.timer); }
}
```

- [ ] **Step 2: Edit `news.worker.ts`** — keep the BullMQ generate consumer; replace the `publishTick` interval with a `runOnce()` + self-rescheduling loop. Replace the `onModuleInit` publish-tick block and add methods:

Replace:
```ts
    // Repeatable publish tick — auto-publish scheduled articles.
    this.publishTick = setInterval(async () => {
      try {
        const n = await publishDueNews(prisma);
        if (n > 0) this.log.log(`auto-published ${n} scheduled news article(s)`);
      } catch (err) {
        this.log.error(`publishDueNews error: ${(err as Error).message}`);
      }
    }, 60_000);
```
with:
```ts
    void this.loop();
```
Add imports `getJobConfig, isJobEnabled, recordJobRun` to the `@wc/pipeline` import line. Change the field `private publishTick?: ...` to `private timer?: ReturnType<typeof setTimeout>; private stopped = false;`. Add methods:
```ts
  /** Publish due articles; also the manual-trigger entry point. */
  async runOnce(): Promise<string> {
    try {
      if (!(await isJobEnabled(prisma, 'news'))) { await recordJobRun(prisma, 'news', 'SKIPPED', 'disabled'); return 'disabled'; }
      const n = await publishDueNews(prisma);
      if (n > 0) this.log.log(`auto-published ${n} scheduled news article(s)`);
      await recordJobRun(prisma, 'news', 'OK', `published ${n}`);
      return `published ${n}`;
    } catch (err) {
      await recordJobRun(prisma, 'news', 'ERROR', (err as Error).message);
      this.log.error(`publishDueNews error: ${(err as Error).message}`);
      return 'error';
    }
  }

  private async loop() {
    if (this.stopped) return;
    await this.runOnce();
    const { publishIntervalSeconds } = await getJobConfig(prisma, 'news');
    this.timer = setTimeout(() => void this.loop(), publishIntervalSeconds * 1000);
  }
```
Update `onModuleDestroy` to `this.stopped = true; if (this.timer) clearTimeout(this.timer); await this.worker?.close();`.

- [ ] **Step 3: Commit (held)** — stage both files.

---

### Task S2.3: `LineupWorker` + `ResultCheckWorker` → enabled gate + config + record

**Files:**
- Modify: `apps/worker/src/schedule/lineup.worker.ts`
- Modify: `apps/worker/src/schedule/result-check.worker.ts`

- [ ] **Step 1: `lineup.worker.ts`** — add imports `isJobEnabled, recordJobRun` from `@wc/pipeline`; in the handler, before work:
```ts
        if (!(await isJobEnabled(prisma, 'lineup'))) { await recordJobRun(prisma, 'lineup', 'SKIPPED', 'disabled'); return { skipped: true }; }
```
and after `refreshMatchLineups`: `await recordJobRun(prisma, 'lineup', 'OK', \`match ${matchId}\`);`. In the `failed` handler add `void recordJobRun(prisma, 'lineup', 'ERROR', err.message);`.

- [ ] **Step 2: `result-check.worker.ts`** — replace the `RESULT_RECHECK_MS` import with `getJobConfig, isJobEnabled, recordJobRun` (drop `RESULT_RECHECK_MS`; keep `decideResultCheck`). In the handler, first line:
```ts
        if (!(await isJobEnabled(prisma, 'result_check'))) { await recordJobRun(prisma, 'result_check', 'SKIPPED', 'disabled'); return { action: 'stop' as const, reason: 'disabled' }; }
        const cfg = await getJobConfig(prisma, 'result_check');
```
Pass `cfg.maxAttempts` into `decideResultCheck` — change `decideResultCheck(match, attempt)` to honor config. Edit `decideResultCheck` signature in `schedule.ts` to accept an optional cap:
```ts
export function decideResultCheck(
  match: { status: string; scoreHome90: number | null; scoreAway90: number | null },
  attempt: number,
  maxAttempts: number = MAX_RESULT_ATTEMPTS,
): ResultAction {
  if (match.status === 'FINISHED' && match.scoreHome90 != null && match.scoreAway90 != null) return 'settle';
  if (attempt >= maxAttempts) return 'stop';
  return 'recheck';
}
```
Then call `decideResultCheck(match, attempt, cfg.maxAttempts)`. Replace the recheck delay `RESULT_RECHECK_MS` with `cfg.recheckMinutes * 60_000`. Add `recordJobRun(prisma, 'result_check', 'OK', \`${action} match ${matchId}\`)` after deciding, and `ERROR` in the `failed` handler.

- [ ] **Step 3:** the `decideResultCheck` default-arg change is backward-compatible; existing `schedule.test.ts` calls still pass. Run `pnpm --filter @wc/pipeline exec vitest run schedule` → pass. Rebuild pipeline: `pnpm --filter @wc/pipeline build`.

- [ ] **Step 4: Commit (held)** — stage both worker files + `schedule.ts`.

---

### Task S2.4: `ControlWorker` (manual trigger)

**Files:**
- Create: `apps/worker/src/schedule/control.worker.ts`

- [ ] **Step 1: Create `control.worker.ts`:**

```ts
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { prisma } from '@wc/db';
import { recordJobRun, type JobKey } from '@wc/pipeline';
import { connection } from '../redis';
import { MatchSchedulerService } from './match-scheduler.service';
import { LiveScoreWorker } from '../livescore/livescore.worker';
import { NewsWorker } from '../news/news.worker';

interface ControlJob { key: JobKey }

/** ControlWorker — consumes "job-control" (admin "Run now"). Dispatches a one-off run of the
 *  global jobs; per-match jobs (lineup/result_check/lock_betting) force a scheduler scan. */
@Injectable()
export class ControlWorker implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ControlWorker.name);
  private worker?: Worker;

  constructor(
    private readonly scheduler: MatchSchedulerService,
    private readonly liveScore: LiveScoreWorker,
    private readonly news: NewsWorker,
  ) {}

  onModuleInit() {
    this.worker = new Worker<ControlJob>(
      'job-control',
      async (job: Job<ControlJob>) => {
        const key = job.data.key;
        this.log.log(`manual trigger: ${key}`);
        switch (key) {
          case 'livescore': return { note: await this.liveScore.runOnce() };
          case 'news': return { note: await this.news.runOnce() };
          case 'scheduler_scan':
          case 'lineup':
          case 'result_check':
          case 'lock_betting':
            await this.scheduler.scan();
            return { note: 'scan triggered' };
          default:
            return { note: 'unknown key' };
        }
      },
      { connection },
    );
    this.worker.on('failed', (job, err) => {
      this.log.error(`job-control ${job?.data?.key} failed: ${err.message}`);
      if (job?.data?.key) void recordJobRun(prisma, job.data.key, 'ERROR', err.message);
    });
    this.log.log('ControlWorker listening on queue "job-control".');
  }

  async onModuleDestroy() { await this.worker?.close(); }
}
```

- [ ] **Step 2: Build the worker.** `pnpm --filter @wc/worker build` → clean (nest build; resolves the new providers + cross-injection).

- [ ] **Step 3: Verify lock-betting end-to-end** (manual, isolated — NOT an int test). Script in `packages/pipeline/` (run with `DATABASE_URL` + `REDIS_URL` exported; uses `@wc/db` singleton, no VITEST):

```js
// rt_lock_test.mjs — create throwaway match kicking off in 2s, enqueue lock job, verify bettingLocked flips.
import { Queue, Worker } from 'bullmq';
const { prisma } = await import('@wc/db');
// (Simpler: directly test the worker logic) set up match 999998 SCHEDULED, kickoff now+2s, bettingLocked=false
await prisma.match.upsert({ where: { id: 999998n }, update: { status: 'SCHEDULED', bettingLocked: false },
  create: { id: 999998n, round: 'GROUP', homeTeamId: 1n, awayTeamId: 2n, kickoffAt: new Date(Date.now()+2000), status: 'SCHEDULED', source: 'API' } });
// simulate the worker body:
await prisma.match.update({ where: { id: 999998n }, data: { bettingLocked: true } });
const m = await prisma.match.findUnique({ where: { id: 999998n }, select: { bettingLocked: true } });
console.log('bettingLocked:', m.bettingLocked, '(expect true)');
await prisma.match.delete({ where: { id: 999998n } });
await prisma.$disconnect(); process.exit(0);
```
(This validates the DB write path; the BullMQ wiring is covered by the worker build + manual smoke once the worker runs.) Delete the script after.

- [ ] **Step 4: Commit (held)** — stage `control.worker.ts`.

**STOP — Phase S2 review.** Verify: worker builds clean; lock write path works; pipeline tests green.

---

# PHASE S3 — Admin API + UI

### Task S3.1: GET list route

**Files:**
- Create: `apps/web/app/api/v1/admin/schedule-jobs/route.ts`

- [ ] **Step 1: Implement:**

```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';

// GET /api/v1/admin/schedule-jobs — list all schedule-job registry rows.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const rows = await prisma.scheduleJob.findMany({ orderBy: { key: 'asc' } });
  return NextResponse.json({
    data: rows.map((r) => ({
      key: r.key, label: r.label, enabled: r.enabled, config: r.config,
      lastRunAt: r.lastRunAt, lastRunStatus: r.lastRunStatus, lastRunNote: r.lastRunNote, updatedAt: r.updatedAt,
    })),
  });
}
```

- [ ] **Step 2: Verify 401/200** — dev server running; `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/admin/schedule-jobs` → 403 (unauth). Authed (admin cookie) → 200 with 6 rows.

- [ ] **Step 3: Commit (held).**

---

### Task S3.2: PATCH + trigger routes

**Files:**
- Create: `apps/web/app/api/v1/admin/schedule-jobs/[key]/route.ts`
- Create: `apps/web/app/api/v1/admin/schedule-jobs/[key]/trigger/route.ts`

- [ ] **Step 1: PATCH route:**

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { mergeJobConfig, JOB_KEYS, type JobKey } from '@wc/pipeline';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';
import type { Prisma } from '@wc/db';

export const dynamic = 'force-dynamic';

const Schema = z.object({ enabled: z.boolean().optional(), config: z.record(z.unknown()).optional() });

export async function PATCH(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const { key } = await params;
  if (!JOB_KEYS.includes(key as JobKey)) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } }, { status: 422 });

  const data: { enabled?: boolean; config?: Prisma.InputJsonValue; updatedBy: bigint } = { updatedBy: admin.id };
  if (parsed.data.enabled !== undefined) data.enabled = parsed.data.enabled;
  if (parsed.data.config !== undefined) {
    try { data.config = mergeJobConfig(key as JobKey, parsed.data.config) as unknown as Prisma.InputJsonValue; }
    catch (e) { return NextResponse.json({ error: { code: 'BAD_CONFIG', message: (e as Error).message } }, { status: 422 }); }
  }
  const row = await prisma.scheduleJob.update({ where: { key }, data });
  await prisma.auditLog.create({ data: { actorType: 'ADMIN', actorId: admin.id, action: 'EDIT_SCHEDULE_JOB', target: `job:${key}`, metadata: { enabled: data.enabled, config: data.config as object } } });
  return NextResponse.json({ data: { key: row.key, enabled: row.enabled, config: row.config } });
}
```

- [ ] **Step 2: trigger route:**

```ts
import { NextResponse } from 'next/server';
import { Queue } from 'bullmq';
import { JOB_KEYS, type JobKey } from '@wc/pipeline';
import { requireAdmin } from '@/lib/session';
import { prisma } from '@/lib/db';
import { connection } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const { key } = await params;
  if (!JOB_KEYS.includes(key as JobKey)) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
  const q = new Queue('job-control', { connection });
  try { await q.add('trigger', { key }); } finally { await q.close(); }
  await prisma.auditLog.create({ data: { actorType: 'ADMIN', actorId: admin.id, action: 'TRIGGER_SCHEDULE_JOB', target: `job:${key}` } });
  return NextResponse.json({ data: { triggered: key } });
}
```

  > **Check first:** does `@/lib/redis` exist in the web app exporting a BullMQ `connection`? Run `cat apps/web/lib/redis.ts 2>/dev/null`. If absent, create it mirroring `apps/worker/src/redis.ts` (parse `process.env.REDIS_URL` into the `connection` options object) so the web route can enqueue.

- [ ] **Step 3: Verify** — `curl` PATCH with bad field → 422; unknown key → 404; unauth → 403. Rebuild not needed (web reads `@wc/pipeline` dist already built in S1). Run `pnpm --filter @wc/web exec tsc --noEmit` → clean.

- [ ] **Step 4: Commit (held).**

---

### Task S3.3: `AdmJobs` admin tab

**Files:**
- Modify: `apps/web/components/screens-admin.tsx`

- [ ] **Step 1: Add nav entry** to the `nav` array (after `['pipeline', ...]`):
```ts
    ['jobs', 'Schedule jobs', 'clock'],
```
(If `clock` icon is missing in the `Icon` set, use `'database'` or `'gauge'`.)

- [ ] **Step 2: Add render line** in the tab block (after the `pipeline` line):
```tsx
          {!detail && tab === 'jobs' && <AdmJobs s={s} />}
```

- [ ] **Step 3: Add the `AdmJobs` component** (near `AdmPipeline`):

```tsx
interface SchedJob { key: string; label: string; enabled: boolean; config: Record<string, number>; lastRunAt: string | null; lastRunStatus: string | null; lastRunNote: string | null }

function AdmJobs({ s }: { s: ScreenProps['s'] }) {
  const [jobs, setJobs] = useState<SchedJob[]>([]);
  const [draft, setDraft] = useState<Record<string, Record<string, number>>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch('/api/v1/admin/schedule-jobs').then(r => (r.ok ? r.json() : null))
      .then(j => { if (j?.data) { setJobs(j.data); setDraft(Object.fromEntries(j.data.map((x: SchedJob) => [x.key, { ...x.config }]))); } })
      .catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (key: string, body: object) => {
    setBusy(key);
    try {
      const res = await fetch(`/api/v1/admin/schedule-jobs/${key}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      setBusy(null);
      if (res.ok) { s.toastMsg('Job updated', 'check', 'var(--green)'); load(); }
      else { const j = await res.json().catch(() => ({})); s.toastMsg(j?.error?.message || 'Update failed', 'alert', 'var(--danger)'); }
    } catch { setBusy(null); s.toastMsg('Network error', 'alert', 'var(--danger)'); }
  };
  const trigger = async (key: string) => {
    setBusy(key);
    try {
      const res = await fetch(`/api/v1/admin/schedule-jobs/${key}/trigger`, { method: 'POST' });
      setBusy(null);
      s.toastMsg(res.ok ? 'Triggered' : 'Trigger failed', res.ok ? 'refresh' : 'alert', res.ok ? 'var(--green)' : 'var(--danger)');
    } catch { setBusy(null); s.toastMsg('Network error', 'alert', 'var(--danger)'); }
  };

  return (
    <div>
      <SecHead title="Schedule jobs" sub="Worker job thresholds, enable/disable, last run & manual trigger" />
      <div className="stack gap-12">
        {jobs.map(j => {
          const d = draft[j.key] ?? j.config;
          const badge = j.lastRunStatus === 'OK' ? 'var(--green)' : j.lastRunStatus === 'ERROR' ? 'var(--danger)' : 'var(--gold)';
          return (
            <div key={j.key} className="card card-pad">
              <div className="row between">
                <div className="row gap-8"><span className="h4">{j.label}</span><span className="tiny muted">{j.key}</span></div>
                <label className="row gap-6 tiny"><input type="checkbox" checked={j.enabled} onChange={e => save(j.key, { enabled: e.target.checked })} /> Enabled</label>
              </div>
              <div className="row gap-12 wrap-w mt-12">
                {Object.keys(j.config).map(f => (
                  <div key={f} className="field" style={{ minWidth: 150 }}>
                    <label className="label tiny">{f}</label>
                    <input className="input input-mono" type="number" value={d[f]}
                      onChange={e => setDraft(p => ({ ...p, [j.key]: { ...d, [f]: +e.target.value } }))} />
                  </div>
                ))}
              </div>
              <div className="row between mt-12">
                <span className="tiny muted">{j.lastRunAt ? <><JobDot st={j.lastRunStatus === 'OK' ? 'ok' : j.lastRunStatus === 'ERROR' ? 'err' : 'fallback'} /> {new Date(j.lastRunAt).toLocaleString()} · {j.lastRunNote ?? ''}</> : 'never run'}</span>
                <div className="row gap-8">
                  <Btn variant="ghost" size="sm" icon="refresh" disabled={busy === j.key} onClick={() => trigger(j.key)}>Run now</Btn>
                  <Btn variant="primary" size="sm" disabled={busy === j.key} onClick={() => save(j.key, { config: d })}>Save</Btn>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```
(`JobDot` already exists at the top of `screens-admin.tsx`. `Btn`, `SecHead`, `Icon` are imported. Confirm `s.toastMsg(msg, icon, color)` signature matches existing calls — it does in `AdmTourney`.)

- [ ] **Step 4: Verify** — `pnpm --filter @wc/web exec tsc --noEmit` → clean; `pnpm --filter @wc/web test` → 113 pass (no regression). Restart dev server (picks up `@wc/pipeline` dist), open Admin → Schedule jobs: 6 rows render, edit a threshold + Save → toast + persists; toggle Enabled; Run now → toast.

- [ ] **Step 5: Commit (held).**

**STOP — Phase S3 complete (feature done).** Final verification: worker build clean; web tsc + 113 tests; manual admin round-trip (edit/enable/trigger) + confirm `bettingLocked` flips for a near-kickoff match after the worker runs.

---

## Self-review notes (addressed)

- **Spec coverage:** `ScheduleJob` table (S1.1) ✓; config layer getJobConfig/isJobEnabled/recordJobRun/mergeJobConfig + clamps (S1.3) ✓; `lockBettingDelayMs` (S1.2) ✓; lock-betting queue+worker + scheduler enqueue (S2.1) ✓; config-driven scan + remove/re-add + enabled gate + self-rescheduling (S2.1) ✓; livescore/news runOnce+config+enabled+record (S2.2) ✓; lineup/result-check enabled+config+record (S2.3) ✓; control queue+worker manual trigger (S2.4) ✓; GET/PATCH/trigger routes (S3.1–S3.2) ✓; AdmJobs tab edit/enable/status/trigger (S3.3) ✓.
- **Type consistency:** `JobKey`/`JobConfigs`/`JOB_DEFAULTS`/`JOB_KEYS` defined in S1.3 and used by worker (S2) + routes (S3). `recordJobRun(prisma,key,status,note)` and `getJobConfig(prisma,key)` signatures consistent across all callers. `mergeJobConfig` throws `UNKNOWN_FIELD:` consumed by PATCH 422.
- **Known checks the implementer must make:** (a) `@/lib/redis` exists in web (else create from worker's `redis.ts`) — S3.2 note; (b) `clock` icon exists in the `Icon` set (else fallback) — S3.3 note; (c) `Prisma.InputJsonValue` cast for the `config` Json field (S1.3 used in notify pattern earlier).
- **No int-test execution against dev DB** — all tests here are pure unit (`schedule.test.ts`, `job-config.test.ts`) + manual scripts; honors the `@wc/db` guard.
