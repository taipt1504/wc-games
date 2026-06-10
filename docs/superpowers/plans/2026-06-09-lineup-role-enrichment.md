# Lineup Role Enrichment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Feed a team's real football-data roster into an LLM that returns the best projected XI (specific roles + 11 starters + formation + numbers), map it back onto the existing player rows by name, and label un-enriched teams' diagrams "· projected" — so the lineup diagram is role-accurate.

**Architecture:** Pure `applyLineupAssignments` (name-matched updates, TDD) + impure `enrichLineup`/`enrichAndStoreLineup`/`enrichAllLineups` in `@wc/pipeline`. Triggers: per-team admin route (sync), bulk worker job via the existing schedule-jobs trigger (async), and a CLI. Render adds a `projected` flag. The existing `bandOf`/`sideRank` placement is unchanged.

**Tech Stack:** TypeScript, `@wc/ai` LlmGateway (9router), Prisma, NestJS worker (Redis pub/sub control), Next 15 admin UI, Vitest.

**Grounding facts (read from the repo):**
- Web routes/CLI build the gateway with `createGatewayFromEnv(process.env as Record<string,string|undefined>)` from `@wc/ai` → returns gateway or `null`; guard `if (!gw) return 503`. (See `app/api/v1/admin/teams/[id]/recrawl/route.ts`, `crawl-players-cli.ts`.)
- Worker uses the injected Nest `LlmGateway` (`apps/worker/src/llm/llm-gateway.ts`); it's structurally compatible with `@wc/ai`'s `LlmGateway` (the existing `LineupWorker` passes it to `refreshMatchLineups`).
- `squad.ts` already has `CrawledPlayer{number,name,position,starter}`, `CrawledLineup{manager,formation,players}`, `parseLineupJson(raw)`, and imports `import type { LlmGateway } from '@wc/ai'`.
- `job-config.ts`: `JobKey` union + `JobConfigs`/`JOB_DEFAULTS`/`JOB_LABELS`/`BOUNDS`. ControlWorker dispatches by key.

**Verification gate:** `pnpm --filter @wc/pipeline build` + `pnpm --filter @wc/pipeline test -- --exclude='**/*.int.test.ts'`; `pnpm --filter @wc/web exec tsc --noEmit` + `pnpm --filter @wc/web test`. Pre-existing `Flag > shows team code` failure stays (unrelated). Build deps in order if a stale-dep type error appears.

---

## File Structure

| File | Change |
|---|---|
| `packages/pipeline/src/squad.ts` | + `normName`, `applyLineupAssignments` (pure), `enrichLineup`, `enrichAndStoreLineup`, `enrichAllLineups` |
| `packages/pipeline/src/squad.test.ts` (new) | unit-test the pure `applyLineupAssignments` |
| `packages/pipeline/src/enrich-lineups-cli.ts` (new) | bulk CLI |
| `packages/pipeline/package.json` | + `enrich-lineups` script |
| `packages/pipeline/src/job-config.ts` | + `enrich_lineups` job key (trigger-only) |
| `apps/web/app/api/v1/admin/teams/[id]/enrich-lineup/route.ts` (new) | per-team admin route |
| `apps/worker/src/footballdata/lineup-enrich.worker.ts` (new) | bulk runner |
| `apps/worker/src/app.module.ts` | register `LineupEnrichWorker` |
| `apps/worker/src/schedule/control.worker.ts` | dispatch `enrich_lineups` |
| `apps/web/components/screens-admin.tsx` | per-team + bulk buttons |
| `apps/web/components/formation-pitch.tsx` | `deriveLineup` `projected` flag + badge |
| `apps/web/components/formation-pitch.test.tsx` | `projected` assertions |
| `apps/web/lib/i18n/dictionaries/{en,vi}.ts` | `tournament.projected` |

---

## Task 1: Pure `applyLineupAssignments` + `normName` (TDD)

**Files:** Modify `packages/pipeline/src/squad.ts`; Create `packages/pipeline/src/squad.test.ts`

