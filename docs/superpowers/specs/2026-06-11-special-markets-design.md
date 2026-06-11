# Special Markets ("Will Ronaldo cry?") — Design

**Date:** 2026-06-11
**Goal:** A novelty YES/NO prediction market ("Will Cristiano Ronaldo cry?") that users predict + stake on — globally (admin-set odds, global points) and per-lobby (host-set odds, lobby points) — surfaced via a highlighted banner on Home + in lobbies, a dedicated sidebar entry/screen, and resolved manually by an admin. Built as a generic special-market subsystem, seeded with this one market, isolated from `Match`.

**Scope:** `packages/db` (3 models + enums + migration), `packages/prediction` (special-market service), `packages/pipeline` (seed), `apps/web` (APIs + screen + banner + sidebar + admin + lobby host). Player + admin + host surfaces.

**Approved decisions (2026-06-11):** new isolated models + migration (not a synthetic-Match hack); global **and** per-lobby contexts (mirror Match odds); generic model but seed/surface only `RONALDO_CRY` (no admin create-market UI); admin manually resolves YES/NO anytime.

---

## Why new models (not reuse Prediction)

`Prediction.matchId` is a hard FK to `Match`; `Outcome` is `HOME|DRAW|AWAY` only; `settleMatch` derives result from a score; `MatchOdds` is `mHome/mDraw/mAway`. A YES/NO, match-less market can't reuse these without either polluting the schedule with a fake `Match` (leaks into standings/fd-sync/scorers) or abusing the enum. New isolated models are clean and never touch the match pipeline.

---

## Architecture

### 1. DB (`packages/db/prisma/schema.prisma`) — migration (STOP-GATE)

New enums:
```prisma
enum SpecialOutcome { YES NO }
enum SpecialStatus  { OPEN LOCKED RESOLVED }      // market lifecycle
enum SpecialPredStatus { OPEN WON LOST VOID }     // a user's bet
```

```prisma
// A novelty prop market (e.g. "Will Ronaldo cry?"). Global odds live here (admin-set).
model SpecialMarket {
  id              BigInt         @id @default(autoincrement())
  key             String         @unique          // 'RONALDO_CRY'
  title           String
  titleVi         String?
  subtitle        String?
  subtitleVi      String?
  status          SpecialStatus  @default(OPEN)
  resolvedOutcome SpecialOutcome?                  // set when RESOLVED
  oddsYes         Decimal        @db.Decimal(6, 2) @default(1.50)   // profit multiplier
  oddsNo          Decimal        @db.Decimal(6, 2) @default(1.50)
  resolvedAt      DateTime?
  updatedAt       DateTime       @updatedAt
  createdAt       DateTime       @default(now())
}

// Per-lobby host odds override (mirrors LobbyMatchOdds). Falls back to SpecialMarket global odds.
model SpecialLobbyOdds {
  id        BigInt   @id @default(autoincrement())
  lobbyId   BigInt
  marketId  BigInt
  oddsYes   Decimal  @db.Decimal(6, 2)
  oddsNo    Decimal  @db.Decimal(6, 2)
  updatedAt DateTime @updatedAt
  @@unique([lobbyId, marketId])
}

// A user's stake on a special market (mirrors Prediction's context model). GLOBAL → global wallet;
// LOBBY → that lobby's wallet. oddsSnapshot frozen at bet time.
model SpecialPrediction {
  id           BigInt           @id @default(autoincrement())
  userId       BigInt
  contextType  ContextType                          // GLOBAL | LOBBY (reuse existing enum)
  contextId    BigInt?                              // null GLOBAL; lobbyId when LOBBY
  marketId     BigInt
  pick         SpecialOutcome
  stake        BigInt
  oddsSnapshot Decimal          @db.Decimal(6, 2)
  status       SpecialPredStatus @default(OPEN)
  payout       BigInt           @default(0)
  settledAt    DateTime?
  createdAt    DateTime         @default(now())
  @@index([marketId, status])
  @@index([userId, contextType, contextId])
}
```
Migration hand-authored + applied via `prisma migrate deploy` (not `migrate dev`). `ContextType` is the existing enum (reused).

### 2. Service — `packages/prediction/src/special-market.ts`

Mirrors `placeBet` / `settleMatch` escrow+ledger exactly (wallet by `(userId, contextType, contextId)`, `STAKE` ledger `amount=-stake`, `SETTLE` ledger on payout, `refType:'SPECIAL', refId:marketId`).

- **`resolveSpecialOdds(prisma, marketId, lobbyId?)`** → `{ oddsYes, oddsNo, source }`: lobby override (`SpecialLobbyOdds`) → market global → the market row. (Mirrors `getLobbyOdds`.)
- **`placeSpecialBet(prisma, { userId, marketKey, pick, stake, contextType, contextId })`** (atomic tx): market must be `OPEN`; resolve odds for the context; check wallet balance; decrement wallet; create `SpecialPrediction` (OPEN, `oddsSnapshot` = the picked side's odds); write `STAKE` ledger. One open bet per (user, context, market) — guard like `placeBet`'s dupe check.
- **`setSpecialLobbyOdds(prisma, lobbyId, ownerId, marketId, {oddsYes,oddsNo})`** — host-auth (`lobby.ownerId === ownerId` else `NOT_OWNER`); upsert `SpecialLobbyOdds`. (Mirrors `setLobbyOdds`.)
- **`resolveSpecialMarket(prisma, key, outcome)`** (atomic tx, idempotent): set market `status=RESOLVED, resolvedOutcome, resolvedAt`; for every `OPEN` `SpecialPrediction` of that market: `won = pick === outcome`; `payout = won ? stake + round(stake × oddsSnapshot) : 0`; credit the bettor's `(contextType, contextId)` wallet + `SETTLE` ledger; set `WON|LOST` + payout + settledAt. (Mirrors `settleMatch`'s per-prediction credit loop, but result = the admin outcome, not a score.)
- **`setSpecialOdds(prisma, key, {oddsYes,oddsNo})`** — admin sets market global odds.

