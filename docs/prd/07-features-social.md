# 07 — Social & Viral

Nhóm tính năng tạo **tính xã hội** (giữ chân theo nhóm) và **lan truyền** (tăng trưởng tự nhiên). Trọng tâm P3 (chủ lobby) & P1.

---

## SOCIAL-01 — Chat & Reaction trong Lobby (v1)

**Mô tả:** Kênh trò chuyện/"khẩu chiến" ngay trong private lobby — chất keo gắn kết nhóm bạn.

**Yêu cầu:**
- Chat realtime trong phạm vi lobby (text + emoji + reaction).
- Tin hệ thống tự sinh tạo không khí: "🔥 Khoa vừa thắng kèo cửa dưới +250", "Trang vươn lên #1".
- Reaction nhanh trên kèo/kết quả của thành viên (👍😂😮💀).
- Kiểm duyệt cơ bản: lọc từ cấm, report; chủ phòng có thể mute/kick (`FR-LOBBY-08`).

**AC:** *Given* trong lobby, *when* gửi tin nhắn, *then* các thành viên thấy realtime; *when* ai đó settle thắng lớn, *then* có tin hệ thống.

**Phạm vi:** chat **trong lobby** (v1). Chat global/DM = ngoài phạm vi (rủi ro kiểm duyệt cao).

---

## SOCIAL-02 — Share Card kết quả (v1) ⭐ viral

**Mô tả:** Ảnh kết quả đẹp, tự sinh, để share lên mạng xã hội → kéo người mới.

**Nội dung card:**
- Thành tích nổi bật: "Tôi đoán đúng 5/6 trận hôm nay 🎯", chuỗi thắng, hạng leaderboard, badge mới.
- Branding game + **link mời** (gắn referral code — `SOCIAL-03`).

**Yêu cầu:**
- Sinh ảnh (server-side render hoặc canvas) theo template; nút "Chia sẻ" (Web Share API / tải ảnh / copy link).
- Open Graph meta cho link share (preview đẹp khi dán Facebook/X/Zalo).

**AC:** *Given* vừa có kết quả tốt, *when* bấm "Chia sẻ thành tích", *then* sinh card kèm link referral, share được ra MXH.

---

## SOCIAL-03 — Referral (v1)

**Mô tả:** Mời bạn — cả người mời và người được mời đều nhận thưởng point.

**Yêu cầu:**
- Mỗi user có **referral code/link** riêng.
- Người mới đăng ký qua link → ghi nhận; sau khi người mới đạt mốc kích hoạt (vd đặt 1 kèo / điểm danh 1 ngày) → **cả hai** nhận thưởng (vd +300 mỗi bên).
- Chống lạm dụng: 1 thiết bị/IP không tự refer vòng tròn (liên kết `16` — IP/UA, giới hạn).

**AC:** *Given* B đăng ký qua link của A, *when* B đặt kèo đầu tiên, *then* A và B mỗi người +300; ledger ghi `REFERRAL`.

---

## SOCIAL-04 — Duel 1v1 / Head-to-Head (v2)

**Mô tả:** Thách đấu trực tiếp 1 người: cùng dự đoán 1 trận / 1 vòng, ai điểm cao hơn thắng kèo danh dự (hoặc cược point trong khuôn khổ giải trí, không tiền thật).

**Yêu cầu:**
- Gửi/ chấp nhận lời thách; phạm vi (1 trận / 1 vòng); điều kiện thắng (điểm cao hơn).
- Kết quả ghi vào hồ sơ đối đầu (record W-L) + huy hiệu.

**AC:** *Given* A thách B trên trận T, *when* cả hai đặt & trận settle, *then* xác định winner + cập nhật record.

---

## SOCIAL-05 — Activity Feed bạn bè (v2)

**Mô tả:** Dòng thời gian hoạt động của bạn bè/cùng lobby **sau khi kèo đã khoá** (không lộ kèo trước kickoff → tránh "nhìn bài").

**Yêu cầu:**
- Hiển thị: ai vừa thắng lớn, chuỗi nổi bật, badge mới, thay đổi thứ hạng.
- Tôn trọng quyền riêng tư: chỉ trong phạm vi bạn bè/lobby; không lộ kèo đang mở.

**AC:** *Given* kèo của bạn bè đã khoá/settle, *then* feed hiển thị; *given* kèo còn OPEN, *then* không lộ lựa chọn.
