# Phase 4 — Tournament betting (block-bet + confirm-result + match de-mock) — Design

> Date: 2026-06-07 · Status: Approved (design) · Scope: `packages/db` (migration), `packages/prediction`, `packages/lobby`, `apps/web`
> Source: master plan Phase 4 + PRD [04-scoring], prediction-scoring SD. Includes the deferred Phase-2 match-screen de-mock.

## Decisions (locked)
| # | Decision | Choice |
|---|---|---|
| A | Block mechanism | `Match.bettingLocked Boolean @default(false)` (migration) — server-enforced |
| B | Global betting | Multi-outcome (like lobby): stake popup, back 1/X/2 per match |
| C | De-mock scope | Match data + betting only; Form/H2H/Lineups + Home/Landing featured → Phase 5 |
| D | Confirm-result | Reuse `resettleMatch` (handles first-confirm + correction; settles global+lobby) |

## What already exists (no rebuild)
`settleMatch`/`resettleMatch` settle ALL predictions for a match across contexts, credit the right wallet (global vs lobby), apply knockout exact-score bonus + power-ups, update ROI stats (global), recompute win-streak, idempotent via `settlement(matchId)`. `placeBet`/`placeLobbyBet` enforce SCHEDULED + kickoff server-side.

## Migration
`Match.bettingLocked Boolean @default(false)` — hand-authored `ALTER TABLE ADD COLUMN` + `migrate deploy` (no shadow DB). Additive.

## Sequencing: 4A + 4B first (this chunk), then 4C.

### 4A — Block bet (server-enforced)
- `placeBet` + `placeLobbyBet`: after the match load, `if (match.bettingLocked) throw 'BET_LOCKED'`.
- `POST /api/v1/admin/matches/[id]/lock-betting` body `{ locked: boolean }` → `requireAdmin` → set `bettingLocked` + audit `LOCK_BETTING`.
- Admin UI (`AdmTourney`): per-match **Lock/Unlock betting** toggle.

### 4B — Confirm result → points
- Admin `ScoreEditModal` (currently mock `saveScore` toast) → `POST /admin/matches/[id]/resettle {home,away}` → real settle. Toast result + refresh.
- Admin `AdmTourney` matches list **de-mocked** to real `/api/v1/matches` (needed for block + confirm to target real matches). Shows status, score, `bettingLocked`, settled badge.
- Users see result: MatchDetail FT score/result (4C) + MyBets shows `WON/LOST`+payout (`/me/predictions`, real) + balance via `/me`.

### 4C — Match-screen de-mock + global multi-bet (second chunk)
- `Schedule` + `MatchDetail` → real `/api/v1/matches[/:id]` (teams/odds/status/score/result). Closes the mock-id→real-DB seam.
- Global betting → multi-outcome: tap outcome → bet-slip popup (stake + payout + balance + knockout exact-score) → `POST /predictions`; back 1/X/2; show placed bets + `WON/LOST`; disabled + "Betting closed" when `bettingLocked` or past kickoff.
- Rewire `app-shell` bet store (`openBet`/`betSlip`/`confirmBet`/`bets`) + `BetSlip` + `MatchCard`/`OddsRow` usage to the real match shape (in the match screens). Home/Landing featured stay on mock (Phase 5).

## Testing
- Migration applies.
- `placeBet`/`placeLobbyBet` reject when `bettingLocked` (live).
- `lock-betting` route (admin-only 403); `resettle` first-confirm settles (live: bet → block → unblock → bet → confirm → WON/LOST + balance/ROI).
- De-mocked Schedule/MatchDetail/AdmTourney render real data; global multi-bet posts; existing suites green.

## Stop-conditions
Migration approved (decision A). No new dependency.

## Notes
- `bettingLocked` is independent of lifecycle; admin can lock a SCHEDULED match without changing status.
- Per-outcome unique (Phase 3) already lets global betting back 1/X/2 — 4C just exposes it in the UI.
