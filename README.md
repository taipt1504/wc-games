# ⚽ WC2026 Prediction Game

Game dự đoán **FIFA World Cup 2026** — point ảo, **không cá cược tiền thật**. Monorepo: Next.js (web) + NestJS (worker) + Prisma (Postgres).

> 📄 Tài liệu: [`docs/prd/`](./docs/prd/README.md) (PRD) · [`docs/solution-design/`](./docs/solution-design/README.md) (kiến trúc + service design).

## Cấu trúc

```
apps/
  web/        Next.js 15 (App Router) — FE SSR/PWA + API/BFF
  worker/     NestJS 11 — BullMQ worker (settle/ingest/AI...) + LlmGateway (9router)
packages/
  db/         Prisma schema + PrismaClient (dùng chung web & worker)
docker-compose.yml   Postgres 16 + Redis 7
```

Kiến trúc: **modular monolith + worker** ([ADR-0001](./docs/solution-design/decisions/ADR-0001-modular-monolith.md)). Stack: [ADR-0002](./docs/solution-design/decisions/ADR-0002-typescript-nextjs.md).

## Yêu cầu
- Node.js ≥ 22, **pnpm** (`corepack enable`), Docker.

## Chạy local

```bash
# 1. Env
cp .env.example .env            # sửa secret nếu cần; LLM_GATEWAY_* trỏ tới 9router đã self-host

# 2. Hạ tầng (Postgres + Redis)
pnpm docker:up

# 3. Cài deps + generate Prisma client + build package db
pnpm setup

# 4. Tạo schema DB (lần đầu)
pnpm db:migrate                 # prisma migrate dev (đặt tên migration, vd: init)

# 5. Chạy web + worker
pnpm dev
```

- Web: http://localhost:3000 · Health: http://localhost:3000/api/health
- Worker: log "listening on queue settle".

## Scripts (root)
| Script | Việc |
|---|---|
| `pnpm setup` | install + prisma generate + build `@wc/db` |
| `pnpm dev` | chạy song song web + worker |
| `pnpm build` | build toàn bộ |
| `pnpm db:generate` / `db:migrate` / `db:studio` | Prisma |
| `pnpm docker:up` / `docker:down` | Postgres + Redis |

## Ghi chú scaffold (đọc trước khi code)
- **Đây là skeleton**: API/worker là **stub** (vd `POST /api/v1/predictions` trả 501, `SettlementWorker` chỉ log). Logic nghiệp vụ implement theo Service Design.
- **Prisma schema** (`packages/db/prisma/schema.prisma`) = source of truth, dịch từ DDL trong service design (30 model). DDL trong tài liệu là SQL minh hoạ.
- **BigInt**: point amount + id dùng `BigInt` (khớp BIGINT). Đã patch `BigInt.prototype.toJSON` ở `apps/web/lib/db.ts` để serialize JSON. Khi thêm chỗ trả JSON khác, nhớ import qua `@/lib/db` hoặc tự patch.
- **9router**: `LlmGateway` (worker) gọi qua OpenAI SDK trỏ `LLM_GATEWAY_BASE_URL`. 9router đã self-host (ADR-0005); chỉ cần điền env.
- **Một `.env` duy nhất ở root** được nạp bởi cả 3: web (`next.config.mjs` → dotenv), worker (`main.ts` → dotenv), Prisma (`@wc/db` scripts → `dotenv-cli -e ../../.env`). Không cần `.env` riêng từng app.
- **`@wc/db` build trước**: web & worker import từ `dist` → chạy `pnpm setup` (hoặc `pnpm --filter @wc/db build`) trước `pnpm dev`. Có thể chạy `pnpm --filter @wc/db dev` (tsc watch) song song khi sửa schema.
- **Prisma + Next**: `@prisma/client` để `serverExternalPackages`. Nếu build standalone thiếu query engine, xem docs Prisma deploy.
- **Chưa có**: realtime gateway (Socket.io), service worker PWA, icon manifest, lint config, tests — thêm theo ưu tiên P0→P2 ([roadmap](./docs/prd/18-roadmap-milestones.md)).

## Ưu tiên build (P0 trước)
auth + IP/UA → data pipeline (free API + AI-crawl) → scoring/settle + ledger → leaderboard ROI → admin core + risk-engine. Xem [roadmap](./docs/prd/18-roadmap-milestones.md).
