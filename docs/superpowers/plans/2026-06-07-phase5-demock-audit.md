# Phase 5 — Full De-Mock Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. **Commits are HELD** (on `main`, commit-when-asked) — each task ends with verification + stop-for-review at sub-step boundaries, not `git commit`.

**Goal:** Remove the last static-fixture reads + the parallel mock-betting path (user side) and the fabricated admin bits, so every screen renders live DB-backed data through one betting path.

**Architecture:** Reuse the real `/api/v1/matches` reads + a self-contained `MatchBetCard`; add two admin read endpoints (`/admin/users/:id`, `/admin/metrics`) aggregating existing tables. No schema, no deps, no keys.

**Tech Stack:** Next.js 15 route handlers, Prisma/PostgreSQL, React 19, Vitest (jsdom), `requireAdmin`.

---

## File structure

- `apps/web/components/screens-match.tsx` — self-contained `MatchBetCard` (T1); retire global `BetSlip` (T3).
- `apps/web/components/screens-core.tsx` — Home/Landing real featured matches (T2).
- `apps/web/lib/store.ts` + `apps/web/components/app-shell.tsx` — drop mock-betting members (T3).
- `apps/web/components/ui.tsx` — drop `MatchCard`/`OddsRow` (T3).
- `apps/web/components/screens-lobby.tsx` — picker → `/matches` (T4).
- `apps/web/components/screens-compete.tsx` — MyBets labels → `/matches` (T5).
- `apps/web/components/screens-admin.tsx` — E1/E2 removals (T6), AdmUserDetail (T7), AdmOverview (T8).
- Create: `apps/web/app/api/v1/admin/users/[id]/route.ts` (T7), `apps/web/app/api/v1/admin/metrics/route.ts` (T8).

---

## SUB-STEP 1 = Task 1 + Task 2 + Task 3 (A + D)

### Task 1: Self-contained `MatchBetCard`

**Files:** Modify `apps/web/components/screens-match.tsx`

- [ ] **Step 1: Make `MatchBetCard` own its slip + confirm.** Change its signature from `({ m, s, onBet })` to `({ m, s })` and move the slip state + confirm into it. Replace the `MatchBetCard` function so it manages betting internally:

