# 06 — Prediction Depth (Chiều Sâu Dự Đoán)

Nhóm tính năng tăng độ hấp dẫn & chiều sâu cho người chơi nghiêm túc (P2) lẫn tạo "đặc sản" thu hút (P1). Tính điểm bám `04-scoring-engine.md`.

---

## DEPTH-01 — Bracket Predictor (v1) ⭐ "đặc sản World Cup"

**Mô tả:** Trước khi vòng knockout bắt đầu, user điền dự đoán **cả nhánh đấu loại trực tiếp** (32 đội → CK), ăn điểm cho từng vòng đoán đúng đội đi tiếp.

**Yêu cầu:**
- Mở khi đã xác định 32 đội vào knockout (sau vòng bảng, ~27/06); **khoá tại kickoff trận knockout đầu tiên** (29/06).
- Chấm điểm lũy tiến theo vòng đoán đúng **đội đi tiếp** (không phải kết quả 90' — đây là "đội advance" sau ET/pen):

| Vòng đoán đúng | Điểm/đội |
|---|---|
| Vào Vòng 16 đội (Round of 16) | 10 |
| Vào tứ kết | 20 |
| Vào bán kết | 40 |
| Vào CK | 80 |
| Vô địch | 160 |

- Có **leaderboard bracket riêng**; tích hợp vào điểm tổng (chốt trọng số ở OQ).
- Cho phép xem lại & so sánh bracket với bạn bè (sau khoá).

**AC:** *Given* bracket đã khoá, *when* đội A user chọn vào tới bán kết, *then* cộng 10+20+40 cho A.

**Lưu ý phân biệt với kèo 1X2:** Bracket dùng khái niệm **đội đi tiếp** (sau ET/pen); kèo 1X2 từng trận dùng **kết quả 90'** (`04 §4`). Hai cơ chế độc lập.

---

## DEPTH-02 — Futures / Kèo dài hạn (v1)

**Mô tả:** Đặt từ sớm các dự đoán "tầm giải", hệ số cao, settle cuối giải/cuối chặng.

**Thị trường futures:**
- **Vô địch** WC 2026.
- **Vua phá lưới** (Golden Boot).
- **Đội vào CK / đội gây sốc** (vào sâu hơn kỳ vọng).
- **Cầu thủ hay nhất** (Golden Ball) — Could.

**Yêu cầu:**
- Mỗi market có danh mục lựa chọn + hệ số riêng (AI/admin set); đặt point như kèo thường, settle 1 lần khi có kết quả chính thức.
- Khoá theo mốc (vd "vô địch" khoá trước trận khai mạc hoặc theo cấu hình).

**AC:** *Given* đặt "Vô địch = Brazil" hệ số 6.0 với 100 point, *when* Brazil vô địch, *then* payout = 100×(1+6.0)=700.

---

## DEPTH-03 — Underdog Bonus (v1)

**Mô tả:** Thưởng thêm khi đoán đúng **cửa dưới** (tỉ lệ thấp/khó) → khuyến khích mạo hiểm, tạo khoảnh khắc "bắt sốc".

**Cơ chế (cấu hình được):**
- Định nghĩa underdog theo ngưỡng hệ số, vd `m_o ≥ underdog_threshold` (mặc định `m ≥ 2.0`).
- Đoán đúng cửa underdog → cộng thêm % thưởng (vd +15% payout) **hoặc** điểm danh hiệu + huy hiệu "Bắt sốc".

**AC:** *Given* đặt cửa có `m=2.5 ≥ ngưỡng`, *when* thắng, *then* payout chuẩn + bonus underdog theo cấu hình.

> Cần cân bằng để không vỡ kinh tế điểm — xem `20-open-questions.md`.

---

## DEPTH-04 — Power-ups / Boosters (v2)

**Mô tả:** Vật phẩm dùng 1 lần, tạo lựa chọn chiến thuật. Lấy từ nhiệm vụ/thành tựu hoặc mua bằng point (cosmetic shop không bán đồ ảnh hưởng cân bằng quá mạnh — chốt ở OQ).

| Power-up | Hiệu ứng |
|---|---|
| **Double Down** | Nhân đôi payout 1 kèo nếu thắng (rủi ro: mất gấp đôi nếu thua — hoặc chỉ x2 phần thắng, chốt OQ) |
| **Insurance** | Hoàn lại stake nếu kèo đó thua (1 lần) |
| **Streak Shield** | Bảo vệ chuỗi (điểm danh/thắng) khỏi 1 lần đứt |

**Yêu cầu:** giới hạn số lượng/tần suất; ghi ledger; minh bạch hiệu ứng trước khi dùng.

---

## DEPTH-05 — Combo / Parlay (v2)

**Mô tả:** Gộp nhiều trận thành 1 vé; **nhân hệ số** các kèo; chỉ thắng khi **tất cả** đúng → rủi ro cao, thưởng lớn.

```
payout_combo = S × (1 + m1) × (1 + m2) × ... × (1 + mn)   nếu TẤT CẢ đúng
             = 0                                            nếu có ≥1 sai
```
(VOID 1 chân → loại chân đó khỏi tích, chốt cách xử lý ở OQ.)

**Yêu cầu:** giới hạn số chân (vd 2–6); khoá theo kickoff sớm nhất; hiển thị tổng hệ số & payout dự kiến.

---

## DEPTH-06 — In-play Micro-prediction (v2, phức tạp)

**Mô tả:** Dự đoán nhanh trong trận (trước khi sự kiện xảy ra): "đội nào ghi bàn tiếp", "có thẻ đỏ không", "tỉ số hiệp 1". Tạo gắn kết khi xem trực tiếp.

**Yêu cầu:**
- Phụ thuộc dữ liệu **real-time độ trễ thấp** (rủi ro kỹ thuật cao → để v2).
- Cửa sổ đặt ngắn, khoá theo sự kiện; chống lợi dụng độ trễ (anti-latency-arbitrage).

**AC (mẫu):** *Given* trận LIVE phút 60, *when* đặt "đội nhà ghi bàn tiếp" trong cửa sổ mở, *then* settle theo bàn thắng kế tiếp.

> Đánh dấu **rủi ro/độ phức tạp cao**; cân nhắc kỹ ở `20-open-questions.md` trước khi cam kết.
