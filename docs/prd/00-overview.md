# 00 — Tổng Quan Sản Phẩm

## 1. Executive Summary

Sản phẩm là một **game dự đoán bóng đá trực tuyến** bám theo lịch thi đấu **FIFA World Cup 2026**. Người chơi dùng **điểm ảo (point)** để đặt vào kết quả các trận đấu; đoán đúng được nhân điểm theo **tỉ lệ kèo (odds)**, đoán sai mất điểm. Mục tiêu tạo trải nghiệm thi đua vui, có tính xã hội cao, xoay quanh sự kiện thể thao lớn nhất hành tinh — **không liên quan tiền thật**.

Hai chế độ chơi:
- **Global:** mọi người chơi chung trên toàn bộ 104 trận, đua trên một bảng xếp hạng (leaderboard) toàn hệ thống.
- **Private lobby:** người chơi tự mở phòng kín (mật khẩu/invite), giới hạn theo vòng đấu tuỳ chọn, có leaderboard riêng và cơ chế "mượn point" trong phòng.

Dữ liệu giải đấu (đội, bảng, lịch, cầu thủ, tỉ lệ) được nạp qua **pipeline hybrid**: API thể thao có cấu trúc cho dữ liệu sống, **AI (qua proxy 9router → Claude primary, OpenAI fallback)** cho sinh tin tức và tổng hợp tỉ lệ. AI còn cung cấp tính năng đặc sản **AI Pundit** (preview trận, gợi ý "smart pick").

## 2. Bối cảnh & Vấn đề

- World Cup 2026 là kỳ World Cup **lớn nhất lịch sử**: lần đầu 48 đội, 104 trận, 39 ngày, 3 quốc gia chủ nhà. Lượng quan tâm và lưu lượng tìm kiếm cực lớn → cơ hội thu hút người chơi theo mùa sự kiện.
- Người hâm mộ muốn **"thi đấu trí đoán"** cùng bạn bè nhưng các nền tảng cá cược thật tiềm ẩn rủi ro pháp lý/đạo đức. Thiếu một sân chơi **giải trí, an toàn, miễn phí** để đua tài dự đoán.
- Các app dự đoán hiện có thường **thiếu yếu tố xã hội** (phòng kín cùng hội bạn) và **thiếu tính cá nhân hoá bằng AI**.

## 3. Mục tiêu

### 3.1 Mục tiêu sản phẩm
1. Cho phép người chơi dự đoán mọi trận World Cup 2026 với cơ chế điểm hấp dẫn, dễ hiểu.
2. Tạo vòng lặp giữ chân hằng ngày (điểm danh, streak, nhiệm vụ, thông báo trước giờ bóng lăn).
3. Tạo tính lan truyền (lobby bạn bè, share card kết quả, referral).
4. Tận dụng AI để cá nhân hoá (gợi ý, preview) và tự động hoá nội dung (tin tức, tỉ lệ).

### 3.2 Mục tiêu kinh doanh / vận hành
1. Ra mắt **MVP trước 11/06/2026** (khai mạc) để bắt trọn sóng sự kiện.
2. Đạt mật độ tương tác cao trong 39 ngày giải đấu (xem KPI §5).
3. Vận hành an toàn pháp lý: không cá cược tiền thật, có công cụ admin phát hiện & xử lý lạm dụng.

## 4. Non-goals (Ngoài phạm vi)

- ❌ **Không** giao dịch/nạp/rút **tiền thật**; point không quy đổi tiền.
- ❌ **Không** app mobile native ở v1 (web responsive/PWA là đủ; native cân nhắc sau).
- ❌ **Không** hỗ trợ giải đấu khác ngoài WC 2026 ở phạm vi này (kiến trúc dữ liệu vẫn để mở cho mùa sau).
- ❌ **Không** phát trực tiếp (livestream) trận đấu.
- ❌ **Không** sàn giao dịch kèo người-với-người (peer-to-peer betting exchange).

## 5. Success Metrics

**North Star Metric:** *Số lượt dự đoán hợp lệ mỗi ngày trong giai đoạn giải đấu (Daily Valid Predictions).*

| Nhóm | Chỉ số | Mục tiêu định hướng |
|---|---|---|
| Acquisition | Đăng ký mới/ngày (giai đoạn trước & đầu giải) | tăng trưởng dương theo tuần |
| Activation | % user đặt ≥1 kèo trong 24h đầu | ≥ 60% |
| Engagement | Kèo/user/ngày (ngày có trận) | ≥ 3 |
| Engagement | % user dùng AI Pundit khi đặt kèo | ≥ 25% (v1) |
| Retention | D1 / D7 retention | D1 ≥ 40%, D7 ≥ 20% |
| Retention | Chuỗi điểm danh trung bình | ≥ 3 ngày |
| Viral | Hệ số lan truyền (referral + share invite) | K ≥ 0.3 |
| Social | % user tham gia ≥1 private lobby | ≥ 35% |
| Integrity | % lobby bị gắn cờ nghi lạm dụng được xử lý < 24h | 100% |

