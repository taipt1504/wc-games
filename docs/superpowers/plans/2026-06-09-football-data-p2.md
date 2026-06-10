# Football-Data.org — PHASE 2 Implementation Plan (de-mock finish + enhance UI)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Finish de-mocking the player UI and surface the real football-data fields already in the DB — translated match status, translated knockout round labels, full standings columns, and real bracket scores — frontend/render + i18n only.

**Architecture:** The match/tournament screens already fetch real DB data via `/api/v1/*` (prior de-mock passes did the heavy lifting). The remaining work is render-only: replace raw DB enum strings with i18n labels, add columns/values the API already returns, and remove a dead `@wc/fixtures` import. **No logic changes, no API/DB/schema changes, no new deps.** One small exception is flagged in Task 6 (optional) where the bracket needs real knockout scores.

**Tech Stack:** Next 15 React (custom CSS, no Tailwind), the existing `useT()` i18n hook + `en.ts`/`vi.ts` dictionaries.

**Verification gate (every task):**
```bash
pnpm --filter @wc/web exec tsc --noEmit      # exit 0
pnpm --filter @wc/web test                    # 122 pass (jsdom — proves no behavioral regression, NOT visual)
```
jsdom has no layout engine, so green tests prove no behavioral break, not visual correctness — manual device/locale check still required at phase end.

**Scope guards:**
- Player-facing only. **Admin screens out of scope** (their English placeholders at `screens-admin.tsx:331/365/401/475/1212` are explicitly NOT touched here).
- Do NOT rip out `@wc/fixtures` / `lib/wc.ts` wholesale — `WC.me`/`WC.leaderboard`/etc. are harmless empty first-paint stubs and `ui.tsx`'s `Flag` still uses `byId` for a legacy color path. Only remove the clearly-dead import (Task 5).
- EN values are byte-stable where existing tests assert them; only ADD keys.

**Deferred (out of P2 — note, don't build):** venue in the match *list* response (detail already shows venue; list needs a backend join), live `minute` display (API doesn't return it), ET/penalty sub-scores, team-list `playerCount`/manager labels, dynamic matchday label. These are enhancements beyond the spec's core P2 asks.

---

## File Structure

| File | Change |
|---|---|
| `apps/web/lib/i18n/dictionaries/en.ts` | ADD status + standings-column keys |
| `apps/web/lib/i18n/dictionaries/vi.ts` | ADD same keys (VI) |
| `apps/web/components/screens-match.tsx` | Translate status enum; remove dead `WC` import |
| `apps/web/components/screens-tournament.tsx` | Translate knockout round in fixtures; add standings columns; real bracket scores (Task 6) |

---

## Task 1: i18n keys — status + standings columns

**Files:**
- Modify: `apps/web/lib/i18n/dictionaries/en.ts`
- Modify: `apps/web/lib/i18n/dictionaries/vi.ts`

- [ ] **Step 1: Find the `match` and `tournament` key groups** in `en.ts`. The `match` group already has `kickoff/roundLabel/venue/status/live/fullTime/ft`. The `tournament` group already has `colRank/colTeam/colP/colGD/colPts`.

- [ ] **Step 2: ADD to `en.ts`** — in the `match` group add:
```ts
    statusScheduled: 'Scheduled',
    statusLive: 'Live',
    statusFinished: 'Finished',
    statusPostponed: 'Postponed',
    statusCancelled: 'Cancelled',
```
and in the `tournament` group add:
```ts
    colW: 'W',
    colD: 'D',
    colL: 'L',
    colGF: 'GF',
    colGA: 'GA',
```

- [ ] **Step 3: ADD the same keys to `vi.ts`** — `match` group:
```ts
    statusScheduled: 'Chưa đá',
    statusLive: 'Đang đá',
    statusFinished: 'Kết thúc',
    statusPostponed: 'Hoãn',
    statusCancelled: 'Hủy',
```
`tournament` group:
```ts
    colW: 'T',
    colD: 'H',
    colL: 'B',
    colGF: 'BT',
    colGA: 'BB',
```
(VI football abbreviations: Thắng/Hòa/Bại, Bàn Thắng/Bàn Bại.)

- [ ] **Step 4: Verify** `pnpm --filter @wc/web exec tsc --noEmit` (exit 0) and `pnpm --filter @wc/web test` (122 pass — the dictionary parity/byte tests must stay green; we only added keys).

- [ ] **Step 5: Commit**
```bash
git add apps/web/lib/i18n/dictionaries/en.ts apps/web/lib/i18n/dictionaries/vi.ts
git commit -m "feat(web/i18n): add match status + standings column labels (EN/VI)"
```

