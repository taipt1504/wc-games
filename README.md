# ⚽ GOLAZO — WC2026 Prediction Game

Game dự đoán **FIFA World Cup 2026** — **point ảo, không cá cược tiền thật**. Full-stack TypeScript monorepo: Next.js 15 (web + API/BFF) + NestJS 11 worker + Prisma/PostgreSQL + Redis/BullMQ.

> **Status:** feature-complete theo PRD §02 (MVP + v1 + v2). Gate: **322 tests pass 100%** (308 unit/integration + 14 E2E), `next build` + worker build sạch.
>
> 📄 Tài liệu: [`docs/prd/`](./docs/prd/README.md) (PRD) · [`docs/solution-design/`](./docs/solution-design/README.md) (kiến trúc + ADR + service design) · [`docs/design/predict-wc-2026/`](./docs/design/predict-wc-2026/README.md) (Claude Design bundle — UI source of truth).

---

## Tính năng

**Global mode** — đặt kèo 1X2 mọi trận, khoá tại giờ bóng lăn; payout `S×(1+m)`; **bonus tỉ số chính xác** (knockout); **underdog bonus** (+15% khi `m≥2.0`); leaderboard **ROI**; ví point + sổ cái bất biến; điểm danh hằng ngày **theo bậc streak** (200/250/300/400).

**Private lobby** — tạo/join bằng code·link; scope presets (cả giải/vòng bảng/R32…/custom picker); ví lobby cô lập; **mượn point + duyệt của chủ phòng**; **chủ phòng set odds từng trận + đặt kèo trong lobby**; chuyển quyền/kick thành viên; chat.

**Prediction depth** — bracket predictor; **power-ups** (Double Down/Insurance/Streak Shield); **combo/parlay**; **in-play micro-prediction**.

**Engagement & social** — streak điểm danh + chuỗi thắng; **missions** & **achievements** (tính từ dữ liệu thật); **referral**; **share card** (OG image); **duel 1v1**; **activity feed**; notification preferences.

**Tournament data** — 48 đội + chi tiết + **đội hình 23 cầu thủ**; 12 bảng + BXH; lịch 104 trận; chi tiết trận (odds, bet distribution, formation pitch); bracket; **live scores** (poll + ingest).

**AI (Ora Pundit)** — match preview/smart-pick qua **9router** (Claude primary → OpenAI fallback) với **deterministic fallback** khi gateway chưa cấu hình; news AI draft → **review queue (human-in-the-loop)** → publish/auto-schedule.

**Admin & Ops** — quản lý user (ban + audit IP/UA), **risk-engine** chống lạm dụng + investigation + case-file/escalate, tournament data + **score override & re-settle idempotent**, news review, **AI pipeline metrics**, cosmetic shop, predictor tiers.

---

## Kiến trúc

```
apps/
  web/        Next.js 15 (App Router) — UI (client AppShell + store) + 56 API routes (BFF)
  worker/     NestJS 11 — BullMQ workers (settle, news-gen, auto-publish) + LlmGateway (9router)
packages/
  core/       Pure scoring (payout 1X2, knockout/exact/underdog bonus, ROI, lobby score,
              check-in tiers, predictor tiers) — no I/O, unit-tested
  db/         Prisma schema (40+ models) + PrismaClient (dùng chung web & worker)
  fixtures/   Dữ liệu giải deterministic (48 đội, 72 trận, odds, squads) — single source
  auth/       Đăng ký/đăng nhập (bcrypt+jose), check-in, referral, cosmetics, password reset
  prediction/ placeBet/settle/re-settle, leaderboard, missions, achievements, bracket,
              powerups, parlay, micro, duel, feed
  lobby/      Tạo/join, borrow + approve, host-odds + lobby betting, transfer-host/kick
  pipeline/   Seed giải (deterministic), news generation + auto-publish
  ai/         Ora pundit + news draft (LlmGateway interface + 9router client + fallback)
  risk/       Anti-abuse risk-engine (heuristic flags)
docker-compose.yml   Postgres 16 + Redis 7
```

Modular monolith + worker ([ADR-0001](./docs/solution-design/decisions/ADR-0001-modular-monolith.md)); TypeScript/Next.js ([ADR-0002](./docs/solution-design/decisions/ADR-0002-typescript-nextjs.md)); 9router gateway (ADR-0005, `docs/solution-design/decisions/`).

**UI** = port pixel-faithful của Claude Design bundle (`globals.css` verbatim, client `AppShell` + store, guest shell + sign-up wall). Behavior/scoring theo PRD; UI theo design.

---

## Yêu cầu
- Node.js ≥ 20 (CI dùng 22), **pnpm** (`corepack enable`), Docker.

## Chạy local

```bash
cp .env.example .env          # LLM_GATEWAY_* trỏ 9router (tùy chọn — có fallback nếu trống)
pnpm docker:up                # Postgres + Redis
pnpm setup                    # install + prisma generate + build @wc/db
pnpm --filter @wc/db exec prisma db push   # tạo schema vào DATABASE_URL
pnpm dev                      # web + worker song song
```

