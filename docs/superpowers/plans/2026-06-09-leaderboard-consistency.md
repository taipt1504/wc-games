# Leaderboard Consistency — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Fix the `+-6.5%` ROI formatting on Home (shared sign-safe formatter) and rank the lobby leaderboard by lobby ROI (= netProfit/seed) with an ROI column.

**Architecture:** One pure formatter `pctSigned` in `apps/web/lib/format.ts` used at every ROI site (Home ×3, compete replaces its local `sgnPct`). Lobby route adds a derived `roi` per board row + sorts by it; lobby UI gains an ROI column. Frontend + one API route only; no DB/dep change.

**Tech Stack:** Next 15 React (custom CSS), Vitest, `useT()` i18n.

**Verification gate (each task):** `pnpm --filter @wc/web exec tsc --noEmit` (exit 0) + `pnpm --filter @wc/web test`. KNOWN pre-existing failure: `Flag > shows team code` (unrelated — do NOT fix). Success = no NEW failures + the new `pctSigned` tests pass.

---

## File Structure

| File | Change |
|---|---|
| `apps/web/lib/format.ts` (new) | `pctSigned(n)` — signed 1-decimal percent |
| `apps/web/lib/format.test.ts` (new) | unit tests for `pctSigned` |
| `apps/web/components/screens-core.tsx` | 3 ROI sites → `pctSigned` |
| `apps/web/components/screens-compete.tsx` | drop local `sgnPct`, import `pctSigned` |
| `apps/web/app/api/v1/lobbies/[id]/route.ts` | per-row `roi` + sort by roi |
| `apps/web/components/screens-lobby.tsx` | `BoardRow.roi` + ROI column |
| `apps/web/lib/i18n/dictionaries/{en,vi}.ts` | `lobby.colRoi` |

---

## Task 1: `pctSigned` formatter (TDD)

**Files:** Create `apps/web/lib/format.ts`, `apps/web/lib/format.test.ts`

- [ ] **Step 1: Write the failing test** — create `apps/web/lib/format.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pctSigned } from './format';

describe('pctSigned', () => {
  it('positive gets +, negative keeps its own -, zero is plain', () => {
    expect(pctSigned(24.1)).toBe('+24.1%');
    expect(pctSigned(-6.5)).toBe('-6.5%');
    expect(pctSigned(0)).toBe('0%');
    expect(pctSigned(100)).toBe('+100%');
  });
  it('rounds to one decimal (sub-0.05 → 0%)', () => {
    expect(pctSigned(0.04)).toBe('0%');
    expect(pctSigned(24.16)).toBe('+24.2%');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @wc/web test format`
Expected: FAIL — `Cannot find module './format'`.

- [ ] **Step 3: Implement** — create `apps/web/lib/format.ts`:

```ts
/** Signed percent for ROI/growth display. +24.1% · -6.5% · 0% (never a "+-" double sign).
 *  Rounds to one decimal; only strictly-positive values get a leading '+'. */
export function pctSigned(n: number): string {
  const r = Math.round(n * 10) / 10;
  return `${r > 0 ? '+' : ''}${r}%`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @wc/web test format`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/format.ts apps/web/lib/format.test.ts