- [ ] **Step 1: Write the failing test** — create `packages/pipeline/src/squad.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { applyLineupAssignments, type RosterPlayer } from './squad';

const roster: RosterPlayer[] = [
  { id: 1n, name: 'Romelu Lukaku' },
  { id: 2n, name: 'Kevin De Bruyne' },
  { id: 3n, name: 'José Giménez' },
];

describe('applyLineupAssignments', () => {
  it('matches by normalized name (case + accents), sets position/number/starter', () => {
    const updates = applyLineupAssignments(roster, [
      { name: 'romelu lukaku', position: 'ST', number: 9, starter: true },
      { name: 'Jose Gimenez', position: 'CB', number: 2, starter: true },
    ]);
    expect(updates).toEqual([
      { id: 1n, position: 'ST', number: 9, isStarter: true },
      { id: 3n, position: 'CB', number: 2, isStarter: true },
    ]);
  });

  it('omitted roster players produce no update (stay bench after reset)', () => {
    const updates = applyLineupAssignments(roster, [{ name: 'Romelu Lukaku', position: 'ST', number: 9, starter: true }]);
    expect(updates.map((u) => u.id)).toEqual([1n]); // De Bruyne + Giménez absent
  });

  it('unmatched assignment names are ignored (never invent rows)', () => {
    const updates = applyLineupAssignments(roster, [{ name: 'Nonexistent Player', position: 'ST', number: 9, starter: true }]);
    expect(updates).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @wc/pipeline test -- squad`
Expected: FAIL — `applyLineupAssignments` not exported.

- [ ] **Step 3: Implement** — append to `squad.ts`:

```ts
/** Normalize a player name for matching: strip diacritics, lowercase, collapse non-alphanumerics. */
function normName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export interface RosterPlayer { id: bigint; name: string }
export interface PlayerUpdate { id: bigint; position: string; number: number | null; isStarter: boolean }

/** Map LLM lineup assignments onto an existing roster by normalized name. Pure. Each roster player
 *  matched at most once; assignments with no roster match are dropped (never invent rows); roster
 *  players with no assignment produce no update (they stay non-starters after the caller's reset). */
export function applyLineupAssignments(roster: RosterPlayer[], assignments: CrawledPlayer[]): PlayerUpdate[] {
  const byNorm = new Map<string, RosterPlayer>();
  for (const p of roster) byNorm.set(normName(p.name), p);
  const used = new Set<bigint>();
  const updates: PlayerUpdate[] = [];
  for (const a of assignments) {
    const match = byNorm.get(normName(a.name));
    if (!match || used.has(match.id)) continue;
    used.add(match.id);
    updates.push({ id: match.id, position: a.position, number: a.number, isStarter: a.starter });
  }
  return updates;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @wc/pipeline test -- squad`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/pipeline/src/squad.ts packages/pipeline/src/squad.test.ts
git commit -m "feat(pipeline): applyLineupAssignments — name-matched lineup updates (pure)"
```

---

## Task 2: `enrichLineup` + `enrichAndStoreLineup` + `enrichAllLineups`

**Files:** Modify `packages/pipeline/src/squad.ts`

No CI test (LLM/DB-impure, like `crawlAndStoreSquads`) — verified by build + the pure Task 1 test + the CLI run.

- [ ] **Step 1: Append** to `squad.ts`:

```ts
/** Enrich a team's REAL roster: the LLM annotates the given names with a best projected XI
 *  (specific position + 11 starters + formation + numbers). Roster names are an INPUT (never invented). */
export async function enrichLineup(
  gateway: LlmGateway,
  team: { name: string; players: string[]; model?: string },
): Promise<CrawledLineup> {
  const roster = team.players.join(', ');
  const messages = [
    { role: 'system' as const, content: 'You are a football data assistant. Output ONLY a JSON object — no prose, no code fences.' },
    {
      role: 'user' as const,
      content:
        `Here is ${team.name}'s squad for the 2026 World Cup: ${roster}. ` +
        `Using ONLY these exact players (do not add, drop, or rename anyone), pick the team's strongest projected ` +
        `starting XI and assign EVERY squad member a specific position. ` +
        `Return JSON: {"manager":"<head coach full name>","formation":"<e.g. 4-2-3-1>","players":[` +
        `{"number":<shirt number or null>,"name":"<exact name from the list>","position":"<specific: GK,RB,CB,LB,RWB,LWB,CDM,CM,CAM,RM,LM,RW,LW,ST,CF>","starter":<boolean>}]}. ` +
        `Set starter:true for exactly 11 forming the formation; starter:false for the rest. Include every listed player exactly once.`,
    },
  ];
  const raw = await gateway.complete({ messages, model: team.model });
  return parseLineupJson(raw);
}

/** Enrich + store ONE team's lineup. Loads the FD-synced roster; if empty → 'no-roster' (no LLM call).
 *  Resets starters, applies name-matched assignments, sets Team.formation/manager. Never adds/removes players. */
