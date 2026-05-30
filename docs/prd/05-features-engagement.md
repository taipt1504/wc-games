# 05 — Engagement & Retention

Nhóm tính năng tạo **thói quen quay lại hằng ngày**. Trọng tâm persona P1 (fan giải trí).

---

## ENG-01 — Streak điểm danh (MVP-lite → v1)

**Mô tả:** Chuỗi ngày điểm danh liên tiếp; càng dài thưởng càng cao.

**Yêu cầu:**
- Điểm danh đủ ngày liên tiếp → `streak += 1`; bỏ 1 ngày → reset về 0 (trừ khi có Streak Shield, v2).
- Thưởng theo bậc (cấu hình được), ví dụ:

| Streak | Thưởng điểm danh |
|---|---|
| 1–2 ngày | 200 (cơ bản) |
| 3–6 ngày | 250 |
| 7–13 ngày | 300 + huy hiệu "Tuần lễ" |
| 14+ ngày | 400 + huy hiệu "Bền bỉ" |

**AC:** *Given* streak=6, *when* điểm danh ngày 7, *then* nhận 300 + mở huy hiệu; *given* bỏ 1 ngày, *then* streak reset.

**MVP-lite:** chỉ đếm streak + thưởng bậc cơ bản. **v1:** thêm huy hiệu + UI lửa/chuỗi.

---

## ENG-02 — Streak chuỗi thắng (v1)

**Mô tả:** Đếm số kèo thắng liên tiếp (đã settle), thưởng hệ số/điểm khi đạt mốc (3, 5, 10…).

**Yêu cầu:**
- Chuỗi tính theo thứ tự settle; thua → reset.
- Mốc thưởng: vd chuỗi 5 → +500 point; chuỗi 10 → huy hiệu "Nhà tiên tri".
- Hiển thị "🔥 chuỗi N thắng" trên profile & cạnh tên ở leaderboard.

**AC:** *Given* 4 kèo thắng liên tiếp, *when* kèo thứ 5 thắng, *then* nhận thưởng mốc 5 + cập nhật badge.

---

## ENG-03 — Nhiệm vụ hằng ngày / Missions (v1)

**Mô tả:** Vài nhiệm vụ ngắn mỗi ngày để thưởng point, kéo user vào sâu hơn.

**Ví dụ nhiệm vụ:**
- "Đặt 3 kèo hôm nay" → +100
- "Đặt 1 kèo cửa dưới (underdog)" → +150
- "Xem 1 preview AI Pundit" → +50
- "Mời 1 bạn / share 1 kết quả" → +200

**Yêu cầu:**
- 3–5 nhiệm vụ/ngày, reset theo mốc ngày hệ thống; tiến độ realtime; nhận thưởng khi hoàn thành.
- Cấu hình pool nhiệm vụ phía admin.

**AC:** *Given* nhiệm vụ "đặt 3 kèo", *when* đặt đủ 3, *then* nút "Nhận" sáng, bấm → +point + ghi ledger.

---

## ENG-04 — Thành tựu & Huy hiệu / Achievements (v1, Could)

**Mô tả:** Hệ thống mốc thành tích trưng bày trên profile (không nhất thiết thưởng point lớn — giá trị là khoe).

**Ví dụ:**
- "First Blood" — kèo thắng đầu tiên.
- "Bắt sốc" — đoán đúng 1 trận cửa dưới tỉ lệ cao.
- "Hoàn hảo vòng bảng" — đúng cả 3 kèo của 1 bảng.
- "Bậc thầy bracket" — bracket đạt ngưỡng điểm.
- "Người triệu phú ảo" — đạt mốc số dư.

**Yêu cầu:** danh mục badge, điều kiện rõ, trạng thái khoá/mở, hiển thị tiến độ.

---

## ENG-05 — Thông báo / Notifications (MVP-lite → v1) ⭐

**Mô tả:** Kênh giữ chân quan trọng nhất. **Web push** (PWA) + **email**; tùy chọn bật/tắt từng loại.

**Loại thông báo:**
| Loại | Thời điểm | Phase |
|---|---|---|
| Nhắc khoá kèo | Trước kickoff X phút (trận user quan tâm/đội yêu thích) | MVP-lite |
| Kết quả kèo | Sau khi settle | MVP-lite |
| Streak sắp mất | Cuối ngày nếu chưa điểm danh | v1 |
| Mời/duyệt mượn point | Khi có sự kiện lobby | v1 |
| Nhiệm vụ mới / sắp hết hạn | Đầu ngày / trước reset | v1 |
| Tin tức nổi bật | Khi có bài hot | v1 |

**Yêu cầu:**
- Trung tâm cài đặt thông báo (per-channel, per-type).
- Tôn trọng opt-out; không spam; gộp (digest) khi nhiều sự kiện.
- Hàng đợi gửi bất đồng bộ, chịu spike quanh kickoff (xem `17`).

**AC:** *Given* user bật "nhắc khoá kèo" & theo dõi trận T, *when* còn 30 phút tới kickoff, *then* nhận push/email một lần.

**MVP-lite:** tối thiểu "nhắc khoá kèo" + "kết quả" qua 1 kênh (email hoặc web push). **v1:** đủ loại + cài đặt chi tiết.
