# Match Time — Client Timezone Rendering — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Render match kickoff times in the client's timezone (SSR-safe) with a visible `· GMT+7` offset label, so a UTC+7 user sees the opener as `02:00, 12 Jun` not a server-tz value.

**Architecture:** Pure offset helpers in `apps/web/lib/format.ts` + a small SSR-safe `<LocalTime>` client component (mounted-guard → browser tz, optional tz label). Wire it at the match-time JSX sites; for the few string-prop sites, widen one prop to ReactNode / use a locale `fmt.date`. Frontend/render only; no DB/API/dep change.

**Tech Stack:** Next 15 React (`'use client'`), `useT().fmt` (Intl), Vitest.

**Verification gate (each task):** `pnpm --filter @wc/web exec tsc --noEmit` (exit 0) + `pnpm --filter @wc/web test`. KNOWN pre-existing failure: `Flag > shows team code` (unrelated — do NOT fix). Success = no NEW failures + the new `formatGmtOffset` tests pass.

**Verified facts (read from the code):**
- `useT()` returns `{ t, locale, setLocale, fmt }`; `fmt.date(d, opts) = new Intl.DateTimeFormat(locale, opts).format(new Date(d))` — no `timeZone`.
- `InfoCell({ label, value }: { label: string; value: string })` (`screens-match.tsx:558`) — `value` is **string** (rendered as `{value}`). `ScoreEditModal` prop `sub: string` (`screens-admin.tsx:376`).
- Match data is client-fetched; all these components are `'use client'`.

---

## File Structure

| File | Change |
|---|---|
| `apps/web/lib/format.ts` | + `formatGmtOffset`, `tzOffsetLabel` |
| `apps/web/lib/format.test.ts` | + `formatGmtOffset` cases |
| `apps/web/components/local-time.tsx` (new) | `<LocalTime>` SSR-safe client-tz renderer |
| `apps/web/components/screens-match.tsx` | card + hero → `<LocalTime>`; widen `InfoCell.value`→ReactNode; Kickoff cell → `<LocalTime>` |
| `apps/web/components/screens-tournament.tsx` | fixtures time → `<LocalTime>` |
| `apps/web/components/screens-lobby.tsx` | match row + picker → `<LocalTime>` |
| `apps/web/components/screens-core.tsx` | Home eyebrow → JSX `<LocalTime>` |
| `apps/web/components/screens-admin.tsx` | 2 JSX sites → `<LocalTime>`; 2 modal `sub` date strings → `fmt.date` |

---

## Task 1: Offset helpers (TDD)

**Files:** Modify `apps/web/lib/format.ts`, `apps/web/lib/format.test.ts`

- [ ] **Step 1: Add failing tests** — append to `apps/web/lib/format.test.ts`:

```ts
import { formatGmtOffset } from './format';

describe('formatGmtOffset', () => {
  it('formats minutes-ahead-of-UTC as a GMT label', () => {
    expect(formatGmtOffset(420)).toBe('GMT+7');
    expect(formatGmtOffset(-300)).toBe('GMT-5');
    expect(formatGmtOffset(330)).toBe('GMT+5:30');
    expect(formatGmtOffset(0)).toBe('GMT+0');
    expect(formatGmtOffset(-60)).toBe('GMT-1');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @wc/web test format`
Expected: FAIL — `formatGmtOffset` not exported.

- [ ] **Step 3: Implement** — append to `apps/web/lib/format.ts`:

```ts
/** "GMT+7" · "GMT-5" · "GMT+5:30" · "GMT+0" from minutes-ahead-of-UTC. Pure. */
export function formatGmtOffset(minsAheadOfUtc: number): string {
  const sign = minsAheadOfUtc < 0 ? '-' : '+';
  const abs = Math.abs(minsAheadOfUtc);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `GMT${sign}${h}${m ? ':' + String(m).padStart(2, '0') : ''}`;
}

/** The client's GMT offset label for a given instant (DST-correct via the runtime tz). */
export function tzOffsetLabel(d: Date | string | number): string {
  return formatGmtOffset(-new Date(d).getTimezoneOffset());
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @wc/web test format`
Expected: PASS (`pctSigned` + `formatGmtOffset` blocks).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/format.ts apps/web/lib/format.test.ts
git commit -m "feat(web): formatGmtOffset/tzOffsetLabel — client GMT offset label"
```

---

## Task 2: `<LocalTime>` SSR-safe client-tz renderer

**Files:** Create `apps/web/components/local-time.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/hooks';
import { tzOffsetLabel } from '@/lib/format';

/** Render an instant in the CLIENT's timezone. SSR-safe: the visible value is computed after mount
 *  (browser tz); `suppressHydrationWarning` avoids a hydration mismatch flash. `withTz` appends "· GMT+7". */