git commit -m "feat(web): pctSigned — sign-safe ROI percent formatter"
```

---

## Task 2: Wire `pctSigned` at Home + compete

**Files:** Modify `apps/web/components/screens-core.tsx`, `apps/web/components/screens-compete.tsx`

- [ ] **Step 1: Import in `screens-core.tsx`** — add after the existing `useT` import (line 8):

```ts
import { pctSigned } from '@/lib/format';
```

- [ ] **Step 2: Home ROI stat (line ~292)** — replace:
```tsx
<Stat val={`+${me.roi}%`} lbl={t('home.statRoi')} c="var(--green)" i="trending" onClick={() => s.go('mybets')} />
```
with:
```tsx
<Stat val={pctSigned(me.roi)} lbl={t('home.statRoi')} c="var(--green)" i="trending" onClick={() => s.go('mybets')} />
```

- [ ] **Step 3: MiniBoard row (line ~435)** — replace:
```tsx
<span className="tnum text-green" style={{ fontWeight: 700 }}>+{p.roi}%</span>
```
with:
```tsx
<span className="tnum" style={{ fontWeight: 700, color: p.roi >= 0 ? 'var(--green)' : 'var(--danger)' }}>{pctSigned(p.roi)}</span>
```

- [ ] **Step 4: MiniBoard You row (line ~441)** — replace:
```tsx
<span className="tnum text-green" style={{ fontWeight: 700 }}>+{s.me.roi}%</span>
```
with:
```tsx
<span className="tnum" style={{ fontWeight: 700, color: s.me.roi >= 0 ? 'var(--green)' : 'var(--danger)' }}>{pctSigned(s.me.roi)}</span>
```

- [ ] **Step 5: `screens-compete.tsx` — replace local `sgnPct`** — add import after `useT` (line 7):
```ts
import { pctSigned } from '@/lib/format';
```
Delete the local `sgnPct` definition (line 10: `const sgnPct = (n: number) => ...`). Then replace **every** `sgnPct(` call in the file with `pctSigned(` — there are **7** call sites (lines ~73, 94, 120, 319, 714, 794, 845: the your-rank card, podium, table, bottom your-rank card, duel roi-race, profile stat, share card). A repo-wide check `grep -n "sgnPct" apps/web/components/screens-compete.tsx` must return **0** matches when done. Leave `sgnNum` + `sgnCol` (lines 11–12) untouched.

> Behavior note: old `sgnPct` rendered `+0%` for zero; `pctSigned` renders `0%`. Intended (matches the spec). The new `pctSigned` rounds to 1 decimal — the API already returns 1-decimal roi, so values are unchanged.

- [ ] **Step 6: Verify**

Run: `pnpm --filter @wc/web exec tsc --noEmit` (exit 0)
Run: `pnpm --filter @wc/web test` (no new failures; only the pre-existing `Flag` fail)

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/screens-core.tsx apps/web/components/screens-compete.tsx
git commit -m "fix(web): sign-safe ROI everywhere (no more +-6.5%); share pctSigned"
```

---

## Task 3: Lobby ROI in the route

**Files:** Modify `apps/web/app/api/v1/lobbies/[id]/route.ts`

- [ ] **Step 1: Add `roi` to each board row** — in the `boardRows = await Promise.all(... .map(async (m) => { const standing = ...; return {...} }))` block, add a `roi` field to the returned object (after `borrowed`):

```ts
        borrowed: Number(standing.borrowed),
        roi: standing.defaultPoints > 0n
          ? Math.round((Number(standing.winnings - standing.borrowed) / Number(standing.defaultPoints)) * 1000) / 10
          : 0,
        you: m.userId === user.id,
```

- [ ] **Step 2: Sort by ROI, tie-break score** — replace:
```ts
  // Sort board by score desc, assign rank
  boardRows.sort((a, b) => b.score - a.score);
```
with:
```ts
  // Sort board by lobby ROI desc (tie-break score), assign rank
  boardRows.sort((a, b) => b.roi - a.roi || b.score - a.score);
```

- [ ] **Step 3: Verify**

Run: `pnpm --filter @wc/web exec tsc --noEmit` (exit 0)

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/api/v1/lobbies/[id]/route.ts"
git commit -m "fix(web): rank lobby board by lobby ROI = (winnings-borrowed)/defaultPoints"
```

---

## Task 4: Lobby board ROI column + i18n

**Files:** Modify `apps/web/components/screens-lobby.tsx`, `apps/web/lib/i18n/dictionaries/en.ts`, `apps/web/lib/i18n/dictionaries/vi.ts`

- [ ] **Step 1: i18n** — add `colRoi` to the `lobby` group in BOTH dictionaries:
  - `en.ts`: `colRoi: 'ROI',`
  - `vi.ts`: `colRoi: 'ROI',`
  (Both must get it — the parity test fails otherwise.)

- [ ] **Step 2: `BoardRow` type (line ~33)** — add `roi`:
```ts
interface BoardRow {
  rank: number;
  userId: number;
  name: string;
  score: number;
  balance: number;
  won: number;
  def: number;
  borrowed: number;
  roi: number;
  you: boolean;
}
```

- [ ] **Step 3: Import `pctSigned`** — add to the imports of `screens-lobby.tsx` (near the other `@/lib` / `@/components` imports):
```ts
import { pctSigned } from '@/lib/format';
```

- [ ] **Step 4: `LobbyBoard` table — add the ROI column** as the first stat column (right after Member, before Default). In the `<thead>` row, insert after the Member `<th>`:
```tsx
<th style={{ textAlign: 'right' }}>{t('lobby.colRoi')}</th>
```
In the `<tbody>` row (inside `board.map`), insert after the Member `<td>` and before the Default `<td>`:
```tsx
<td className="tnum" style={{ textAlign: 'right', fontWeight: 700, color: p.roi >= 0 ? 'var(--green)' : 'var(--danger)' }}>{pctSigned(p.roi)}</td>
```
The empty-state row currently spans `colSpan={6}` — bump it to `colSpan={7}` (one more column now).

- [ ] **Step 5: Verify**

Run: `pnpm --filter @wc/web exec tsc --noEmit` (exit 0)
Run: `pnpm --filter @wc/web test` (no new failures; i18n parity test green; only the pre-existing `Flag` fail)

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/screens-lobby.tsx apps/web/lib/i18n/dictionaries/en.ts apps/web/lib/i18n/dictionaries/vi.ts
git commit -m "feat(web/lobby): ROI column on the lobby board (ranked by lobby ROI)"
```

---

## Task 5: Phase verification + handoff

- [ ] **Step 1:** `pnpm --filter @wc/web exec tsc --noEmit` → exit 0.
- [ ] **Step 2:** `pnpm --filter @wc/web test` → `pctSigned` suite green; only the pre-existing `Flag` fail.
- [ ] **Step 3: Report** + manual check owed (jsdom has no layout): (a) Home summary + Home ROI stat show `-6.5%` (not `+-6.5%`) and `0%` for a zero user; (b) full leaderboard unchanged; (c) lobby board ranked by ROI with a sign-correct ROI column. STOP for review.

---

## Self-Review

**Spec coverage:** D1 sign-safe shared formatter → Task 1 (`pctSigned`) + Task 2 (Home ×3 + compete). D2 lobby ROI ranking → Task 3 (roi + sort). D3 same-concept ROI (netProfit/seed) → Task 3 formula mirrors the global `netProfit/SIGNUP_BONUS` shape (1-decimal %); column via Task 4. All covered. ✓

**Placeholder scan:** none — full code in every step; exact line anchors given.

**Type consistency:** `pctSigned(n: number): string` defined Task 1, imported + called in Tasks 2/4. `BoardRow.roi: number` (Task 4) matches the route's `roi` number (Task 3). i18n `lobby.colRoi` added both dicts (Task 4). compete keeps `sgnNum`/`sgnCol`; only `sgnPct` removed.

**Note:** Task 2 Step 5 changes compete's zero-render from `+0%` → `0%` — intentional per spec (consistent zero). No existing compete test asserts the `+0%` string (the leaderboard render isn't unit-tested), so no test breaks.
