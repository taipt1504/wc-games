# 12 — Use Cases

Đặc tả use case chi tiết cho các luồng chính. Định dạng: *Actor · Tiền điều kiện · Luồng chính · Ngoại lệ/luồng phụ · Hậu điều kiện.*

---

### UC-01 — Đăng ký tài khoản
- **Actor:** Khách (chưa đăng nhập)
- **Tiền điều kiện:** chưa có tài khoản với email đó
- **Luồng chính:** nhập email/username + mật khẩu → hệ thống validate → tạo user (hash mật khẩu) → **cộng 1000 point** → tạo session (JWT cookie) + lưu IP/UA → vào onboarding
- **Ngoại lệ:** email tồn tại → báo lỗi; mật khẩu yếu → từ chối
- **Hậu điều kiện:** user đăng nhập, có 1000 point, có 1 dòng ledger `SIGNUP_BONUS`

### UC-02 — Đăng nhập
- **Actor:** User
- **Tiền điều kiện:** có tài khoản
- **Luồng chính:** nhập credential → xác thực → phát JWT (cookie httpOnly) + lưu IP/UA
- **Ngoại lệ:** sai N lần → khoá tạm/captcha; tài khoản bị ban → chặn + thông báo
- **Hậu điều kiện:** session hợp lệ, audit log ghi nhận

### UC-03 — Điểm danh hằng ngày
- **Actor:** User đã đăng nhập
- **Tiền điều kiện:** chưa điểm danh hôm nay
- **Luồng chính:** bấm điểm danh → +200 (×hệ số streak) → streak++ → ghi ledger
- **Ngoại lệ:** đã điểm danh → từ chối + hiện mốc reset
- **Hậu điều kiện:** số dư tăng, streak cập nhật

### UC-04 — Đặt kèo 1X2 (Global)
- **Actor:** User
- **Tiền điều kiện:** trận `SCHEDULED`, chưa kickoff, có odds, đủ số dư
- **Luồng chính:** chọn trận → chọn cửa `1/X/2` → nhập `S` → xem payout dự kiến → xác nhận → trừ `S` (escrow) + tạo Prediction `OPEN` + **snapshot odds**
- **Ngoại lệ:** tới kickoff → khoá; `S > số dư` → chặn; chưa có odds → ẩn nút
- **Hậu điều kiện:** Prediction `OPEN`, ledger `STAKE`

### UC-05 — Sửa/huỷ kèo trước kickoff
- **Actor:** User
- **Tiền điều kiện:** Prediction `OPEN`, trận chưa kickoff
- **Luồng chính:** đổi cửa/stake hoặc huỷ → hoàn/điều chỉnh escrow theo `04`
- **Ngoại lệ:** đã `LOCKED` → từ chối
- **Hậu điều kiện:** Prediction cập nhật, ledger phản ánh

### UC-06 — Khoá kèo tại kickoff
- **Actor:** Hệ thống (scheduler)
- **Tiền điều kiện:** trận đạt giờ kickoff
- **Luồng chính:** chuyển mọi Prediction `OPEN`→`LOCKED`; chặn đặt/sửa
- **Hậu điều kiện:** kèo bất biến

### UC-07 — Settle trận & chia điểm
- **Actor:** Hệ thống (+ Admin xác nhận khi cần)
- **Tiền điều kiện:** trận `FINISHED`, có tỉ số 90' hợp lệ
- **Luồng chính:** xác định `result_90` + `score_90` → tính payout từng kèo (1X2 + bonus knockout) → cập nhật ví/ledger → cập nhật leaderboard
- **Ngoại lệ:** nguồn mâu thuẫn → treo, chờ admin; trận huỷ → **VOID** hoàn điểm; chạy lại → idempotent
- **Hậu điều kiện:** kèo `SETTLED`, leaderboard cập nhật

### UC-08 — Tạo private lobby
- **Actor:** User (→ chủ phòng)
- **Tiền điều kiện:** đã đăng nhập
- **Luồng chính:** đặt tên/mật khẩu/point default/scope vòng/tuỳ chọn mượn → tạo lobby + invite token
- **Hậu điều kiện:** lobby tồn tại, chủ phòng là creator

