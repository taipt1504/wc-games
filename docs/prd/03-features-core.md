# 03 — Tính Năng Lõi (Core)

Đặc tả chi tiết các epic lõi: **Auth & Tài khoản**, **Dữ liệu giải đấu**, **Global Mode**, **Private Lobby**. Tính điểm tách riêng ở `04-scoring-engine.md`.

Định dạng mỗi mục: *Mô tả → Yêu cầu → Acceptance Criteria (AC) → Ghi chú UX.*

---

## A. Auth & Tài khoản

### A1. Đăng ký & Đăng nhập (FR-AUTH-01/02/04)
**Mô tả:** User tạo tài khoản bằng email/username + mật khẩu, đăng nhập nhận JWT lưu trong **cookie httpOnly + Secure**.

**Yêu cầu:**
- Mật khẩu hash bằng thuật toán mạnh (bcrypt/argon2), không lưu plaintext.
- JWT access token ngắn hạn + refresh token; xoay (rotate) refresh token.
- Rate-limit đăng nhập (chống brute force) — xem `16`.
- Mỗi lần tạo session: lưu **IP + User-Agent + timestamp** (FR-AUTH-03) vào `AuditLog`.

**AC:**
- *Given* email chưa tồn tại, *when* đăng ký hợp lệ, *then* tạo tài khoản + cộng **1000 point** + tạo session.
- *Given* sai mật khẩu N lần, *then* tạm khoá/đưa captcha.
- *Given* token hết hạn, *when* gọi API, *then* trả 401 và cho refresh.

### A2. Thưởng đăng ký & điểm danh (FR-AUTH-05, FR-GLOBAL-05)
- Đăng ký lần đầu: +1000 point (idempotent — không nhận 2 lần).
- Điểm danh: +200 point/ngày khi đăng nhập + check-in (một lần/ngày).
- **AC:** *Given* đã điểm danh hôm nay, *when* điểm danh lại, *then* từ chối + hiển thị mốc reset kế tiếp.

### A3. Profile & Ví Point (FR-AUTH-06/07)
- Profile: avatar, tên hiển thị, đổi mật khẩu, thống kê (số kèo, tỉ lệ thắng, ROI, huy hiệu).
- Ví Point: số dư hiện tại + **lịch sử giao dịch** (đặt kèo, settle, thưởng, mượn) từ `PointLedger`.
- **AC:** mọi thay đổi point đều truy được về 1 dòng ledger (đối soát được).

---

## B. Dữ liệu giải đấu (FR-DATA-01…07)

> Nguồn dữ liệu: pipeline hybrid (`15-data-pipeline-ai.md`). UI hiển thị, không nhập tay (trừ admin override).

### B1. Đội & Cầu thủ (FR-DATA-01/05)
- Danh sách 48 đội (cờ, FIFA ranking, bảng), trang chi tiết đội: đội hình, cầu thủ, lịch đấu của đội, phong độ.
- **AC:** mở 1 đội thấy đủ 3 trận vòng bảng + cầu thủ; dữ liệu khớp nguồn.

### B2. Bảng đấu & BXH vòng bảng (FR-DATA-02)
- 12 bảng (A–L), mỗi bảng 4 đội; BXH cập nhật theo kết quả (điểm, hiệu số, bàn thắng) theo tiebreaker FIFA.
- **AC:** sau mỗi trận vòng bảng settle, BXH bảng cập nhật đúng thứ tự tiebreaker.

### B3. Lịch thi đấu (FR-DATA-03/07)
- 104 trận, lọc theo **đội / ngày / vòng / sân**; hiển thị giờ địa phương người dùng.
- Trạng thái trận: `SCHEDULED / LIVE / FINISHED / POSTPONED / CANCELLED`.
- Cập nhật tỉ số **gần real-time** khi LIVE.
- **AC:** trận đã FINISHED hiển thị tỉ số chính thức; trận LIVE cập nhật tối thiểu mỗi vài chục giây (xem NFR).

