# 17 — Non-Functional Requirements (NFR)

Yêu cầu phi chức năng. Con số là **mục tiêu định hướng**; chốt SLO khi có baseline (`20`).

---

## NFR-PERF — Hiệu năng
- **NFR-PERF-01:** Thời gian phản hồi API đọc (trang dữ liệu, leaderboard) p95 < **300ms** (đọc từ cache khi có thể).
- **NFR-PERF-02:** Thao tác đặt kèo p95 < **500ms** (gồm ghi escrow + ledger).
- **NFR-PERF-03:** Cập nhật tỉ số trận LIVE độ trễ ≤ **30–60s** so với thực tế (tuỳ nguồn API).
- **NFR-PERF-04:** Settle + chia điểm hoàn tất < **60s** sau khi có kết quả chính thức (xử lý bất đồng bộ).

## NFR-SCALE — Khả năng mở rộng & chịu tải spike
- **NFR-SCALE-01:** Chịu **spike đặt kèo** trước **kickoff** (nhiều trận trùng giờ) — kiến trúc scale ngang, hàng đợi.
- **NFR-SCALE-02:** Chịu **spike đọc leaderboard** sau settle — phục vụ từ **snapshot cache**, tránh tính realtime mỗi request.
- **NFR-SCALE-03:** Xử lý settle hàng loạt qua **job/queue bất đồng bộ**, idempotent, retry.
- **NFR-SCALE-04:** Mục tiêu công suất khởi điểm: hỗ trợ đồng thời lượng người chơi cao điểm giờ bóng lăn (đặt mục tiêu cụ thể theo dự báo — `20`).

## NFR-AVAIL — Khả dụng & độ tin cậy
- **NFR-AVAIL-01:** Uptime mục tiêu ≥ **99.5%**, ưu tiên **trong khung giờ có trận**.
- **NFR-AVAIL-02:** Degrade mượt: nếu AI/preview lỗi → ẩn, không vỡ trang; nếu odds thiếu → ẩn nút đặt.
- **NFR-AVAIL-03:** Không mất dữ liệu point/ledger (durability); backup định kỳ + khôi phục được.

## NFR-SEC — Bảo mật
- Theo `16-security-compliance.md`: JWT/cookie, hashing, rate-limit, RBAC, OWASP, audit, anti-abuse. (Bắt buộc, Must.)

## NFR-PRIV — Quyền riêng tư
- **NFR-PRIV-01:** Thu thập tối thiểu (IP/UA cho chống gian lận); minh bạch ToS/Privacy.
- **NFR-PRIV-02:** Chính sách lưu trữ & xoá/ẩn danh log theo thời hạn (`20`).

## NFR-USAB — Usability & Accessibility
- **NFR-USAB-01:** Luồng đặt kèo cốt lõi ≤ **3 thao tác** (quan trọng cho P1, mobile).
- **NFR-USAB-02:** Responsive (mobile-first) + **PWA** (cài được, web-push, offline-shell cơ bản).
- **NFR-USAB-03:** Hướng tới **WCAG 2.1 AA** (tương phản, bàn phím, alt text) ở mức hợp lý.

## NFR-I18N — Đa ngôn ngữ & múi giờ
- **NFR-I18N-01:** Ngôn ngữ mặc định **Tiếng Việt**; kiến trúc i18n sẵn sàng thêm English (sau).
- **NFR-I18N-02:** Hiển thị giờ trận theo **múi giờ người dùng**; mốc "ngày" hệ thống (điểm danh, reset nhiệm vụ) theo **giờ Việt Nam UTC+7** (OQ-07).

## NFR-OBS — Khả năng quan sát (Observability)
- **NFR-OBS-01:** Logging có cấu trúc + tracing cho luồng đặt kèo/settle.
- **NFR-OBS-02:** Metrics: tỉ lệ lỗi, latency, hàng đợi settle, **quota/cost LLM (9router)**, độ tươi dữ liệu.
- **NFR-OBS-03:** Alerting: API down trong giờ trận, settle treo, AI fallback kích hoạt, risk-flag tăng đột biến.

## NFR-MAINT — Bảo trì & chất lượng
- **NFR-MAINT-01:** Module hoá rõ ranh giới (auth, prediction, scoring, lobby, pipeline, admin) — dễ test độc lập.
- **NFR-MAINT-02:** Test cho **scoring engine** (lõi nghiệp vụ): 1X2, bonus, void, borrow, idempotent settle.
- **NFR-MAINT-03:** Tài liệu API + PRD là "living document".

## NFR-COMPAT — Tương thích
- **NFR-COMPAT-01:** Hỗ trợ trình duyệt hiện đại (Chrome/Safari/Firefox/Edge bản gần đây), iOS/Android web.