```tsx
export function MatchBetCard({ m, s }: { m: RealMatch; s: ScreenProps['s'] }) {
  const [slip, setSlip] = useState<{ pick: Pick1X2; oddsVal: number } | null>(null);
  const [sending, setSending] = useState(false);
  const open = m.status === 'SCHEDULED' && !m.bettingLocked;
  const myBets = s.bets.filter(b => b.mid === m.id);
  const betFor = (k: Pick1X2) => myBets.find(b => b.pick === k);
  const cells: [Pick1X2, string, number][] = m.odds
    ? [['1', m.home?.code ?? 'H', m.odds.mHome], ['X', 'Draw', m.odds.mDraw], ['2', m.away?.code ?? 'A', m.odds.mAway]]
    : [];
  const onBet = (k: Pick1X2, v: number) => { if (!s.authed) { s.go('auth', { mode: 'signup' }); return; } setSlip({ pick: k, oddsVal: v }); };
  const confirm = async (stake: number, exact?: { home: number; away: number }) => {
    if (!slip || sending) return;
    setSending(true);
    const err = await placeGlobalBet(s, m.id, slip.pick, stake, exact);
    setSending(false);
    if (err) { s.toastMsg(BET_ERR[err] ?? 'Could not place bet', 'alert', 'danger'); return; }
    s.toastMsg('Bet placed!', 'check', 'green');
    setSlip(null);
  };
  return (
    <div className="card card-pad">
      <div className="row between" style={{ marginBottom: 10 }}>
        <span className="badge badge-muted">{m.round === 'GROUP' ? `Group ${m.group ?? ''}` : m.round}</span>
        {m.status === 'LIVE' ? <span className="badge badge-magenta"><span className="live-dot"></span>LIVE</span>
          : m.status === 'FINISHED' ? <span className="badge badge-muted">FT {m.scoreHome}-{m.scoreAway}</span>
            : m.bettingLocked ? <span className="badge badge-danger"><Icon name="lock" size={11} /> Betting closed</span>
              : <span className="tiny muted">{new Date(m.kickoffAt).toLocaleDateString()}</span>}
      </div>
      <div className="row between gap-12" style={{ marginBottom: 10 }} onClick={() => s.go('match', { id: m.id })}>
        {[m.home, m.away].map((t, i) => (
          <div key={i} className="row gap-8 pointer" style={{ flex: 1, minWidth: 0, justifyContent: i ? 'flex-end' : 'flex-start' }}>
            {i === 0 && t && <Flag flagUrl={t.flagUrl ?? undefined} name={t.name} code={t.code ?? undefined} size={26} />}
            <span className="ellip small" style={{ fontWeight: 600 }}>{t?.name ?? 'TBD'}</span>
            {i === 1 && t && <Flag flagUrl={t.flagUrl ?? undefined} name={t.name} code={t.code ?? undefined} size={26} />}
          </div>
        ))}
      </div>
      {cells.length > 0 && (
        <div className="row gap-8 full">
          {cells.map(([k, lbl, v]) => {
            const bet = betFor(k);
            return (
              <button key={k} className={`odds ${bet ? 'sel' : ''}`} disabled={!open || !!bet}
                onClick={() => open && !bet && onBet(k, v)} style={!open ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}>
                <span className="o-label">{k} · {lbl}</span><span className="o-val">{v.toFixed(2)}</span>
              </button>
            );
          })}
        </div>
      )}
      {myBets.length > 0 && (
        <div className="tiny text-green mt-8 row gap-8 wrap-w">
          {myBets.map((b, i) => <span key={i} className="row gap-4"><Icon name="check" size={13} /> {b.pick} · {b.stake}{b.status !== 'OPEN' ? ` (${b.status})` : ''}</span>)}
        </div>
      )}
      {slip && <MatchBetSlip match={m} pick={slip.pick} oddsVal={slip.oddsVal} balance={s.points} busy={sending} onClose={() => setSlip(null)} onConfirm={confirm} />}
    </div>
  );
}
```
(This folds the parent's slip logic into the card. `placeGlobalBet`, `BET_ERR`, `MatchBetSlip` stay module-level above it.)

- [ ] **Step 2: Simplify `Schedule`** — remove its `slip`/`sending`/`onBet`/`confirm` state + the trailing `<MatchBetSlip>`, and change the grid to `<MatchBetCard key={m.id} m={m} s={s} />`. Keep `filter`/`q`/`matches`/`load`.

- [ ] **Step 3: tsc** — `pnpm --filter @wc/web exec tsc --noEmit` → no errors.
- [ ] **Step 4: web tests** — `pnpm --filter @wc/web test` → all pass (Schedule test still finds match cards).

### Task 2: Home + Landing real featured matches

**Files:** Modify `apps/web/components/screens-core.tsx`

- [ ] **Step 1: Import** `MatchBetCard` + `RealMatch` from `@/components/screens-match`; remove `MatchCard` from the `@/components/ui` import; remove `Match`/`WC.matchById`/`WC.fmtDate` if they become unused after this task.

- [ ] **Step 2: Home featured** — replace the `const feat = [WC.matchById(23)…]` + its `<MatchCard … onPick={s.openBet}>` render with a real fetch + `MatchBetCard`:

```tsx
  const [featured, setFeatured] = useState<RealMatch[]>([]);
  useEffect(() => {
    fetch('/api/v1/matches').then(r => (r.ok ? r.json() : null))
      .then(j => {
        const all = (j?.data ?? []) as RealMatch[];
        setFeatured(all.filter(mm => mm.status === 'SCHEDULED' && mm.odds).slice(0, 3));
      }).catch(() => {});
  }, []);
```
Render: `{featured.map(mm => <MatchBetCard key={mm.id} m={mm} s={s} />)}` (drop the `MatchCard`/`onPick`/`onOpen`).

- [ ] **Step 3: Landing featured** — same pattern, `.slice(0, 5)`; replace the `const today = [WC.matchById(23)…]` + its `<MatchCard … onPick={s.openBet} picked={s.pickFor}>` with `<MatchBetCard>`.

- [ ] **Step 4: Fix the hardcoded spotlight** — the `onClick={() => s.go('match', { id: 23 })}` card: change to `s.go('match', { id: featured[0]?.id })` guarded by `featured.length > 0` (hide the card if none), so no hardcoded id 23.

- [ ] **Step 5: tsc + tests** — `pnpm --filter @wc/web exec tsc --noEmit`; `pnpm --filter @wc/web test`. Update `screens-core.test.tsx` if it asserted the old `MatchCard`/featured mock (mock `fetch('/api/v1/matches')` → a small array; assert a featured card renders).

### Task 3: Retire the mock-betting path (D)

**Files:** Modify `apps/web/lib/store.ts`, `apps/web/components/app-shell.tsx`, `apps/web/components/screens-match.tsx`, `apps/web/components/ui.tsx`, test mockStores.

- [ ] **Step 1: `store.ts`** — remove the `BetSlipState` interface and the members `betSlip`, `openBet`, `setSlipPick`, `closeBet`, `confirmBet`, `pickFor` from the `Store` interface. Keep `bets`/`points`/etc.

- [ ] **Step 2: `app-shell.tsx`** — remove `const [betSlip, setBetSlip] = useState(...)`, the `openBet`/`setSlipPick`/`closeBet`/`confirmBet`/`pickFor` impls in the store object, `betSlip` from the store literal, the `BetSlip` import, and all three `<BetSlip s={store} />` renders (lines ~255, ~292, ~348). Remove `BetSlipState` from the type import.

- [ ] **Step 3: `screens-match.tsx`** — delete the exported global `BetSlip` function (the `/* BET SLIP (overlay) */` block). Keep `MatchBetSlip` (the real one).

- [ ] **Step 4: `ui.tsx`** — delete `MatchCard` and `OddsRow` (now orphaned). Leave `Flag`/`Icon`/etc.

- [ ] **Step 5: Update test mockStores** — in every `*.test.tsx` whose `mockStore` includes `openBet`/`confirmBet`/`setSlipPick`/`closeBet`/`betSlip`/`pickFor`, remove those keys. Remove the `BetSlip` tests in `screens-match.test.tsx`.

- [ ] **Step 6: tsc + tests** — `pnpm --filter @wc/web exec tsc --noEmit` (catches every dangling ref); `pnpm --filter @wc/web test` → all pass.

- [ ] **STOP — sub-step 1 (A+D) complete. Print changed files, await review.**

---

## SUB-STEP 2 = Task 4 (B)

### Task 4: Lobby-create match picker → `/api/v1/matches`

**Files:** Modify `apps/web/components/screens-lobby.tsx`

- [ ] **Step 1: Fetch real matches** in the lobby-create component — add `const [matches, setMatches] = useState<{id:number;status:string;kickoffAt:string;home:{code:string|null}|null;away:{code:string|null}|null}[]>([])` + a `useEffect` fetching `/api/v1/matches` → `setMatches(j.data)`. Replace `const pool = [...WC.live, ...WC.upcoming].slice(0,20)` with `const pool = matches.slice(0, 30)`.

- [ ] **Step 2: Quick-picks** — replace the quick-pick list with: `all` → all pool ids; `today` → `pool.filter(m => new Date(m.kickoffAt).toDateString() === new Date().toDateString()).map(m=>m.id)`; `open` → `pool.filter(m => m.status === 'SCHEDULED').map(m=>m.id)`. **Remove the `top` (rank) quick-pick** and the `WC.byId(...).rank` usage.

- [ ] **Step 3: Row render** — replace `WC.byId(m.home)`/`WC.fmtDate(m.date)` with `m.home?.code`/`m.away?.code` + `new Date(m.kickoffAt).toLocaleDateString()`; status badge from `m.status`.

- [ ] **Step 4: tsc + tests** — no errors; lobby tests pass (mock `/api/v1/matches` if the create-picker test needs rows).

- [ ] **STOP — await review.**

---

## SUB-STEP 3 = Task 5 (C)

### Task 5: MyBets match labels → `/api/v1/matches` map

**Files:** Modify `apps/web/components/screens-compete.tsx`

- [ ] **Step 1: Fetch matches map** in MyBets — `const [mmap, setMmap] = useState<Map<number, {home:{code:string|null}|null;away:{code:string|null}|null;status:string}>>(new Map())`; `useEffect` fetch `/api/v1/matches` → `setMmap(new Map((j.data as any[]).map(m => [m.id, m])))`.

- [ ] **Step 2: Render** — replace `const m = WC.matchById(b.mid); const home = WC.byId(m.home)…` with `const mm = mmap.get(b.mid)` and render `mm?.home?.code ?? '?' } v {mm?.away?.code ?? '?'`; guard when `mm` is undefined (show the pick/stake without team codes). Remove `WC.matchById/byId`.

- [ ] **Step 3: tsc + tests** — no errors; compete tests pass (mock `/api/v1/matches`).

- [ ] **STOP — await review.**

---

## SUB-STEP 4 = Task 6 (E1 + E2)

### Task 6: Admin removals

**Files:** Modify `apps/web/components/screens-admin.tsx`

- [ ] **Step 1: AdmAudit (E1)** — delete the `MOCK_AUDIT` constant. Change `useState<...>(MOCK_AUDIT)` to `useState<[string,string,string,string,string][]>([])`. The existing fetch already replaces on data; the render already maps `log` — when empty it shows nothing, so add an empty state: `{log.length === 0 && <p className="tiny muted" style={{ padding: 16 }}>No audit entries yet.</p>}` inside the card.

- [ ] **Step 2: AdmPipeline (E2)** — delete the hardcoded footer card (the `<div … pundit.preview fell back to OpenAI… news.crawl failed 503 …>`). Optionally replace with: `{jobs.some(j => j.status === 'error') && <div className="card-2 card-pad mt-12 small t2 row gap-8"><Icon name="alert" size={15} style={{ color:'var(--gold)' }} /><span>{jobs.filter(j=>j.status==='error').length} job(s) failed in the last batch.</span></div>}`.

- [ ] **Step 3: tsc + tests** — no errors; admin tests pass.

- [ ] **STOP — await review.**

---

## SUB-STEP 5 = Task 7 (E3)

### Task 7: `/admin/users/:id` + de-mock AdmUserDetail

**Files:** Create `apps/web/app/api/v1/admin/users/[id]/route.ts`; Modify `apps/web/components/screens-admin.tsx`.

- [ ] **Step 1: Create the route**

```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';
const OUTCOME: Record<string, string> = { HOME: '1', DRAW: 'X', AWAY: '2' };

// GET /api/v1/admin/users/[id] — real user detail: profile, balance, recent ledger + bets, stats.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const { id } = await params;
  const uid = BigInt(id);
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { id: true, email: true, username: true, displayName: true, role: true, status: true, createdAt: true } });
  if (!user) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  const [wallet, ledger, bets, stats] = await Promise.all([
    prisma.wallet.findFirst({ where: { userId: uid, contextType: 'GLOBAL', contextId: null }, select: { balance: true } }),
    prisma.pointLedger.findMany({ where: { userId: uid }, orderBy: { id: 'desc' }, take: 10, select: { type: true, amount: true, balanceAfter: true, createdAt: true } }),
    prisma.prediction.findMany({ where: { userId: uid, contextType: 'GLOBAL' }, orderBy: { createdAt: 'desc' }, take: 10, select: { matchId: true, outcome: true, stake: true, oddsSnapshot: true, status: true } }),
    prisma.predictionUserStats.findUnique({ where: { userId: uid } }),
  ]);

  const settled = stats?.settledCount ?? 0;
  const winRate = settled > 0 ? Math.round((stats!.winCount / settled) * 100) : null;
  const totalStaked = Number(stats?.totalStaked ?? 0);
  const roi = totalStaked > 0 ? Math.round(((Number(stats!.totalReturned) - totalStaked) / totalStaked) * 100) : null;

  return NextResponse.json({ data: {
    id: Number(user.id), email: user.email, name: user.displayName ?? user.username ?? user.email, role: user.role, status: user.status, joined: user.createdAt,
    balance: Number(wallet?.balance ?? 0),
    winRate, roi, settled, won: stats?.winCount ?? 0,
    ledger: ledger.map(l => ({ type: l.type, amount: Number(l.amount), balanceAfter: Number(l.balanceAfter), when: l.createdAt })),
    bets: bets.map(b => ({ matchId: Number(b.matchId), pick: OUTCOME[b.outcome] ?? '1', stake: Number(b.stake), odds: Number(b.oddsSnapshot), status: b.status })),
  } });
}
```

- [ ] **Step 2: Verify route** — `pnpm --filter @wc/web exec tsc --noEmit`; live unauth `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/v1/admin/users/1` → 403.

- [ ] **Step 3: De-mock `AdmUserDetail`** — fetch `/api/v1/admin/users/${realId}` on open into a `detail` state. Remove the hardcoded `ledger` + `bets` arrays, the `21%/58%` win-rate, and `WC.matchById/byId`. Render: KPIs from `detail` (Balance, Win rate `detail.winRate ?? '—'%`, ROI, Settled); "Recent point activity" from `detail.ledger` (type · amount · when); "Recent bets" from `detail.bets` (resolve match labels via a `/api/v1/matches` id→code map, like Task 5, or show `#matchId pick stake status`). Keep the existing real ban action; drop the `flags`/`ip` cluster block (not tracked) or gate it on a real field if added later.

- [ ] **Step 4: tsc + tests** — no errors; admin tests pass (mock `/api/v1/admin/users/:id`). Add a test: AdmUserDetail shows a ledger/bet from mocked detail.

- [ ] **STOP — await review.**

---

## SUB-STEP 6 = Task 8 (E4)

### Task 8: `/admin/metrics` + de-mock AdmOverview

**Files:** Create `apps/web/app/api/v1/admin/metrics/route.ts`; Modify `apps/web/components/screens-admin.tsx`.

- [ ] **Step 1: Create the route**

```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';

// GET /api/v1/admin/metrics — real ops KPIs from existing tables.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const [betsToday, articlesPending, settled, totalUsers] = await Promise.all([
    prisma.prediction.count({ where: { createdAt: { gte: start } } }),
    prisma.newsArticle.count({ where: { status: 'PENDING' } }),
    prisma.prediction.count({ where: { status: { in: ['WON', 'LOST'] } } }),
    prisma.user.count(),
  ]);
  return NextResponse.json({ data: { betsToday, articlesPending, settled, totalUsers } });
}
```

- [ ] **Step 2: Verify route** — tsc; live unauth `curl … /api/v1/admin/metrics` → 403.

- [ ] **Step 3: De-mock `AdmOverview`** — add `const [metrics, setMetrics] = useState<{betsToday:number;articlesPending:number;settled:number;totalUsers:number}|null>(null)` + fetch `/api/v1/admin/metrics`. Replace the 5 KPIs with exactly 4 real cells: `Bets today` (`metrics?.betsToday ?? '—'`), `Open risk flags` (`riskLobbies.length`, already real), `Articles pending` (`metrics?.articlesPending ?? '—'`), `Total settled` (`metrics?.settled ?? '—'`). Remove the `48.2K` / `11,940` / `6` / `99.9%` literals and the "Active users (24h)" + "Settle accuracy" cells.

- [ ] **Step 4: tsc + tests** — no errors; admin tests pass (mock `/api/v1/admin/metrics`; assert a real KPI label renders).

- [ ] **STOP — Phase 5 complete. Print changed files, await review.**

---

## Self-review notes (addressed)

- **Spec coverage:** A→T1+T2, D→T3, B→T4, C→T5, E1+E2→T6, E3→T7, E4→T8. All spec items mapped.
- **Placeholder scan:** new-endpoint code is complete; UI edits show the new code + exact anchors; verification commands explicit.
- **Type consistency:** `MatchBetCard({m,s})` exported in T1, consumed in T1 (Schedule) + T2 (Home/Landing); `RealMatch` reused; `predictionUserStats` fields (`settledCount`/`winCount`/`totalStaked`/`totalReturned`) match the schema; `NewsStatus 'PENDING'` + `Prediction.status WON/LOST` match.
- **Known notes:** `User` has no `flags`/`ip` (the `/admin/users` list stubs them) — T7 drops the fabricated flags/IP cluster block rather than wiring a non-existent field. Commits held throughout (no `git commit` steps).