---

## Task 2: Match detail — translate the status enum

**Files:**
- Modify: `apps/web/components/screens-match.tsx` (the `MatchDetail` info strip, ~line 432)

- [ ] **Step 1: Read** `screens-match.tsx` around the info-strip cell that renders `value={m.status}` (~line 432). Confirm a `t` function from `useT()` is in scope in that component (it is — the file already uses `t('round.*')`).

- [ ] **Step 2: Add a local status→label helper** near the top of `MatchDetail` (or as a module-level pure function), mapping the DB enum to the new keys:
```tsx
  const statusLabel = (s: string) =>
    s === 'LIVE' ? t('match.statusLive')
    : s === 'FINISHED' ? t('match.statusFinished')
    : s === 'POSTPONED' ? t('match.statusPostponed')
    : s === 'CANCELLED' ? t('match.statusCancelled')
    : t('match.statusScheduled');
```

- [ ] **Step 3: Use it** — change the status info cell from `value={m.status}` to `value={statusLabel(m.status)}`.

- [ ] **Step 4: Verify** `pnpm --filter @wc/web exec tsc --noEmit` (exit 0) + `pnpm --filter @wc/web test` (122 pass).

- [ ] **Step 5: Commit**
```bash
git add apps/web/components/screens-match.tsx
git commit -m "feat(web): render translated match status in detail (no raw enum)"
```

---

## Task 3: Tournament fixtures — translate knockout round labels

**Files:**
- Modify: `apps/web/components/screens-tournament.tsx` (TeamDetail fixtures, ~line 125)

- [ ] **Step 1: Read** `screens-tournament.tsx` around line 125 where a fixture row renders the round as:
```tsx
m.round === 'GROUP' ? t('round.groupPrefix') : m.round
```
(`m.round` for knockouts is the raw enum `R32/R16/QF/SF/THIRD/FINAL`.) The `round.R32`…`round.FINAL` keys already exist and are used by `screens-match.tsx` — reuse them.

- [ ] **Step 2: Replace** the raw `m.round` branch with the existing round keys. **Verified:** `t` is `(path: string, vars?) => string` (`apps/web/lib/i18n/hooks.ts:11`) — it takes a plain string, so the template-literal key compiles:
```tsx
m.round === 'GROUP' ? t('round.groupPrefix') : t(`round.${m.round}`)
```

- [ ] **Step 3: Verify** `pnpm --filter @wc/web exec tsc --noEmit` (exit 0) + `pnpm --filter @wc/web test` (122 pass).

- [ ] **Step 4: Commit**
```bash
git add apps/web/components/screens-tournament.tsx
git commit -m "feat(web): translate knockout round labels in team fixtures"
```

---

## Task 4: Standings — add W/D/L/GF/GA columns

**Files:**
- Modify: `apps/web/components/screens-tournament.tsx` (the `Groups` standings table, ~line 161-180)

- [ ] **Step 1: Read** the `Groups` component table. **Verified** (`apps/web/lib/tournament.ts:19`): the standings row type is `{ played, won, drawn, lost, gf, ga, gd, pts }` (note `drawn`, not `draw`). Confirm current `<thead>` renders only `colRank/colTeam/colP/colGD/colPts` and each `<tr>` renders position/team/played/gd/pts.

- [ ] **Step 2: Add the columns.** In the table header, insert W/D/L between P and GD, and GF/GA after (or before GD — match the conventional order P W D L GF GA GD Pts). Using the new keys:
```tsx
<th>{t('tournament.colP')}</th>
<th>{t('tournament.colW')}</th>
<th>{t('tournament.colD')}</th>
<th>{t('tournament.colL')}</th>
<th>{t('tournament.colGF')}</th>
<th>{t('tournament.colGA')}</th>
<th>{t('tournament.colGD')}</th>
<th>{t('tournament.colPts')}</th>
```
and in each body row add the matching cells:
```tsx
<td className="tnum">{r.won}</td>
<td className="tnum">{r.drawn}</td>
<td className="tnum">{r.lost}</td>
<td className="tnum">{r.gf}</td>
<td className="tnum">{r.ga}</td>
```
(Use the actual field names from the `StandingRow` type — confirm `won/drawn/lost/gf/ga` vs any alias before writing. Keep the existing P/GD/Pts cells.)

- [ ] **Step 3: Responsive check** — this widens the table. The standings table should already sit in a `.scroll-x` wrapper from the responsive pass; if not, wrap it so the extra columns scroll horizontally on mobile rather than overflow. Verify the table is inside `.scroll-x` (add it if missing — render-only).

