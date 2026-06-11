# Special Markets ("Will Ronaldo cry?") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. **One PHASE per run; STOP for review at each phase boundary.**

**Goal:** A novelty YES/NO market ("Will Ronaldo cry?") users predict + stake on — globally (admin odds, global points) and per-lobby (host odds, lobby points) — with a banner on Home + in lobbies, a sidebar screen, and admin manual resolve.

**Architecture:** New isolated models (`SpecialMarket`/`SpecialLobbyOdds`/`SpecialPrediction`), a `special-market.ts` service mirroring `placeBet`/`settleMatch` escrow+ledger and `getLobbyOdds`/`setLobbyOdds` host-auth, 5 API routes, banner+screen+sidebar+admin+host UI. Never touches `Match`.

**Tech Stack:** Prisma/Postgres, `@wc/prediction`, NestJS-free service fns, Next 15 React (custom CSS), Vitest.

**Verification gate (each phase):** build touched packages in dependency order (`@wc/db → @wc/prediction → @wc/pipeline → @wc/web`); `pnpm --filter @wc/web exec tsc --noEmit`; relevant tests. KNOWN pre-existing failure: `Flag > shows team code` (unrelated). Pipeline unit suite: `pnpm --filter @wc/prediction test` (and exclude int: `-- --exclude='**/*.int.test.ts'` if needed).

**Grounded facts (read from repo):**
- `placeBet` (`prediction-service.ts:85`): `$transaction`; wallet by `{userId, contextType, contextId}`; `wallet.findFirstOrThrow`; decrement; create prediction (`oddsSnapshot`, `status:'OPEN'`); `pointLedger.create({type:'STAKE', amount:-stake, balanceAfter, refType, refId})`. GLOBAL dupe guarded manually via `findFirst({status:'OPEN'})` (NULL contextId).
- `settleMatch` (`:147`): per-pred `wallet.findFirstOrThrow({userId,contextType,contextId})`, credit `payout`, `pointLedger.create({type:'SETTLE', amount:payout, balanceAfter})`, `prediction.update({status, payout, settledAt})`.
- `setLobbyOdds`/`getLobbyOdds` (`lobby-service.ts:130-169`): `lobby.findUniqueOrThrow`; `if (lobby.ownerId !== ownerId) throw 'NOT_OWNER'`; upsert by `lobbyId_matchId`; resolution = lobby override → global → null; `Number(...)` on Decimals.
- admin odds route: `requireAdmin()` → 403; `auditLog.create({actorType:'ADMIN', actorId, action, target, metadata})`.
- lobby host odds route: `getSessionUser()`; try/catch `NOT_OWNER`→403.
- `ContextType` enum exists (`GLOBAL|LOBBY`); `PointLedger` has `refType String?`, `refId BigInt?`; `LedgerType` has `STAKE`/`SETTLE`.
- app-shell scorers wiring: `ROUTES` (`:27`), `PUB_NAV` (`:34`), `RAIL` (`:37`, `sec:'nav.secTournament'`), `TITLE_KEYS` (`:42`), import (`:15`). Icon `'target'` is known-present.
- `seed-cli.ts` calls `seedTournament(prisma)`; `seed.ts` exports it. `prediction/src/index.ts` re-exports each module.
- latest migration: `20260609010000_add_scorer` → new one sorts after as `20260611000000_special_markets`.

---

## File Structure

| File | Phase | Change |
|---|---|---|
| `packages/db/prisma/schema.prisma` | P1 | + 3 enums + 3 models |
| `packages/db/prisma/migrations/20260611000000_special_markets/migration.sql` | P1 | hand-authored |
| `packages/pipeline/src/seed.ts` | P1 | + `seedSpecialMarkets` |
| `packages/pipeline/src/seed-cli.ts` | P1 | call it |
| `packages/prediction/src/special-market.ts` (new) | P2 | `specialPayout` + service fns |
| `packages/prediction/src/special-market.test.ts` (new) | P2 | `specialPayout` unit test |
| `packages/prediction/src/index.ts` | P2 | export `./special-market` |
| `apps/web/app/api/v1/special-markets/route.ts` (new) | P2 | GET |
| `apps/web/app/api/v1/special-predictions/route.ts` (new) | P2 | POST place |
| `apps/web/app/api/v1/admin/special-markets/[key]/odds/route.ts` (new) | P2 | admin odds |
| `apps/web/app/api/v1/admin/special-markets/[key]/resolve/route.ts` (new) | P2 | admin resolve |
| `apps/web/app/api/v1/lobbies/[id]/special-odds/route.ts` (new) | P2 | host odds |
| `apps/web/components/special-banner.tsx` (new) | P3 | banner (home+lobby) |
| `apps/web/components/screens-special.tsx` (new) | P3 | the market screen |
| `apps/web/components/app-shell.tsx` | P3 | sidebar wiring |
| `apps/web/components/screens-core.tsx` | P3 | banner on Home |
| `apps/web/components/screens-lobby.tsx` | P3/P4 | banner + host odds control |
| `apps/web/components/screens-admin.tsx` | P4 | admin odds + resolve |
| `apps/web/lib/i18n/dictionaries/{en,vi}.ts` | P3 | keys |

---

# PHASE 1 — DB + seed

## Task 1: schema models + enums

**Files:** Modify `packages/db/prisma/schema.prisma`

- [ ] **Step 1:** After the `MatchRound` / odds enums area (near other enums), add:
```prisma
enum SpecialOutcome { YES NO }
enum SpecialStatus { OPEN LOCKED RESOLVED }
enum SpecialPredStatus { OPEN WON LOST }
```

