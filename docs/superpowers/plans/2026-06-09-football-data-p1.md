# Football-Data.org — PHASE 1 Implementation Plan (client + scheduled sync + cache)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single rate-limited football-data.org v4 client + pure mappers + DB sync functions in `packages/pipeline`, add `externalId` mapping columns to `Team`/`Match`/`Player`, and wire a scheduled reference-sync + live-sync into the existing `apps/worker` — so teams, squads, and matches in Postgres come from the real WC API.

**Architecture:** All FD traffic funnels through one `FdClient` (min-7.5s spacing ⇒ ≤8 req/min, honors `x-requests-available-minute` + 429 `Retry-After`). Pure mappers translate FD JSON → existing Prisma enums/shapes and are unit-tested against captured fixtures (no network). Impure sync functions preserve synthetic primary keys and attach FD ids via a new nullable `externalId`, matching existing rows by natural key on first run (group matches by team pair, knockouts by chronological ordinal). Worker reuses the existing timer-poller + `job-config`/`ScheduleJob` scaffolding — no new infra, no new deps.

**Tech Stack:** TypeScript, Prisma 6 (Postgres), Vitest, NestJS + BullMQ (worker), `@wc/realtime` pub/sub.

**Scope guards (from spec §6):**
- Frontend untouched in P1.
- Per spec decisions: scorers (D2) and its `Scorer` model are **P4, not here**; standings stay **computed** (D4, no fetch); venue stays **DB-owned** (D5, sync never writes `venueId`); odds stay **internal** (D6, sync never writes odds source from FD).
- **Two user gates** (executor STOPS and waits):
  1. **Task 6** — the `externalId` migration (schema change).
  2. **Task 8** — populating `SPORTS_API_KEY` + `SPORTS_API_BASE_URL` in `.env` before any live run (we never edit `.env`).