### UC-09 — Tham gia lobby
- **Actor:** User
- **Tiền điều kiện:** có link/mật khẩu hợp lệ, chưa là thành viên
- **Luồng chính:** mở link/nhập mật khẩu → join → cấp `default` point (ví lobby)
- **Ngoại lệ:** sai mật khẩu/lobby đầy/đóng → từ chối
- **Hậu điều kiện:** membership tạo, ledger `LOBBY_DEFAULT`

### UC-10 — Mượn point trong lobby
- **Actor:** Thành viên + Chủ phòng
- **Tiền điều kiện:** lobby bật mượn point
- **Luồng chính:** thành viên request `B` → chủ phòng approve → `borrowed += B`, cấp khả năng đặt kèo → ghi ledger `BORROW`
- **Luồng phụ:** chủ phòng set trực tiếp (không cần request)
- **Ngoại lệ:** deny → không đổi
- **Hậu điều kiện:** `score_lobby` giảm `B`, audit ghi nhận

### UC-11 — Nộp Bracket Predictor
- **Actor:** User
- **Tiền điều kiện:** đã xác định 32 đội knockout, chưa khoá bracket
- **Luồng chính:** điền đội đi tiếp từng vòng tới vô địch → lưu → khoá tại kickoff knockout đầu
- **Hậu điều kiện:** bracket lưu, chấm dần theo kết quả (`06`)

### UC-12 — Đặt Futures
- **Actor:** User
- **Tiền điều kiện:** market mở, đủ số dư
- **Luồng chính:** chọn market (vô địch/vua phá lưới…) → chọn lựa chọn + stake → xác nhận (snapshot odds)
- **Hậu điều kiện:** future pick `OPEN`, settle 1 lần khi có kết quả

### UC-13 — Xem AI Pundit
- **Actor:** User
- **Tiền điều kiện:** trận sắp đá
- **Luồng chính:** mở chi tiết trận → hệ thống lấy preview/smart pick (cache hoặc gọi 9router) → hiển thị + disclaimer
- **Ngoại lệ:** LLM lỗi → fallback nguồn khác hoặc ẩn mượt
- **Hậu điều kiện:** không đổi dữ liệu game; có thể log "đã xem"

### UC-14 — Referral
- **Actor:** User A (mời), User B (mới)
- **Luồng chính:** B đăng ký qua link A → B đạt mốc kích hoạt → cả hai +point (ledger `REFERRAL`)
- **Ngoại lệ:** nghi tự-refer (IP/UA trùng) → không thưởng + gắn cờ
- **Hậu điều kiện:** point thưởng, liên kết referral ghi nhận

### UC-15 — Admin xử lý lobby nghi vấn
- **Actor:** Admin/Moderator
- **Tiền điều kiện:** lobby bị gắn cờ
- **Luồng chính:** mở điều tra (ledger, IP/UA, chat) → xác định vi phạm → đóng lobby/ban + case file + export
- **Hậu điều kiện:** vi phạm xử lý, audit + hồ sơ lưu

### UC-16 — Admin override dữ liệu & re-settle
- **Actor:** Admin
- **Tiền điều kiện:** phát hiện tỉ số/tỉ lệ sai
- **Luồng chính:** sửa dữ liệu + lý do → nếu sau settle: confirm **re-settle** idempotent → cập nhật payout + thông báo user ảnh hưởng
- **Hậu điều kiện:** dữ liệu đúng, audit ghi tác động

### UC-17 — Quản trị tin tức (review)
- **Actor:** Admin
- **Tiền điều kiện:** có bài AI `PENDING`
- **Luồng chính:** xem/sửa → duyệt (`PUBLISHED`) hoặc từ chối (`REJECTED` + lý do)
- **Hậu điều kiện:** trạng thái bài cập nhật

### UC-18 — Quản lý thông báo cá nhân
- **Actor:** User
- **Luồng chính:** bật/tắt từng loại × kênh (push/email) → lưu cấu hình
- **Hậu điều kiện:** preference áp dụng cho lần gửi sau