- [ ] **Step 2:** After the `LobbyMatchOdds` model, add the 3 models:
```prisma
// Novelty prop market (e.g. "Will Ronaldo cry?"). Global odds live here (admin-set). Isolated from Match.
model SpecialMarket {
  id              BigInt          @id @default(autoincrement())
  key             String          @unique
  title           String
  titleVi         String?
  subtitle        String?
  subtitleVi      String?
  status          SpecialStatus   @default(OPEN)
  resolvedOutcome SpecialOutcome?
  oddsYes         Decimal         @default(1.50) @db.Decimal(6, 2)
  oddsNo          Decimal         @default(1.50) @db.Decimal(6, 2)
  resolvedAt      DateTime?
  updatedAt       DateTime        @updatedAt
  createdAt       DateTime        @default(now())
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

// A user's stake on a special market (mirrors Prediction context model). GLOBAL → global wallet; LOBBY → lobby wallet.
model SpecialPrediction {
  id           BigInt            @id @default(autoincrement())
  userId       BigInt
  contextType  ContextType
  contextId    BigInt?
  marketId     BigInt
  pick         SpecialOutcome
  stake        BigInt
  oddsSnapshot Decimal           @db.Decimal(6, 2)
  status       SpecialPredStatus @default(OPEN)
  payout       BigInt            @default(0)
  settledAt    DateTime?
  createdAt    DateTime          @default(now())

  @@index([marketId, status])
  @@index([userId, contextType, contextId])
}
```

- [ ] **Step 3: Commit** (schema only; migration applied next task)
```bash
git add packages/db/prisma/schema.prisma
git commit -m "feat(db): SpecialMarket/SpecialLobbyOdds/SpecialPrediction models + enums"
```

## Task 2: migration + regenerate  🚦 STOP-GATE

**Files:** Create `packages/db/prisma/migrations/20260611000000_special_markets/migration.sql`

> **GATE:** applies a migration to the dev DB. **STOP for user approval before Step 2.** Use `migrate deploy` (not `migrate dev`). Confirm `DATABASE_URL` is dev.

- [ ] **Step 1: Hand-author** `packages/db/prisma/migrations/20260611000000_special_markets/migration.sql`:
```sql
-- Special (novelty) prediction markets.
CREATE TYPE "SpecialOutcome" AS ENUM ('YES', 'NO');
CREATE TYPE "SpecialStatus" AS ENUM ('OPEN', 'LOCKED', 'RESOLVED');
CREATE TYPE "SpecialPredStatus" AS ENUM ('OPEN', 'WON', 'LOST');

CREATE TABLE "SpecialMarket" (
    "id" BIGSERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleVi" TEXT,
    "subtitle" TEXT,
    "subtitleVi" TEXT,
    "status" "SpecialStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedOutcome" "SpecialOutcome",
    "oddsYes" DECIMAL(6,2) NOT NULL DEFAULT 1.50,
    "oddsNo" DECIMAL(6,2) NOT NULL DEFAULT 1.50,
    "resolvedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SpecialMarket_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SpecialMarket_key_key" ON "SpecialMarket"("key");

CREATE TABLE "SpecialLobbyOdds" (
    "id" BIGSERIAL NOT NULL,
    "lobbyId" BIGINT NOT NULL,
    "marketId" BIGINT NOT NULL,
    "oddsYes" DECIMAL(6,2) NOT NULL,
    "oddsNo" DECIMAL(6,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SpecialLobbyOdds_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SpecialLobbyOdds_lobbyId_marketId_key" ON "SpecialLobbyOdds"("lobbyId", "marketId");

CREATE TABLE "SpecialPrediction" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "contextType" "ContextType" NOT NULL,
    "contextId" BIGINT,
    "marketId" BIGINT NOT NULL,
    "pick" "SpecialOutcome" NOT NULL,
    "stake" BIGINT NOT NULL,
    "oddsSnapshot" DECIMAL(6,2) NOT NULL,
    "status" "SpecialPredStatus" NOT NULL DEFAULT 'OPEN',
    "payout" BIGINT NOT NULL DEFAULT 0,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SpecialPrediction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SpecialPrediction_marketId_status_idx" ON "SpecialPrediction"("marketId", "status");
CREATE INDEX "SpecialPrediction_userId_contextType_contextId_idx" ON "SpecialPrediction"("userId", "contextType", "contextId");
```

- [ ] **Step 2: Apply** 🚦 (after approval): `pnpm --filter @wc/db prisma:deploy`
Expected: `Applying migration 20260611000000_special_markets` … `All migrations have been successfully applied.`

- [ ] **Step 3: Regenerate + build** (BEFORE any `prisma.special*` code exists — this is the stale-client guard):
```bash
pnpm --filter @wc/db exec prisma generate && pnpm --filter @wc/db build
```
Expected: client regenerated (knows `specialMarket`/`specialLobbyOdds`/`specialPrediction`); `tsc` exit 0.

- [ ] **Step 4: Verify table + commit**
```bash
cd packages/db && DATABASE_URL=$(grep -E "^DATABASE_URL=" ../../.env | cut -d= -f2-) node --input-type=module -e "import {PrismaClient} from '@prisma/client'; const p=new PrismaClient(); console.log('special markets:', await p.specialMarket.count()); await p.\$disconnect();"; cd ../..
git add packages/db/prisma/migrations
git commit -m "feat(db): migration — special markets tables"
```
(The running worker must be restarted later to load the regenerated client.)

## Task 3: seed the Ronaldo market