export async function enrichAndStoreLineup(
  prisma: PrismaClient,
  gateway: LlmGateway,
  teamId: bigint,
): Promise<{ team: string; matched: number; starters: number; status: string }> {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true, name: true } });
  if (!team) throw new Error('TEAM_NOT_FOUND');
  const roster = await prisma.player.findMany({ where: { teamId }, select: { id: true, name: true } });
  if (roster.length === 0) return { team: team.name, matched: 0, starters: 0, status: 'no-roster' };

  const t0 = Date.now();
  let lineup: CrawledLineup = { manager: '', formation: '', players: [] };
  let status = 'ok';
  try {
    lineup = await enrichLineup(gateway, { name: team.name, players: roster.map((p) => p.name) });
    if (lineup.players.length === 0) status = 'empty';
  } catch {
    status = 'error';
  }
  await prisma.aiJob.create({ data: { type: 'squad', providerUsed: 'gateway', status, latencyMs: Date.now() - t0 } });
  if (lineup.players.length === 0) return { team: team.name, matched: 0, starters: 0, status };

  const updates = applyLineupAssignments(roster, lineup.players);
  await prisma.$transaction([
    prisma.player.updateMany({ where: { teamId }, data: { isStarter: false } }),
    ...updates.map((u) =>
      prisma.player.update({ where: { id: u.id }, data: { position: u.position, number: u.number ?? undefined, isStarter: u.isStarter } }),
    ),
    prisma.team.update({ where: { id: teamId }, data: { formation: lineup.formation || null, manager: lineup.manager || null } }),
  ]);
  return { team: team.name, matched: updates.length, starters: updates.filter((u) => u.isStarter).length, status };
}

/** Enrich every team's lineup (bulk). Sequential — each is one LLM call. */
export async function enrichAllLineups(
  prisma: PrismaClient,
  gateway: LlmGateway,
): Promise<{ team: string; matched: number; starters: number; status: string }[]> {
  const teams = await prisma.team.findMany({ select: { id: true }, orderBy: { name: 'asc' } });
  const out: { team: string; matched: number; starters: number; status: string }[] = [];
  for (const t of teams) out.push(await enrichAndStoreLineup(prisma, gateway, t.id));
  return out;
}
```

> `PrismaClient` + `LlmGateway` are already imported at the top of `squad.ts`. `CrawledLineup`/`CrawledPlayer`/`parseLineupJson` already exist there.

- [ ] **Step 2: Build**

Run: `pnpm --filter @wc/pipeline build`
Expected: exit 0. (If stale-dep error: `pnpm --filter @wc/db build` first, retry.)

- [ ] **Step 3: Test (no regressions)**

Run: `pnpm --filter @wc/pipeline test -- --exclude='**/*.int.test.ts'`
Expected: exit 0 (Task 1's 3 tests included; football-data 63 unchanged).

- [ ] **Step 4: Commit**

```bash
git add packages/pipeline/src/squad.ts
git commit -m "feat(pipeline): enrichLineup/enrichAndStoreLineup/enrichAllLineups (LLM best XI on real roster)"
```

---

## Task 3: Bulk CLI `enrich-lineups`

**Files:** Create `packages/pipeline/src/enrich-lineups-cli.ts`; Modify `packages/pipeline/package.json`

- [ ] **Step 1: Create** `packages/pipeline/src/enrich-lineups-cli.ts` (mirrors `crawl-players-cli.ts`):

```ts
import { PrismaClient } from '@wc/db';
import { createGatewayFromEnv } from '@wc/ai';
import { enrichAllLineups } from './squad';

// Usage: pnpm --filter @wc/pipeline enrich-lineups   (enriches all teams' lineups from their FD roster)
const prisma = new PrismaClient();

(async () => {
  const gw = createGatewayFromEnv(process.env as Record<string, string | undefined>);
  if (!gw) {
    console.error('No LLM gateway configured (LLM_GATEWAY_BASE_URL/API_KEY). Aborting.');
    process.exit(1);
  }
  console.log('Enriching lineups for all teams…');
  const results = await enrichAllLineups(prisma, gw);
  for (const r of results) console.log(`  ${r.team}: ${r.matched} matched, ${r.starters} starters (${r.status})`);
  await prisma.$disconnect();
  process.exit(0);
})().catch((e) => {
  console.error('enrich-lineups failed:', e);
  process.exit(1);
});
```

- [ ] **Step 2: Add the script** — in `packages/pipeline/package.json` `"scripts"`, after `"ingest:fd"`:

```json
    "enrich-lineups": "dotenv -e ../../.env -- tsx src/enrich-lineups-cli.ts"
