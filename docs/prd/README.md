# PRD — Game Dự Đoán FIFA World Cup 2026

Tài liệu PRD (Product Requirements Document) cho sản phẩm **game dự đoán bóng đá** bám theo **FIFA World Cup 2026** (đội tuyển quốc gia — 48 đội, đồng chủ nhà Mỹ/Canada/Mexico, 11/06–19/07/2026).

> **Tính chất sản phẩm:** Game giải trí *free-to-play*. Điểm (point) là **tiền ảo**, **không mua bằng tiền thật, không quy đổi ra tiền, không chuyển nhượng giữa người dùng**. Đây **không** phải nền tảng cá cược. Xem `16-security-compliance.md`.

---

## Trạng thái tài liệu

| Mục | Giá trị |
|---|---|
| Phiên bản | 0.1 — Draft |
| Cập nhật | 2026-05-30 |
| Chủ sở hữu (Product) | TBD |
| Giải đấu mục tiêu | FIFA World Cup 2026 |
| Nền tảng | Web-first, responsive, chuẩn PWA |

---

## Mục lục

| # | File | Nội dung |
|---|---|---|
| — | [`README.md`](./README.md) | Index, quy ước, change log (file này) |
| 00 | [`00-overview.md`](./00-overview.md) | Executive summary, mục tiêu, success metrics, scope & phasing |
| 01 | [`01-personas.md`](./01-personas.md) | 5 chân dung người dùng |
| 02 | [`02-feature-overview.md`](./02-feature-overview.md) | Ma trận tính năng × ưu tiên × phase |
| 03 | [`03-features-core.md`](./03-features-core.md) | Global mode, private lobby, profile/point, trang dữ liệu giải |
| 04 | [`04-scoring-engine.md`](./04-scoring-engine.md) | Cơ chế tính điểm: 1X2, odds, bonus knockout, mượn point |
| 05 | [`05-features-engagement.md`](./05-features-engagement.md) | Streak, missions, achievements, notifications |
| 06 | [`06-features-prediction-depth.md`](./06-features-prediction-depth.md) | Bracket, futures, underdog, power-ups, combo, in-play |
| 07 | [`07-features-social.md`](./07-features-social.md) | Chat lobby, share card, referral, duel |
| 08 | [`08-features-ai-meta.md`](./08-features-ai-meta.md) | AI Pundit, cosmetic shop, tiers |
| 09 | [`09-admin.md`](./09-admin.md) | Quản lý user/lobby/dữ liệu/tin tức + chống lạm dụng |
| 10 | [`10-news.md`](./10-news.md) | Tin tức bên lề — AI auto-publish + review queue |
| 11 | [`11-user-journeys.md`](./11-user-journeys.md) | ~6 user journey chính |
| 12 | [`12-use-cases.md`](./12-use-cases.md) | Bảng use case chi tiết |
| 13 | [`13-sequence-diagrams.md`](./13-sequence-diagrams.md) | ~12 sequence diagram (mermaid) |
| 14 | [`14-data-model.md`](./14-data-model.md) | ERD + từ điển thực thể |
| 15 | [`15-data-pipeline-ai.md`](./15-data-pipeline-ai.md) | Hybrid sports-API + AI router (9router; Claude→OpenAI) |
| 16 | [`16-security-compliance.md`](./16-security-compliance.md) | JWT/cookie, IP/UA, point ảo, chống cá độ |
| 17 | [`17-nfr.md`](./17-nfr.md) | Yêu cầu phi chức năng |
| 18 | [`18-roadmap-milestones.md`](./18-roadmap-milestones.md) | Lộ trình MVP→v1→v2 bám lịch WC |
| 19 | [`19-glossary.md`](./19-glossary.md) | Thuật ngữ |
| 20 | [`20-open-questions.md`](./20-open-questions.md) | Câu hỏi/quyết định còn mở |

---

## Cách đọc

- **Product/BA:** 00 → 01 → 02 → 03–10 → 11–12.
- **Engineer:** 02 → 03–10 → 13 → 14 → 15 → 16 → 17.
- **Stakeholder/QC:** 00 → 18 → 12 → 20.

## Quy ước ký hiệu

| Loại | Tiền tố | Ví dụ |
|---|---|---|
| Yêu cầu chức năng | `FR-` | `FR-SCORE-01` |
| Yêu cầu phi chức năng | `NFR-` | `NFR-PERF-02` |
| Use case | `UC-` | `UC-12` |
| User journey | `UJ-` | `UJ-03` |
| Sequence diagram | `SEQ-` | `SEQ-05` |
| Câu hỏi mở | `OQ-` | `OQ-04` |

**Ưu tiên (MoSCoW):** `Must` / `Should` / `Could` / `Won't (now)`.
**Phase:** `MVP` (ra mắt trước 11/06/2026) / `v1` (trong giải) / `v2` (sau giải / mùa sau).

## Change log

| Ngày | Phiên bản | Thay đổi | Người |
|---|---|---|---|
| 2026-05-30 | 0.1 | Khởi tạo PRD draft từ `requirements.md` + brainstorming | — |