**Files:** Modify `packages/pipeline/src/seed.ts`, `packages/pipeline/src/seed-cli.ts`

- [ ] **Step 1:** In `seed.ts`, add an exported fn (idempotent upsert):
```ts
/** Seed the novelty special markets (idempotent). Currently just the Ronaldo-cry prop. */
export async function seedSpecialMarkets(prisma: PrismaClient): Promise<{ markets: number }> {
  await prisma.specialMarket.upsert({
    where: { key: 'RONALDO_CRY' },
    update: {},
    create: {
      key: 'RONALDO_CRY',
      title: 'Will Cristiano Ronaldo cry?',
      titleVi: 'Ronaldo có khóc không?',
      subtitle: 'Portugal · the whole tournament',
      subtitleVi: 'Bồ Đào Nha · cả giải đấu',
      oddsYes: 1.80,
      oddsNo: 1.90,
    },
  });
  return { markets: 1 };
}
```
(`PrismaClient` is already imported in `seed.ts`.)

- [ ] **Step 2:** In `seed-cli.ts`, call it alongside the tournament seed. Replace the `seedTournament(prisma).then(...)` chain's first `.then` body to also seed specials:
```ts
import { PrismaClient } from '@wc/db';
import { seedTournament, seedSpecialMarkets } from './seed';

const prisma = new PrismaClient();

(async () => {
  const t = await seedTournament(prisma);
  const s = await seedSpecialMarkets(prisma);
  // eslint-disable-next-line no-console
  console.log('Seeded tournament:', t, 'specials:', s);
  await prisma.$disconnect();
  process.exit(0);
})().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', e);
  process.exit(1);
});
```

- [ ] **Step 3: Build + run seed + verify**
```bash
pnpm --filter @wc/pipeline build
pnpm --filter @wc/pipeline seed
```
Expected: logs `specials: { markets: 1 }`; `specialMarket.count()` = 1 (`RONALDO_CRY`).

- [ ] **Step 4: Commit**
```bash
git add packages/pipeline/src/seed.ts packages/pipeline/src/seed-cli.ts
git commit -m "feat(pipeline): seed the RONALDO_CRY special market"
```

- [ ] **Step 5: PHASE 1 verification + STOP.** `pnpm --filter @wc/db build` + `pnpm --filter @wc/pipeline build` exit 0; market seeded. Report + STOP for review.

---

# PHASE 2 — service + APIs

## Task 4: `specialPayout` pure helper (TDD)

**Files:** Create `packages/prediction/src/special-market.ts`, `packages/prediction/src/special-market.test.ts`; Modify `packages/prediction/src/index.ts`

- [ ] **Step 1: Failing test** — create `special-market.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { specialPayout } from './special-market';

describe('specialPayout', () => {
  it('win → stake + round(stake×odds); loss → 0', () => {
    expect(specialPayout(100, 1.5, true)).toBe(250);   // 100 + round(150)
    expect(specialPayout(100, 1.8, true)).toBe(280);
    expect(specialPayout(100, 1.5, false)).toBe(0);
    expect(specialPayout(33, 1.9, true)).toBe(33 + Math.round(33 * 1.9)); // 33 + 63 = 96
  });
});
```

- [ ] **Step 2:** Run `pnpm --filter @wc/prediction test -- special-market` → FAIL (module missing).

- [ ] **Step 3: Implement** — create `special-market.ts` (header + the pure fn only for now):
```ts
/**
 * @wc/prediction — Special (novelty) market service. Isolated from Match. Mirrors placeBet/settleMatch
 * escrow+ledger and getLobbyOdds/setLobbyOdds host-auth. odds = profit multiplier (payout = stake×(1+odds)).
 */
import type { PrismaClient } from '@wc/db';

/** win → stake + round(stake×odds); loss → 0. Pure (BigInt×Decimal must be done as Number here). */
export function specialPayout(stake: number, odds: number, won: boolean): number {
  return won ? stake + Math.round(stake * odds) : 0;
}
```

- [ ] **Step 4:** Run `pnpm --filter @wc/prediction test -- special-market` → PASS.

- [ ] **Step 5:** Add to `packages/prediction/src/index.ts`: `export * from './special-market';`

- [ ] **Step 6: Commit**
```bash
git add packages/prediction/src/special-market.ts packages/prediction/src/special-market.test.ts packages/prediction/src/index.ts
git commit -m "feat(prediction): specialPayout pure helper + export special-market"
```

## Task 5: special-market service fns

**Files:** Modify `packages/prediction/src/special-market.ts`

No CI test (DB-impure, like placeBet) — verified by build + the live API test in P2/P4.

