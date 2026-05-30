# Solution Design — WC2026 Prediction Game

Thiết kế kiến trúc, dẫn xuất từ [PRD](../prd/README.md). Trạng thái: **Draft (overview) — chờ checkpoint** trước khi viết Service Design chi tiết.

## Tài liệu

| File | Nội dung |
|---|---|
| [`2026-05-30-wc-game-solution-design.md`](./2026-05-30-wc-game-solution-design.md) | **Solution Design (overview)** — C4, module/service, flow cross-cutting, NFR, deploy, rollout, risks |
| [`decisions/`](./decisions/) | ADRs (quyết định kiến trúc) |

## ADRs

| ADR | Quyết định |
|---|---|
| [ADR-0001](./decisions/ADR-0001-modular-monolith.md) | Modular monolith + worker (không microservices) |
| [ADR-0002](./decisions/ADR-0002-typescript-nextjs.md) | TypeScript: Next.js + Node/NestJS worker |
| [ADR-0003](./decisions/ADR-0003-postgres-ledger.md) | PostgreSQL + PointLedger append-only |
| [ADR-0004](./decisions/ADR-0004-redis-queue-cache.md) | Redis: cache + BullMQ queue + pub/sub |
| [ADR-0005](./decisions/ADR-0005-9router-gateway.md) | 9router LLM gateway (self-host, API-key) |

## Stack đã chốt

TypeScript · **Next.js** (FE SSR/PWA + API/BFF) · **Node/NestJS Worker** (BullMQ) · **Realtime Gateway** (Socket.io + Redis) · **PostgreSQL** (Prisma) · **Redis** · **Object Storage** (S3) · **9router** → Anthropic/OpenAI.

## Service Design (kế hoạch — sau checkpoint)

| Ưu tiên | Service Design |
|---|---|
| **Full** ⭐ | Prediction & Scoring & Settlement (scoring 1X2 + bonus, settle idempotent, ROI leaderboard, bracket, futures) |
| Medium | Auth & Account + Wallet/Ledger |
| Medium | Tournament Data + AI/Pipeline (9router) |
| Light | Lobby · Engagement · Social · Admin & Risk · News |

## Liên kết PRD

Scoring [`prd/04`](../prd/04-scoring-engine.md) · Data model [`prd/14`](../prd/14-data-model.md) · Pipeline AI [`prd/15`](../prd/15-data-pipeline-ai.md) · Security [`prd/16`](../prd/16-security-compliance.md) · NFR [`prd/17`](../prd/17-nfr.md).
