# 01 — Personas

5 chân dung đại diện cho người dùng sản phẩm. Mỗi tính năng trong PRD đều gắn về ít nhất một persona (xem cột "Persona" trong `02-feature-overview.md`).

---

## P1 — Minh, "Fan giải trí" 🎉

| | |
|---|---|
| Tuổi/nghề | 24, nhân viên văn phòng |
| Mức độ rành bóng đá | Trung bình — xem trận lớn, biết đội mạnh |
| Thiết bị | Điện thoại (mobile web), thỉnh thoảng laptop |

- **Mục tiêu:** vui theo mùa World Cup, đoán cho có cảm giác hồi hộp, khoe bạn bè khi đoán đúng.
- **Nỗi đau:** không có thời gian phân tích sâu; ngại app phức tạp; dễ quên đặt kèo.
- **Hành vi:** vào nhanh trước giờ bóng lăn, đặt vài kèo theo cảm tính/gợi ý, chia sẻ kết quả.
- **Tính năng quan tâm:** điểm danh + streak, **AI smart pick**, thông báo nhắc khoá kèo, share card, lobby với hội bạn.
- **Ngày điển hình:** nhận thông báo "2 trận tối nay, kèo khoá lúc 23:00" → mở app → xem gợi ý AI → đặt 3 kèo trong 2 phút → tối xem kết quả → share thành tích.

---

## P2 — Trang, "Cao thủ dự đoán" 🏆

| | |
|---|---|
| Tuổi/nghề | 31, dân phân tích/đam mê bóng đá |
| Mức độ rành bóng đá | Cao — theo dõi phong độ, đội hình, lịch sử đối đầu |
| Thiết bị | Laptop là chính |

- **Mục tiêu:** leo **top leaderboard global**, tối ưu điểm qua quản lý vốn (bankroll) và bắt kèo cửa dưới.
- **Nỗi đau:** cần dữ liệu chính xác (đội hình, chấn thương, tỉ lệ); ghét tỉ lệ/tính điểm mập mờ; cần lịch sử kèo của mình.
- **Hành vi:** nghiên cứu trước, đặt kèo có chọn lọc, theo dõi ROI, săn **underdog bonus**, chơi **Futures** (vô địch, vua phá lưới).
- **Tính năng quan tâm:** trang dữ liệu giải chi tiết, **odds rõ ràng + lịch sử**, underdog bonus, futures, bracket predictor, thống kê cá nhân.
- **Ngày điển hình:** đọc preview AI + số liệu → đối chiếu nhận định riêng → phân bổ point theo nhiều kèo → kiểm tra thứ hạng → điều chỉnh chiến lược.

---

## P3 — Khoa, "Chủ lobby" 👥

| | |
|---|---|
| Tuổi/nghề | 28, trưởng nhóm bạn/đồng nghiệp |
| Vai trò | Người khởi xướng cuộc vui trong nhóm |
| Thiết bị | Mobile + laptop |

- **Mục tiêu:** lập **phòng kín** cho hội bạn/công ty đua với nhau, kiểm soát luật chơi, giữ không khí sôi nổi.
- **Nỗi đau:** mời người vào phòng phải dễ; cần chỉnh point khởi điểm & phạm vi vòng đấu; xử lý người hết điểm giữa chừng (mượn point); muốn trò chuyện/"khẩu chiến" ngay trong phòng.
- **Hành vi:** tạo lobby theo "vòng bảng" hoặc "cả giải", set point default, mời bằng link/mật khẩu, duyệt yêu cầu mượn point, theo dõi BXH phòng.
- **Tính năng quan tâm:** tạo/cấu hình lobby, invite link + mật khẩu, **mượn point + duyệt**, leaderboard phòng, **chat + reaction**, set tỉ lệ tay (tuỳ chọn).
- **Ngày điển hình:** tạo phòng "Công ty ABC — Vòng bảng" → gửi link Slack → duyệt mượn point cho đồng nghiệp hết điểm → chọc ghẹo trong chat khi ai đó đoán trật.

---

## P4 — Hằng, "Admin / Moderator" 🛡️

| | |
|---|---|
| Vai trò | Vận hành & kiểm duyệt nền tảng |
| Thiết bị | Laptop (trang admin) |

- **Mục tiêu:** giữ hệ thống chạy đúng & an toàn; phát hiện lobby/người dùng có dấu hiệu **lợi dụng point để cá cược tiền thật**; quản trị dữ liệu giải & tin tức.
- **Nỗi đau:** cần công cụ giám sát hành vi bất thường; cần override dữ liệu sai (tỉ số/tỉ lệ); cần audit log đầy đủ (IP/UA) để xử lý vi phạm.
- **Hành vi:** theo dõi dashboard cờ cảnh báo, điều tra lobby nghi vấn, **ban/khoá**, duyệt nội dung tin AI trước khi publish, chỉnh fixtures/odds khi cần.
- **Tính năng quan tâm:** quản lý user, **giám sát & xử lý lobby**, quản lý đội/lịch/tỉ lệ, **review queue tin tức**, audit log, báo cáo.
- **Ngày điển hình:** xem cảnh báo "lobby X có pattern chuyển point bất thường" → mở audit (IP/UA, ledger) → quyết định cảnh cáo/ban → ghi nhận hồ sơ.

---

## P5 — Tú, "Data / AI Ops" ⚙️ (phụ trợ)

| | |
|---|---|
| Vai trò | Vận hành pipeline dữ liệu & AI |
| Thiết bị | Laptop (công cụ nội bộ/admin) |

- **Mục tiêu:** đảm bảo dữ liệu giải **tươi & đúng**, pipeline AI (9router) chạy ổn định, chi phí trong ngân sách.
- **Nỗi đau:** nguồn API trễ/sai; LLM hết quota/đổi format; cần theo dõi job crawl/ingest và chất lượng nội dung AI.
- **Hành vi:** theo dõi trạng thái AIJob, retry, kiểm tra fallback Claude→OpenAI, kiểm duyệt mẫu nội dung, điều chỉnh prompt/nguồn.
- **Tính năng quan tâm:** trạng thái pipeline, log job, cấu hình nguồn odds/news, quota & cost LLM, công cụ override.

> P5 có thể trùng vai với P4 ở tổ chức nhỏ; tách ra để làm rõ yêu cầu về vận hành dữ liệu/AI.
