# ADR-0005 — 9router làm LLM Gateway (self-host, API-key tier)

> **Status**: Accepted · **Date**: 2026-05-30

## Context
Chủ sản phẩm chọn **9router** (`github.com/decolua/9router`) làm proxy AI: Claude (Anthropic) **primary** → OpenAI **fallback**. Dùng cho: AI-crawl/trích xuất dữ liệu, tổng hợp odds, sinh tin tức, **AI Pundit**.

9router là proxy **OpenAI-compatible** (1 endpoint), có auto-fallback, quota tracking, format translation, multi-account — phù hợp nhu cầu định tuyến.

## Decision
Dùng 9router làm **lớp gateway LLM duy nhất**: App/Worker gọi endpoint OpenAI-compatible của 9router; 9router định tuyến Claude→OpenAI. Ghi `AIJob` (provider, tokens, cost, latency) cho dashboard. Tận dụng prompt caching + structured output.

## Tích hợp (env config) — SD-01 resolved
9router **đã được team self-host/deploy sẵn**. App/Worker **không** quản lý vòng đời 9router — chỉ cần **cấu hình env** để kết nối. Hợp đồng cấu hình:

| Env | Mô tả |
|---|---|
| `LLM_GATEWAY_BASE_URL` | Endpoint OpenAI-compatible của 9router (vd `https://.../v1`) — team cung cấp |
| `LLM_GATEWAY_API_KEY` | Khoá truy cập gateway — team cung cấp |
| `LLM_MODEL_PRIMARY` | Model/combo chính (Claude) |
| `LLM_MODEL_FALLBACK` | Model/combo dự phòng (OpenAI) — hoặc để 9router tự fallback nội bộ |
| `LLM_TIMEOUT_MS` / `LLM_MAX_RETRIES` | Timeout + retry phía client |

- Fallback Claude→OpenAI do **9router xử lý nội bộ** (combo) hoặc app chỉ định 2 model.
- Code gọi LLM **bọc sau 1 interface nội bộ** (`LlmGateway`) → đổi gateway/model không đụng business logic.
- Secret nạp qua secret manager/env (không hardcode).

## Consequences
**+** 1 interface, fallback sẵn, đổi provider không sửa code app.
**+** Quan sát chi phí/quota tập trung.
**−** Phụ thuộc 1 proxy → bọc sau interface nội bộ để thay được (giảm khoá nhà cung cấp).