```
(Add a comma after the previous entry.)

- [ ] **Step 3: Build** `pnpm --filter @wc/pipeline build` → exit 0.

- [ ] **Step 4: Commit**

```bash
git add packages/pipeline/src/enrich-lineups-cli.ts packages/pipeline/package.json
git commit -m "feat(pipeline): enrich-lineups CLI (bulk LLM lineup enrichment)"
```

---

## Task 4: Per-team admin route

**Files:** Create `apps/web/app/api/v1/admin/teams/[id]/enrich-lineup/route.ts`

- [ ] **Step 1: Create** the route (mirrors `…/recrawl/route.ts`):

```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';
import { createGatewayFromEnv } from '@wc/ai';
import { enrichAndStoreLineup } from '@wc/pipeline';

export const dynamic = 'force-dynamic';

// POST /api/v1/admin/teams/[id]/enrich-lineup — LLM assigns roles + best XI to this team's FD roster.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const { id } = await params;

  const gw = createGatewayFromEnv(process.env as Record<string, string | undefined>);
  if (!gw) return NextResponse.json({ error: { code: 'LLM_NOT_CONFIGURED' } }, { status: 503 });

  let result;
  try {
    result = await enrichAndStoreLineup(prisma, gw, BigInt(id));
  } catch (e) {
    const code = (e as Error).message === 'TEAM_NOT_FOUND' ? 'NOT_FOUND' : 'ENRICH_FAILED';
    return NextResponse.json({ error: { code } }, { status: code === 'NOT_FOUND' ? 404 : 502 });
  }
  await prisma.auditLog.create({
    data: { actorType: 'ADMIN', actorId: admin.id, action: 'ENRICH_LINEUP', target: `team:${id}`, metadata: { matched: result.matched, starters: result.starters, status: result.status } },
  });
  if (result.status === 'error') return NextResponse.json({ error: { code: 'ENRICH_FAILED' } }, { status: 502 });
  return NextResponse.json({ data: result });
}
```

- [ ] **Step 2: Verify** `pnpm --filter @wc/pipeline build` (dist current) then `pnpm --filter @wc/web exec tsc --noEmit` → exit 0.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/api/v1/admin/teams/[id]/enrich-lineup/route.ts"
git commit -m "feat(web/admin): per-team enrich-lineup route (LLM best XI on FD roster)"
```

---

## Task 5: Worker bulk job `enrich_lineups`

**Files:** Modify `packages/pipeline/src/job-config.ts`; Create `apps/worker/src/footballdata/lineup-enrich.worker.ts`; Modify `apps/worker/src/app.module.ts`, `apps/worker/src/schedule/control.worker.ts`

- [ ] **Step 1: Add the job key** in `packages/pipeline/src/job-config.ts` (trigger-only, no numeric config):
  - `JobKey` union: append `| 'enrich_lineups'`.
  - `JobConfigs`: add `enrich_lineups: Record<string, never>;`
  - `JOB_DEFAULTS`: add `enrich_lineups: {},`
  - `JOB_LABELS`: add `enrich_lineups: 'Lineup enrichment',`
  - (No `BOUNDS` entry — no numeric fields; `clampConfig` over empty defaults returns `{}`.)

- [ ] **Step 2: Build pipeline** `pnpm --filter @wc/pipeline build` → exit 0.

- [ ] **Step 3: Create** `apps/worker/src/footballdata/lineup-enrich.worker.ts` (mirrors the LlmGateway use in `LineupWorker`; `runOnce()` is the ControlWorker entry point):

```ts
import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@wc/db';
import { enrichAllLineups, isJobEnabled, recordJobRun } from '@wc/pipeline';
import { LlmGateway } from '../llm/llm-gateway';

/** LineupEnrichWorker — bulk LLM lineup enrichment for all teams, triggered on-demand by admin
 *  (ControlWorker → 'enrich_lineups'). Sequential LLM calls; runs in the background (not a request). */
@Injectable()
export class LineupEnrichWorker {
  private readonly log = new Logger(LineupEnrichWorker.name);
  private running = false;

  constructor(private readonly llm: LlmGateway) {}

  async runOnce(): Promise<string> {
    if (this.running) return 'busy';
    this.running = true;
    try {
      if (!(await isJobEnabled(prisma, 'enrich_lineups'))) {
        await recordJobRun(prisma, 'enrich_lineups', 'SKIPPED', 'disabled');
        return 'disabled';
      }
      const res = await enrichAllLineups(prisma, this.llm);
      const ok = res.filter((r) => r.status === 'ok').length;
      const note = `enriched ${ok}/${res.length} teams`;
      await recordJobRun(prisma, 'enrich_lineups', 'OK', note);
      this.log.log(`enrich_lineups: ${note}`);
      return note;
    } catch (err) {
      await recordJobRun(prisma, 'enrich_lineups', 'ERROR', (err as Error).message);
      this.log.warn(`enrich_lineups failed: ${(err as Error).message}`);
      return 'error';
    } finally {
      this.running = false;
    }
  }
}
```