- [ ] **Step 1: Append the service fns:**
```ts
export interface SpecialOddsResult { oddsYes: number; oddsNo: number; source: 'LOBBY' | 'GLOBAL' }

/** Effective odds for a market in a context: lobby override → market global. Null if market missing. */
export async function resolveSpecialOdds(prisma: PrismaClient, marketId: bigint, lobbyId?: bigint): Promise<SpecialOddsResult | null> {
  if (lobbyId != null) {
    const lo = await prisma.specialLobbyOdds.findUnique({ where: { lobbyId_marketId: { lobbyId, marketId } } });
    if (lo) return { oddsYes: Number(lo.oddsYes), oddsNo: Number(lo.oddsNo), source: 'LOBBY' };
  }
  const m = await prisma.specialMarket.findUnique({ where: { id: marketId } });
  if (!m) return null;
  return { oddsYes: Number(m.oddsYes), oddsNo: Number(m.oddsNo), source: 'GLOBAL' };
}

export interface PlaceSpecialInput {
  userId: bigint; marketKey: string; pick: 'YES' | 'NO'; stake: bigint;
  contextType: 'GLOBAL' | 'LOBBY'; contextId: bigint | null;
}

/** Escrow a special-market bet (atomic). Market must be OPEN. Mirrors placeBet (wallet/STAKE ledger). */
export async function placeSpecialBet(prisma: PrismaClient, input: PlaceSpecialInput) {
  return prisma.$transaction(async (tx) => {
    if (input.stake <= 0n) throw new Error('INVALID_STAKE');
    const market = await tx.specialMarket.findUnique({ where: { key: input.marketKey } });
    if (!market) throw new Error('MARKET_NOT_FOUND');
    if (market.status !== 'OPEN') throw new Error('MARKET_CLOSED');

    const odds = await resolveSpecialOdds(tx as unknown as PrismaClient, market.id, input.contextType === 'LOBBY' ? input.contextId ?? undefined : undefined);
    if (!odds) throw new Error('ODDS_UNAVAILABLE');
    const oddsSnapshot = input.pick === 'YES' ? odds.oddsYes : odds.oddsNo;

    // One open bet per (user, context, market). contextId NULL (GLOBAL) → unique index can't enforce; guard here.
    const dupe = await tx.specialPrediction.findFirst({
      where: { userId: input.userId, contextType: input.contextType, contextId: input.contextId, marketId: market.id, status: 'OPEN' },
    });
    if (dupe) throw new Error('ALREADY_BET');

    const wallet = await tx.wallet.findFirstOrThrow({ where: { userId: input.userId, contextType: input.contextType, contextId: input.contextId } });
    if (wallet.balance < input.stake) throw new Error('INSUFFICIENT_BALANCE');
    const newBal = wallet.balance - input.stake;
    await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBal } });

    const pred = await tx.specialPrediction.create({
      data: {
        userId: input.userId, contextType: input.contextType, contextId: input.contextId,
        marketId: market.id, pick: input.pick, stake: input.stake, oddsSnapshot, status: 'OPEN',
      },
    });
    await tx.pointLedger.create({
      data: {
        userId: input.userId, contextType: input.contextType, contextId: input.contextId,
        type: 'STAKE', amount: -input.stake, balanceAfter: newBal, refType: 'SPECIAL', refId: pred.id,
      },
    });
    return pred;
  });
}

/** Admin sets the market's global odds. */
export async function setSpecialOdds(prisma: PrismaClient, key: string, odds: { oddsYes: number; oddsNo: number }) {
  return prisma.specialMarket.update({ where: { key }, data: { oddsYes: odds.oddsYes, oddsNo: odds.oddsNo } });
}

/** Lobby host sets this lobby's odds override (host-auth; mirrors setLobbyOdds). */
export async function setSpecialLobbyOdds(prisma: PrismaClient, lobbyId: bigint, ownerId: bigint, marketKey: string, odds: { oddsYes: number; oddsNo: number }) {
  const lobby = await prisma.lobby.findUniqueOrThrow({ where: { id: lobbyId } });
  if (lobby.ownerId !== ownerId) throw new Error('NOT_OWNER');
  const market = await prisma.specialMarket.findUniqueOrThrow({ where: { key: marketKey } });
  return prisma.specialLobbyOdds.upsert({
    where: { lobbyId_marketId: { lobbyId, marketId: market.id } },
    create: { lobbyId, marketId: market.id, oddsYes: odds.oddsYes, oddsNo: odds.oddsNo },
    update: { oddsYes: odds.oddsYes, oddsNo: odds.oddsNo },
  });
}

/** Admin resolve YES/NO — locks the market + settles every OPEN bet from its own wallet. Idempotent. */
export async function resolveSpecialMarket(prisma: PrismaClient, key: string, outcome: 'YES' | 'NO'): Promise<{ alreadyResolved: boolean; settled: number }> {
  const market = await prisma.specialMarket.findUniqueOrThrow({ where: { key } });
  if (market.status === 'RESOLVED') return { alreadyResolved: true, settled: 0 };

  let settled = 0;
  await prisma.$transaction(async (tx) => {
    await tx.specialMarket.update({ where: { id: market.id }, data: { status: 'RESOLVED', resolvedOutcome: outcome, resolvedAt: new Date() } });
    const preds = await tx.specialPrediction.findMany({ where: { marketId: market.id, status: 'OPEN' } });
    for (const p of preds) {
      const won = p.pick === outcome;
      const payout = BigInt(specialPayout(Number(p.stake), Number(p.oddsSnapshot), won));
      const wallet = await tx.wallet.findFirstOrThrow({ where: { userId: p.userId, contextType: p.contextType, contextId: p.contextId } });
      const newBal = wallet.balance + payout;
      if (payout > 0n) await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBal } });
      await tx.pointLedger.create({
        data: { userId: p.userId, contextType: p.contextType, contextId: p.contextId, type: 'SETTLE', amount: payout, balanceAfter: newBal, refType: 'SPECIAL', refId: p.id },
      });
      await tx.specialPrediction.update({ where: { id: p.id }, data: { status: won ? 'WON' : 'LOST', payout, settledAt: new Date() } });
      settled++;
    }
  });
  return { alreadyResolved: false, settled };
}
```
> Note: `resolveSpecialOdds` is called inside the `placeSpecialBet` tx via a cast; that's fine — it only does reads.

- [ ] **Step 2: Build** `pnpm --filter @wc/db build && pnpm --filter @wc/prediction build` → exit 0.

