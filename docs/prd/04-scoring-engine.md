# 04 — Scoring Engine (Cơ Chế Tính Điểm)

> File quan trọng nhất về nghiệp vụ. Đây là "luật chơi" về điểm. Mọi quy ước phải rõ ràng, không mơ hồ.

## 1. Khái niệm

| Thuật ngữ | Ý nghĩa |
|---|---|
| **Point** | Tiền ảo trong game. Không tiền thật, không quy đổi. |
| **Stake (`S`)** | Số point user đặt vào 1 cửa của 1 trận. |
| **Outcome** | Kết quả dự đoán: `1` (đội nhà thắng) / `X` (hòa) / `2` (đội khách thắng). |
| **Odds / hệ số (`m`)** | Hệ số nhân của 1 cửa. Mỗi trận có 3 hệ số: `m_home`, `m_draw`, `m_away`. |
| **Payout** | Số point nhận về nếu thắng. |
| **Settle** | Hành động chốt kết quả trận và chia điểm cho các kèo. |
| **Void** | Hoàn điểm (trận hoãn/huỷ, hoặc dữ liệu không hợp lệ). |

## 2. Quy tắc đặt điểm khởi tạo (FR-AUTH-05, FR-GLOBAL-05)

- Đăng ký lần đầu: **+1000 point** (một lần/tài khoản).
- Điểm danh hằng ngày (đăng nhập + check-in): **+200 point** (một lần/ngày, mốc "ngày" theo **giờ Việt Nam UTC+7** — OQ-07).
- Streak điểm danh có thể tăng thưởng (xem `05-features-engagement.md`), nhưng phần thưởng cơ bản giữ 200.

## 3. Công thức kèo thường (1X2) — FR-SCORE-01

User đặt `S` point vào một outcome `o ∈ {1, X, 2}` với hệ số tương ứng `m_o`.

```
Nếu đoán ĐÚNG:   payout = S × (1 + m_o)      → lãi ròng = S × m_o
Nếu đoán SAI:    payout = 0                   → mất toàn bộ S
```

Point bị **trừ ngay khi đặt kèo** (escrow), và **cộng `payout` khi settle**.

**Kiểm chứng với ví dụ trong requirements** (Pháp – Nhật Bản, `m_home=0.8`, `m_away=1.5`):

| Dự đoán | Stake | Đúng? | Payout | Lãi ròng |
|---|---|---|---|---|
| Pháp thắng | 100 | ✓ | `100×(1+0.8)=180` | +80 |
| Nhật thắng | 100 | ✓ | `100×(1+1.5)=250` | +150 |
| Sai | 100 | ✗ | 0 | −100 |

✅ Khớp tuyệt đối với requirements.

**Cửa Hòa (`X`)** dùng chung công thức với `m_draw`. (Requirements gốc chỉ nêu thắng/thua; PRD bổ sung cửa Hòa cho vòng bảng — đã chốt với chủ sản phẩm.)

### 3.1 Ràng buộc đặt kèo
- `S` nguyên dương, `S ≤ số dư khả dụng` (global) hoặc theo `04 §6` (lobby).
- Mỗi user, mỗi trận, mỗi context (global / từng lobby): **1 kèo 1X2** (đặt lại = sửa trước giờ khoá; không cộng dồn nhiều cửa ở MVP). Combo nhiều trận là tính năng v2 (`FR-DEPTH-05`).
- Kèo **khoá tại `kickoff`** (FR-GLOBAL-02); sau đó bất biến.

## 4. Quy ước trận Knockout — FR-SCORE-02

Knockout có thể có hiệp phụ (ET) và luân lưu (penalty). Để tránh mơ hồ:

