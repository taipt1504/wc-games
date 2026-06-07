# Schedule Jobs Enhancement — Design

**Date:** 2026-06-07
**Status:** Approved (brainstorming) → ready for implementation plan

## Goal

Two related capabilities:

1. **Auto-lock betting at kickoff** — a scheduled job that sets `Match.bettingLocked = true` at (kickoff − configurable lead), so betting hard-closes on time without manual admin action.
2. **Admin schedule-jobs module** — a first-class registry of the worker's scheduled jobs that an admin can: edit thresholds/config, enable/disable, see last-run status, and trigger on demand.

Both are served by making the worker's currently-hardcoded thresholds **DB-backed and admin-editable**, with each job modeled as a registry row.

## Background — current state

- Worker: NestJS app (`apps/worker`) on BullMQ + Redis.
- `MatchSchedulerService` (on startup + hourly rescan) enqueues per-match **delayed** BullMQ jobs: `lineup` (kickoff−15m) and `result-check` (kickoff+135m, +30m rechecks, max 8). Deterministic jobIds → idempotent.
- `LiveScoreWorker` — 45s interval poller (no queue) → `updateLiveScores`.
- `NewsWorker` — generates on init + `publishDueNews` every 60s.
- Thresholds are **hardcoded constants** in `packages/pipeline/src/schedule.ts` and `match-scheduler.service.ts`. **No config/settings table exists.**
- `placeBet` already *soft*-rejects bets once `kickoffAt <= now`; the new job adds the persistent `bettingLocked` flag (hard lock, "Betting closed" in UI, fires realtime `match.update`).

## Decisions (locked during brainstorming)

- **Architecture:** Approach A — typed `ScheduleJob` registry table (not a flat key-value `Setting` table).
- **Jobs managed:** all six — `lock_betting` (new), `lineup`, `result_check`, `livescore`, `scheduler_scan`, `news`.
- **Lock timing:** configurable `leadMinutes`, default `0` (= exactly at kickoff).
- **Threshold propagation:** by next rescan (rescan interval itself editable). Enable/disable + manual-trigger take effect immediately.
- **Admin module:** edit thresholds + enable/disable + view last-run status + manual trigger.

## 1. Data model — `ScheduleJob`

```prisma
model ScheduleJob {
  key           String    @id        // see job keys below
  label         String
  enabled       Boolean   @default(true)
  config        Json                 // per-job threshold shape (below)
  lastRunAt     DateTime?
  lastRunStatus String?              // OK | ERROR | SKIPPED
  lastRunNote   String?              // short summary or error message
  updatedBy     BigInt?              // admin userId who last edited
  updatedAt     DateTime  @updatedAt
}
```

Seeded (migration + seed) with today's constants:

| key              | label              | default config |
|------------------|--------------------|----------------|
| `lock_betting`   | Lock betting       | `{ "leadMinutes": 0 }` |
| `lineup`         | Lineup crawl       | `{ "leadMinutes": 15 }` |
| `result_check`   | Result check       | `{ "firstDelayMinutes": 135, "recheckMinutes": 30, "maxAttempts": 8 }` |
| `livescore`      | Live score poll    | `{ "intervalSeconds": 45 }` |
| `scheduler_scan` | Scheduler scan     | `{ "rescanMinutes": 60, "scanAheadHours": 36, "scanBehindHours": 6 }` |
| `news`           | News publish       | `{ "publishIntervalSeconds": 60 }` |

## 2. Config layer (`@wc/pipeline`)

A small, pure-ish module that all worker code reads through. The `schedule.ts` constants remain as the **defaults**.

