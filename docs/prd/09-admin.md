# 09 — Admin & Vận Hành

Khu vực quản trị dành cho **P4 (Admin/Moderator)** và **P5 (Data/AI Ops)**. Mục tiêu: vận hành đúng, **phát hiện & xử lý lạm dụng cá cược**, quản trị dữ liệu & nội dung.

---

## ADMIN-01 — Quản lý User (MVP)

**Yêu cầu:**
- Tìm/lọc user (theo email, trạng thái, ngày tạo, IP).
- Xem hồ sơ: thông tin, số dư point, lịch sử kèo, **các session (IP/UA)**, lobby tham gia, cờ cảnh báo.
- Action: **khoá/mở khoá, ban (vĩnh viễn/tạm)**, reset mật khẩu, thu hồi point gian lận (ghi ledger + lý do).
- Mọi action ghi **audit** (ai, khi nào, lý do).

**AC:** *Given* user vi phạm, *when* admin ban, *then* user mất quyền đăng nhập + ghi hồ sơ vi phạm + audit log.

---

## ADMIN-02 — Giám sát Lobby & Cờ cảnh báo lạm dụng (v1) ⭐

> Đây là yêu cầu cốt lõi về tuân thủ: phát hiện lobby "lợi dụng point để cá cược" tiền thật.

**Yêu cầu:**
- Danh sách lobby + bộ lọc rủi ro; **hệ thống cờ tự động (risk flags)** dựa trên heuristic, ví dụ:
  - Mượn point bất thường (volume lớn, lặp lại, dồn về 1 người).
  - Nhiều tài khoản chung IP/UA trong 1 lobby.
  - Pattern "thua có hệ thống về 1 người" (nghi chuyển giá trị).
  - Lobby chỉ 2 người với dòng point một chiều.
- Trang điều tra lobby: thành viên, **PointLedger** đầy đủ, biểu đồ dòng point, IP/UA, chat log.

**AC:** *Given* lobby vượt ngưỡng heuristic, *then* tự gắn cờ + đẩy lên hàng đợi review; *when* admin mở, *then* xem được toàn bộ bằng chứng.

---

## ADMIN-03 — Xử lý vi phạm (v1)

**Yêu cầu:**
- Action trên lobby/user: cảnh cáo, đóng lobby, ban user, **ghi hồ sơ vi phạm** (case file) phục vụ xử lý nội bộ hoặc **tố cáo cơ quan pháp luật** (theo requirements).
- Xuất bằng chứng (export): ledger, IP/UA, timeline, chat.
- Quy trình escalation rõ (mod → admin cấp cao).

**AC:** *Given* xác nhận lobby cá cược tiền thật, *when* xử lý, *then* đóng lobby + ban liên quan + tạo case file export được.

---

## ADMIN-04 — Quản lý Dữ liệu giải (đội/lịch/tỉ lệ) (MVP)

**Yêu cầu:**
- CRUD + **override** dữ liệu từ pipeline: đội, bảng, **lịch/giờ**, **tỉ số**, **tỉ lệ kèo (m_home/draw/away)**.
- Khi override: ghi nguồn + lý do; ưu tiên override admin > AI > API mặc định (chốt thứ tự ở `15`).
- Trigger **re-settle** an toàn nếu sửa tỉ số sau settle (có cảnh báo tác động + audit).

**AC:** *Given* tỉ số API sai, *when* admin sửa + confirm re-settle, *then* hệ thống tính lại payout idempotent + ghi audit + thông báo user bị ảnh hưởng.

---

## ADMIN-05 — Quản lý Tin tức + Review Queue (MVP)

**Yêu cầu:**
- Hàng đợi bài AI sinh (`10-news.md`): xem, sửa, **duyệt/từ chối**, gắn tag, lên lịch publish.
- Chỉ bài **đã duyệt** mới hiển thị công khai (human-in-the-loop).

**AC:** *Given* bài AI ở trạng thái `PENDING`, *when* admin duyệt, *then* chuyển `PUBLISHED` + hiện trang tin.

---

## ADMIN-06 — Audit Log (MVP)

**Yêu cầu:**
- Ghi bất biến: đăng nhập (IP/UA), giao dịch point (ledger), action admin, thay đổi dữ liệu.
- Tìm kiếm/lọc theo user/lobby/thời gian/loại; **export**.
- Chính sách lưu trữ & quyền truy cập theo `16` + `17` (privacy/retention).

---

## ADMIN-07 — Dashboard Pipeline AI (v1)

**Yêu cầu (cho P5):**
- Trạng thái **AIJob** (crawl/ingest/news/odds/preview): thành công/thất bại/retry.
- **9router**: provider đang dùng, fallback Claude→OpenAI, **quota & cost**, độ trễ.
- Cấu hình nguồn (sports API, nguồn odds/news), bật/tắt job, chạy lại thủ công.

**AC:** *Given* Claude hết quota, *then* dashboard hiển thị đã fallback OpenAI + cảnh báo; *when* job lỗi, *then* hiện log + nút retry.

---

## Phân quyền (RBAC) — tóm tắt

| Vai trò | Quyền |
|---|---|
| **Moderator** | Giám sát lobby, xử lý chat/report, gắn cờ, đề xuất ban |
| **Admin** | Toàn bộ moderator + ban, quản lý dữ liệu/tin, override, re-settle |
| **Data/AI Ops** | Pipeline, nguồn dữ liệu, cấu hình AI; không quyền ban user |
| **Super Admin** | Toàn quyền + quản lý vai trò + cấu hình tham số hệ thống (`04 §10`) |