export function LocalTime({ value, opts, withTz = false }: {
  value: string | number | Date;
  opts?: Intl.DateTimeFormatOptions;
  withTz?: boolean;
}) {
  const { fmt } = useT();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const base = fmt.date(value, opts);
  if (!mounted) return <span suppressHydrationWarning>{base}</span>;
  return <span>{withTz ? `${base} · ${tzOffsetLabel(value)}` : base}</span>;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm --filter @wc/web exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/local-time.tsx
git commit -m "feat(web): LocalTime — SSR-safe client-timezone time renderer"
```

---

## Task 3: Wire `<LocalTime>` — screens-match (incl. InfoCell widen)

**Files:** Modify `apps/web/components/screens-match.tsx`

- [ ] **Step 1: Import** — add near the top imports:
```ts
import { LocalTime } from '@/components/local-time';
```

- [ ] **Step 2: Card status row (`:126`)** — replace:
```tsx
              : <span className="tiny muted">{fmt.date(m.kickoffAt, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
```
with:
```tsx
              : <span className="tiny muted"><LocalTime value={m.kickoffAt} opts={{ day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }} withTz /></span>}
```

- [ ] **Step 3: Detail hero badge (`:419`)** — replace:
```tsx
              : <span className="badge badge-sky">{fmt.date(m.kickoffAt, { dateStyle: 'medium', timeStyle: 'short' })}</span>}
```
with:
```tsx
              : <span className="badge badge-sky"><LocalTime value={m.kickoffAt} opts={{ dateStyle: 'medium', timeStyle: 'short' }} withTz /></span>}
```

- [ ] **Step 4: Widen `InfoCell.value` to ReactNode (`:558`)** — replace:
```tsx
function InfoCell({ label, value }: { label: string; value: string }) {
```
with:
```tsx
function InfoCell({ label, value }: { label: string; value: React.ReactNode }) {
```
(`InfoCell` renders `{value}` in a div — ReactNode is fine. The other 3 `InfoCell` calls pass strings, still valid.)

- [ ] **Step 5: Kickoff InfoCell (`:436`)** — replace:
```tsx
          <InfoCell label={t('match.kickoff')} value={fmt.date(m.kickoffAt, { dateStyle: 'medium', timeStyle: 'short' })} />
```
with:
```tsx
          <InfoCell label={t('match.kickoff')} value={<LocalTime value={m.kickoffAt} opts={{ dateStyle: 'medium', timeStyle: 'short' }} withTz />} />
```

- [ ] **Step 6: Verify** `pnpm --filter @wc/web exec tsc --noEmit` (0) + `pnpm --filter @wc/web test` (only the pre-existing `Flag` fail).

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/screens-match.tsx
git commit -m "feat(web): match card/detail kickoff in client tz (LocalTime + GMT label)"
```

---

## Task 4: Wire `<LocalTime>` — tournament, lobby, core

**Files:** Modify `apps/web/components/screens-tournament.tsx`, `screens-lobby.tsx`, `screens-core.tsx`

- [ ] **Step 1: `screens-tournament.tsx`** — add import `import { LocalTime } from '@/components/local-time';`. Replace the fixtures time (`:129`):
```tsx
              {m.status === 'FINISHED' ? `${m.scoreHome}–${m.scoreAway}` : fmt.date(m.kickoffAt, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
```
with:
```tsx
              {m.status === 'FINISHED' ? `${m.scoreHome}–${m.scoreAway}` : <LocalTime value={m.kickoffAt} opts={{ day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }} withTz />}
```

- [ ] **Step 2: `screens-lobby.tsx`** — add import `import { LocalTime } from '@/components/local-time';`. Replace match row (`:294`):
```tsx
                      <span className="tiny muted nowrap">{m.status === 'LIVE' ? <span className="text-magenta">● {t('match.live')}</span> : fmt.date(m.kickoffAt)}</span>
```
with:
```tsx
                      <span className="tiny muted nowrap">{m.status === 'LIVE' ? <span className="text-magenta">● {t('match.live')}</span> : <LocalTime value={m.kickoffAt} withTz />}</span>
```
And the picker row (`:459`):
```tsx
                      : <span className="tiny muted">{fmt.date(m.kickoffAt, kickoffFmt)}</span>}
```
with:
```tsx
                      : <span className="tiny muted"><LocalTime value={m.kickoffAt} opts={kickoffFmt} withTz /></span>}
```

- [ ] **Step 3: `screens-core.tsx` Home eyebrow (`:285`)** — add import `import { LocalTime } from '@/components/local-time';`. Replace:
```tsx
          <div className="eyebrow">{t('home.matchday')}{today[0] ? ` · ${fmt.date(today[0].kickoffAt)}` : ''}</div>
```
with:
```tsx
          <div className="eyebrow">{t('home.matchday')}{today[0] && <> · <LocalTime value={today[0].kickoffAt} /></>}</div>
```
(No `withTz` — the eyebrow is a compact date label.)

- [ ] **Step 4: Verify** `pnpm --filter @wc/web exec tsc --noEmit` (0) + `pnpm --filter @wc/web test` (only the pre-existing `Flag` fail).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/screens-tournament.tsx apps/web/components/screens-lobby.tsx apps/web/components/screens-core.tsx
git commit -m "feat(web): fixtures/lobby/home match times in client tz (LocalTime)"
```

---

## Task 5: Wire admin time sites

**Files:** Modify `apps/web/components/screens-admin.tsx`

- [ ] **Step 1: Imports** — add `import { LocalTime } from '@/components/local-time';`. Confirm `useT` (and thus `fmt`) is available in the components touched (`AdmTournament` card `:297`, `AdmMatchDetail` hero `:1338`, and the two modal-callers): the file already uses `useT()`/`fmt` widely. For the modal `sub` string sites, use `fmt` from the enclosing component's `useT()` (add `const { fmt } = useT()` / extend the existing destructure if not present in that component scope).

- [ ] **Step 2: Tournament card kickoff (`:297`)** — replace:
```tsx
      {m.status === 'SCHEDULED' && <div className="row center tiny muted mt-4">{new Date(m.kickoffAt).toLocaleString()}</div>}
```
with:
```tsx
      {m.status === 'SCHEDULED' && <div className="row center tiny muted mt-4"><LocalTime value={m.kickoffAt} opts={{ dateStyle: 'medium', timeStyle: 'short' }} withTz /></div>}
```

- [ ] **Step 3: Match-detail hero (`:1338`)** — replace:
```tsx
              : <span className="badge badge-sky">{new Date(m.kickoffAt).toLocaleString()}</span>}
```
with:
```tsx
              : <span className="badge badge-sky"><LocalTime value={m.kickoffAt} opts={{ dateStyle: 'medium', timeStyle: 'short' }} withTz /></span>}
