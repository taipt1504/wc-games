# ADR-0004 — Redis: Cache + Queue (BullMQ) + Pub/Sub

> **Status**: Accepted · **Date**: 2026-05-30

## Context
Tải **vọt quanh kickoff** (đặt kèo) và **lúc settle** (chia điểm + đọc leaderboard hàng loạt). Settle phải < 60s và idempotent. Leaderboard gần real-time. Chat/live cần fan-out realtime đa instance.

## Decision
Dùng **Redis** cho 3 vai trò:
1. **Cache** — snapshot leaderboard (global ROI + lobby), số dư, dữ liệu trận hot. Đọc leaderboard phục vụ từ snapshot (không tính realtime mỗi request).
2. **Queue (BullMQ)** — job bất đồng bộ: ingest, odds, news-gen, **settle**, notify, risk-scan, recompute leaderboard. App `enqueue`, Worker consume; retry + backoff; idempotent theo key.
3. **Pub/Sub** — fan-out sự kiện (settle xong, tỉ số live) tới **Realtime Gateway** (Socket.io Redis adapter) để scale WS đa instance.

## Consequences
**+** Tách ghi nặng khỏi request → chịu spike; settle async đúng SLA.
**+** Đọc leaderboard rẻ (cache) lúc cao điểm.
**+** WS scale ngang nhờ Redis adapter.
**−** Thêm thành phần stateful (dùng **managed Redis** + HA).
**−** Cache invalidation cần kỷ luật (invalidate khi settle/đặt kèo).

## Alternatives
- **Kafka/RabbitMQ:** mạnh hơn nhưng nặng vận hành — thừa cho quy mô & deadline; BullMQ/Redis đủ.
- **Tính leaderboard realtime mỗi request:** loại — sập lúc spike.