> Ngưỡng cụ thể là *định hướng*; chốt OKR khi có baseline thực tế (xem `20-open-questions.md`).

## 6. Đối tượng người dùng (tóm tắt)

5 persona chi tiết tại `01-personas.md`: **Fan giải trí**, **Cao thủ dự đoán**, **Chủ lobby**, **Admin/Moderator**, **Data/AI Ops** (phụ trợ).

## 7. Phạm vi & Ưu tiên build

> **Chốt OQ-01:** **launch TOÀN BỘ tính năng trong 1 lần, trước 11/06.** Nhãn P0/P1/P2 dưới đây = **thứ tự ưu tiên build** (build gì trước trong sprint), **không** phải mốc release riêng.

| Ưu tiên | Trọng tâm |
|---|---|
| **P0 — Lõi** | Auth + thu thập IP/UA · pipeline (free API + AI-crawl) · trang dữ liệu giải · **Global mode** + scoring 1X2 + odds · **leaderboard ROI** · điểm danh · admin core + **risk-engine** · thông báo cơ bản · news + review queue |
| **P1 — Xã hội & chiều sâu** | Private lobby + mượn point · Bracket · Futures · underdog · streak/missions/achievements · chat · share card · referral · **AI Pundit** · news AI đầy đủ |
| **P2 — Nâng cao (cut-line)** | Power-ups · combo/parlay · in-play · duel 1v1 · cosmetic shop · tiers theo mùa |

> ⚠️ 12 ngày cho toàn bộ là rất nén → cần nhiều workstream song song; giữ cut-line P2 nếu trễ. Chi tiết & gantt tại `18-roadmap-milestones.md`. Ma trận tính năng tại `02-feature-overview.md`.

## 8. Giả định & Ràng buộc

**Giả định (Assumptions):**
- A1. Có nguồn **dữ liệu thể thao FREE** cho WC2026 (worldcup2026 / OpenFootball / TheSportsDB / API-Football free) hoặc **AI-crawl bù** khi free thiếu (xem `15-data-pipeline-ai.md`).
- A2. Có nguồn **odds free-tier** (OddsPapi / Odds-API.io / The Odds API) hoặc **AI-crawl** (whoscored/oddsportal); admin nhập tay khi thiếu.
- A3. Có credential Anthropic + OpenAI cấu hình qua **9router**.
- A4. Người chơi chấp nhận điều khoản về việc thu thập IP/User-Agent phục vụ chống gian lận.

**Ràng buộc (Constraints):**
- C1. **Pháp lý:** point ảo, không quy đổi tiền; phải có cơ chế phát hiện & ngăn lạm dụng cá cược.
- C2. **Thời gian:** TOÀN BỘ tính năng phải kịp khai mạc 11/06/2026 (1 lần launch — OQ-01) → cần nhiều workstream song song; giữ cut-line P2 nếu trễ.
- C3. **Tải:** lưu lượng tăng vọt quanh **giờ bóng lăn** (kickoff) và lúc **settle** trận → kiến trúc phải chịu spike.
- C4. **Toàn vẹn:** kèo khoá tại giờ bóng lăn; tỉ số lấy từ nguồn chính thống, có audit.

## 9. Rủi ro chính & Giảm thiểu

| Rủi ro | Ảnh hưởng | Giảm thiểu |
|---|---|---|
| Dữ liệu trận/tỉ số sai hoặc trễ | Chia điểm sai, mất niềm tin | Hybrid: ưu tiên API có cấu trúc; AI chỉ phụ trợ; admin override + audit; settle có bước xác nhận |
| Bị hiểu nhầm là cá cược | Pháp lý | Lập trường "point ảo không quy đổi" rõ trong ToS + UI; công cụ admin chống lạm dụng |
| Spike tải giờ bóng lăn | Downtime đúng lúc cao điểm | Cache, hàng đợi settle bất đồng bộ, rate-limit, scale ngang |
| Chi phí/giới hạn LLM | Gián đoạn tính năng AI | 9router auto-fallback Claude→OpenAI, quota tracking, prompt caching, review queue |
| Gian lận đa tài khoản | Sai lệch leaderboard | Thu thập IP/UA, phát hiện bất thường, giới hạn thiết bị/đăng ký |

## 10. Phụ thuộc bên ngoài

- **Dữ liệu thể thao FREE** (worldcup2026 / OpenFootball / TheSportsDB / API-Football free) + **AI-crawl** fallback — xem `15`.
- **Odds free-tier** (OddsPapi / Odds-API.io / The Odds API) + **AI-crawl** (whoscored/oddsportal) hoặc admin nhập.
- **9router** (`github.com/decolua/9router`) — proxy LLM, endpoint OpenAI-compatible; định tuyến **Claude (Anthropic) primary → OpenAI (Codex/GPT) fallback**.
- **Web push / email provider** — cho thông báo.
