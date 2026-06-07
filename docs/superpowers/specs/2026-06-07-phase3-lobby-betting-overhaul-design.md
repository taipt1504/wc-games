# Phase 3 (lobby review) — Betting overhaul + host controls — Design

> Date: 2026-06-07 · Status: Approved (design) · Scope: `packages/db` (migration), `packages/lobby`, `apps/web`
> From Phase-3 lobby review (5 issues, Image #5).

## Issues → fixes
1. Host odds-edit shows a blurred overlay, no popup → `LobbyOddsModal` renders mock teams (`WC.byId`) on real match ids; **de-mock** fixes it.
2. Host can't bet → `LobbyMatches` disables bet buttons when `isHost`; **remove the disable**.
3. Bet is single-pick, default 100, no stake input, no multi-outcome → **bet-slip popup** + **1-bet-per-outcome** model.
4. Member can't request borrow → no member borrow route; **add `POST /lobbies/[id]/borrow`** + wire `BorrowModal`.
5. Host can't set member points → **`adjustMemberPoints`** + UI in `LobbyMembers`.

Root cause for 1–3: lobby workspace renders the `WC` mock (`WC.lobbyMatches`/`WC.byId`); betting/odds operate on mock ids. **De-mock the lobby workspace to real data.**

## Decisions (locked)
| # | Decision | Choice |
|---|---|---|
| A | Multi-bet | **1 bet per outcome** (migration; up to 3/match; shared constraint → applies to global too) |
| B | Host points | **Grant/deduct delta** (ledger `ADMIN_ADJ`) |
| C | Scope | All five in one phase |

## 1. Migration (approved)
`Prediction` `@@unique([userId, contextType, contextId, matchId, market])` → `@@unique([userId, contextType, contextId, matchId, market, outcome])`. Hand-authored SQL: `DROP INDEX` old + `CREATE UNIQUE INDEX` new, via `migrate deploy` (no shadow DB). Predictions=0 currently → safe. Relaxes global betting (UI still does 1 bet/match — unaffected).

## 2. Backend
- **`packages/lobby` `adjustMemberPoints(prisma, lobbyId, hostId, memberUserId, delta)`** — verify host owns lobby + target is a member; tx: lobby wallet `+= delta` (floor 0; reject if would go negative) + `pointLedger(ADMIN_ADJ, context=LOBBY)`. Returns new balance.
- **`placeLobbyBet`** — new unique allows per-outcome. If an OPEN prediction for the SAME outcome exists → refund its stake (wallet += old, ledger reversal) + delete, then place fresh (stake editable). Host already allowed (member).
- **Routes**:
  - `POST /lobbies/[id]/borrow` `{amount}` → `requestBorrow` (member). 422 invalid, 403 non-member.
  - `POST /lobbies/[id]/members/[uid]/adjust` `{delta}` → `adjustMemberPoints` (host only). 403/422/409 (insufficient).
  - `GET /lobbies/[id]` — add `matches`: scoped real matches `{ id, round, status, kickoffAt, home, away, odds(lobby override→house), bets:[{outcome,stake,status}] }` for the caller.

## 3. Frontend (`screens-lobby.tsx`)
- `LobbyView` renders `d.matches` (real); drop `WC.lobbyMatches`/`WC.byId`. Odds state seeded from real `m.odds`.
- `LobbyMatches`: real teams; bet buttons enabled for everyone (incl. host); each outcome shows the caller's bet+stake if placed; tapping an outcome → bet slip.
- **`LobbyBetSlip`** modal: match + outcome + stake input + lobby balance + payout → `POST /lobbies/[id]/predictions {matchId,outcome,stake}`; on success refresh; re-tap a placed outcome → prefilled (edit).
- `LobbyOddsModal`: real teams (passed match object, not `WC.byId`).
- `BorrowModal`: `POST /lobbies/[id]/borrow {amount}` → toast; clears.
- `LobbyMembers`: host sees `± points` per member → `adjust` endpoint → refresh board.

## 4. Testing
- `@wc/lobby` int: `adjustMemberPoints` (host-only, delta, ledger); `placeLobbyBet` multi-outcome (A+B+draw) + same-outcome replace.
- Routes: borrow (member), adjust (host-only 403), lobby detail returns matches.
- Lobby UI unit: real matches render, bet slip posts, host bet enabled, borrow posts, point-adjust.
- Live: A+B+draw on one match, host bet, odds edit, borrow→approve, host ±points; existing suites green.

## Stop-conditions
Migration approved. No new dependency.
