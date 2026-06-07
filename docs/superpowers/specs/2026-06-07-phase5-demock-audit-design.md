# Design: Phase 5 — Full De-Mock Audit (user + admin)

**Date:** 2026-06-07
**Status:** Approved (design) — pending spec review → writing-plans

## Goal

Eliminate the last mock/static reads across the app so every screen renders **live, DB-backed data** through one betting path. Two surfaces: **user** screens (Home/Landing/MyBets/Lobby-create) and **admin** screens (Overview/UserDetail/Audit/Pipeline).

## Context / constraint

The remaining "mock" is two things, not fabricated data in most cases:
1. **Static `@wc/fixtures` reads** — real-aligned reference data (same as the DB seed) read from a static bundle instead of the live API, so they miss live odds / `bettingLocked` / scores.
2. **A parallel mock-betting store path** (global `BetSlip` + `openBet`/`confirmBet`) used only by Home/Landing.
3. **A few genuinely-fabricated admin bits** — `AdmOverview` KPIs, `AdmUserDetail` ledger/bets/win-rate, `AdmAudit` fallback, `AdmPipeline` footer.

**No schema change. No new deps. No API keys.** New work is read endpoints over existing tables.

## Decisions (locked)

- **Full audit** — user A+B+C+D and admin E1+E2+E3+E4.
- **Betting:** reuse the real `MatchBetCard` flow everywhere; retire the store's mock-betting members + global `BetSlip`.
- **Overview KPIs:** compute only what existing tables support; drop metrics with no real source.
- Execution in sub-steps with stop-for-review; **A+D together** (D depends on A).

---

## USER SURFACE

### A — Home + Landing real featured matches + real betting
- **Refactor `MatchBetCard`** (`screens-match.tsx`) to be **self-contained**: it owns its own slip state + confirm handler + renders `MatchBetSlip` internally. Export it. `Schedule` simplifies to mapping `<MatchBetCard m s/>` (drops its parent-level slip/confirm/sending state).
- **Home** (`screens-core.tsx`): fetch `/api/v1/matches`; featured = first 3 `SCHEDULED` (by `kickoffAt`) with odds → render `<MatchBetCard>`. Remove `feat`/`WC.matchById`, `MatchCard`, `s.openBet`.
- **Landing** (`screens-core.tsx`): same; "Matchday" = next ~5 upcoming → `<MatchBetCard>`. Remove `today`/`WC.matchById`.
- Replace the hardcoded `s.go('match', { id: 23 })` (the featured spotlight card) with the first real featured match id (or hide if none).

### B — Lobby-create match picker (`screens-lobby.tsx`)
- Replace the `[...WC.live, ...WC.upcoming]` pool with a fetch of `/api/v1/matches`.
- Quick-picks become **All / Today (by `kickoffAt` date) / Open (`SCHEDULED`)**. **Drop "Top teams"** (rank-based; `/api/v1/matches` has no FIFA rank). Remove `WC.live/upcoming/byId`. The picker still emits the selected match ids to the lobby-create POST unchanged.

### C — MyBets match labels (`screens-compete.tsx`)
- Fetch `/api/v1/matches` once → build `Map<id, match>`. Render each bet's match (real team codes + status) from the map. Remove `WC.matchById/byId`.

### D — Retire the mock-betting path (after A)
Once A removes Home/Landing's use, these are orphaned — remove:
- Store members `openBet`, `confirmBet`, `setSlipPick`, `closeBet`, `betSlip`, `pickFor` + `BetSlipState` type (`store.ts`) and their impls (`app-shell.tsx`).
- Global `BetSlip` (the exported component in `screens-match.tsx`) + its 3 renders in `app-shell.tsx` + the import.
- `MatchCard` + `OddsRow` (`ui.tsx`) — used only by Home/Landing.
- **Result: one betting path app-wide (`MatchBetCard` → `MatchBetSlip` → POST `/predictions`).**

---

## ADMIN SURFACE

