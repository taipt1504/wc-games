# ADR-0003 — PostgreSQL làm System of Record + PointLedger Append-Only

> **Status**: Accepted · **Date**: 2026-05-30

## Context
Point là tài sản trong game; sai/mất/chia 2 lần là lỗi nghiêm trọng (niềm tin + tuân thủ). Cần giao dịch (escrow khi đặt, payout khi settle), **settle idempotent**, audit đối soát, và ví **tách context** (global vs từng lobby).

## Decision
- **PostgreSQL** là nguồn chân lý cho mọi dữ liệu giao dịch.
- **PointLedger append-only** là nguồn chân lý về point: mỗi thay đổi = 1 dòng (`SIGNUP/DAILY/STAKE/SETTLE/BORROW/REFERRAL/PURCHASE/ADMIN_ADJ`) với `amount`, `balance_after`, `context`, `ref_id`. Số dư = tổng hợp ledger (không sửa trực tiếp).
- Đặt kèo & settle chạy trong **DB transaction**; settle có **idempotency guard theo `match_id`** (unique/lock) để không chia 2 lần.
- **Snapshot odds** lưu trên prediction (không dùng odds hiện tại lúc settle).

## Consequences
**+** Toàn vẹn point (ACID), đối soát/audit dễ, re-settle an toàn.
**+** Tách `context` → point không chảy giữa global/lobby (chống lạm dụng).
**−** Append-only ledger phình → cần index + (sau) archival/partition theo thời gian.
**−** Đọc số dư cần tổng hợp → cache `balance_after` mới nhất / materialized balance per (user, context).

## Alternatives
- **Lưu số dư gộp (no ledger):** loại — khó audit, dễ sai khi đồng thời.
- **NoSQL:** loại cho phần tiền tệ — thiếu giao dịch đa-bảng mạnh.