- [ ] **Step 4: Verify** `pnpm --filter @wc/web exec tsc --noEmit` (exit 0) + `pnpm --filter @wc/web test` (122 pass).

- [ ] **Step 5: Commit**
```bash
git add apps/web/components/screens-tournament.tsx
git commit -m "feat(web): full standings columns (W/D/L/GF/GA) from API"
```

---

## Task 5: De-mock cleanup — remove dead fixtures import

**Files:**
- Modify: `apps/web/components/screens-match.tsx` (import line ~4)

- [ ] **Step 1: Confirm dead.** Grep `screens-match.tsx` for `WC.` — there are 0 references (the `WC` symbol is imported but unused). Confirm the import line ~4 imports `WC` alongside still-used symbols (types/`fmt`).

- [ ] **Step 2: Remove `WC` from the import** (keep everything else on that line that IS used). Do not remove other symbols.

- [ ] **Step 3: Sweep for other rendered mock.** Grep `apps/web/components` for any remaining rendered `@wc/fixtures` match/team/standings data (not types, not empty stubs). Expected: none beyond `ui.tsx`'s legacy `byId` color path (leave that — it's a fallback, not mock display). Report what you find; only remove genuinely-dead imports your change orphans.

- [ ] **Step 4: Verify** `pnpm --filter @wc/web exec tsc --noEmit` (exit 0 — proves no other code used `WC` here) + `pnpm --filter @wc/web test` (122 pass).

- [ ] **Step 5: Commit**
```bash
git add apps/web/components/screens-match.tsx
git commit -m "chore(web): drop dead @wc/fixtures import from screens-match"
```

---

## Task 6 (OPTIONAL): Bracket — real knockout scores

**Files:**
- Modify: `apps/web/components/screens-tournament.tsx` (the `Bracket` / `BracketMatch`, ~line 248)

> Optional because the bracket is currently *projected* from group standings, not wired to real knockout fixtures. Showing real scores means matching a projected slot to a real `/api/v1/matches` knockout row. If that matching is non-trivial, STOP and report — do not invent a fragile mapping. Skip this task if it requires more than display wiring.

- [ ] **Step 1: Assess.** Read the `Bracket` component. It already fetches `/api/v1/groups` + `/api/v1/teams`. Determine whether knockout match scores are reachable without new logic (e.g. a `/api/v1/matches?round=R16` fetch + match by the two team ids). If it needs a new data source/fetch and matching heuristic, mark this task **deferred** and report — that's a logic change beyond P2.

- [ ] **Step 2: If display-only is feasible**, replace the hardcoded `–` (line ~248) with the real `scoreHome–scoreAway` when the corresponding match is FINISHED, else keep `–`. Verify + commit:
```bash
git add apps/web/components/screens-tournament.tsx
git commit -m "feat(web): show real knockout scores in bracket when finished"
```
Otherwise: leave line 248 as-is, note "bracket real-scores deferred — needs knockout fetch+match (logic), out of P2."

---

## Task 7: Phase verification + handoff

- [ ] **Step 1:** `pnpm --filter @wc/web exec tsc --noEmit` → exit 0.
- [ ] **Step 2:** `pnpm --filter @wc/web test` → 122 pass.
- [ ] **Step 3: Grep** `apps/web/components` confirms no rendered mock team/player/match/standings remains (only types, empty stubs, and the `ui.tsx` color fallback).
- [ ] **Step 4: Report** files changed + the manual locale/device check owed: (a) match detail status shows "Scheduled/Đang đá" not "SCHEDULED"; (b) team fixtures show "Round of 16" not "R16"; (c) standings show full P/W/D/L/GF/GA/GD/Pts and scroll on mobile; (d) EN/VI both correct. STOP for review.

---

## Self-Review

**Spec coverage (P2 = "no mock rendered" + "show kickoff/venue/stage/score"):**
- kickoff/venue/stage/score — already rendered (prior de-mock); the gaps were raw-enum status (Task 2) + knockout round labels (Task 3). ✓
- "no mock" — screens already DB-backed; Task 5 removes the last dead fixtures import. ✓
- Standings "show fully" — Task 4 adds the missing W/D/L/GF/GA. ✓
- Bracket scores — Task 6 (optional, gated on it being display-only). ✓

**Placeholder scan:** none — every step has concrete edits. Task 3/4 include "confirm the actual field names / `t()` signature before writing" because those are the two spots where the codebase's exact types must be checked (not guessed).

**Type consistency:** new i18n keys (`match.status*`, `tournament.col{W,D,L,GF,GA}`) are defined in Task 1 and consumed in Tasks 2/4; round keys reused in Task 3 already exist. EN/VI parity maintained (both get the same keys).
