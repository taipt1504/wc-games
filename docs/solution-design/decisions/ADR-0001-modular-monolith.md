# ADR-0001 — Modular Monolith + Background Worker (không Microservices)

> **Status**: Accepted · **Date**: 2026-05-30

## Context
Greenfield, **deadline ~12 ngày** tới khai mạc (OQ-01: launch toàn bộ tính năng). Team nhỏ. Nhiều bounded context (auth, data, prediction/scoring, lobby, engagement, social, AI/pipeline, admin, news).

## Decision
Xây **modular monolith** bằng Next.js full-stack cho phần online (FE + API/BFF), tách **background worker** (BullMQ) cho job nặng/bất đồng bộ (ingest, settle, AI, notify, risk), và **Realtime Gateway** (WS) cho chat/live. Ranh giới module rõ trong code (mỗi context 1 thư mục/domain, giao tiếp qua interface), **không** chia microservices.

## Consequences
**+** 1 deployable → build/deploy/debug nhanh, hợp deadline; giao dịch point trong 1 DB (ACID dễ); ít overhead vận hành/network.
**+** Module boundary rõ → có thể **tách service sau** khi cần scale riêng.
**−** Toàn app scale chung (giảm nhẹ bằng tách Worker + Realtime ra process riêng để scale độc lập theo tải).
**−** Cần kỷ luật giữ ranh giới module (review + lint boundary).

## Alternatives
- **Microservices ngay:** loại — quá nhiều overhead (network, deploy, dữ liệu phân tán, distributed tx cho ledger) cho 12 ngày.
- **Serverless functions thuần:** loại — WS long-lived + worker chạy dài + giao dịch ledger hợp container/process bền hơn.