- [ ] **Step 3: Commit**
```bash
git add packages/prediction/src/special-market.ts
git commit -m "feat(prediction): special-market service (place/resolve/odds, global+lobby)"
```

## Task 6: player APIs (GET markets, POST predict)

**Files:** Create `apps/web/app/api/v1/special-markets/route.ts`, `apps/web/app/api/v1/special-predictions/route.ts`

- [ ] **Step 1: GET** `special-markets/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { resolveSpecialOdds } from '@wc/prediction';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

// GET /api/v1/special-markets[?lobbyId=] — markets with context-resolved odds + caller's bet.
export async function GET(req: Request) {
  const user = await getSessionUser();
  const url = new URL(req.url);
  const lobbyIdRaw = url.searchParams.get('lobbyId');
  const lobbyId = lobbyIdRaw ? BigInt(lobbyIdRaw) : undefined;
  const contextType = lobbyId != null ? 'LOBBY' : 'GLOBAL';
  const contextId = lobbyId ?? null;

  const markets = await prisma.specialMarket.findMany({ orderBy: { createdAt: 'asc' } });
  const data = await Promise.all(markets.map(async (m) => {
    const odds = await resolveSpecialOdds(prisma, m.id, lobbyId);
    const mine = user ? await prisma.specialPrediction.findFirst({ where: { userId: user.id, contextType, contextId, marketId: m.id }, orderBy: { createdAt: 'desc' } }) : null;
    return {
      key: m.key, title: m.title, titleVi: m.titleVi, subtitle: m.subtitle, subtitleVi: m.subtitleVi,
      status: m.status, resolvedOutcome: m.resolvedOutcome,
      oddsYes: odds ? odds.oddsYes : Number(m.oddsYes),
      oddsNo: odds ? odds.oddsNo : Number(m.oddsNo),
      oddsSource: odds?.source ?? 'GLOBAL',
      yourBet: mine ? { pick: mine.pick, stake: Number(mine.stake), oddsSnapshot: Number(mine.oddsSnapshot), status: mine.status, payout: Number(mine.payout) } : null,
    };
  }));
  return NextResponse.json({ data });
}
```

- [ ] **Step 2: POST** `special-predictions/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { placeSpecialBet } from '@wc/prediction';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

const Schema = z.object({
  marketKey: z.string().min(1),
  pick: z.enum(['YES', 'NO']),
  stake: z.coerce.number().int().positive(),
  lobbyId: z.coerce.number().int().positive().optional(),
});

// POST /api/v1/special-predictions — place a special-market bet (global or lobby context).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } }, { status: 422 });
  const { marketKey, pick, stake, lobbyId } = parsed.data;

  if (lobbyId != null) {
    const membership = await prisma.lobbyMembership.findUnique({ where: { lobbyId_userId: { lobbyId: BigInt(lobbyId), userId: user.id } } });
    if (!membership) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  }
  try {
    const pred = await placeSpecialBet(prisma, {
      userId: user.id, marketKey, pick, stake: BigInt(stake),
      contextType: lobbyId != null ? 'LOBBY' : 'GLOBAL', contextId: lobbyId != null ? BigInt(lobbyId) : null,
    });
    return NextResponse.json({ data: { id: Number(pred.id), pick: pred.pick, stake: Number(pred.stake), oddsSnapshot: Number(pred.oddsSnapshot) } }, { status: 201 });
  } catch (e) {
    const code = (e as Error).message;
    const known = ['MARKET_NOT_FOUND', 'MARKET_CLOSED', 'ODDS_UNAVAILABLE', 'ALREADY_BET', 'INSUFFICIENT_BALANCE', 'INVALID_STAKE'];
    return NextResponse.json({ error: { code: known.includes(code) ? code : 'PLACE_FAILED' } }, { status: known.includes(code) ? 422 : 500 });
  }
}
```

- [ ] **Step 3: Verify** `pnpm --filter @wc/prediction build` (dist current) + `pnpm --filter @wc/web exec tsc --noEmit` → 0.

- [ ] **Step 4: Commit**
```bash
git add apps/web/app/api/v1/special-markets/route.ts apps/web/app/api/v1/special-predictions/route.ts
git commit -m "feat(web): special-markets GET + special-predictions POST"
```

## Task 7: admin + host odds/resolve APIs

**Files:** Create the 3 routes.

- [ ] **Step 1:** `apps/web/app/api/v1/admin/special-markets/[key]/odds/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { setSpecialOdds } from '@wc/prediction';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';
const Schema = z.object({ oddsYes: z.coerce.number().positive(), oddsNo: z.coerce.number().positive() });

export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } }, { status: 422 });
  const { key } = await params;
  try {
    await setSpecialOdds(prisma, key, parsed.data);
  } catch { return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 }); }
  await prisma.auditLog.create({ data: { actorType: 'ADMIN', actorId: admin.id, action: 'SET_SPECIAL_ODDS', target: `special:${key}`, metadata: parsed.data } });
  return NextResponse.json({ data: parsed.data });
}
```

- [ ] **Step 2:** `apps/web/app/api/v1/admin/special-markets/[key]/resolve/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveSpecialMarket } from '@wc/prediction';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';
const Schema = z.object({ outcome: z.enum(['YES', 'NO']) });

export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } }, { status: 422 });
  const { key } = await params;
  let r;
  try { r = await resolveSpecialMarket(prisma, key, parsed.data.outcome); }
  catch { return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 }); }
  await prisma.auditLog.create({ data: { actorType: 'ADMIN', actorId: admin.id, action: 'RESOLVE_SPECIAL', target: `special:${key}`, metadata: { outcome: parsed.data.outcome, settled: r.settled } } });
  return NextResponse.json({ data: r });
}
```