- `JOB_DEFAULTS: Record<JobKey, JobConfig>` — the table above, sourced from the existing constants.
- `CONFIG_BOUNDS` — min/max per numeric field (clamp ranges), e.g. `intervalSeconds ∈ [10, 3600]`, `leadMinutes ∈ [0, 240]`, `maxAttempts ∈ [0, 50]`, `rescanMinutes ∈ [1, 1440]`, `scanAheadHours ∈ [1, 168]`, `scanBehindHours ∈ [0, 72]`, `firstDelayMinutes ∈ [0, 600]`, `recheckMinutes ∈ [1, 240]`, `publishIntervalSeconds ∈ [10, 3600]`.
- `getJobConfig(prisma, key)` → reads the row, merges `config` over `JOB_DEFAULTS[key]`, clamps each field to `CONFIG_BOUNDS`. On any error (missing row, bad JSON) → returns `JOB_DEFAULTS[key]`. **Never throws.**
- `isJobEnabled(prisma, key)` → row `enabled` (default `true` if missing). Never throws.
- `recordJobRun(prisma, key, status, note?)` → updates `lastRunAt = now`, `lastRunStatus`, `lastRunNote` (truncated). Best-effort (swallow errors).
- `mergeJobConfig(key, patch)` (pure) → validate + clamp a partial config patch for the PATCH endpoint; reject unknown keys.

## 3. Worker changes

### 3.1 New `lock_betting` job
- New `lock-betting` BullMQ queue + `LockBettingWorker` (`apps/worker/src/schedule/lock-betting.worker.ts`).
- `MatchSchedulerService` enqueues per match: `lockQ.add('lock', { matchId }, { delay: lockBettingDelayMs(kickoff, leadMinutes, now), jobId: 'lock:{id}' })`.
- `lockBettingDelayMs(kickoffAt, leadMinutes, now)` (pure, in `schedule.ts`) = `max(0, kickoffAt − leadMinutes*60000 − now)`.
- Worker handler: skip if `!isJobEnabled('lock_betting')` (→ SKIPPED). Else load match; if status `SCHEDULED` and `!bettingLocked` → set `bettingLocked = true`, `publishEvent(channels.matches, { type:'match.update', matchId })`. Idempotent (no-op if already locked/started). `recordJobRun`.

### 3.2 `MatchSchedulerService.scan()`
- Read `getJobConfig('scheduler_scan')` for `scanAheadHours`/`scanBehindHours` window and `rescanMinutes`.
- Replace the fixed `setInterval` with a **self-rescheduling `setTimeout`** that re-reads `rescanMinutes` each pass (so rescan cadence is editable).
- For each match in window, per job in `{lineup, result_check, lock_betting}`:
  - If that job's registry row is **enabled**: `queue.remove(jobId)` then re-`add` with the **current-config** delay (propagates threshold edits to already-queued matches).
  - If **disabled**: `queue.remove(jobId)` and do not re-add.
- `recordJobRun('scheduler_scan', 'OK', '{n} matches')`.
- Removing a *delayed* (not active) job then re-adding is safe; jobs about to fire within the rescan window are acceptable to leave.

### 3.3 Pollers — `LiveScoreWorker`, `NewsWorker`
- Refactor the poll body into a public `runOnce()` returning a short status note.
- The interval becomes a self-rescheduling `setTimeout` reading `intervalSeconds`/`publishIntervalSeconds` from config each pass.
- Each pass: if `!enabled` → record `SKIPPED`, skip work; else run + `recordJobRun(OK|ERROR, note)`.
- `runOnce()` is also the entry point for manual trigger (§4).

### 3.4 `LineupWorker` / `ResultCheckWorker`
- At the top of each handler: if `!isJobEnabled(key)` → record `SKIPPED`, return without work.
- `ResultCheckWorker` reads `recheckMinutes`/`maxAttempts` from `getJobConfig('result_check')` (replaces the `RESULT_RECHECK_MS`/`MAX_RESULT_ATTEMPTS` constants at the call site; constants stay as defaults).
- Both call `recordJobRun` with OK/ERROR + a short note.

## 4. Manual trigger

- New `job-control` BullMQ queue + `ControlWorker` (`apps/worker/src/schedule/control.worker.ts`), injected with `MatchSchedulerService`, `LiveScoreWorker`, `NewsWorker`.
- Admin "Run now" → `POST .../trigger` adds `{ key }` to `job-control`.
- `ControlWorker` dispatch:
  - `livescore` → `liveScore.runOnce()`
  - `news` → `news.runOnce()`
  - `scheduler_scan` → `scheduler.scan()`
  - `lineup` / `result_check` / `lock_betting` (per-match jobs) → `scheduler.scan()` (forces due jobs to enqueue). Per-match one-offs already exist via the `sync-lineup` / `sync-result` admin routes.