### 3. APIs (`apps/web/app/api/v1`)

- `GET /special-markets` (+ optional `?lobbyId=`) → active markets with **context-resolved** odds (`resolveSpecialOdds`), `status`, `resolvedOutcome`, and the caller's existing bet for that context. (Used by banner + screen.)
- `POST /special-predictions` — body `{ marketKey, pick: 'YES'|'NO', stake, lobbyId? }` → `placeSpecialBet` (contextType LOBBY if `lobbyId`, else GLOBAL; lobby membership checked when lobbyId). Session-auth.
- `POST /admin/special-markets/[key]/odds` — `requireAdmin` → `setSpecialOdds`. + audit log `SET_SPECIAL_ODDS`.
- `POST /admin/special-markets/[key]/resolve` — `requireAdmin`, body `{ outcome: 'YES'|'NO' }` → `resolveSpecialMarket`. + audit `RESOLVE_SPECIAL`.
- `POST /lobbies/[id]/special-odds` — host-auth, body `{ marketKey, oddsYes, oddsNo }` → `setSpecialLobbyOdds`. (Mirrors `/lobbies/[id]/odds`.)

### 4. UI (`apps/web`)

- **`components/special-banner.tsx`** (new, `'use client'`) — highlighted gradient card showing the market title + YES/NO odds (context-resolved) + CTA. Props: `{ s, lobbyId? }`. Renders on **Home** (`screens-core.tsx`, in the right-column stack near `PunditPromo`, global odds) and **inside LobbyView** (`screens-lobby.tsx`, lobby odds) → navigates to the special screen (carrying lobby context).
- **`components/screens-special.tsx`** (new) — `Specials` screen: the market card, **YES · odds / NO · odds** buttons + stake input + place-bet (adapts the existing bet-slip UX), the user's current bet, resolved/won-lost badge when `RESOLVED`. Works in global context; when opened from a lobby, uses lobby odds + stakes lobby points.
- **Sidebar:** add `specials` to `app-shell.tsx` `ROUTES` (→ `Specials`), `RAIL` (a `nav.specials` item, icon e.g. `'flame'`/`'target'`), `TITLE_KEYS`. (Mirrors how `scorers` was added.)
- **Admin** (`screens-admin.tsx`): a Special Markets section — set odds (oddsYes/oddsNo) + **"Resolve: Cried (YES) / Didn't (NO)"** buttons. English labels (admin has no i18n).
- **Lobby host** (`screens-lobby.tsx`): host-only control to set this lobby's special odds (mirrors the lobby match-odds edit).
- **i18n** EN/VI for `nav.specials`, banner/screen copy, YES/NO labels — VI uses **"dự đoán"** (never "cược"); e.g. YES="Có khóc", NO="Không khóc".

### 5. Seed (`packages/pipeline/src/seed.ts`)

Add `seedSpecialMarkets(prisma)` — upsert the `RONALDO_CRY` market (title "Will Cristiano Ronaldo cry?", VI "Ronaldo có khóc không?", default odds 1.50/1.50, status OPEN). Called from `seed-cli` alongside `seedTournament`/`seedNews`. Idempotent.

---

## Settlement flow

Admin opens the market → sets odds → users bet (global + per-lobby). Admin clicks **Resolve YES/NO** → `resolveSpecialMarket` locks it + pays every open bet from its own wallet (global or lobby), winners `stake×(1+oddsSnapshot)`, losers 0. Idempotent (re-resolve is a no-op once RESOLVED). No `Match`/`Settlement` involvement.

---

## Phases & gates

- **P1 — DB + seed.** 3 models + enums; hand-authored migration (**migrate-deploy STOP-GATE**); `seedSpecialMarkets`. *Done when:* migration applied, `RONALDO_CRY` seeded, `@wc/db` regenerated + builds.
- **P2 — Service + APIs.** `special-market.ts` (resolveOdds/placeBet/resolve/setOdds/setLobbyOdds) + the 5 routes. Unit-test the pure payout math. *Done when:* place + resolve work end-to-end (global + lobby), pipeline/prediction build + tests green.
- **P3 — Player UI.** `special-banner` (home + lobby) + `screens-special` + sidebar + i18n. *Done when:* banner shows odds, screen places a bet, sidebar routes.
- **P4 — Admin + host.** Admin set-odds + resolve; lobby-host set-odds. *Done when:* admin resolves → bets settle; host odds override applies in-lobby.

**Stop-and-ask:** the P1 migration (apply via `migrate deploy`).

**Verification gate (each phase):** build touched packages in dependency order (`@wc/db → @wc/prediction → @wc/pipeline → @wc/web`); `pnpm --filter @wc/web exec tsc --noEmit`; relevant tests (pre-existing `Flag` fail is known/unrelated). Live bet/resolve verified via the API/CLI.

---

## Out of scope / non-goals
- Admin create/edit/delete arbitrary markets (only the seeded one is surfaced).
- Auto-resolution from any data source (crying has none — admin decides).
- Reusing `Match`/`Prediction`/`settleMatch` (deliberately isolated).
- Parlays/power-ups/micro on special markets.
