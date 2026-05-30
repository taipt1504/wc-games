# ADR-0002 — TypeScript Stack: Next.js + Node/NestJS Worker

> **Status**: Accepted · **Date**: 2026-05-30

## Context
Cần stack ra được toàn bộ tính năng trong 12 ngày, có **SSR** (SEO trang tin + OG share card) + **PWA** (web-push, cài được), realtime, và tích hợp LLM qua 9router (OpenAI-compatible).

## Decision
**TypeScript end-to-end:**
- **Next.js (App Router)** — FE (SSR/PWA) + API routes/Server Actions (BFF). Modular monolith.
- **Node/NestJS Worker** — BullMQ consumers (ingest/odds/news/settle/notify/risk/AI). NestJS cho cấu trúc module/DI rõ.
- **Realtime Gateway** — Node + Socket.io (+ Redis adapter).
- ORM: **Prisma** (hoặc Drizzle) trên PostgreSQL.
- LLM: SDK OpenAI-compatible trỏ vào **9router** (hoặc Vercel AI SDK).

## Consequences
**+** 1 ngôn ngữ → chia sẻ type/model FE↔BE, ít context-switch, nhanh.
**+** Next.js cho SSR/SEO/OG/PWA sẵn; ecosystem realtime/queue/AI phong phú.
**+** 9router OpenAI-compatible → dùng thẳng OpenAI SDK JS.
**−** Node CPU-bound (parse/crawl nặng) kém Python/Go → đẩy việc nặng sang Worker + batching; AI parse để LLM lo.
**−** WS không hợp serverless → chạy app/worker/RT dạng **container** (xem ADR-0001, deployment).

## Alternatives
- **Python (FastAPI/Django) BE + Next FE:** AI/data ecosystem tốt nhưng **2 ngôn ngữ** → chậm hơn cho 12 ngày.
- **Next.js FE + NestJS API tách:** ranh giới rõ hơn nhưng nhiều boilerplate/thời gian hơn.