- [ ] **Step 4: Register** in `apps/worker/src/app.module.ts`: add `import { LineupEnrichWorker } from './footballdata/lineup-enrich.worker';` and add `LineupEnrichWorker` to the `providers` array.

- [ ] **Step 5: Dispatch** in `apps/worker/src/schedule/control.worker.ts`:
  - import `import { LineupEnrichWorker } from '../footballdata/lineup-enrich.worker';`
  - constructor param: `private readonly lineupEnrich: LineupEnrichWorker,`
  - in the `dispatch` switch: `case 'enrich_lineups': await this.lineupEnrich.runOnce(); break;`

- [ ] **Step 6: Build** `pnpm --filter @wc/pipeline build && pnpm --filter @wc/worker build` → both exit 0.

- [ ] **Step 7: Commit**

```bash
git add packages/pipeline/src/job-config.ts apps/worker/src/footballdata/lineup-enrich.worker.ts apps/worker/src/app.module.ts apps/worker/src/schedule/control.worker.ts
git commit -m "feat(worker): enrich_lineups bulk job (LLM lineup enrichment, admin-triggered)"
```

---

## Task 6: Admin UI buttons

**Files:** Modify `apps/web/components/screens-admin.tsx`

Admin labels are plain English (no i18n) — keep that convention.

- [ ] **Step 1: Read** `screens-admin.tsx` — the `AdmTeamDetail` `recrawl()`/`syncFd()` handlers + their buttons (the per-team controls), and the `AdmTeams` header where the bulk "Sync all squads (API)" button lives (`SecHead` action).

- [ ] **Step 2: Per-team button** — in `AdmTeamDetail`, add an `enrichLineup()` handler mirroring `syncFd()`: a `enriching` loading flag; POST `/api/v1/admin/teams/${id}/enrich-lineup`; on success toast `matched X / starters Y`; on 503 `LLM_NOT_CONFIGURED` toast "LLM gateway not configured"; on `no-roster` status toast "Sync squad (API) first"; then `load()` to refresh. Add a button next to "Sync squad (API)":
```tsx
<Btn variant="primary" size="sm" icon="refresh" disabled={enriching} onClick={enrichLineup}>Assign roles & XI (AI)</Btn>
```