- [ ] **Step 3:** `apps/web/app/api/v1/lobbies/[id]/special-odds/route.ts` (host):
```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { setSpecialLobbyOdds } from '@wc/prediction';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';
const Schema = z.object({ marketKey: z.string().min(1), oddsYes: z.number().positive(), oddsNo: z.number().positive() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } }, { status: 422 });
  const { id } = await params;
  try {
    const row = await setSpecialLobbyOdds(prisma, BigInt(id), user.id, parsed.data.marketKey, { oddsYes: parsed.data.oddsYes, oddsNo: parsed.data.oddsNo });
    return NextResponse.json({ data: { oddsYes: Number(row.oddsYes), oddsNo: Number(row.oddsNo) } });
  } catch (e) {
    if ((e as Error).message === 'NOT_OWNER') return NextResponse.json({ error: { code: 'NOT_OWNER' } }, { status: 403 });
    return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
  }
}
```

- [ ] **Step 4: Verify** `pnpm --filter @wc/web exec tsc --noEmit` → 0.

- [ ] **Step 5: Commit**
```bash
git add "apps/web/app/api/v1/admin/special-markets" "apps/web/app/api/v1/lobbies/[id]/special-odds"
git commit -m "feat(web): admin special-odds + resolve routes + lobby-host special-odds route"
```

- [ ] **Step 6: PHASE 2 verification + STOP.** Builds (`@wc/db`→`@wc/prediction`→`@wc/web`) + `@wc/prediction` test + web tsc all green. (Optional live: a quick script placing a GLOBAL bet then `resolveSpecialMarket('RONALDO_CRY','YES')` → winner credited.) Report + STOP.

---

# PHASE 3 — player UI (banner + screen + sidebar + i18n)

## Task 8: banner + screen + nav + i18n

**Files:** Create `apps/web/components/special-banner.tsx`, `screens-special.tsx`; Modify `app-shell.tsx`, `screens-core.tsx`, `screens-lobby.tsx`, `lib/i18n/dictionaries/{en,vi}.ts`

- [ ] **Step 1: i18n** — add to BOTH dicts a `special` group + `nav.specials`. EN:
```ts
// nav group: add
    specials: 'Special',
// new top-level group:
  special: {
    title: 'Special prediction', tagline: 'Just for fun',
    cry: 'Will Ronaldo cry?', yes: 'Yes · cries', no: 'No · stays cool',
    place: 'Place prediction', yourPick: 'Your prediction', resolved: 'Resolved',
    won: 'Won', lost: 'Lost', open: 'Open', stake: 'Points', cta: 'Predict now →',
  },
```
VI (de-gambled — "dự đoán", never "cược"):
```ts
    specials: 'Đặc biệt',
  special: {
    title: 'Dự đoán đặc biệt', tagline: 'Chỉ để vui',
    cry: 'Ronaldo có khóc không?', yes: 'Có khóc', no: 'Không khóc',
    place: 'Đặt dự đoán', yourPick: 'Dự đoán của bạn', resolved: 'Đã có kết quả',
    won: 'Thắng', lost: 'Thua', open: 'Đang mở', stake: 'Điểm', cta: 'Dự đoán ngay →',
  },
```

- [ ] **Step 2: `special-banner.tsx`** (new, `'use client'`) — fetches `/api/v1/special-markets[?lobbyId]`, shows the first OPEN market's title + YES/NO odds, links to the `special` screen (carrying lobby context via the store nav param). Mirror `PunditPromo`'s `card card-pad` gradient style:
```tsx
'use client';
import { useEffect, useState } from 'react';
import type { Store } from '@/lib/store';
import { Icon } from '@/components/ui';
import { useT } from '@/lib/i18n/hooks';

interface Mkt { key: string; title: string; titleVi: string | null; status: string; oddsYes: number; oddsNo: number }

export function SpecialBanner({ s, lobbyId }: { s: Store; lobbyId?: number }) {
  const { t, locale } = useT();
  const [mkt, setMkt] = useState<Mkt | null>(null);
  useEffect(() => {
    const q = lobbyId != null ? `?lobbyId=${lobbyId}` : '';
    fetch(`/api/v1/special-markets${q}`).then(r => r.ok ? r.json() : null)
      .then(j => { const list = (j?.data ?? []) as Mkt[]; setMkt(list.find(m => m.status === 'OPEN') ?? list[0] ?? null); })
      .catch(() => {});
  }, [lobbyId]);
  if (!mkt) return null;
  const title = locale === 'vi' && mkt.titleVi ? mkt.titleVi : mkt.title;
  return (
    <div className="card card-pad pointer card-hover" onClick={() => s.go('special', lobbyId != null ? { lobbyId } : {})}
         style={{ background: 'linear-gradient(120deg, var(--gold-soft), transparent)', borderColor: 'rgba(255,200,61,.3)' }}>
      <div className="row between wrap wrap-w gap-12">
        <div className="row gap-12">
          <Icon name="trophy" size={28} style={{ color: 'var(--gold)' }} />
          <div>
            <span className="badge badge-gold">{t('special.tagline')}</span>
            <div className="h3" style={{ marginTop: 6, fontSize: 16 }}>{title}</div>
          </div>
        </div>
        <div className="row gap-8">
          <span className="badge badge-sky">{t('special.yes')} {mkt.oddsYes.toFixed(2)}</span>
          <span className="badge badge-muted">{t('special.no')} {mkt.oddsNo.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `screens-special.tsx`** (new) — `Specials` screen. Reads `s.param.lobbyId` (if navigated from a lobby) for context; fetches markets with that context; renders YES·odds / NO·odds buttons, a stake input (quick picks `[50,100,250,500]`), place-bet POST to `/api/v1/special-predictions`, shows `yourBet` + resolved/won-lost badge. Reuse `SecHead`, `Btn`, the odds-button styling from screens-match (`.odds`/`.o-label`/`.o-val`). Root `<div className="page fade-up">`. (Full component — mirror the MatchBetSlip stake UX; on success refresh + `s.toastMsg`.)
```tsx
'use client';
import { useEffect, useState } from 'react';
import type { ScreenProps } from '@/lib/store';
import { SecHead, Btn } from '@/components/ui';
import { useT } from '@/lib/i18n/hooks';