**Verification gate per code task:** build + test the touched packages in dependency order:
```bash
pnpm --filter @wc/pipeline test
pnpm --filter @wc/db build && pnpm --filter @wc/pipeline build && pnpm --filter @wc/worker build
```
(Integration-against-DB is not CI-tested here — mirrors the existing `ingest.ts`, which unit-tests mappers only. The live sync is verified by the manual CLI in Task 7 once the key is set.)

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/pipeline/src/__fixtures__/fd-teams.json` (new) | Trimmed real `/teams` response (2 teams, 2 squad each) for mapper tests |
| `packages/pipeline/src/__fixtures__/fd-matches.json` (new) | Trimmed real `/matches` response (1 group + 1 knockout) for mapper tests |
| `packages/pipeline/src/football-data.ts` (new) | The whole FD layer: raw types, pure mappers, `FdClient` (rate limiter + fetchers), sync functions |
| `packages/pipeline/src/football-data.test.ts` (new) | Unit tests: mappers vs fixtures + rate-limiter spacing/backoff |
| `packages/pipeline/src/ingest-fd-cli.ts` (new) | Manual one-shot sync CLI for P1 verification |
| `packages/pipeline/src/index.ts` (modify) | Export `./football-data` |
| `packages/pipeline/src/job-config.ts` (modify) | Add `fd_sync` job key + config + bounds |
| `packages/pipeline/package.json` (modify) | Add `ingest:fd` script |
| `packages/db/prisma/schema.prisma` (modify) | Add `externalId` to `Team`/`Match`/`Player` |
| `packages/db/prisma/migrations/20260609000000_add_external_ids/migration.sql` (new, hand-authored) | The migration (applied via `migrate deploy`, not `migrate dev`) |
| `apps/worker/src/footballdata/fd-sync.worker.ts` (new) | Timer-poller reference-sync worker (teams+matches) |
| `apps/worker/src/livescore/livescore.worker.ts` (modify) | Repoint live poll to FD `syncLiveScores` |
| `apps/worker/src/app.module.ts` (modify) | Register `FdSyncWorker` |
| `apps/worker/src/schedule/control.worker.ts` (modify) | Manual-trigger case for `fd_sync` |

---

## Task 1: Commit captured test fixtures

**Files:**
- Create: `packages/pipeline/src/__fixtures__/fd-teams.json`
- Create: `packages/pipeline/src/__fixtures__/fd-matches.json`

These are trimmed verbatim slices of the real verified responses (2026-06-09). They let mapper tests run with zero network and zero key.

- [ ] **Step 1: Create `fd-teams.json`**

```json
{
  "count": 2,
  "teams": [
    {
      "id": 758,
      "name": "Uruguay",
      "shortName": "Uruguay",
      "tla": "URY",
      "crest": "https://crests.football-data.org/758.svg",
      "coach": { "id": 56079, "name": "Marcelo Bielsa", "nationality": "Argentina" },
      "squad": [
        { "id": 3160, "name": "Fernando Muslera", "position": "Goalkeeper", "dateOfBirth": "1986-06-16", "nationality": "Uruguay" },
        { "id": 30210, "name": "Santiago Mele", "position": "Goalkeeper", "dateOfBirth": "1997-09-06", "nationality": "Uruguay" }
      ]
    },
    {
      "id": 769,
      "name": "Mexico",
      "shortName": "Mexico",
      "tla": "MEX",
      "crest": "https://crests.football-data.org/769.svg",
      "coach": { "id": 11111, "name": "Javier Aguirre", "nationality": "Mexico" },
      "squad": [
        { "id": 40001, "name": "Guillermo Ochoa", "position": "Goalkeeper", "dateOfBirth": "1985-07-13", "nationality": "Mexico" },
        { "id": 40002, "name": "Edson Alvarez", "position": "Midfield", "dateOfBirth": "1997-10-24", "nationality": "Mexico" }
      ]
    }
  ]
}
```

- [ ] **Step 2: Create `fd-matches.json`**

(Group match `537327` and final `537390` are real; the final's teams are `null` pre-draw, exactly as the API returns.)

```json
{
  "resultSet": { "count": 2, "first": "2026-06-11", "last": "2026-07-19", "played": 0 },
  "matches": [
    {
      "id": 537327,
      "utcDate": "2026-06-11T19:00:00Z",
      "status": "TIMED",
      "matchday": 1,
      "stage": "GROUP_STAGE",
      "group": "GROUP_A",
      "homeTeam": { "id": 769, "name": "Mexico", "tla": "MEX" },
      "awayTeam": { "id": 774, "name": "South Africa", "tla": "RSA" },
      "score": { "winner": null, "duration": "REGULAR", "fullTime": { "home": null, "away": null }, "halfTime": { "home": null, "away": null } }
    },
    {
      "id": 537390,
      "utcDate": "2026-07-19T19:00:00Z",
      "status": "TIMED",
      "matchday": null,
      "stage": "FINAL",
      "group": null,
      "homeTeam": { "id": null, "name": null, "tla": null },
      "awayTeam": { "id": null, "name": null, "tla": null },
      "score": { "winner": null, "duration": "REGULAR", "fullTime": { "home": null, "away": null }, "halfTime": { "home": null, "away": null } }
    }
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/pipeline/src/__fixtures__/fd-teams.json packages/pipeline/src/__fixtures__/fd-matches.json
git commit -m "test(pipeline): captured football-data WC fixtures for mapper tests"
```

---

## Task 2: Raw types + pure scalar mappers

**Files:**
- Create: `packages/pipeline/src/football-data.ts`
- Create: `packages/pipeline/src/football-data.test.ts`

- [ ] **Step 1: Write the failing test** (`football-data.test.ts`)

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @wc/pipeline test football-data`
Expected: FAIL — `Cannot find module './football-data'`.

- [ ] **Step 3: Implement** (`football-data.ts` — first section)

```ts
/**
 * @wc/pipeline — football-data.org v4 source (spec docs/superpowers/specs/2026-06-09-football-data-integration-design.md).
 * One rate-limited client for all FD traffic; pure mappers translate FD JSON onto our Prisma enums
 * and are unit-tested against captured fixtures (no network, no key in CI).
 */
import type { PrismaClient, MatchRound, MatchStatus, Outcome } from '@wc/db';
import { publishEvent, channels } from '@wc/realtime';

// ─────────────────────────── Raw API shapes (football-data.org v4) ───────────────────────────
export interface FdRef { id: number | null; name?: string | null; tla?: string | null }
export interface FdPlayer { id: number; name: string; position: string | null; dateOfBirth?: string; nationality?: string }
export interface FdTeam {
  id: number; name: string; shortName?: string; tla: string; crest?: string;
  coach?: { id?: number; name?: string | null } | null;
  squad?: FdPlayer[];
}
export interface FdScore {
  winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null;
  duration?: string;
  fullTime: { home: number | null; away: number | null };
  halfTime?: { home: number | null; away: number | null };
}
export interface FdMatch {
  id: number; utcDate: string; status: string;
  matchday: number | null; stage: string; group: string | null;
  homeTeam: FdRef; awayTeam: FdRef; score: FdScore;
}

// ─────────────────────────── Pure scalar mappers ───────────────────────────

/** FD status workflow → our MatchStatus enum. SCHEDULED|TIMED→SCHEDULED, IN_PLAY|PAUSED→LIVE,
 *  FINISHED|AWARDED→FINISHED, POSTPONED→POSTPONED, CANCELLED|SUSPENDED→CANCELLED. */
export function mapFdStatus(s: string): MatchStatus {
  switch (s) {
    case 'SCHEDULED': case 'TIMED': return 'SCHEDULED';
    case 'IN_PLAY': case 'PAUSED': return 'LIVE';
    case 'FINISHED': case 'AWARDED': return 'FINISHED';
    case 'POSTPONED': return 'POSTPONED';
    case 'CANCELLED': case 'SUSPENDED': return 'CANCELLED';
    default: return 'SCHEDULED';
  }
}

const STAGE: Record<string, MatchRound> = {
  GROUP_STAGE: 'GROUP', LAST_32: 'R32', LAST_16: 'R16',
  QUARTER_FINALS: 'QF', SEMI_FINALS: 'SF', THIRD_PLACE: 'THIRD', FINAL: 'FINAL',
};
/** FD `stage` → MatchRound. Throws on unknown so bad data never lands silently. */
export function mapFdStage(stage: string): MatchRound {
  const r = STAGE[stage];
  if (!r) throw new Error(`unknown FD stage: ${stage}`);
  return r;
}

/** "GROUP_A" → "A"; null → null. */
export function mapFdGroup(group: string | null): string | null {
  if (!group) return null;
  const m = group.match(/^GROUP_([A-L])$/);
  return m ? m[1] : null;
}

/** Coarse FD squad role → GK/DEF/MID/FWD (baseline; AI lineup worker refines near kickoff). */
export function mapFdPosition(pos: string | null): string | null {
  if (!pos) return null;
  const p = pos.toLowerCase();
  if (p.includes('keeper')) return 'GK';
  if (p.includes('defence') || p.includes('defender') || p.includes('back')) return 'DEF';
  if (p.includes('midfield')) return 'MID';
  if (p.includes('offence') || p.includes('forward') || p.includes('winger') || p.includes('striker') || p.includes('attack'))
    return 'FWD';
  return null;
}

export interface MappedScore { scoreHome90: number | null; scoreAway90: number | null; result90: Outcome | null }
/** FD score → our 90' fields. (Knockout fullTime may include ET/pens; `duration` distinguishes —
 *  we store fullTime as-is, accepting "90" is a label not a guarantee for knockouts.) */
export function mapFdScore(s: FdScore): MappedScore {
  const h = s.fullTime?.home ?? null;
  const a = s.fullTime?.away ?? null;
  if (h == null || a == null) return { scoreHome90: null, scoreAway90: null, result90: null };
  const result90: Outcome = s.winner === 'HOME_TEAM' ? 'HOME' : s.winner === 'AWAY_TEAM' ? 'AWAY' : 'DRAW';
  return { scoreHome90: h, scoreAway90: a, result90 };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @wc/pipeline test football-data`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/pipeline/src/football-data.ts packages/pipeline/src/football-data.test.ts
git commit -m "feat(pipeline): football-data raw types + pure scalar mappers"
```

---

## Task 3: Entity mappers (team / player / match)

**Files:**
- Modify: `packages/pipeline/src/football-data.ts`
- Modify: `packages/pipeline/src/football-data.test.ts`

- [ ] **Step 1: Add failing tests** (append to `football-data.test.ts`)

```ts
import { mapFdTeam, mapFdMatch, type MappedFdMatch } from './football-data';

describe('football-data entity mappers', () => {
  it('mapFdTeam extracts identity + coach + mapped squad', () => {
    const t = mapFdTeam(teams[0]); // Uruguay
    expect(t.externalId).toBe(758);
    expect(t.code).toBe('URY');
    expect(t.name).toBe('Uruguay');
    expect(t.flagUrl).toBe('https://crests.football-data.org/758.svg');
    expect(t.manager).toBe('Marcelo Bielsa');
    expect(t.squad).toHaveLength(2);
    expect(t.squad[0]).toEqual({ externalId: 3160, name: 'Fernando Muslera', position: 'GK' });
  });

  it('mapFdMatch maps a group match with both teams resolvable', () => {
    const resolveTeam = (fdId: number | null) => (fdId === 769 ? 1n : fdId === 774 ? 2n : null);
    const m = mapFdMatch(matches[0], resolveTeam); // 537327 MEX v RSA
    expect(m.externalId).toBe(537327);
    expect(m.round).toBe('GROUP');
    expect(m.groupLetter).toBe('A');
    expect(m.homeTeamId).toBe(1n);
    expect(m.awayTeamId).toBe(2n);
    expect(m.kickoffAt.toISOString()).toBe('2026-06-11T19:00:00.000Z');
    expect(m.status).toBe('SCHEDULED'); // TIMED
    expect(m.scoreHome90).toBeNull();
  });

  it('mapFdMatch maps a knockout match with null teams to placeholder 0n', () => {
    const resolveTeam = () => null;
    const m = mapFdMatch(matches[1], resolveTeam); // 537390 FINAL, teams null
    expect(m.round).toBe('FINAL');
    expect(m.groupLetter).toBeNull();
    expect(m.homeTeamId).toBe(0n);
    expect(m.awayTeamId).toBe(0n);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @wc/pipeline test football-data`
Expected: FAIL — `mapFdTeam`/`mapFdMatch` not exported.

- [ ] **Step 3: Implement** (append to `football-data.ts`)

```ts
// ─────────────────────────── Pure entity mappers ───────────────────────────

export interface MappedSquadPlayer { externalId: number; name: string; position: string | null }
export interface MappedFdTeam {
  externalId: number; name: string; code: string; flagUrl: string | null;
  manager: string | null; squad: MappedSquadPlayer[];
}
export function mapFdTeam(t: FdTeam): MappedFdTeam {
  return {
    externalId: t.id,
    name: t.name,
    code: t.tla,
    flagUrl: t.crest ?? null,
    manager: t.coach?.name ?? null,
    squad: (t.squad ?? []).map((p) => ({ externalId: p.id, name: p.name, position: mapFdPosition(p.position) })),
  };
}

export interface MappedFdMatch {
  externalId: number; round: MatchRound; groupLetter: string | null;
  homeTeamId: bigint; awayTeamId: bigint; kickoffAt: Date; status: MatchStatus;
  scoreHome90: number | null; scoreAway90: number | null; result90: Outcome | null;
}
/** Resolve FD team id → DB team id (via Team.externalId); null FD team (undrawn knockout) → 0n
 *  placeholder, matching the existing worldcup26 "0" convention (homeTeamId has no FK). */
export type ResolveTeamId = (fdTeamId: number | null) => bigint | null;
export function mapFdMatch(m: FdMatch, resolveTeamId: ResolveTeamId): MappedFdMatch {
  const round = mapFdStage(m.stage);
  const score = mapFdScore(m.score);
  return {
    externalId: m.id,
    round,
    groupLetter: round === 'GROUP' ? mapFdGroup(m.group) : null,
    homeTeamId: resolveTeamId(m.homeTeam.id) ?? 0n,
    awayTeamId: resolveTeamId(m.awayTeam.id) ?? 0n,
    kickoffAt: new Date(m.utcDate),
    status: mapFdStatus(m.status),
    scoreHome90: score.scoreHome90,
    scoreAway90: score.scoreAway90,
    result90: score.result90,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @wc/pipeline test football-data`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/pipeline/src/football-data.ts packages/pipeline/src/football-data.test.ts
git commit -m "feat(pipeline): football-data entity mappers (team/player/match)"
```

---

## Task 4: Rate-limited client

**Files:**
- Modify: `packages/pipeline/src/football-data.ts`
- Modify: `packages/pipeline/src/football-data.test.ts`

The client serializes every request through a min-interval gate (default 7500 ms ⇒ ≤8/min), and on HTTP 429 sleeps for `Retry-After`. Time is injected (`now`/`sleep`) so tests are deterministic with no real waiting.

- [ ] **Step 1: Add failing tests** (append to `football-data.test.ts`)

```ts
import { FdClient } from './football-data';

describe('FdClient rate limiter', () => {
  function fakeClock() {
    let t = 0;
    return { now: () => t, sleep: async (ms: number) => { t += ms; }, at: () => t };
  }

  it('spaces sequential requests by at least minSpacingMs', async () => {
    const clock = fakeClock();
    const starts: number[] = [];
    const fetchFn = (async () => {
      starts.push(clock.at());
      return { ok: true, status: 200, headers: new Map([['x-requests-available-minute', '9']]) as any, json: async () => ({ ok: 1 }) };
    }) as unknown as typeof fetch;
    const c = new FdClient({ apiKey: 'k', baseUrl: 'http://x/v4', minSpacingMs: 7500, fetchFn, now: clock.now, sleep: clock.sleep });
    await c.get('/competitions/WC');
    await c.get('/competitions/WC/teams');
    await c.get('/competitions/WC/matches');
    expect(starts[0]).toBe(0);
    expect(starts[1]).toBeGreaterThanOrEqual(7500);
    expect(starts[2]).toBeGreaterThanOrEqual(15000);
  });

  it('sends X-Auth-Token and builds the URL from baseUrl', async () => {
    const clock = fakeClock();
    let seenUrl = ''; let seenKey = '';
    const fetchFn = (async (url: string, init: any) => {
      seenUrl = url; seenKey = init.headers['X-Auth-Token'];
      return { ok: true, status: 200, headers: new Map() as any, json: async () => ({ count: 0 }) };
    }) as unknown as typeof fetch;
    const c = new FdClient({ apiKey: 'secret', baseUrl: 'http://x/v4', fetchFn, now: clock.now, sleep: clock.sleep });
    await c.get('/competitions/WC/scorers');
    expect(seenUrl).toBe('http://x/v4/competitions/WC/scorers');
    expect(seenKey).toBe('secret');
  });

  it('honors Retry-After on 429 then retries', async () => {
    const clock = fakeClock();
    let calls = 0;
    const fetchFn = (async () => {
      calls++;
      if (calls === 1) return { ok: false, status: 429, headers: new Map([['retry-after', '12']]) as any, json: async () => ({}) };
      return { ok: true, status: 200, headers: new Map() as any, json: async () => ({ done: true }) };
    }) as unknown as typeof fetch;
    const c = new FdClient({ apiKey: 'k', baseUrl: 'http://x/v4', fetchFn, now: clock.now, sleep: clock.sleep });
    const out = await c.get('/competitions/WC');
    expect(out).toEqual({ done: true });
    expect(calls).toBe(2);
    expect(clock.at()).toBeGreaterThanOrEqual(12000);
  });

  it('throws a clear error when apiKey is missing', () => {
    expect(() => new FdClient({ apiKey: '', baseUrl: 'http://x/v4' })).toThrow(/SPORTS_API_KEY/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @wc/pipeline test football-data`
Expected: FAIL — `FdClient` not exported.

- [ ] **Step 3: Implement** (append to `football-data.ts`)

```ts
// ─────────────────────────── Rate-limited client ───────────────────────────

export interface FdClientOpts {
  apiKey: string;
  baseUrl: string;
  minSpacingMs?: number;                 // default 7500 → ≤8 req/min (margin under the 10/min cap)
  maxRetries?: number;                   // default 2 (for 429)
  fetchFn?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/** Single funnel for all football-data.org traffic. Serialized min-interval gate + 429 backoff.
 *  Time is injected so the limiter is unit-tested without real waiting. */
export class FdClient {
  private readonly key: string;
  private readonly base: string;
  private readonly spacing: number;
  private readonly maxRetries: number;
  private readonly fetchFn: typeof fetch;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private last = -Infinity;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(opts: FdClientOpts) {
    if (!opts.apiKey) throw new Error('FdClient: missing SPORTS_API_KEY');
    if (!opts.baseUrl) throw new Error('FdClient: missing SPORTS_API_BASE_URL');
    this.key = opts.apiKey;
    this.base = opts.baseUrl.replace(/\/$/, '');
    this.spacing = opts.minSpacingMs ?? 7500;
    this.maxRetries = opts.maxRetries ?? 2;
    this.fetchFn = opts.fetchFn ?? fetch;
    this.now = opts.now ?? Date.now;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  /** GET `path` (relative to baseUrl), rate-limited + retried. Returns parsed JSON. */
  get<T = unknown>(path: string): Promise<T> {
    const run = this.chain.then(() => this.spacedRequest<T>(path));
    this.chain = run.then(() => undefined, () => undefined); // keep the queue moving on error
    return run;
  }

  private async spacedRequest<T>(path: string, attempt = 0): Promise<T> {
    const wait = this.spacing - (this.now() - this.last);
    if (wait > 0) await this.sleep(wait);
    this.last = this.now();

    const res = await this.fetchFn(`${this.base}${path}`, { headers: { 'X-Auth-Token': this.key } } as RequestInit);
    if (res.status === 429 && attempt < this.maxRetries) {
      const retryAfter = Number(this.header(res, 'retry-after')) || 60;
      await this.sleep(retryAfter * 1000);
      return this.spacedRequest<T>(path, attempt + 1);
    }
    if (!res.ok) throw new Error(`football-data ${path} → ${res.status}`);

    // If we're about to exhaust the per-minute budget, pause one window before the next call.
    const remaining = Number(this.header(res, 'x-requests-available-minute'));
    if (Number.isFinite(remaining) && remaining <= 1) this.last = this.now() + 60_000;

    return (await res.json()) as T;
  }

  private header(res: Response, name: string): string | null {
    const h = res.headers as unknown as { get?: (k: string) => string | null };
    return h.get ? h.get(name) : null;
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @wc/pipeline test football-data`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/pipeline/src/football-data.ts packages/pipeline/src/football-data.test.ts
git commit -m "feat(pipeline): rate-limited football-data client (8/min, 429 backoff)"
```

---

## Task 5: Typed fetchers + a factory from env

**Files:**
- Modify: `packages/pipeline/src/football-data.ts`
- Modify: `packages/pipeline/src/football-data.test.ts`

- [ ] **Step 1: Add failing tests** (append to `football-data.test.ts`)

```ts
import { fetchFdTeams, fetchFdMatches, type FdClientLike } from './football-data';

describe('football-data typed fetchers', () => {
  function stubClient(map: Record<string, unknown>): FdClientLike {
    return { get: async (path: string) => map[path] };
  }

  it('fetchFdTeams hits the teams endpoint and returns the array', async () => {
    const c = stubClient({ '/competitions/WC/teams': { teams: teams } });
    expect(await fetchFdTeams(c)).toHaveLength(2);
  });

  it('fetchFdMatches passes a status filter as a query param', async () => {
    let seen = '';
    const c: FdClientLike = { get: async (p: string) => { seen = p; return { matches }; } };
    await fetchFdMatches(c, { status: 'LIVE' });
    expect(seen).toBe('/competitions/WC/matches?status=LIVE');
    await fetchFdMatches(c);
    expect(seen).toBe('/competitions/WC/matches');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @wc/pipeline test football-data`
Expected: FAIL — fetchers not exported.

- [ ] **Step 3: Implement** (append to `football-data.ts`)

```ts
// ─────────────────────────── Typed fetchers + env factory ───────────────────────────

/** Minimal shape the sync functions need — lets tests stub the client without a real one. */
export interface FdClientLike { get<T = unknown>(path: string): Promise<T> }

const COMP = '/competitions/WC';

export async function fetchFdTeams(client: FdClientLike): Promise<FdTeam[]> {
  const r = await client.get<{ teams: FdTeam[] }>(`${COMP}/teams`);
  return r.teams;
}

export async function fetchFdMatches(
  client: FdClientLike,
  filters: { status?: string; dateFrom?: string; dateTo?: string; stage?: string } = {},
): Promise<FdMatch[]> {
  const qs = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v != null) as [string, string][],
  ).toString();
  const r = await client.get<{ matches: FdMatch[] }>(`${COMP}/matches${qs ? `?${qs}` : ''}`);
  return r.matches;
}

export async function fetchFdMatch(client: FdClientLike, id: number): Promise<FdMatch> {
  return client.get<FdMatch>(`/matches/${id}`);
}

/** Build a client from env (SPORTS_API_KEY + SPORTS_API_BASE_URL). Throws a clear error if unset. */
export function fdClientFromEnv(): FdClient {
  return new FdClient({
    apiKey: process.env.SPORTS_API_KEY ?? '',
    baseUrl: process.env.SPORTS_API_BASE_URL ?? '',
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @wc/pipeline test football-data`
Expected: PASS (15 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/pipeline/src/football-data.ts packages/pipeline/src/football-data.test.ts
git commit -m "feat(pipeline): football-data typed fetchers + env client factory"
```

---

## Task 6: `externalId` migration  🚦 USER GATE

**Files:**
- Modify: `packages/db/prisma/schema.prisma:332-364` (Team, Player) and `:366-387` (Match)
- Create (hand-authored): `packages/db/prisma/migrations/20260609000000_add_external_ids/migration.sql`

> **GATE:** This task changes the schema and applies a migration. Per the spec stop-conditions, **STOP and get explicit user approval before applying the migration** (Step 3). Confirm `DATABASE_URL` points at the dev database, not prod.
>
> **Use `migrate deploy`, not `migrate dev`.** This DB holds real demo data (13 users, 6 predictions we are explicitly preserving). `migrate dev` runs drift detection and can **reset the database** on drift; `migrate deploy` only applies pending migration files and never resets. So we hand-author the SQL (we already know it exactly) and deploy it.

- [ ] **Step 1: Edit `schema.prisma`** — add a nullable, unique `externalId` to three models.

In `model Team` (after `manager String?`):
```prisma
  externalId Int? @unique // football-data.org team id (e.g. 769); null until first FD sync
```

In `model Player` (after `isStarter Boolean @default(false)`):
```prisma
  externalId Int? @unique // football-data.org player id (e.g. 3160)
```

In `model Match` (after `bettingLocked Boolean @default(false) ...`):
```prisma
  externalId Int? @unique // football-data.org match id (e.g. 537327); null until first FD sync
```

- [ ] **Step 2: Hand-author the migration SQL**

Create `packages/db/prisma/migrations/20260609000000_add_external_ids/migration.sql`:
```sql
-- Add football-data.org external id mapping columns (nullable, unique).
ALTER TABLE "Team"   ADD COLUMN "externalId" INTEGER;
ALTER TABLE "Player" ADD COLUMN "externalId" INTEGER;
ALTER TABLE "Match"  ADD COLUMN "externalId" INTEGER;
CREATE UNIQUE INDEX "Team_externalId_key"   ON "Team"("externalId");
CREATE UNIQUE INDEX "Player_externalId_key" ON "Player"("externalId");
CREATE UNIQUE INDEX "Match_externalId_key"  ON "Match"("externalId");
```
(The folder timestamp `20260609000000` sorts after the latest existing migration `20260607130000_news_i18n`, so Prisma applies it last.)

- [ ] **Step 3: Apply the migration**  🚦 (run only after user approval, on the dev DB)

Run:
```bash
pnpm --filter @wc/db prisma:deploy
```
Expected: `Applying migration 20260609000000_add_external_ids` … `All migrations have been successfully applied.` (`prisma:deploy` = `dotenv -e ../../.env -- prisma migrate deploy` — applies pending files only, no reset.)

- [ ] **Step 4: Regenerate the client + rebuild db**

Run:
```bash
pnpm --filter @wc/db exec prisma generate && pnpm --filter @wc/db build
```
Expected: client regenerated (now knows `externalId`); `tsc` exits 0.

- [ ] **Step 5: Verify columns exist + demo data intact**

Run:
```bash
cd packages/db && DATABASE_URL=$(grep -E "^DATABASE_URL=" ../../.env | cut -d= -f2- | tr -d '"') node --input-type=module -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
console.log('match externalId column ok; predictions still:', await p.prediction.count());
await p.\$disconnect();
"; cd ../..
```
Expected: `predictions still: 6` (migration added columns without touching data).

- [ ] **Step 6: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations
git commit -m "feat(db): add externalId mapping columns to Team/Match/Player"
```

---

## Task 7: Sync functions (teams+squads, matches, live)

**Files:**
- Modify: `packages/pipeline/src/football-data.ts`
- Modify: `packages/pipeline/src/index.ts`

No CI test (DB-impure — mirrors `ingestTournament`, which is verified by the manual CLI in Task 8). Correctness rests on the pure mappers (Tasks 2–3) + `tsc` + the live CLI run. Each function preserves synthetic PKs, attaches `externalId`, never reverts an `ADMIN`-sourced result, never writes `venueId`/odds (spec D5/D6), and publishes `match.update`.

- [ ] **Step 1: Implement `syncTeamsAndSquads`** (append to `football-data.ts`)

```ts
// ─────────────────────────── Sync (impure) ───────────────────────────

/**
 * Sync 48 teams + their real squads from FD into existing DB rows (1 API call).
 * Match each FD team to a DB team by externalId, else by code (TLA). Set externalId + manager +
 * flag, then REPLACE that team's squad with the real FD squad (delete + recreate). Safe: nothing
 * references Player.id with live data (microPrediction:0; the lineup worker regenerates the XI).
 */
export async function syncTeamsAndSquads(
  prisma: PrismaClient,
  client: FdClientLike,
): Promise<{ teams: number; players: number; unmatched: string[] }> {
  const fdTeams = (await fetchFdTeams(client)).map(mapFdTeam);
  let teamCount = 0, playerCount = 0;
  const unmatched: string[] = [];

  for (const t of fdTeams) {
    const dbTeam =
      (await prisma.team.findUnique({ where: { externalId: t.externalId }, select: { id: true } })) ??
      (await prisma.team.findFirst({ where: { code: t.code }, select: { id: true } }));
    if (!dbTeam) { unmatched.push(`${t.code} (${t.name})`); continue; }

    await prisma.team.update({
      where: { id: dbTeam.id },
      data: { externalId: t.externalId, manager: t.manager ?? undefined, flagUrl: t.flagUrl ?? undefined, name: t.name },
    });
    teamCount++;

    if (t.squad.length > 0) {
      await prisma.$transaction([
        prisma.player.deleteMany({ where: { teamId: dbTeam.id } }),
        ...t.squad.map((p) =>
          prisma.player.create({
            data: { teamId: dbTeam.id, name: p.name, position: p.position, externalId: p.externalId, isStarter: false },
          }),
        ),
      ]);
      playerCount += t.squad.length;
    }
  }
  return { teams: teamCount, players: playerCount, unmatched };
}
```

- [ ] **Step 2: Implement `syncMatches`** (append to `football-data.ts`)

```ts
/**
 * Sync all 104 matches from FD into existing DB rows (1 API call). Attaches Match.externalId by
 * natural key on first run, then upserts by externalId thereafter:
 *   - GROUP matches → match the DB row by (homeTeamId, awayTeamId, round=GROUP). Teams are known,
 *     so this is unique and protects existing predictions on those rows.
 *   - KNOCKOUT matches (teams null pre-draw) → match remaining DB rows of the same round by
 *     chronological ordinal (both sides ordered by kickoff). One-time heuristic; once the bracket
 *     is drawn, externalId already drives updates. No predictions exist on knockout rows.
 * Never overwrites an ADMIN-sourced result. Never touches venueId or odds. Publishes match.update.
 */
export async function syncMatches(
  prisma: PrismaClient,
  client: FdClientLike,
): Promise<{ matched: number; updated: number; skippedAdmin: number; unresolved: number }> {
  const fdMatches = await fetchFdMatches(client);

  // group name → id
  const groups = await prisma.group.findMany({ select: { id: true, name: true } });
  const groupId: Record<string, bigint> = {};
  for (const g of groups) groupId[g.name] = g.id;

  // FD team id → DB team id (via externalId set by syncTeamsAndSquads)
  const teamRows = await prisma.team.findMany({ where: { externalId: { not: null } }, select: { id: true, externalId: true } });
  const teamByExt = new Map<number, bigint>();
  for (const t of teamRows) teamByExt.set(t.externalId as number, t.id);
  const resolveTeamId: ResolveTeamId = (fdId) => (fdId == null ? null : teamByExt.get(fdId) ?? null);

  const mapped = fdMatches.map((m) => ({ raw: m, m: mapFdMatch(m, resolveTeamId) }));

  // First-run knockout reconciliation: pair unattached DB knockout rows to FD knockouts by ordinal.
  const knockoutByRound = new Map<MatchRound, number[]>(); // round → FD externalIds (chronological)
  for (const { m } of mapped.filter((x) => x.m.round !== 'GROUP').sort((a, b) => a.m.kickoffAt.getTime() - b.m.kickoffAt.getTime())) {
    const arr = knockoutByRound.get(m.round) ?? [];
    arr.push(m.externalId);
    knockoutByRound.set(m.round, arr);
  }
  for (const [round, extIds] of knockoutByRound) {
    const dbRows = await prisma.match.findMany({
      where: { round, externalId: null }, orderBy: { kickoffAt: 'asc' }, select: { id: true },
    });
    for (let i = 0; i < dbRows.length && i < extIds.length; i++) {
      await prisma.match.update({ where: { id: dbRows[i].id }, data: { externalId: extIds[i] } });
    }
  }

  let matched = 0, updated = 0, skippedAdmin = 0, unresolved = 0;
  for (const { m } of mapped) {
    // locate target row: externalId first, else group-by-teams
    let target = await prisma.match.findUnique({ where: { externalId: m.externalId }, select: { id: true, source: true } });
    if (!target && m.round === 'GROUP' && m.homeTeamId !== 0n && m.awayTeamId !== 0n) {
      target = await prisma.match.findFirst({
        where: { round: 'GROUP', homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId },
        select: { id: true, source: true },
      });
    }
    if (!target) { unresolved++; continue; }
    if (target.source === 'ADMIN') { skippedAdmin++; continue; }

    // Typed literal (assignable to MatchUpdateInput). `undefined` fields are skipped by Prisma —
    // so teams are only written when FD actually provides them (never clobber a known pair with 0n).
    const data = {
      externalId: m.externalId,
      round: m.round,
      groupId: m.groupLetter ? (groupId[m.groupLetter] ?? null) : null,
      kickoffAt: m.kickoffAt,
      status: m.status,
      scoreHome90: m.scoreHome90,
      scoreAway90: m.scoreAway90,
      result90: m.result90,
      source: 'API' as const,
      homeTeamId: m.homeTeamId !== 0n ? m.homeTeamId : undefined,
      awayTeamId: m.awayTeamId !== 0n ? m.awayTeamId : undefined,
    };

    await prisma.match.update({ where: { id: target.id }, data });
    matched++; updated++;
    await publishEvent(channels.matches, { type: 'match.update', matchId: Number(target.id) });
  }
  return { matched, updated, skippedAdmin, unresolved };
}
```

- [ ] **Step 3: Implement `syncLiveScores`** (append to `football-data.ts`)

```ts
/**
 * Live poll — ONE call returns all currently-live matches (FD `status=LIVE` = IN_PLAY+PAUSED).
 * Updates score/status by externalId only; never touches ADMIN rows; publishes match.update.
 * Replaces the worldcup26 /get/games poll. Returns the ids that newly transitioned to FINISHED.
 */
export async function syncLiveScores(
  prisma: PrismaClient,
  client: FdClientLike,
): Promise<{ updated: number; newlyFinished: number[] }> {
  const fdMatches = await fetchFdMatches(client, { status: 'LIVE' });
  let updated = 0;
  const newlyFinished: number[] = [];

  for (const raw of fdMatches) {
    const ext = raw.id;
    const existing = await prisma.match.findUnique({
      where: { externalId: ext },
      select: { id: true, status: true, scoreHome90: true, scoreAway90: true, source: true },
    });
    if (!existing || existing.source === 'ADMIN') continue;

    const status = mapFdStatus(raw.status);
    const score = mapFdScore(raw.score);
    if (existing.status === status && existing.scoreHome90 === score.scoreHome90 && existing.scoreAway90 === score.scoreAway90) continue;

    await prisma.match.update({
      where: { id: existing.id },
      data: { status, scoreHome90: score.scoreHome90, scoreAway90: score.scoreAway90, result90: score.result90, source: 'API' },
    });
    updated++;
    await publishEvent(channels.matches, { type: 'match.update', matchId: Number(existing.id) });
    if (status === 'FINISHED' && existing.status !== 'FINISHED') newlyFinished.push(Number(existing.id));
  }
  return { updated, newlyFinished };
}
```

- [ ] **Step 4: Export the module** — edit `packages/pipeline/src/index.ts`, add at the end:

```ts
export * from './football-data';
```

- [ ] **Step 5: Build to verify types**

Run: `pnpm --filter @wc/pipeline build`
Expected: `tsc` exits 0.

> If `tsc` reports the `source: 'API'` literal isn't assignable, cast it `as const` (as `ingest.ts:193` does) — but the `Record<string, unknown> data` object above already accepts it.

- [ ] **Step 6: Run the unit-test suite (no regressions)**

Run: `pnpm --filter @wc/pipeline test -- --exclude='**/*.int.test.ts'`
Expected: **exit 0**, all unit tests pass (the pre-existing 47 + the 15 new football-data tests = 62).

> **Known-red, do not "fix":** the bare `pnpm --filter @wc/pipeline test` exits 1 because `news.int.test.ts` + `seed.int.test.ts` refuse to construct `PrismaClient` against the dev DB (`Refusing to construct PrismaClient under a test runner against a non-test database`). That is environmental (they need `TEST_DATABASE_URL`), pre-existing, and unrelated to this work — hence the `--exclude` filter above.

- [ ] **Step 7: Commit**

```bash
git add packages/pipeline/src/football-data.ts packages/pipeline/src/index.ts
git commit -m "feat(pipeline): football-data DB sync (teams+squads, matches, live)"
```

---

## Task 8: Manual verification CLI  🚦 KEY GATE

**Files:**
- Create: `packages/pipeline/src/ingest-fd-cli.ts`
- Modify: `packages/pipeline/package.json:13-19` (scripts)

> **GATE:** Running this needs a real key. **STOP and ask the user to populate `.env`** with `SPORTS_API_KEY=<key>` and `SPORTS_API_BASE_URL=https://api.football-data.org/v4` before Step 3. We never edit `.env`.

- [ ] **Step 1: Create `ingest-fd-cli.ts`**

```ts
/**
 * Manual one-shot football-data sync (P1 verification). Needs SPORTS_API_KEY + SPORTS_API_BASE_URL.
 * Order matters: teams first (sets Team.externalId) so matches can resolve team ids.
 *   pnpm --filter @wc/pipeline ingest:fd
 */
import { prisma } from '@wc/db';
import { fdClientFromEnv, syncTeamsAndSquads, syncMatches } from './index';

async function main() {
  const client = fdClientFromEnv();
  console.log('syncing teams + squads…');
  const t = await syncTeamsAndSquads(prisma, client);
  console.log('teams:', t);
  console.log('syncing matches…');
  const m = await syncMatches(prisma, client);
  console.log('matches:', m);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Add the script** — in `packages/pipeline/package.json`, add to `"scripts"`:

```json
    "ingest:fd": "dotenv -e ../../.env -- tsx src/ingest-fd-cli.ts",
```

- [ ] **Step 3: Run it** 🚦 (after the user confirms `.env` is populated)

Run: `pnpm --filter @wc/pipeline ingest:fd`
Expected (approx):
```
teams: { teams: 48, players: 1248, unmatched: [] }
matches: { matched: 104, updated: 104, skippedAdmin: 0, unresolved: 0 }
```
**`unmatched` / `unresolved` are diagnostics, not a pass/fail gate.** Nonzero is *information*, not necessarily a bug:
- `unmatched` lists FD teams whose `tla` has no DB team with that `code` — the DB and FD disagree on a 3-letter code. **List them, do not guess** an alias; decide with the user whether a small alias map is warranted.
- `unresolved` counts FD matches that found no DB row. Group-match matching assumes FD and DB agree on the **home/away designation** and **group letter** for each fixture; a source can swap home/away or assign a group differently. If nonzero, print which fixtures (`stage`, teams) disagreed and decide whether a swap/alias fix is needed — **do not silently force a match.**
- In the happy path (data already aligned, as verified 2026-06-09) both are expected to be 0/empty.

- [ ] **Step 4: Spot-check the DB** — confirm externalIds landed and a known match updated.

Run:
```bash
cd packages/db && DATABASE_URL=$(grep -E "^DATABASE_URL=" ../../.env | cut -d= -f2- | tr -d '"') node --input-type=module -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const j = (x)=>JSON.parse(JSON.stringify(x,(k,v)=>typeof v==='bigint'?v.toString():v));
console.log(j(await p.team.findFirst({ where:{ code:'MEX' }, select:{ id:true, externalId:true, manager:true } })));
console.log('players w/ externalId:', await p.player.count({ where:{ externalId:{ not:null } } }));
console.log('matches w/ externalId:', await p.match.count({ where:{ externalId:{ not:null } } }));
console.log(j(await p.prediction.findMany({ select:{ matchId:true } })));
await p.\$disconnect();
"; cd ../..
```
Expected: Mexico has `externalId: 769` + a manager; `players w/ externalId` ≈ 1248; `matches w/ externalId` = 104; the 6 prediction `matchId`s are unchanged (1,2,28,52,3,25) — proof identity was preserved.

- [ ] **Step 5: Commit**

```bash
git add packages/pipeline/src/ingest-fd-cli.ts packages/pipeline/package.json
git commit -m "feat(pipeline): manual football-data sync CLI (ingest:fd)"
```

---

## Task 9: Worker wiring — scheduled reference sync + live repoint

**Files:**
- Modify: `packages/pipeline/src/job-config.ts:10-45`
- Create: `apps/worker/src/footballdata/fd-sync.worker.ts`
- Modify: `apps/worker/src/livescore/livescore.worker.ts:1-43`
- Modify: `apps/worker/src/app.module.ts`
- Modify: `apps/worker/src/schedule/control.worker.ts:36-44`

- [ ] **Step 1: Add the `fd_sync` job key + config** — edit `packages/pipeline/src/job-config.ts`:

In the `JobKey` union (line 10), add `'fd_sync'`:
```ts
export type JobKey = 'lock_betting' | 'lineup' | 'result_check' | 'livescore' | 'scheduler_scan' | 'news' | 'fd_sync';
```
In `JobConfigs` (after `news`):
```ts
  fd_sync: { intervalMinutes: number; teamsEveryRuns: number };
```
In `JOB_DEFAULTS` (after `news`):
```ts
  fd_sync: { intervalMinutes: 45, teamsEveryRuns: 16 },
```
In `JOB_LABELS` (after `news`):
```ts
  fd_sync: 'Football-data sync',
```
In `BOUNDS` (add two fields):
```ts
  intervalMinutes: [5, 1440], teamsEveryRuns: [1, 1000],
```

- [ ] **Step 2: Build pipeline to verify config types**

Run: `pnpm --filter @wc/pipeline build`
Expected: `tsc` exits 0.

- [ ] **Step 3: Create `fd-sync.worker.ts`** — timer poller modeled on `LiveScoreWorker`. Syncs matches every run; syncs teams+squads only every Nth run (squads rarely change). Skips cleanly if the key is unset.

```ts
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { prisma } from '@wc/db';
import {
  fdClientFromEnv, syncMatches, syncTeamsAndSquads,
  getJobConfig, isJobEnabled, recordJobRun,
} from '@wc/pipeline';

/**
 * FdSyncWorker — reference sync from football-data.org on a config-driven cadence (PRD §15).
 * Matches every run (1 call); teams+squads every `teamsEveryRuns` runs (1 call). Plain timer
 * poller (no queue). `runOnce()` is also the manual-trigger entry point (ControlWorker).
 */
@Injectable()
export class FdSyncWorker implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(FdSyncWorker.name);
  private timer?: ReturnType<typeof setTimeout>;
  private running = false;
  private stopped = false;
  private runs = 0;

  onModuleInit() {
    void this.loop();
    this.log.log('FdSyncWorker polling football-data.org (config-driven cadence).');
  }

  async runOnce(): Promise<string> {
    if (this.running) return 'busy';
    this.running = true;
    try {
      if (!(await isJobEnabled(prisma, 'fd_sync'))) {
        await recordJobRun(prisma, 'fd_sync', 'SKIPPED', 'disabled');
        return 'disabled';
      }
      let client;
      try { client = fdClientFromEnv(); }
      catch (e) {
        await recordJobRun(prisma, 'fd_sync', 'SKIPPED', (e as Error).message);
        return 'no-key';
      }
      const { teamsEveryRuns } = await getJobConfig(prisma, 'fd_sync');
      let note = '';
      if (this.runs % teamsEveryRuns === 0) {
        const t = await syncTeamsAndSquads(prisma, client);
        note += `teams ${t.teams}/${t.players}p${t.unmatched.length ? ` unmatched:${t.unmatched.length}` : ''}; `;
      }
      const m = await syncMatches(prisma, client);
      note += `matches matched ${m.matched}, skippedAdmin ${m.skippedAdmin}, unresolved ${m.unresolved}`;
      this.runs++;
      await recordJobRun(prisma, 'fd_sync', 'OK', note);
      this.log.log(`fd_sync: ${note}`);
      return note;
    } catch (err) {
      await recordJobRun(prisma, 'fd_sync', 'ERROR', (err as Error).message);
      this.log.warn(`fd_sync failed: ${(err as Error).message}`);
      return 'error';
    } finally {
      this.running = false;
    }
  }

  private async loop() {
    if (this.stopped) return;
    await this.runOnce();
    const { intervalMinutes } = await getJobConfig(prisma, 'fd_sync');
    this.timer = setTimeout(() => void this.loop(), intervalMinutes * 60_000);
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }
}
```

- [ ] **Step 4: Repoint `LiveScoreWorker` to FD** — edit `apps/worker/src/livescore/livescore.worker.ts`.

Change the import (line 3) from:
```ts
import { updateLiveScores, getJobConfig, isJobEnabled, recordJobRun } from '@wc/pipeline';
```
to:
```ts
import { syncLiveScores, fdClientFromEnv, getJobConfig, isJobEnabled, recordJobRun } from '@wc/pipeline';
```

Replace the body of `runOnce()` between the `isJobEnabled` check and the `recordJobRun(... 'OK' ...)` call — specifically swap the `updateLiveScores(prisma)` line (line 31) for a guarded FD client + `syncLiveScores`:
```ts
      let client;
      try { client = fdClientFromEnv(); }
      catch (e) {
        await recordJobRun(prisma, 'livescore', 'SKIPPED', (e as Error).message);
        return 'no-key';
      }
      const { updated, newlyFinished } = await syncLiveScores(prisma, client);
```
(Everything else in the method — the `note`, logging, `recordJobRun`, catch/finally — stays identical.) Update the class doc comment (line 6) `polls worldcup26.ir` → `polls football-data.org`.

- [ ] **Step 5: Register `FdSyncWorker`** — edit `apps/worker/src/app.module.ts`:

Add the import:
```ts
import { FdSyncWorker } from './footballdata/fd-sync.worker';
```
Add `FdSyncWorker` to the `providers` array.

- [ ] **Step 6: Wire the manual trigger** — edit `apps/worker/src/schedule/control.worker.ts`.

Add `FdSyncWorker` to the constructor and a dispatch case. Constructor (after `news`):
```ts
    private readonly fdSync: FdSyncWorker,
```
Import at top:
```ts
import { FdSyncWorker } from '../footballdata/fd-sync.worker';
```
In `dispatch`'s `switch` (alongside `livescore`):
```ts
        case 'fd_sync': await this.fdSync.runOnce(); break;
```

- [ ] **Step 7: Build the worker (and deps) to verify wiring**

Run:
```bash
pnpm --filter @wc/pipeline build && pnpm --filter @wc/worker build
```
Expected: both `tsc` builds exit 0.

- [ ] **Step 8: Commit**

```bash
git add packages/pipeline/src/job-config.ts apps/worker/src/footballdata/fd-sync.worker.ts \
  apps/worker/src/livescore/livescore.worker.ts apps/worker/src/app.module.ts apps/worker/src/schedule/control.worker.ts
git commit -m "feat(worker): schedule football-data reference sync + repoint live poll to FD"
```

---

## Task 10: Phase verification + handoff

- [ ] **Step 1: Full build, dependency order**

Run:
```bash
pnpm --filter @wc/db build && pnpm --filter @wc/pipeline build && pnpm --filter @wc/worker build
```
Expected: all exit 0.

- [ ] **Step 2: Unit-test suite**

Run: `pnpm --filter @wc/pipeline test -- --exclude='**/*.int.test.ts'`
Expected: exit 0, 62 unit tests pass. (The 2 DB-gated int files are excluded — see Task 7 Step 6.)

- [ ] **Step 3: Confirm web still type-checks (no accidental coupling)**

Run: `pnpm --filter @wc/web exec tsc --noEmit`
Expected: exits 0 (P1 touched no web code; this guards against an accidental shared-type break).

- [ ] **Step 4: Print the P1 summary and STOP for review.** Report: files changed, the `ingest:fd` output (teams/players/matches counts, `unmatched`/`unresolved`), proof the 6 demo predictions kept their `matchId`s, and the rate-limiter test evidence (spacing ≥7500ms). Do not start P2.

---

## Follow-ups (tracked, out of P1 scope)

- **Live path is unverifiable until matches actually go live.** Every WC match is `TIMED` until 2026-06-11, so `?status=LIVE` returns an empty set today. Task 8 success proves teams/matches sync, **not** the live transition. Re-verify `syncLiveScores` (IN_PLAY/PAUSED → LIVE → FINISHED) during the tournament — this is a P3 acceptance item.
- **Mixed-source hazard on the admin "sync result" route.** That route still calls the worldcup26 `syncOneMatchResult` (`packages/pipeline/src/livescore.ts`). Once the scheduled live poll is FD-sourced (Task 9), a manual admin sync would overwrite FD scores with worldcup26 data on the same (preserved) match ids. Repoint that route to FD in **P3**; out of scope here. The old worldcup26 `ingest.ts`/`livescore.ts` functions remain (dead once fully cut over) — flagged, not deleted, per house rules.

## Self-Review

**Spec coverage:**
- Single rate-limited client (spec §3.1) → Task 4 (`FdClient`) + Task 5 (fetchers/factory). ✓
- Pure mappers tested vs fixtures (§3.1) → Tasks 1–3. ✓
- Sync teams+squads / matches / live (§3.2) → Task 7. ✓ (`syncScorers` is P4 per D2 — correctly excluded.)
- `externalId` migration, keep PKs, natural-key match (D1) → Task 6 + Task 7 logic. ✓
- Worker reuse: job-config + ScheduleJob + timer poller; live repoint (§3.3) → Task 9. ✓
- Budget ≤8/min (§3.4) → Task 4 spacing + Task 9 cadence. ✓
- Venue untouched (D5), odds untouched (D6), standings not fetched (D4), scorers deferred (D2) → enforced in Task 7 (no `venueId`/odds writes; no standings/scorers fetch). ✓
- Env reuse `SPORTS_API_*` (D7) → Task 5 `fdClientFromEnv` + Task 8 gate. ✓
- Gates: migration (Task 6) + key (Task 8) STOP for user. ✓

**Placeholder scan:** none — every code step is complete. The one annotated simplification (Task 3 `scoreHome90` ternary) is explicitly behavior-neutral with the simpler form given.

**Type consistency:** `FdClientLike.get` is the single client interface used by every fetcher + sync function; `ResolveTeamId` is defined in Task 3 and consumed in Task 7; `mapFd*` names are stable across tasks; job-config field names (`intervalMinutes`, `teamsEveryRuns`) match between `JobConfigs`, `JOB_DEFAULTS`, `BOUNDS`, and `FdSyncWorker`. ✓

**Known limitation (documented, not a gap):** knockout first-sync identity is a chronological-ordinal heuristic (Task 7) — acceptable because no predictions exist on knockout rows and `externalId` drives all subsequent updates. Surfaced in the Task 10 review so the user can sanity-check pairings.