- [ ] **Step 3: Bulk button** — in `AdmTeams` (next to "Sync all squads (API)"), add a button that POSTs to `/api/v1/admin/schedule-jobs/enrich_lineups/trigger` (fire-and-forget worker trigger) with a brief toast "Lineup enrichment started (runs in the worker)". Mirror the existing trigger/bulk button style:
```tsx
<Btn variant="ghost" size="sm" onClick={enrichAllLineups}>Assign roles & XI — all teams</Btn>
```
with an `enrichAllLineups()` handler that does the POST + toast (no loading spinner needed — it's async on the worker).

- [ ] **Step 4: Verify** `pnpm --filter @wc/web exec tsc --noEmit` (exit 0) + `pnpm --filter @wc/web test` (121 pass + the pre-existing `Flag` fail only; no new failures).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/screens-admin.tsx
git commit -m "feat(web/admin): Assign roles & XI buttons (per-team + bulk worker trigger)"
```

---

## Task 7: Render `projected` flag + i18n

**Files:** Modify `apps/web/components/formation-pitch.tsx`, `apps/web/components/formation-pitch.test.tsx`, `apps/web/lib/i18n/dictionaries/en.ts`, `apps/web/lib/i18n/dictionaries/vi.ts`

- [ ] **Step 1: i18n** — add `projected` to the `tournament` group in BOTH dictionaries:
  - `en.ts`: `projected: 'projected',`
  - `vi.ts`: `projected: 'tạm tính',`

- [ ] **Step 2: `deriveLineup` returns `projected`** — in `formation-pitch.tsx`:
  - Extend the interface: `export interface DerivedLineup { lines: LineupPlayer[][]; subs: LineupPlayer[]; formationLabel: string; projected: boolean }`
  - Empty case: `return { lines: [], subs: [], formationLabel: '', projected: false };`
  - Real-XI return: add `projected: false`.
  - No-XI (4-3-3) return: add `projected: true`.

- [ ] **Step 3: Badge** — in `FormationPitch`, destructure `projected` and render the badge:
```tsx
const { t } = useT();
const { lines, subs, formationLabel, projected } = deriveLineup(players, formation);
// …badge:
{formationLabel && <span className="badge badge-sky">{projected ? `${formationLabel} · ${t('tournament.projected')}` : formationLabel}</span>}
```

- [ ] **Step 4: Test** — add to `formation-pitch.test.tsx`:
```ts
  it('projected flag: false for real XI, true for default 4-3-3', () => {
    const real = deriveLineup([P('GK1', 'GK', { starter: true }), P('ST1', 'ST', { starter: true })], '4-2-3-1');
    expect(real.projected).toBe(false);
    const fd = deriveLineup([...band('GK', 1), ...band('DEF', 4), ...band('MID', 3), ...band('FWD', 3)]);
    expect(fd.projected).toBe(true);
  });
```
(`P` and `band` helpers already exist at the top of `formation-pitch.test.tsx`.)

- [ ] **Step 5: Verify** `pnpm --filter @wc/web exec tsc --noEmit` (exit 0) + `pnpm --filter @wc/web test` (the deriveLineup suite now includes the projected test; only the pre-existing `Flag` fail).

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/formation-pitch.tsx apps/web/components/formation-pitch.test.tsx apps/web/lib/i18n/dictionaries/en.ts apps/web/lib/i18n/dictionaries/vi.ts
git commit -m "feat(web): label un-enriched lineup '· projected' (deriveLineup.projected)"
```

---

## Task 8: Phase verification + handoff

- [ ] **Step 1:** Ordered build: `pnpm --filter @wc/db build && pnpm --filter @wc/pipeline build && pnpm --filter @wc/worker build` → all exit 0.
- [ ] **Step 2:** `pnpm --filter @wc/pipeline test -- --exclude='**/*.int.test.ts'` → exit 0. `pnpm --filter @wc/web exec tsc --noEmit` → 0. `pnpm --filter @wc/web test` → only the pre-existing `Flag` fail.
- [ ] **Step 3: Live verification (needs LLM gateway reachable + a synced FD roster):** with `LLM_GATEWAY_*` configured, run `pnpm --filter @wc/pipeline enrich-lineups` (or the per-team admin button) → players get specific positions + ~11 starters + numbers; the diagram renders the real XI (no "· projected"). If the gateway is unreachable here, note it as owed (same as the FD-key situation). STOP for review.

---

## Self-Review

**Spec coverage:** roster from FD rows → LLM (Task 2 `enrichLineup` takes the DB roster names) ✓ · best XI + roles/starters/numbers (Task 2 prompt + `parseLineupJson`) ✓ · map back by name, no roster replace (Task 1 `applyLineupAssignments` + Task 2 `updateMany reset` + per-id updates) ✓ · `no-roster` guard (Task 2) ✓ · per-team route (Task 4) + bulk worker job (Task 5) + CLI (Task 3) ✓ · admin buttons (Task 6) ✓ · `LLM_NOT_CONFIGURED` 503 (Task 4) ✓ · projected label (Task 7) ✓ · tests (Task 1 pure mapper + Task 7 projected) ✓.

**Placeholder scan:** none — full code in every code step. Task 6 gives the handler behavior + exact button JSX + insertion anchors (mirror `syncFd`/`recrawl`/bulk-sync siblings already in the file); the implementer reads the file to place them.

**Type consistency:** `RosterPlayer`/`PlayerUpdate`/`CrawledPlayer`/`CrawledLineup`/`LlmGateway` consistent across Tasks 1–2; `applyLineupAssignments(roster, assignments: CrawledPlayer[])` matches `enrichAndStoreLineup`'s call (`lineup.players` is `CrawledPlayer[]`). `enrich_lineups` JobKey defined in Task 5 Step 1 before its uses in the worker/ControlWorker. `DerivedLineup.projected` defined + consumed in Task 7.

**Note:** the bulk worker passes the Nest `LlmGateway` to `enrichAllLineups` (typed `@wc/ai` `LlmGateway`) — structurally compatible, exactly as the existing `LineupWorker` → `refreshMatchLineups`. If TS objects, the existing lineup worker proves it compiles.