### E1 — `AdmAudit` (`screens-admin.tsx`) — removal
`/api/v1/admin/audit` already exists. Remove the `MOCK_AUDIT` constant + use it as the initial/fallback state; initialise `log` to `[]` and render an empty state ("No audit entries yet.") when the fetch returns nothing.

### E2 — `AdmPipeline` (`screens-admin.tsx`) — removal
Remove the hardcoded footer paragraph ("pundit.preview fell back to OpenAI… news.crawl failed 503"). If desired, replace with a real line derived from fetched jobs where `status === 'error'` (e.g. "N job(s) failed in the last batch"); otherwise omit. No fabricated text.

### E3 — `AdmUserDetail` (`screens-admin.tsx`) + new endpoint
- **New route** `GET /api/v1/admin/users/[id]` (admin-gated) returning the user's real detail:
  - profile (name/email/role/createdAt/flags from `User`),
  - wallet balance (GLOBAL `Wallet`),
  - recent ledger (`PointLedger` where `userId`, newest 10): `{ type, amount, balanceAfter, createdAt }`,
  - recent bets (`Prediction` where `userId`, GLOBAL, newest 10): `{ matchId, outcome, stake, oddsSnapshot, status }`,
  - stats from `predictionUserStats` (`settledCount`, `winCount`, `totalStaked`, `totalReturned`) → win-rate = `winCount/settledCount`, ROI = `(totalReturned-totalStaked)/totalStaked`.
- **`AdmUserDetail`** fetches this on open; renders real ledger + bets (team codes resolved from a `/api/v1/matches` map or the returned matchIds) + real win-rate/ROI. Remove the hardcoded `ledger`/`bets` arrays, the `21%/58%` win-rate, and `WC.matchById/byId`. Keep the existing real `flags`/`ip` cluster warning + the ban action.

### E4 — `AdmOverview` (`screens-admin.tsx`) + new endpoint
- **New route** `GET /api/v1/admin/metrics` (admin-gated) computing from existing tables:
  - `betsToday` = `Prediction` count where `createdAt >= start-of-day`,
  - `articlesPending` = `NewsArticle` count where `status = 'PENDING'`,
  - `settledCount` = `Prediction` count where `status IN (WON,LOST)`,
  - `totalUsers` = `User` count.
- **`AdmOverview`** replaces the fabricated KPIs (`48.2K active users`, `11,940 bets`, `6 articles`, `99.9%`) with these real values. **Drop** "Active users (24h)" and "Settle accuracy" (no real source). The KPI row becomes exactly 4 cells: **Bets today · Open risk flags (already real) · Articles pending · Total settled**. (`totalUsers` is returned by the endpoint but not shown in the KPI row.)

---

## Error handling
- All new admin routes: `requireAdmin` → 403; bad id → 400/404; never throw on empty (return zeros/empty arrays).
- All client fetches: graceful (keep prior state / empty), no fabricated fallback.

## Testing
- **Unit (web, jsdom + mock fetch):** Home/Landing render `MatchBetCard` from mocked `/matches`; Lobby-create picker lists mocked matches; MyBets renders labels from mocked `/matches`; AdmOverview renders real KPIs from mocked `/admin/metrics`; AdmUserDetail renders real ledger/bets from mocked `/admin/users/:id`; AdmAudit empty state.
- **`mockStore`** in tests: drop the removed members (`openBet`/`confirmBet`/`setSlipPick`/`closeBet`/`betSlip`/`pickFor`) and `BetSlipState`.
- tsc clean + full web suite green. New endpoints verified by build + unauth 403 + (where data exists) a live read.

## Sequencing (sub-steps, stop-for-review between)
1. **A + D** — Home/Landing real matches + `MatchBetCard` refactor, then retire the mock-betting path.
2. **B** — lobby-create picker.
3. **C** — MyBets labels.
4. **E1 + E2** — admin removals.
5. **E3** — `/admin/users/:id` + AdmUserDetail.
6. **E4** — `/admin/metrics` + AdmOverview.

## Out of scope
- "Active users (24h)" + "Settle accuracy" KPIs (no real data source).
- Any schema change, new external dependency, or API key.
- Re-styling already-real screens beyond what de-mocking requires.