```

- [ ] **Step 4: Modal subtitle date strings (`:355`, `:1445`)** — these pass a **string** to `ScoreEditModal sub` (date-only, can't host a component). Replace `new Date(edit.kickoffAt).toLocaleDateString()` (`:355`) and `new Date(m.kickoffAt).toLocaleDateString()` (`:1445`) with the locale formatter `fmt.date(<that value>, { dateStyle: 'medium' })`. Concretely:
  - `:355`: `sub={\`${edit.round} · ${fmt.date(edit.kickoffAt, { dateStyle: 'medium' })}\`}`
  - `:1445`: `sub={\`${m.round} · ${fmt.date(m.kickoffAt, { dateStyle: 'medium' })}\`}`
  (Date-only → tz shift negligible; locale-consistent; client-rendered. No `withTz` in a modal subtitle.) Ensure `fmt` is in scope in each caller (from `useT()`).

- [ ] **Step 5: Verify** `pnpm --filter @wc/web exec tsc --noEmit` (0) + `pnpm --filter @wc/web test` (only the pre-existing `Flag` fail).

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/screens-admin.tsx
git commit -m "feat(web/admin): match times in client tz (LocalTime + locale date subtitles)"
```

---

## Task 6: Phase verification + handoff

- [ ] **Step 1:** `pnpm --filter @wc/web exec tsc --noEmit` → exit 0.
- [ ] **Step 2:** `pnpm --filter @wc/web test` → `formatGmtOffset` green; only the pre-existing `Flag` fail.
- [ ] **Step 3: Grep** `grep -rn "fmt.date(m.kickoffAt\|new Date(m.kickoffAt).toLocale\|new Date(edit.kickoffAt).toLocale" apps/web/components` — every match-kickoff display now goes through `<LocalTime>` or a locale `fmt.date` (no bare `new Date().toLocaleString()` left for kickoff).
- [ ] **Step 4: Report** + manual check owed (jsdom has no real tz): in a UTC+7 browser the opener shows `02:00, 12 Jun · GMT+7` (not 23h/19h 11 Jun); changing OS tz changes both the time and the label; admin match list shows local time. STOP for review.

---

## Self-Review

**Spec coverage:** D1 client tz + SSR-safe → Task 2 `<LocalTime>` (mounted guard, browser-tz post-mount). D2 GMT label → Task 1 `formatGmtOffset`/`tzOffsetLabel` + `withTz`. D3 all sites incl. admin → Tasks 3–5 (match, tournament, lobby, core, admin). Tests → Task 1. ✓

**Placeholder scan:** none — every step has exact before/after. The InfoCell-widen + Home-eyebrow-JSX restructure + modal-sub string handling are the three "can't host a component" cases, each resolved explicitly.

**Type consistency:** `<LocalTime value opts withTz>` signature defined Task 2, used identically Tasks 3–5. `formatGmtOffset(minsAheadOfUtc)` / `tzOffsetLabel(d)` defined Task 1, consumed by `<LocalTime>` (Task 2). `InfoCell.value: React.ReactNode` (Task 3 Step 4) accepts both the new `<LocalTime>` and the 3 existing string callers.

**Note:** All target components are `'use client'` with client-fetched match data, so `<LocalTime>` re-renders post-mount in the browser tz — the visible time is always client-local; the `· GMT+X` label makes the applied tz self-evident (and reveals the runtime tz if a user is on a non-local machine).