- Web: http://localhost:3000 · Health: `/api/health`
- Worker log: `SettlementWorker listening on queue "settle"`.

> `.env` **duy nhất ở root** được nạp bởi web (`next.config.mjs`), worker (`main.ts`), Prisma (`dotenv -e ../../.env`). `@wc/db` build ra `dist` → web/worker import từ đó; luôn `pnpm setup` (hoặc `pnpm --filter @wc/db build`) trước `pnpm dev`.

## Scripts (root)
| Script | Việc |
|---|---|
| `pnpm setup` | install + prisma generate + build `@wc/db` |
| `pnpm dev` | web + worker song song |
| `pnpm build` | build toàn bộ package + apps |
| `pnpm test` | **toàn bộ unit + integration**, chạy **serial** (`--workspace-concurrency=1`, tránh đụng DB dùng chung) |
| `pnpm test:e2e` | Playwright E2E (`@wc/web`) |
| `pnpm db:generate` / `db:migrate` / `db:studio` | Prisma |
| `pnpm docker:up` / `docker:down` | Postgres + Redis |

## Testing

| Loại | Công cụ | Phạm vi |
|---|---|---|
| **Unit** | vitest | `packages/core` scoring (PRD-exact), `@wc/ai` pundit/fallback, web components (RTL/jsdom) |
| **Integration** | vitest + Postgres | mọi service package (escrow, settle/re-settle idempotent, lobby, risk, missions, parlay…) |
| **E2E** | Playwright + live API + Postgres | guest browse → sign-up → bet → settle → leaderboard; admin ban/news/audit/re-settle; live feed; exact-score |

**DB cho test** (Postgres tại `:5433`):
- Integration: DB `wc_test` (qua root `.env` → `DATABASE_URL`).
- E2E: DB `wc_game` (pin trong `apps/web/playwright.config.ts`); `global-setup` `TRUNCATE … CASCADE` + seed mỗi run → deterministic.

```bash
# Postgres test một lần (nếu chưa có)
docker run -d --name wc_test_pg -e POSTGRES_USER=wc -e POSTGRES_PASSWORD=wc -e POSTGRES_DB=wc_game -p 5433:5432 postgres:16-alpine
docker exec wc_test_pg psql -U wc -d wc_game -c "CREATE DATABASE wc_test;"
DATABASE_URL="postgresql://wc:wc@localhost:5433/wc_test" pnpm --filter @wc/db exec prisma db push --skip-generate
DATABASE_URL="postgresql://wc:wc@localhost:5433/wc_game" pnpm --filter @wc/db exec prisma db push --skip-generate

pnpm test          # unit + integration (serial)
pnpm test:e2e      # Playwright
```

## Production deploy

App chạy trên **real data**, không có mock UI: tournament = fixtures seed vào DB; user/social/admin = đọc từ live API/DB. Mock arrays đã gỡ (`lib/wc.ts` chỉ còn fixtures + neutral guest default cho first-paint).

```bash
cp .env.example .env          # điền DATABASE_URL / REDIS_URL / JWT_SECRET thật (xem ⚠️ trong file)
pnpm install && pnpm db:generate && pnpm build
pnpm db:deploy                # prisma migrate deploy — áp baseline migration 0_init
pnpm seed                     # seed dữ liệu giải thật (48 đội, 72 trận, odds) vào prod DB
pnpm --filter @wc/web start   # Next production server (sau next build)
pnpm --filter @wc/worker start  # NestJS worker (settle/news/auto-publish) — cần Redis
```

- **Migrations**: `packages/db/prisma/migrations/0_init` là baseline (44 bảng). Schema mới → `pnpm db:migrate` (tạo migration dev) rồi commit; prod chạy `pnpm db:deploy`.
- **Catalogs** (missions, cosmetics) tự seed lazily lần truy cập đầu — không cần seed thủ công. `seed` chỉ nạp dữ liệu giải (reference data).
- **Seed admin**: tạo user rồi set role trong DB (`UPDATE "User" SET role='ADMIN' WHERE email=…`) — chưa có CLI tạo admin.

## Ghi chú kỹ thuật
- **BigInt**: point amount + id dùng `BigInt`. `BigInt.prototype.toJSON` đã patch ở `apps/web/lib/db.ts`; trả JSON luôn `Number(...)` hoặc import qua `@/lib/db`.
- **Settle resettle-safe**: mọi bonus (exact/underdog/power-up) là **derived** từ field của Prediction → `resettleMatch` đảo + tính lại đúng; win-streak là **cached-derived** recompute từ dữ liệu settled.
- **Determinism**: fixtures + seed không dùng `Math.random`/`Date` (tránh hydration mismatch).

## Hạ tầng ngoài (deferred — đã có seam, bật bằng env)
Không phải tính năng thiếu — code path + fallback đã sẵn, chỉ chờ cấu hình:
- **9router LLM** (`LLM_GATEWAY_*`) — chưa cấu hình thì pundit/news dùng deterministic fallback.
- **Web push / email** (VAPID/SMTP) — preferences đã lưu; delivery chờ infra.
- **Live score/odds provider** — admin ingest endpoint là seam; provider feed thật chờ infra.