- **Kèo 1X2 ở knockout tính theo KẾT QUẢ 90 PHÚT** (gồm bù giờ chính thức, **KHÔNG** tính ET/penalty) — đúng chuẩn "Full Time" của nhà cái.
  → Do đó knockout **vẫn có cửa Hòa `X`** (khi hòa sau 90').
- **Đội đi tiếp** (xác định sau ET/penalty) **KHÔNG** ảnh hưởng kèo 1X2. Việc đoán đội đi tiếp thuộc về **Bracket Predictor** (`FR-DEPTH-01`) và **Futures** (`FR-DEPTH-02`).

## 5. Bonus tỉ số chính xác (chỉ Knockout) — FR-SCORE-03

Khi đặt kèo 1X2 ở trận knockout, user **được tuỳ chọn** nhập tỉ số 90' dự đoán (vd `2-1`).

```
Điều kiện bonus:  đoán ĐÚNG 1X2  VÀ  đúng tỉ số 90'
Bonus payout:     + S × bonus_rate        (mặc định bonus_rate = 1.0, cấu hình được)
```

- Bonus **chỉ cộng thêm**, không thay thế payout 1X2.
- Nhập sai tỉ số nhưng đúng 1X2 → vẫn ăn 1X2 bình thường, không có bonus.
- Bonus tỉ số **không áp dụng vòng bảng** ở phạm vi này (giữ vòng bảng đơn giản).

**Ví dụ:** trận tứ kết, `m_home=0.9`, user đặt 100 vào cửa `1` + nhập tỉ số `2-1`. Kết quả 90' = `2-1`:
```
payout = 100×(1+0.9) + 100×1.0 = 190 + 100 = 290
```

## 6. Tính điểm trong Private Lobby (có mượn point) — FR-SCORE-06

Mỗi thành viên trong lobby có một "ví lobby" độc lập với ví global.

**Các đại lượng (theo từng membership):**
- `default` = point khởi điểm chủ phòng cấp khi vào phòng (FR-LOBBY-01).
- `winnings` = số point ròng tích luỹ từ các kèo đã settle trong lobby (có thể âm nếu thua nhiều).
- `borrowed` = tổng point đã mượn (đã được duyệt) trong lobby.

**Công thức điểm hiển thị trên leaderboard lobby (chốt từ requirements):**

```
score_lobby = winnings + default − borrowed
```

> Diễn giải requirements: "tổng điểm = tổng số point dự đoán thắng hiện có + point default − tổng số point mượn". `winnings` mang dấu (thắng dương / thua âm), nên user thua sạch và mượn thêm sẽ ra điểm âm — đúng ý ví dụ requirements: default 100, thua hết, mượn 200 → `(−100) + 100 − 200 = −200`. *(Xem OQ-LEDGER ở `20` để chốt cách biểu diễn nội bộ "winnings" — khuyến nghị dùng ledger giao dịch thay vì lưu số gộp.)*

**Số dư khả dụng để đặt kèo trong lobby:**
```
available = default + winnings + borrowed_outstanding_credit − stake_đang_treo
```
(tức point mượn làm tăng khả năng đặt kèo, nhưng kéo `score_lobby` xuống theo công thức trên → mượn là con dao hai lưỡi.)

**Mượn point (FR-LOBBY-05/06):**
- User request mượn `B` point → chủ phòng **duyệt** (hoặc chủ phòng set trực tiếp).
- Khi duyệt: `borrowed += B`, đồng thời cấp `B` vào khả năng đặt kèo.
- Mọi giao dịch mượn ghi vào **PointLedger** (loại `BORROW`), admin xem được (chống lạm dụng — `16`).

## 7. Settle & vòng đời kèo — FR-SCORE-04

Trạng thái kèo (Prediction.status): `OPEN → LOCKED → SETTLED(WON|LOST|VOID)`.

```
OPEN      : đã đặt, trước kickoff, còn sửa được
LOCKED    : tới kickoff, khoá, chờ kết quả
SETTLED   : trận có kết quả chính thức → tính payout
  WON / LOST / VOID
```

**Quy trình settle (xem SEQ-04 ở `13`):**
1. Pipeline báo trận `FINISHED` + tỉ số 90' (ưu tiên API có cấu trúc; AI/admin chỉ phụ).
2. Hệ thống chốt `result_90 ∈ {1, X, 2}` và `score_90`.
3. Với mỗi kèo `LOCKED`: tính `payout` theo §3/§5, đổi status `WON/LOST`.
4. Ghi PointLedger (loại `SETTLE`), cập nhật số dư.
5. Cập nhật leaderboard (global + các lobby liên quan).

**Idempotent:** settle phải an toàn khi chạy lại (khoá theo `match_id`, không chia điểm 2 lần). Có **bước xác nhận** (auto nếu nguồn API tin cậy; admin confirm nếu lệch nguồn).

## 8. Void / hoàn điểm — FR-SCORE-07

| Tình huống | Xử lý |
|---|---|
| Trận hoãn → đá lại trong khung hợp lệ | Giữ kèo, settle theo trận đá lại (nếu cùng định danh) |
| Trận huỷ/không có kết quả hợp lệ | **VOID**: hoàn `S` về ví, không lãi/lỗ |
| Tỉ số nguồn mâu thuẫn chưa xác minh | Treo settle, không chia cho tới khi admin xác nhận |
| Hệ số `m` sai do nhập/crawl lỗi (phát hiện trước kickoff) | Admin sửa; kèo đã đặt dùng `m` **tại thời điểm đặt** (snapshot odds) |

> **Snapshot odds:** mỗi kèo lưu lại `m_o` **tại thời điểm đặt** (không dùng odds hiện tại lúc settle) → công bằng & audit được.

## 9. Leaderboard

- **Global — ROI-based (chốt OQ-04):** xếp theo **ROI%** = `tổng lãi ròng / tổng stake` (chỉ tính kèo đã settle). Điểm danh (+200/ngày) **không** tính vào ROI → không leo hạng bằng điểm danh suông.
  - **Điều kiện xếp hạng:** tối thiểu **N kèo đã settle** (mặc định N=10) mới vào bảng → chống mẫu nhỏ (1 kèo thắng = ROI ảo cao).
  - **Tie-break:** tổng lãi ròng tuyệt đối → số kèo thắng → thời gian đạt mốc.
  - *(Tinh chỉnh có chủ đích so với chữ "số điểm" ở requirements — thưởng kỹ năng dự đoán, không thưởng việc điểm danh đều.)*
- **Lobby:** xếp theo `score_lobby` (§6) — giữ theo requirements (không dùng ROI trong lobby).
- Cập nhật **gần real-time** sau mỗi đợt settle; chịu spike (xem `17-nfr.md`).

## 10. Tổng hợp tham số cấu hình (admin chỉnh được)

| Tham số | Mặc định | Phạm vi |
|---|---|---|
| `signup_bonus` | 1000 | global |
| `daily_checkin` | 200 | global |
| `bonus_rate` (tỉ số knockout) | 1.0 | global / theo lobby |
| `min_stake` / `max_stake` | 1 / (số dư) | global / theo lobby |
| `underdog_threshold` & thưởng | 2.0 / +15% | global |
| `leaderboard_min_settled` (ROI) | 10 | global |
| `timezone` (mốc ngày) | UTC+7 (VN) | global |
| `lobby_default_points` | do chủ phòng đặt | theo lobby |