- Records the run via `recordJobRun`.

## 5. Admin API + UI

### API (web, admin-guarded)
- `GET /api/v1/admin/schedule-jobs` → `{ data: ScheduleJob[] }` (key, label, enabled, config, lastRunAt, lastRunStatus, lastRunNote, updatedAt).
- `PATCH /api/v1/admin/schedule-jobs/[key]` → body `{ enabled?: boolean, config?: object }`. Validate+clamp via `mergeJobConfig`; unknown key → 404; bad config → 422. Write `updatedBy`. Audit `EDIT_SCHEDULE_JOB`.
- `POST /api/v1/admin/schedule-jobs/[key]/trigger` → enqueue `job-control`. Audit `TRIGGER_SCHEDULE_JOB`. (404 for unknown key.)

### UI
- New admin tab `['jobs', 'Schedule jobs', 'clock']` in `screens-admin.tsx` `nav`, rendered by a new `AdmJobs` component.
- Table: one row per job — label · enabled toggle · editable numeric inputs per config field · last-run (relative time + status badge OK/ERROR/SKIPPED) · "Run now" button.
- Edit → "Save" per row → `PATCH`; toast result + reload. "Run now" → `POST trigger` → toast.

## 6. Error handling & testing

- **Resilience:** every config read falls back to constants and never throws; `recordJobRun` is best-effort; a disabled/misconfigured job degrades to default behavior, never crashes the worker.
- **Idempotency:** `lock_betting` only locks `SCHEDULED`, not-yet-locked matches.
- **Validation:** PATCH validates field names + clamps ranges; the config layer clamps again as defense in depth.
- **Tests (pure unit, runnable without the worker/Redis):**
  - `lockBettingDelayMs` boundaries (lead 0, lead>0, past kickoff → 0).
  - `getJobConfig` merge + clamp (missing row → defaults; out-of-range → clamped; bad JSON → defaults).
  - `mergeJobConfig` rejects unknown fields, clamps values.
  - existing `decideResultCheck` still honored with config-sourced `maxAttempts`.
- **Admin API tests:** auth (401/403), unknown key (404), invalid config (422), happy-path PATCH/trigger.
- **Worker wiring** (BullMQ/Nest lifecycle) verified manually + by build, consistent with prior phases.

## File map

- `packages/db/prisma/schema.prisma` — `ScheduleJob` model (+ migration + seed rows).
- `packages/pipeline/src/job-config.ts` (new) — defaults, bounds, `getJobConfig`/`isJobEnabled`/`recordJobRun`/`mergeJobConfig`; exported from pipeline index.
- `packages/pipeline/src/schedule.ts` — add `lockBettingDelayMs`; keep constants as defaults.
- `apps/worker/src/schedule/lock-betting.worker.ts` (new), `control.worker.ts` (new).
- `apps/worker/src/schedule/match-scheduler.service.ts` — config-driven scan + lock enqueue + remove/re-add + self-rescheduling timer.
- `apps/worker/src/livescore/livescore.worker.ts`, `apps/worker/src/news/news.worker.ts` — `runOnce()` + config-driven interval + enabled + record.
- `apps/worker/src/schedule/lineup.worker.ts`, `result-check.worker.ts` — enabled gate + config + record.
- `apps/worker/src/app.module.ts` — register `LockBettingWorker`, `ControlWorker`.
- `apps/web/app/api/v1/admin/schedule-jobs/route.ts` (GET), `[key]/route.ts` (PATCH), `[key]/trigger/route.ts` (POST).
- `apps/web/components/screens-admin.tsx` — `AdmJobs` component + nav entry.

## Out of scope

- Per-match manual lineup/result triggers (already exist via `sync-lineup`/`sync-result`).
- Cron-expression scheduling UI (thresholds are simple interval/lead numbers).
- Changing the settlement model or live-score source.