### B4. Chi tiết trận (FR-DATA-04)
- Giờ, sân, đội hình dự kiến, **tỉ lệ 3 cửa (1/X/2)**, link đặt kèo, preview AI (v1).
- **AC:** hiển thị `m_home/m_draw/m_away` hiện hành; nếu thiếu odds → ẩn nút đặt hoặc báo "chưa có tỉ lệ".

### B5. Bracket knockout (FR-DATA-06, v1)
- Sơ đồ nhánh từ Vòng 32 đội (Round of 32) → CK; cập nhật theo kết quả.

---

## C. Global Mode (FR-GLOBAL-01…04)

**Mô tả:** Sân chơi chung — mọi user đặt kèo trên toàn bộ 104 trận, đua chung 1 leaderboard.

**Yêu cầu:**
- Đặt kèo 1X2 bất kỳ trận `SCHEDULED` nào (FR-GLOBAL-01); tính điểm theo `04`.
- **Khoá kèo tại kickoff** (FR-GLOBAL-02): sau giờ này không đặt/sửa.
- Leaderboard global (FR-GLOBAL-03): xếp theo số dư/lãi ròng (xem `04 §9`), phân trang, tìm thứ hạng bản thân.
- Lịch sử kèo cá nhân + ROI (FR-GLOBAL-04).

**AC:**
- *Given* trận chưa kickoff, *when* đặt kèo với `S ≤ số dư`, *then* trừ point (escrow) + tạo Prediction `OPEN`.
- *Given* đã tới kickoff, *when* cố đặt/sửa, *then* từ chối ("kèo đã khoá").
- *Given* trận settle, *then* leaderboard & ví cập nhật, lịch sử ghi kết quả.

**UX:** ưu tiên luồng đặt kèo nhanh ≤ 2–3 thao tác (quan trọng cho P1); hiển thị odds & payout dự kiến trước khi xác nhận.

---

## D. Private Lobby (FR-LOBBY-01…08, v1)

**Mô tả:** Phòng kín do user tạo cho nhóm bạn/đồng nghiệp đua riêng, có leaderboard riêng và cơ chế mượn point.

### D1. Tạo & cấu hình lobby (FR-LOBBY-01/03)
- Cấu hình: tên, **mật khẩu**, **point default** mỗi thành viên, **scope vòng đấu**:
  - cả giải / vòng bảng / Vòng 32 đội / Vòng 16 đội / tứ kết / bán kết / CK / **một trận duy nhất**.
- Tuỳ chọn: cho phép mượn point (bật/tắt), set tỉ lệ tay (FR-LOBBY-07, Could).
- **AC:** tạo lobby scope "vòng bảng" → chỉ các trận vòng bảng hiện trong lobby đó.

### D2. Mời & tham gia (FR-LOBBY-02)
- Mời qua **invite link** (token) và/hoặc **nhập mật khẩu**.
- Khi join: cấp `default` point (ví lobby riêng, độc lập ví global).
- **AC:** mở link hợp lệ + đúng mật khẩu (nếu yêu cầu) → vào phòng, nhận default point.

### D3. Leaderboard lobby (FR-LOBBY-04)
- Xếp theo `score_lobby = winnings + default − borrowed` (`04 §6`).

### D4. Mượn point (FR-LOBBY-05/06)
- User request mượn `B` → chủ phòng **approve/deny**; hoặc chủ phòng set trực tiếp.
- Ghi `PointLedger(BORROW)`; cập nhật `borrowed` & khả năng đặt kèo.
- **AC:** *Given* user hết điểm, *when* request mượn 200 & chủ duyệt, *then* đặt được kèo nhưng `score_lobby` giảm 200.

### D5. Quản trị phòng (FR-LOBBY-08)
- Chủ phòng: kick thành viên, chuyển quyền chủ, đóng phòng.
- Mọi lobby & hành vi point đều nằm trong tầm giám sát admin (`09`, `16`).

**Ghi chú tách biệt ví:** ví **global** và ví **mỗi lobby** là độc lập; point không chảy giữa chúng (chống lạm dụng & giữ tính giải trí). Mượn point chỉ là số ảo nội bộ lobby.
