# Admin Manual-Sync + Richer Match Detail Pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add admin on-demand sync (result/odds/lineup) + bet-exposure + audit to a richer admin match-detail page (Phase A), and a real Lineups tab on the user match-detail page (Phase B).

**Architecture:** Thin Next.js route handlers reuse existing services — `syncOneMatchResult` (new, in `@wc/pipeline`, wraps the existing `liveScoreUpdate`), `createGatewayFromEnv` + `refreshMatchLineups` for AI lineup, `MatchOdds` upsert for odds, `AuditLog` for trail, `prisma.prediction` aggregation for exposure. UI reuses `FormationPitch`. No schema change, no new external deps/keys.

**Tech Stack:** Next.js 15 route handlers, Prisma/PostgreSQL, React 19 client components, Vitest (jsdom for components, node for pipeline), worldcup26.ir feed, 9router LLM gateway.

**Execution cadence:** One phase per run → verify → STOP for review (matches this session's workflow). Phase A then Phase B.

---

## File structure

**Phase A — create:**
- `apps/web/app/api/v1/admin/matches/[id]/sync-result/route.ts`
- `apps/web/app/api/v1/admin/matches/[id]/odds/route.ts`
- `apps/web/app/api/v1/admin/matches/[id]/sync-lineup/route.ts`
- `apps/web/app/api/v1/admin/matches/[id]/bets/route.ts`
- `apps/web/app/api/v1/admin/matches/[id]/audit/route.ts`

**Phase A — modify:**
- `packages/pipeline/src/livescore.ts` (+ `livescore.test.ts`) — add `syncOneMatchResult`.
- `apps/web/components/screens-admin.tsx` — richer `AdmMatchDetail` (sync panel, exposure, lineups, audit) + restore `OddsEditModal` (real route).
- `apps/web/components/screens-admin.test.tsx` — cover the new panels.

**Phase B — modify:**
- `apps/web/components/screens-match.tsx` — real Lineups tab, drop Form/H2H, enrich hero.
- `apps/web/components/screens-match.test.tsx` — cover the Lineups tab.

**Reused as-is:** `apps/web/components/formation-pitch.tsx` (`FormationPitch`), `@wc/ai` `createGatewayFromEnv`, `@wc/pipeline` `refreshMatchLineups`/`liveScoreUpdate`, `@/lib/session` `requireAdmin`, `@/lib/db` `prisma`.

---

# PHASE A — Admin manual-sync + richer admin detail

## Task A1: `syncOneMatchResult` in pipeline (TDD)

**Files:**
- Modify: `packages/pipeline/src/livescore.ts`
- Test: `packages/pipeline/src/livescore.test.ts`

- [ ] **Step 1: Write the failing test** — append to `livescore.test.ts`:

```ts
import { liveScoreUpdate, updateLiveScores, syncOneMatchResult } from './livescore';
// (extend the existing import line — add syncOneMatchResult)

describe('syncOneMatchResult', () => {
  it('writes the feed score/status for one match (source API)', async () => {
    const updates: { id: number; data: Record<string, unknown> }[] = [];
    const fakePrisma = {
      match: { update: async ({ where, data }: { where: { id: bigint }; data: Record<string, unknown> }) => { updates.push({ id: Number(where.id), data }); return {}; } },
    } as unknown as import('@wc/db').PrismaClient;
    const fetchJson = (async () => ({
      games: [game({ id: '7', finished: 'TRUE', home_score: '2', away_score: '1' })],
    })) as unknown as Parameters<typeof syncOneMatchResult>[2];

    const res = await syncOneMatchResult(fakePrisma, 7n, fetchJson);
    expect(res).toMatchObject({ updated: true, status: 'FINISHED', scoreHome90: 2, scoreAway90: 1 });
    expect(updates[0].id).toBe(7);
    expect(updates[0].data).toMatchObject({ status: 'FINISHED', scoreHome90: 2, scoreAway90: 1, result90: 'HOME', source: 'API' });
  });

  it('throws when the match is not in the feed', async () => {
    const fakePrisma = { match: { update: async () => ({}) } } as unknown as import('@wc/db').PrismaClient;
    const fetchJson = (async () => ({ games: [game({ id: '1' })] })) as unknown as Parameters<typeof syncOneMatchResult>[2];
    await expect(syncOneMatchResult(fakePrisma, 999n, fetchJson)).rejects.toThrow('MATCH_NOT_IN_FEED');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @wc/pipeline exec vitest run src/livescore.test.ts`
Expected: FAIL — `syncOneMatchResult is not a function`.

- [ ] **Step 3: Implement** — add to `packages/pipeline/src/livescore.ts` (after `updateLiveScores`):

```ts
/** Sync ONE match's score/status from the feed on demand (admin "sync result"). Throws if the
 *  match id isn't in the feed. Does NOT settle — settlement stays the admin confirm/resettle path. */
export async function syncOneMatchResult(
  prisma: PrismaClient,
  matchId: bigint,
  fetchJson: FetchJson = defaultFetch,
): Promise<{ updated: boolean; status: MatchStatus; scoreHome90: number | null; scoreAway90: number | null }> {
  const games = ((await fetchJson('games')) as { games: WcGame[] }).games;
  const g = games.find((x) => BigInt(x.id) === matchId);
  if (!g) throw new Error('MATCH_NOT_IN_FEED');
  const u = liveScoreUpdate(g);
  await prisma.match.update({
    where: { id: matchId },
    data: { status: u.status, scoreHome90: u.scoreHome90, scoreAway90: u.scoreAway90, result90: u.result90, source: 'API' },
  });
  return { updated: true, status: u.status, scoreHome90: u.scoreHome90, scoreAway90: u.scoreAway90 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @wc/pipeline exec vitest run src/livescore.test.ts`
Expected: PASS (all livescore tests).

- [ ] **Step 5: Build pipeline (web imports dist)**

Run: `pnpm --filter @wc/pipeline build`
Expected: tsc success, no output errors.

- [ ] **Step 6: Commit**

```bash
git add packages/pipeline/src/livescore.ts packages/pipeline/src/livescore.test.ts
git commit -m "feat(pipeline): syncOneMatchResult — on-demand single-match feed sync"
```

---

## Task A2: `sync-result` admin route

**Files:**
- Create: `apps/web/app/api/v1/admin/matches/[id]/sync-result/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextResponse } from 'next/server';
import { syncOneMatchResult } from '@wc/pipeline';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';

// POST /api/v1/admin/matches/[id]/sync-result — pull this match's score/status from the worldcup26
// feed on demand. Does NOT settle (admin confirms via resettle). Writes source=API + audit.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const { id } = await params;
  try {
    const r = await syncOneMatchResult(prisma, BigInt(id));
    await prisma.auditLog.create({
      data: { actorType: 'ADMIN', actorId: admin.id, action: 'SYNC_RESULT', target: `match:${id}`, metadata: { status: r.status, score: `${r.scoreHome90 ?? '-'}-${r.scoreAway90 ?? '-'}` } },
    });
    return NextResponse.json({ data: r });
  } catch (e) {
    const code = (e as Error).message === 'MATCH_NOT_IN_FEED' ? 'MATCH_NOT_IN_FEED' : 'SYNC_FAILED';
    return NextResponse.json({ error: { code } }, { status: code === 'MATCH_NOT_IN_FEED' ? 404 : 502 });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @wc/web exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/api/v1/admin/matches/[id]/sync-result/route.ts"
git commit -m "feat(admin): POST sync-result — on-demand feed result sync"
```

---

## Task A3: `odds` admin route + restore `OddsEditModal`

**Files:**
- Create: `apps/web/app/api/v1/admin/matches/[id]/odds/route.ts`
- Modify: `apps/web/components/screens-admin.tsx`

- [ ] **Step 1: Create the odds route**

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

const Schema = z.object({
  mHome: z.coerce.number().positive(),
  mDraw: z.coerce.number().positive(),
  mAway: z.coerce.number().positive(),
  reason: z.string().min(1),
});

// POST /api/v1/admin/matches/[id]/odds — admin sets house odds (source=ADMIN). Open bets keep their snapshot.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } }, { status: 422 });
  const { id } = await params;
  const { mHome, mDraw, mAway, reason } = parsed.data;

  await prisma.matchOdds.upsert({
    where: { matchId: BigInt(id) },
    update: { mHome, mDraw, mAway, source: 'ADMIN' },
    create: { matchId: BigInt(id), mHome, mDraw, mAway, source: 'ADMIN' },
  });
  await prisma.auditLog.create({
    data: { actorType: 'ADMIN', actorId: admin.id, action: 'EDIT_ODDS', target: `match:${id}`, metadata: { mHome, mDraw, mAway, reason } },
  });
  return NextResponse.json({ data: { mHome, mDraw, mAway } });
}
```

- [ ] **Step 2: Add a real `OddsEditModal` to `screens-admin.tsx`** (place just before `AdmMatchDetail`). This replaces the removed mock version (now takes label props + posts to the real route):

```tsx
function OddsEditModal({ m, onClose, onSaved, s }: { m: AdmMatchFull; onClose: () => void; onSaved: () => void; s: ScreenProps['s'] }) {
  const [mh, setMh] = useState(m.odds?.mHome ?? 1.8);
  const [md, setMd] = useState(m.odds?.mDraw ?? 2.3);
  const [ma, setMa] = useState(m.odds?.mAway ?? 2.0);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const num = (v: number, set: (n: number) => void) => (
    <input className="input input-mono" type="number" step="0.01" min="0.1" value={v}
      onChange={e => set(Math.max(0.1, +e.target.value || 0.1))} style={{ textAlign: 'center', fontSize: 18 }} />
  );
  const margin = ((1 / (1 + mh)) + (1 / (1 + md)) + (1 / (1 + ma))) * 100 - 100;
  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/admin/matches/${m.id}/odds`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mHome: mh, mDraw: md, mAway: ma, reason }) });
      setBusy(false);
      if (res.ok) { s.toastMsg('Odds updated', 'check', 'var(--sky)'); onSaved(); }
      else s.toastMsg('Could not update odds', 'alert', 'var(--danger)');
    } catch { setBusy(false); s.toastMsg('Network error', 'alert', 'var(--danger)'); }
  };
  return (
    <Portal><div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="card-pad-lg">
          <div className="row between"><span className="eyebrow">Adjust odds</span><button className="btn-icon" onClick={onClose}><Icon name="x" size={18} /></button></div>
          <div className="row gap-8 mt-8 small">{m.home?.code} v {m.away?.code}</div>
          <div className="row gap-10 mt-16">
            <div className="field" style={{ flex: 1 }}><label className="label" style={{ textAlign: 'center' }}>1 · {m.home?.code}</label>{num(mh, setMh)}</div>
            <div className="field" style={{ flex: 1 }}><label className="label" style={{ textAlign: 'center' }}>X · Draw</label>{num(md, setMd)}</div>
            <div className="field" style={{ flex: 1 }}><label className="label" style={{ textAlign: 'center' }}>2 · {m.away?.code}</label>{num(ma, setMa)}</div>
          </div>
          <div className="card-2 card-pad mt-16 row between small" style={{ borderRadius: 'var(--r-sm)' }}>
            <span className="t2">Implied book margin</span>
            <span className="tnum" style={{ fontWeight: 700, color: Math.abs(margin) > 12 ? 'var(--gold)' : 'var(--green)' }}>{margin.toFixed(1)}%</span>
          </div>
          <div className="field mt-12"><label className="label">Reason (audit)</label><input className="input" placeholder="e.g. injury news / sharp money" value={reason} onChange={e => setReason(e.target.value)} /></div>
          <Btn variant="primary" size="lg" className="btn-block mt-16" disabled={!reason.trim() || busy} onClick={save}>{busy ? 'Saving…' : 'Publish new odds'}</Btn>
          <p className="tiny muted mt-8" style={{ textAlign: 'center' }}>Existing open bets keep the odds they were placed at.</p>
        </div>
      </div>
    </div></Portal>
  );
}
```

- [ ] **Step 3: Typecheck** (modal is wired into `AdmMatchDetail` in Task A7; this step just confirms it compiles as defined — temporarily it's unused, which is fine for tsc).

Run: `pnpm --filter @wc/web exec tsc --noEmit`
Expected: no errors (an unused function is allowed; if `noUnusedLocals` complains, proceed to A7 which uses it, then re-check).

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/api/v1/admin/matches/[id]/odds/route.ts" apps/web/components/screens-admin.tsx
git commit -m "feat(admin): odds editor route + real OddsEditModal"
```

---

## Task A4: `sync-lineup` admin route

**Files:**
- Create: `apps/web/app/api/v1/admin/matches/[id]/sync-lineup/route.ts`

- [ ] **Step 1: Create the route** (mirrors `admin/teams/[id]/recrawl`):

```ts
import { NextResponse } from 'next/server';
import { createGatewayFromEnv } from '@wc/ai';
import { refreshMatchLineups } from '@wc/pipeline';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';

// POST /api/v1/admin/matches/[id]/sync-lineup — AI re-crawl the projected XI for both teams (~20s).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const { id } = await params;
  const gw = createGatewayFromEnv(process.env as Record<string, string | undefined>);
  if (!gw) return NextResponse.json({ error: { code: 'NO_GATEWAY' } }, { status: 503 });

  const results = await refreshMatchLineups(prisma, gw, BigInt(id));
  await prisma.auditLog.create({
    data: { actorType: 'ADMIN', actorId: admin.id, action: 'SYNC_LINEUP', target: `match:${id}`, metadata: { teams: results } },
  });
  if (results.length === 0) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
  if (results.every((r) => r.status === 'error')) return NextResponse.json({ error: { code: 'CRAWL_FAILED' } }, { status: 502 });
  return NextResponse.json({ data: results });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @wc/web exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/api/v1/admin/matches/[id]/sync-lineup/route.ts"
git commit -m "feat(admin): sync-lineup route — on-demand AI XI re-crawl for both teams"
```

---

## Task A5: `bets` exposure route

**Files:**
- Create: `apps/web/app/api/v1/admin/matches/[id]/bets/route.ts`

- [ ] **Step 1: Create the route** (real aggregation; outcome → 1/X/2):

```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';

const PICK: Record<string, string> = { HOME: '1', DRAW: 'X', AWAY: '2' };

// GET /api/v1/admin/matches/[id]/bets — real bet exposure: per-outcome count / staked / liability.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const { id } = await params;

  const preds = await prisma.prediction.findMany({
    where: { matchId: BigInt(id), market: '1X2' },
    select: { outcome: true, stake: true, oddsSnapshot: true, status: true },
  });

  const agg: Record<string, { outcome: string; count: number; staked: number; liability: number }> = {
    '1': { outcome: '1', count: 0, staked: 0, liability: 0 },
    'X': { outcome: 'X', count: 0, staked: 0, liability: 0 },
    '2': { outcome: '2', count: 0, staked: 0, liability: 0 },
  };
  let total = 0, settled = 0;
  for (const p of preds) {
    const k = PICK[p.outcome] ?? '1';
    const stake = Number(p.stake);
    agg[k].count += 1;
    agg[k].staked += stake;
    agg[k].liability += Math.round(stake * (1 + Number(p.oddsSnapshot)));
    total += 1;
    if (p.status === 'WON' || p.status === 'LOST') settled += 1;
  }
  return NextResponse.json({ data: { outcomes: Object.values(agg), total, settled } });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @wc/web exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Live-verify against real bets** (match 1 has the `verify4c` bets from this session). Start dev server if needed, then with an admin session cookie jar `$AJ`:

Run: `curl -s -b "$AJ" http://localhost:3000/api/v1/admin/matches/1/bets`
Expected: JSON with `outcomes` array; outcome `1` count ≥ 2 (the two HOME bets), `X` and `2` count ≥ 1.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/api/v1/admin/matches/[id]/bets/route.ts"
git commit -m "feat(admin): match bet-exposure aggregation route"
```

---

## Task A6: `audit` route

**Files:**
- Create: `apps/web/app/api/v1/admin/matches/[id]/audit/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';

// GET /api/v1/admin/matches/[id]/audit — recent admin actions on this match.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const { id } = await params;
  const rows = await prisma.auditLog.findMany({
    where: { target: `match:${id}` },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, actorType: true, action: true, metadata: true, createdAt: true },
  });
  return NextResponse.json({ data: rows.map((r) => ({ id: Number(r.id), actorType: r.actorType, action: r.action, metadata: r.metadata, createdAt: r.createdAt })) });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @wc/web exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/api/v1/admin/matches/[id]/audit/route.ts"
git commit -m "feat(admin): per-match audit-trail route"
```

---

## Task A7: Richer `AdmMatchDetail` UI

**Files:**
- Modify: `apps/web/components/screens-admin.tsx` (the `AdmMatchDetail` function + ensure `FormationPitch` is imported)
- Test: `apps/web/components/screens-admin.test.tsx`

- [ ] **Step 1: Confirm imports** — `screens-admin.tsx` already imports `FormationPitch` (used by `AdmTeamDetail`) and `Portal`. Add interfaces near the top (after `AdmMatch`):

```tsx
interface ExposureRow { outcome: string; count: number; staked: number; liability: number }
interface AuditRow { id: number; actorType: string; action: string; metadata: unknown; createdAt: string }
interface LineupTeam { code: string | null; name: string; formation: string | null; manager: string | null; players: { name: string; position: string | null; number: number | null; starter?: boolean }[] }
```

- [ ] **Step 2: Extend `AdmMatchDetail`** — add state + loaders for exposure, audit, and both teams' lineups, plus the sync handlers. Insert after the existing `confirmResult` in `AdmMatchDetail`:

```tsx
  const [editOdds, setEditOdds] = useState(false);
  const [exposure, setExposure] = useState<{ outcomes: ExposureRow[]; total: number; settled: number } | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [lineups, setLineups] = useState<LineupTeam[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);

  const loadExtras = useCallback(() => {
    fetch(`/api/v1/admin/matches/${id}/bets`).then(r => r.ok ? r.json() : null).then(j => setExposure(j?.data ?? null)).catch(() => {});
    fetch(`/api/v1/admin/matches/${id}/audit`).then(r => r.ok ? r.json() : null).then(j => setAudit(j?.data ?? [])).catch(() => {});
  }, [id]);
  useEffect(() => { loadExtras(); }, [loadExtras]);

  // both teams' XI for the FormationPitch view — fetched once m is loaded
  const loadLineups = useCallback((homeId?: number, awayId?: number) => {
    const ids = [homeId, awayId].filter((x): x is number => typeof x === 'number');
    Promise.all(ids.map(tid => fetch(`/api/v1/teams/${tid}`).then(r => r.ok ? r.json() : null)))
      .then(rs => setLineups(rs.filter(Boolean).map(j => ({ code: j.data.code, name: j.data.name, formation: j.data.formation, manager: j.data.manager, players: j.data.players }))))
      .catch(() => {});
  }, []);

  const syncResult = async () => {
    setSyncing('result');
    try {
      const res = await fetch(`/api/v1/admin/matches/${id}/sync-result`, { method: 'POST' });
      setSyncing(null);
      if (res.ok) { s.toastMsg('Result synced from feed', 'check', 'var(--green)'); load(); loadExtras(); }
      else s.toastMsg('Feed sync failed', 'alert', 'var(--danger)');
    } catch { setSyncing(null); s.toastMsg('Network error', 'alert', 'var(--danger)'); }
  };
  const syncLineup = async () => {
    setSyncing('lineup');
    try {
      const res = await fetch(`/api/v1/admin/matches/${id}/sync-lineup`, { method: 'POST' });
      setSyncing(null);
      if (res.ok) { s.toastMsg('Lineups re-crawled (AI)', 'check', 'var(--green)'); loadExtras(); }
      else s.toastMsg('Lineup sync failed (gateway?)', 'alert', 'var(--danger)');
    } catch { setSyncing(null); s.toastMsg('Network error', 'alert', 'var(--danger)'); }
  };
```

- [ ] **Step 3: Call `loadLineups` once `m` is set** — in the existing `load()` `.then`, after `setM`, also trigger lineups. Simplest: add an effect after the `if (!m) return ...` guard is resolved. Add this effect alongside the others (it reads `m`):

```tsx
  useEffect(() => { if (m?.home && m?.away) loadLineups((m.home as { id: number }).id, (m.away as { id: number }).id); }, [m, loadLineups]);
```
(Note: `AdmMatchTeam` already has `id: number`.)

- [ ] **Step 4: Render the new sections** — in `AdmMatchDetail`'s returned JSX, replace the existing single "admin actions" card with a Data-sync panel and add Exposure / Lineups / Audit cards. Insert after the hero `</div>`:

```tsx
      {/* data sync */}
      <div className="card card-pad mt-16">
        <span className="eyebrow">Data sync</span>
        <div className="row gap-8 wrap-w mt-12">
          <Btn variant="ghost" size="sm" icon="refresh" disabled={syncing === 'result'} onClick={syncResult}>{syncing === 'result' ? 'Syncing…' : 'Sync result (feed)'}</Btn>
          <Btn variant="ghost" size="sm" icon="trending" onClick={() => setEditOdds(true)}>Edit odds</Btn>
          <Btn variant="ghost" size="sm" icon="refresh" disabled={syncing === 'lineup'} onClick={syncLineup}>{syncing === 'lineup' ? 'Crawling…' : 'Sync lineup (AI)'}</Btn>
        </div>
      </div>

      {/* admin actions (existing: lock + resettle) — keep */}
      <div className="card card-pad mt-16 row between wrap gap-12">
        <button className="chip" onClick={toggleLock}>
          <Icon name={m.bettingLocked ? 'lock' : 'check'} size={14} style={{ color: m.bettingLocked ? 'var(--danger)' : 'var(--green)' }} />
          {m.bettingLocked ? 'Betting blocked' : 'Betting open'}
        </button>
        <Btn variant="primary" size="sm" icon={fin ? 'check' : 'trophy'} onClick={() => setEdit(true)}>{fin ? 'Re-settle result' : 'Confirm result'}</Btn>
      </div>

      {/* bet exposure */}
      {exposure && (
        <div className="card card-pad mt-16">
          <div className="row between"><span className="eyebrow">Bet exposure</span><span className="tiny muted">{exposure.total} bets · {exposure.settled} settled</span></div>
          <div className="stack gap-10 mt-12">
            {exposure.outcomes.map(o => (
              <div key={o.outcome} className="row between small">
                <span className="t2">{o.outcome} · {o.count} bets</span>
                <span className="tnum">staked {o.staked.toLocaleString()} · liability <span className="text-gold">{o.liability.toLocaleString()}</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* lineups (FormationPitch both teams) */}
      {lineups.length > 0 && (
        <div className="card card-pad mt-16">
          <span className="eyebrow">Projected lineups (AI)</span>
          <div className="grid gap-16 mt-12" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
            {lineups.map((t, i) => (
              <div key={i}>
                <div className="small" style={{ fontWeight: 700, marginBottom: 8 }}>{t.name}</div>
                <FormationPitch players={t.players} formation={t.formation} manager={t.manager} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* audit trail */}
      {audit.length > 0 && (
        <div className="card card-pad mt-16">
          <span className="eyebrow">Audit trail</span>
          <div className="stack gap-8 mt-12">
            {audit.map(a => (
              <div key={a.id} className="row between tiny">
                <span className="t2">{a.action}</span>
                <span className="muted">{a.actorType} · {new Date(a.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {editOdds && <OddsEditModal m={m} onClose={() => setEditOdds(false)} onSaved={() => { setEditOdds(false); load(); }} s={s} />}
```
(Keep the existing house-odds read-only card + match-state card + the `ScoreEditModal` at the end of the function.)

- [ ] **Step 5: Verify icon `refresh` exists** — Run: `grep -n "refresh:" apps/web/components/ui.tsx`. If absent, use `icon="clock"` instead in Step 4's sync buttons.

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @wc/web exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Add a component test** — append to `screens-admin.test.tsx` (the `makeFetch` stub returns `{data}` for any url, so the new endpoints resolve to empty arrays/objects gracefully):

```tsx
  it('match detail shows the data-sync panel', async () => {
    const M = {
      id: 1, round: 'GROUP', group: 'A', status: 'SCHEDULED', kickoffAt: '2026-06-11T18:00:00.000Z',
      home: { id: 1, name: 'Mexico', code: 'MEX', flagUrl: null }, away: { id: 2, name: 'South Africa', code: 'RSA', flagUrl: null },
      scoreHome: null, scoreAway: null, result: null, odds: { mHome: 1.6, mDraw: 2.3, mAway: 2.08 }, bettingLocked: false, venue: { name: 'Azteca' },
    };
    global.fetch = makeFetch({ '/api/v1/matches': [M], '/api/v1/matches/1': M, '/api/v1/admin/users': [STUB_USER] }) as unknown as typeof fetch;
    render(<Admin s={mockStore()} />);
    fireEvent.click(screen.getAllByRole('button', { name: /Tournament/i })[0]);
    fireEvent.click(await screen.findByText(/MEX v RSA/i));
    expect(await screen.findByText(/Data sync/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sync result/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sync lineup/i })).toBeInTheDocument();
  });
```

- [ ] **Step 8: Run web tests**

Run: `pnpm --filter @wc/web test`
Expected: all pass (existing + the new test).

- [ ] **Step 9: Commit**

```bash
git add apps/web/components/screens-admin.tsx apps/web/components/screens-admin.test.tsx
git commit -m "feat(admin): richer match detail — sync panel, exposure, lineups, audit"
```

- [ ] **Step 10: STOP — Phase A complete. Print changed files, await review.**

---

# PHASE B — Richer user match detail

## Task B1: Real Lineups tab on `MatchDetail`

**Files:**
- Modify: `apps/web/components/screens-match.tsx`
- Test: `apps/web/components/screens-match.test.tsx`

- [ ] **Step 1: Import `FormationPitch`** — add to the imports in `screens-match.tsx`:

```tsx
import { FormationPitch } from '@/components/formation-pitch';
```

- [ ] **Step 2: Replace `StatPanelStub` with a real `LineupPanel`** — delete the `StatPanelStub` function and add:

```tsx
interface LineupTeamData { name: string; formation: string | null; manager: string | null; players: { name: string; position: string | null; number: number | null; starter?: boolean }[] }

function LineupPanel({ homeId, awayId }: { homeId?: number; awayId?: number }) {
  const [teams, setTeams] = useState<LineupTeamData[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const ids = [homeId, awayId].filter((x): x is number => typeof x === 'number');
    if (!ids.length) { setLoading(false); return; }
    setLoading(true);
    Promise.all(ids.map(id => fetch(`/api/v1/teams/${id}`).then(r => r.ok ? r.json() : null)))
      .then(rs => setTeams(rs.filter(Boolean).map(j => ({ name: j.data.name, formation: j.data.formation, manager: j.data.manager, players: j.data.players }))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [homeId, awayId]);

  if (loading) return <div className="card card-pad-lg" style={{ textAlign: 'center' }}><p className="muted">Loading lineups…</p></div>;
  const anyPlayers = teams.some(t => t.players.length > 0);
  if (!anyPlayers) return <div className="card card-pad-lg" style={{ textAlign: 'center' }}><p className="muted">Lineups not available yet.</p></div>;
  return (
    <div className="stack gap-16">
      <p className="tiny muted">AI-predicted lineups · updated ~15 min before kickoff.</p>
      {teams.map((t, i) => (
        <div key={i}>
          <div className="small" style={{ fontWeight: 700, marginBottom: 8 }}>{t.name}</div>
          <FormationPitch players={t.players} formation={t.formation} manager={t.manager} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Update the tabs in `MatchDetail`** — change the tab list to only `preview` + `lineups`, and render `LineupPanel`. Replace the tab strip + panel block:

```tsx
      {/* tabs */}
      <div className="row gap-8 mt-24" style={{ overflowX: 'auto' }}>
        {([['preview', 'AI Pundit'], ['lineups', 'Lineups']] as [string, string][]).map(([k, l]) =>
          <button key={k} className={`chip ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      <div className="mt-16">
        {tab === 'preview' ? <PunditPanel m={m} /> : <LineupPanel homeId={m.home?.id} awayId={m.away?.id} />}
      </div>
```

- [ ] **Step 4: Enrich the hero** — `RealMatch.venue` is `{ name }` only; the public `/matches/:id` route returns `venue: { id, name, city, country }`. Widen the `RealMatch` venue type and show city/country. Change the `venue` field in the `RealMatch` interface to:

```tsx
  venue?: { name: string; city?: string | null; country?: string | null } | null;
```
And in the hero, replace the venue line with:

```tsx
            {m.venue?.name && <div className="tiny muted mt-4">{m.venue.name}{m.venue.city ? ` · ${m.venue.city}` : ''}</div>}
```

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @wc/web exec tsc --noEmit`
Expected: no errors. (`RealTeam.id` exists, so `m.home?.id` is valid.)

- [ ] **Step 6: Update the test** — in `screens-match.test.tsx`, the `mockFetch` must answer `/api/v1/teams/:id`. Add to `mockFetch` (before the final `notFound()`):

```ts
  if (u.includes('/api/v1/teams/')) return jsonRes({ data: { name: 'Mexico', formation: '4-3-3', manager: 'Coach', players: [{ name: 'Keeper', position: 'GK', number: 1, starter: true }] } });
```
Then add a test:

```ts
  it('renders the real Lineups tab via FormationPitch', async () => {
    render(<MatchDetail s={mockStore({ param: { id: 23 } })} />);
    fireEvent.click(await screen.findByRole('button', { name: /Lineups/i }));
    expect(await screen.findByText(/AI-predicted lineups/i)).toBeInTheDocument();
  });
```
(Add `fireEvent` to the test file's imports from `@testing-library/react` if not already present.)

- [ ] **Step 7: Run web tests**

Run: `pnpm --filter @wc/web test`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/screens-match.tsx apps/web/components/screens-match.test.tsx
git commit -m "feat(match): real Lineups tab (FormationPitch), drop fake Form/H2H, richer hero"
```

- [ ] **Step 9: STOP — Phase B complete. Print changed files, await review.**

---

## Self-review notes (addressed)

- **Spec coverage:** A1+A2 → sync-result; A3 → odds editor; A4 → sync-lineup; A5 → bet exposure; A6 → audit; A7 → admin detail UI (all 6 sections); B1 → user Lineups tab + drop Form/H2H + richer hero. Optional AI-propose-odds is explicitly out of Phase A per the spec (stretch) — not planned.
- **Placeholder scan:** every code step has full code; verification steps have exact commands + expected output.
- **Type consistency:** `AdmMatchFull` (existing) used by `OddsEditModal` + `AdmMatchDetail`; `RealMatch.venue` widened in B1-Step4 before use; `RealTeam.id`/`AdmMatchTeam.id` confirmed present; `FormationPitch` prop shape (`players/formation/manager`) matches `/teams/:id` `data`.
- **Known follow-ups (not bugs):** the `refresh` icon may not exist (A7-Step5 falls back to `clock`); admin live-verification (A5-Step3) needs an admin session cookie.