interface SMkt { key: string; title: string; titleVi: string | null; subtitle: string | null; subtitleVi: string | null; status: string; resolvedOutcome: 'YES'|'NO'|null; oddsYes: number; oddsNo: number; yourBet: { pick: 'YES'|'NO'; stake: number; oddsSnapshot: number; status: string; payout: number } | null }

export function Specials({ s }: ScreenProps) {
  const { t, locale } = useT();
  const lobbyId = typeof s.param.lobbyId === 'number' ? s.param.lobbyId : undefined;
  const [mkts, setMkts] = useState<SMkt[]>([]);
  const [pick, setPick] = useState<Record<string, 'YES'|'NO'>>({});
  const [stake, setStake] = useState<Record<string, number>>({});
  const load = () => { const q = lobbyId != null ? `?lobbyId=${lobbyId}` : ''; fetch(`/api/v1/special-markets${q}`).then(r => r.ok ? r.json() : null).then(j => setMkts(j?.data ?? [])).catch(() => {}); };
  useEffect(load, [lobbyId]);

  const place = async (m: SMkt) => {
    const p = pick[m.key]; const st = stake[m.key];
    if (!p || !st) return;
    const res = await fetch('/api/v1/special-predictions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ marketKey: m.key, pick: p, stake: st, lobbyId }) });
    if (res.ok) { s.toastMsg(t('special.place'), 'trophy', 'var(--gold)'); load(); }
    else { const j = await res.json().catch(() => ({})); s.toastMsg(j?.error?.code ?? 'ERROR', 'alert', 'var(--red)'); }
  };

  return (
    <div className="page fade-up">
      <SecHead title={t('special.title')} sub={t('special.tagline')} />
      <div className="stack gap-16">
        {mkts.map((m) => {
          const title = locale === 'vi' && m.titleVi ? m.titleVi : m.title;
          const resolved = m.status === 'RESOLVED';
          return (
            <div key={m.key} className="card card-pad">
              <div className="h3" style={{ fontSize: 17 }}>{title}</div>
              {resolved ? (
                <div className="mt-8"><span className="badge badge-gold">{t('special.resolved')}: {m.resolvedOutcome === 'YES' ? t('special.yes') : t('special.no')}</span></div>
              ) : (
                <>
                  <div className="row gap-8 mt-12">
                    {(['YES', 'NO'] as const).map((k) => (
                      <button key={k} className={`odds ${pick[m.key] === k ? 'sel' : ''}`} style={{ flex: 1 }} onClick={() => setPick(s2 => ({ ...s2, [m.key]: k }))}>
                        <span className="o-label">{k === 'YES' ? t('special.yes') : t('special.no')}</span>
                        <span className="o-val">{(k === 'YES' ? m.oddsYes : m.oddsNo).toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                  <div className="row gap-8 mt-12 wrap-w">
                    {[50, 100, 250, 500].map(v => <button key={v} className="chip" onClick={() => setStake(s2 => ({ ...s2, [m.key]: v }))}>{v}</button>)}
                  </div>
                  <Btn variant="primary" className="mt-12" disabled={!pick[m.key] || !stake[m.key] || !!m.yourBet} onClick={() => place(m)}>{t('special.place')}{stake[m.key] ? ` · ${stake[m.key]}` : ''}</Btn>
                </>
              )}
              {m.yourBet && <div className="tiny muted mt-8">{t('special.yourPick')}: {m.yourBet.pick === 'YES' ? t('special.yes') : t('special.no')} · {m.yourBet.stake} · {t(`special.${m.yourBet.status === 'WON' ? 'won' : m.yourBet.status === 'LOST' ? 'lost' : 'open'}`)}</div>}
            </div>
          );
        })}
        {mkts.length === 0 && <div className="card card-pad-lg" style={{ textAlign: 'center' }}><span className="muted">—</span></div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Sidebar wiring** in `app-shell.tsx`:
  - import: `import { Specials } from '@/components/screens-special';`
  - `ROUTES`: add `special: Specials,`
  - `RAIL` `sec:'nav.secTournament'` items: add `['special', 'nav.specials', 'trophy']` (icon `'trophy'` is known-present).
  - `TITLE_KEYS`: add `special: 'nav.specials',`
  - (Optional `PUB_NAV` — skip; betting needs auth.)

- [ ] **Step 5: Home banner** in `screens-core.tsx` — import `SpecialBanner`; in the Home right-column stack (near `<PunditPromo s={s} />`) add `<SpecialBanner s={s} />`.

- [ ] **Step 6: Lobby banner** in `screens-lobby.tsx` `LobbyView` — import `SpecialBanner`; render `<SpecialBanner s={s} lobbyId={lid} />` near the lobby hero/tabs (above the tab content).

- [ ] **Step 7: Verify** `pnpm --filter @wc/web exec tsc --noEmit` (0) + `pnpm --filter @wc/web test` (parity test green; only pre-existing `Flag` fail).

- [ ] **Step 8: Commit**
```bash
git add apps/web/components/special-banner.tsx apps/web/components/screens-special.tsx apps/web/components/app-shell.tsx apps/web/components/screens-core.tsx apps/web/components/screens-lobby.tsx apps/web/lib/i18n/dictionaries/en.ts apps/web/lib/i18n/dictionaries/vi.ts
git commit -m "feat(web): special-market banner (home+lobby) + screen + sidebar + i18n"
```

- [ ] **Step 9: PHASE 3 verification + STOP.** web tsc + tests green; banner + screen + sidebar render. Report + STOP.

---

# PHASE 4 — admin resolve/odds + lobby-host odds

## Task 9: admin section + host control

**Files:** Modify `apps/web/components/screens-admin.tsx`, `apps/web/components/screens-lobby.tsx`

- [ ] **Step 1: Admin** — add a "Special markets" section in `screens-admin.tsx`: fetch `/api/v1/special-markets`, render each with two number inputs (oddsYes/oddsNo) + a "Save odds" button POSTing `/api/v1/admin/special-markets/${key}/odds`, and two buttons **"Resolve: Cried (YES)" / "Resolve: Didn't (NO)"** POSTing `/api/v1/admin/special-markets/${key}/resolve` with `{outcome}` (confirm before resolve — it's final). On success toast result + reload. English labels (admin has no i18n). Place it near the other admin tournament-management sections (mirror an existing admin section's fetch+button pattern).

- [ ] **Step 2: Lobby host** — in `screens-lobby.tsx`, when `isHost`, add a host-only control (e.g. inside the special banner area or a small panel) with oddsYes/oddsNo inputs + "Set lobby odds" POSTing `/api/v1/lobbies/${lid}/special-odds` with `{ marketKey: 'RONALDO_CRY', oddsYes, oddsNo }`. On 403 `NOT_OWNER` toast; on success toast + refresh the banner. Mirror the existing lobby host odds-edit pattern (`LobbyOddsModal`).

- [ ] **Step 3: Verify** `pnpm --filter @wc/web exec tsc --noEmit` (0) + `pnpm --filter @wc/web test` (only pre-existing `Flag` fail).

- [ ] **Step 4: Commit**
```bash
git add apps/web/components/screens-admin.tsx apps/web/components/screens-lobby.tsx
git commit -m "feat(web): admin special-odds + resolve UI; lobby-host special-odds control"
```

- [ ] **Step 5: PHASE 4 verification + handoff.** Full ordered build + web tsc + tests. **Live (LLM not needed; needs the migration applied + worker restart for any worker path — but this feature is request-driven, no worker):** place a GLOBAL bet via the screen → admin "Resolve YES" → winner's balance credited, bet shows WON. Report owed manual checks (banner home+lobby, sidebar, bet flow, admin resolve settles, host odds override applies in-lobby). STOP.

---

## Self-Review

**Spec coverage:** bettable market (P2 placeSpecialBet + P3 screen) ✓ · banner home+lobby (P3 Task 8 steps 5–6) ✓ · dedicated sidebar (P3 step 4) ✓ · admin global odds + host lobby odds (P2 setSpecialOdds/setSpecialLobbyOdds + P4 UI) ✓ · global+lobby contexts (placeSpecialBet contextType, resolveSpecialOdds) ✓ · admin manual resolve YES/NO (resolveSpecialMarket + P4) ✓ · migration self-contained sequence + gate (P1 Task 2) ✓ · pure payout test (P2 Task 4) ✓ · Decimal→Number serialization (Task 6 GET) ✓ · NULL-contextId dupe guard (Task 5 placeSpecialBet) ✓ · no VOID/no re-resolve (enums + resolveSpecialMarket idempotent) ✓ · i18n both dicts, "dự đoán" (Task 8) ✓ · seed (P1 Task 3) ✓.

**Placeholder scan:** P2/P1 fully coded. P4 (admin section + host control) and P3 steps 5–6 (banner insertion) describe behavior + exact endpoints/payloads + the sibling pattern to mirror, rather than full JSX — these are integration points into large existing files where the implementer reads the neighbor pattern (consistent with how the FD-admin-buttons + scorers nav tasks were specced this session). All NEW standalone files (service, routes, banner, screen) have complete code.

**Type consistency:** `specialPayout(stake,odds,won)` defined Task 4, used Task 5. `placeSpecialBet`/`resolveSpecialOdds`/`setSpecialOdds`/`setSpecialLobbyOdds`/`resolveSpecialMarket` signatures defined Task 5, consumed by routes Tasks 6–7. `pick:'YES'|'NO'`, `contextType:'GLOBAL'|'LOBBY'` consistent across service+routes. Market key `'RONALDO_CRY'` consistent (seed → host control). `s.go('special', {lobbyId})` ↔ `ROUTES.special` ↔ `s.param.lobbyId` consistent. i18n `nav.specials` + `special.*` added both dicts.

**Known limitation (documented):** `resolveSpecialMarket` settles all bets in one tx with `wallet.findFirstOrThrow` per bettor — same latent risk as `settleMatch` (a missing wallet aborts the batch); mirroring is intentional. Resolve is one-way (no re-resolve).
