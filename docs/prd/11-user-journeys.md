# 11 — User Journeys

6 hành trình người dùng chính. Mỗi journey: *giai đoạn → hành động → điểm chạm → cảm xúc → cơ hội cải thiện.*

---

## UJ-01 — Onboarding & kèo đầu tiên (P1 — Fan giải trí)

| Giai đoạn | Hành động | Điểm chạm | Cảm xúc | Cơ hội |
|---|---|---|---|---|
| Biết đến | Bấm link share/referral của bạn | Landing + share card | Tò mò | OG đẹp, "nhận 1000 point" rõ |
| Đăng ký | Tạo tài khoản | Form đăng ký | Mong chờ | Đăng ký ≤ 30s, social login (sau) |
| Nhận thưởng | +1000 point + +referral | Toast/onboarding | Hứng khởi | Hiển thị "bạn có thể đặt kèo ngay" |
| Khám phá | Xem trận sắp đá + gợi ý AI | Trang trận | Tự tin hơn | Smart pick + payout dự kiến |
| Kèo đầu | Đặt 100 point cửa nào đó | Bottom-sheet đặt kèo | Hồi hộp | ≤ 3 thao tác, xác nhận rõ |
| Quay lại | Nhận push kết quả | Notification | Vui/tiếc | CTA "đặt tiếp trận tối nay" |

**Khoảnh khắc "aha":** thấy point tăng sau kèo thắng đầu tiên + share được thành tích.

---

## UJ-02 — Vòng lặp hằng ngày (P1)

```
Mở app (push nhắc) → Điểm danh +200 (streak↑) → Xem nhiệm vụ hôm nay
→ Lướt trận hôm nay + preview AI → Đặt 2–3 kèo → (tối) nhận kết quả
→ Khoe share card → quay lại hôm sau
```
- **Điểm chạm:** push "2 trận tối nay", màn điểm danh có hiệu ứng streak, missions, feed.
- **Cảm xúc:** thói quen, kỳ vọng phần thưởng.
- **Cơ hội:** "streak sắp mất" nhắc đúng lúc; missions vừa sức.

---

## UJ-03 — Leo top leaderboard global (P2 — Cao thủ)

| Giai đoạn | Hành động | Cảm xúc | Cơ hội |
|---|---|---|---|
| Nghiên cứu | Đọc dữ liệu đội/cầu thủ + preview AI + form | Tập trung | Số liệu sâu, H2H |
| Lập chiến lược | Phân bổ point nhiều kèo, săn underdog, chơi futures | Toan tính | Hiển thị odds + ROI lịch sử |
| Theo dõi | Xem thứ hạng & ROI cá nhân | Cạnh tranh | Cập nhật hạng gần real-time |
| Điều chỉnh | Đổi chiến lược theo kết quả | Quyết tâm | Thống kê chi tiết, lọc theo vòng |

**Khoảnh khắc "aha":** bắt trúng cú sốc underdog đẩy hạng vọt lên.

---

## UJ-04 — Mở lobby & mời bạn (P3 — Chủ lobby)

```
Tạo lobby ("Công ty ABC – Vòng bảng", default 1000, scope vòng bảng)
→ Bật mượn point → Lấy invite link + đặt mật khẩu
→ Gửi link Slack/Zalo → Bạn bè join (nhận default)
→ Cùng đặt kèo → Chat/khẩu chiến → Theo dõi BXH phòng
```
- **Cảm xúc:** vui nhóm, vai trò "người cầm trịch".
- **Cơ hội:** tạo phòng ≤ 1 phút, template sẵn (vòng bảng/cả giải/1 trận), preview luật rõ.

---

## UJ-05 — Mượn point trong lobby (P3 + thành viên)

| Bước | Thành viên | Chủ phòng |
|---|---|---|
| Hết điểm | Bấm "Mượn 200 point" | — |
| Request | Gửi yêu cầu | Nhận thông báo |
| Quyết định | Chờ | Approve/Deny (hoặc set trực tiếp) |
| Kết quả | Có 200 để đặt, `score_lobby −200` | Ghi nhận |

- **Cảm xúc thành viên:** được "cứu" để chơi tiếp nhưng hiểu rõ điểm bị trừ.
- **Cơ hội:** hiển thị minh bạch công thức `score = winnings + default − borrowed` ngay khi mượn.
- **Lưu ý:** mọi giao dịch mượn vào ledger → admin giám sát (`16`, `09`).

---

## UJ-06 — Admin phát hiện & xử lý lobby nghi vấn (P4)

```
Dashboard hiện cờ đỏ lobby X (mượn point bất thường + chung IP)
→ Mở điều tra: ledger, dòng point, IP/UA, chat
→ Xác định pattern chuyển giá trị một chiều
→ Action: đóng lobby + ban user liên quan + tạo case file
→ Export bằng chứng (nếu cần tố cáo) → ghi audit
```
- **Cảm xúc:** cảnh giác, cần chắc chắn trước khi xử lý.
- **Cơ hội:** bằng chứng tập trung 1 màn, heuristic giải thích được "vì sao bị cờ".

---

## Tổng hợp điểm chạm chính

Landing/share → Đăng ký → Onboarding point → Trang trận + AI Pundit → Đặt kèo → Notification → Leaderboard → Lobby (chat/mượn) → Profile/Ví → Admin (giám sát).
