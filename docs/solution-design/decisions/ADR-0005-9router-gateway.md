# ADR-0005 — 9router làm LLM Gateway (self-host, API-key tier)

> **Status**: Accepted (có điều kiện) · **Date**: 2026-05-30

## Context
Chủ sản phẩm chọn **9router** (`github.com/decolua/9router`) làm proxy AI: Claude (Anthropic) **primary** → OpenAI **fallback**. Dùng cho: AI-crawl/trích xuất dữ liệu, tổng hợp odds, sinh tin tức, **AI Pundit**.

9router là proxy **OpenAI-compatible** (1 endpoint), có auto-fallback, quota tracking, format translation, multi-account — phù hợp nhu cầu định tuyến.

## Decision
Dùng 9router làm **lớp gateway LLM duy nhất**: App/Worker gọi endpoint OpenAI-compatible của 9router; 9router định tuyến Claude→OpenAI. Ghi `AIJob` (provider, tokens, cost, latency) cho dashboard. Tận dụng prompt caching + structured output.

## ⚠️ Điều kiện (rủi ro cần chốt — SD-01)
README của 9router định vị nó là **proxy local cho công cụ CLI** (`localhost:20128`, các tier OAuth-subscription như Claude Code/Copilot). Chạy như **gateway production cho web app người dùng** là kịch bản khác. **Bắt buộc:**
- **Self-host** 9router trong hạ tầng (không phụ thuộc máy dev/localhost).
- Dùng **API-key tier** chính thức của Anthropic + OpenAI (không dùng OAuth-subscription của công cụ CLI cho mục đích production).
- Xác nhận giấy phép/điều khoản cho dùng server-side production **trước go-live**.
- Có **đường lui**: nếu 9router không phù hợp production → thay bằng gateway tự xây mỏng (cùng interface OpenAI-compatible) — chi phí thấp vì code chỉ gọi 1 interface chuẩn.

## Consequences
**+** 1 interface, fallback sẵn, đổi provider không sửa code app.
**+** Quan sát chi phí/quota tập trung.
**−** Phụ thuộc 1 proxy → bọc sau interface nội bộ để thay được (giảm khoá nhà cung cấp).
