# 20 — Quyết Định & Câu Hỏi Mở

Cập nhật **2026-05-30**: đã chốt toàn bộ với chủ sản phẩm. Bảng dưới là **nhật ký quyết định**; mục còn mở ở cuối.

## ✅ Quyết định đã chốt

| ID | Vấn đề | **Quyết định** |
|---|---|---|
| **OQ-01** | Phạm vi & timeline MVP (~12 ngày tới khai mạc) | **Launch TOÀN BỘ tính năng trong 1 lần, trước 11/06.** Nhãn MVP/v1/v2 chuyển thành **thứ tự ưu tiên build (P0/P1/P2)** trong cùng sprint, không phải mốc release riêng. *(Tiến độ tham vọng — theo dõi sát, giữ "cut-line" P2 nếu trễ.)* |
| **OQ-02** | Nguồn Sports Data API | **Chỉ tích hợp provider cho phép FREE.** Ưu tiên free WC2026: **worldcup2026 API** (REST realtime, no key), **OpenFootball** (JSON public-domain, no key), **TheSportsDB free**, **API-Football free tier**. Nếu free không đủ (đặc biệt tỉ số real-time) → **dùng AI provider crawl** bù (`15 §1,§3`). |
| **OQ-03** | Nguồn odds | **Free-tier trước, else AI-crawl.** Free-tier: **OddsPapi** (250 req/tháng, 1X2 + nhiều market), **Odds-API.io** (100 req/giờ), **The Odds API** (h2h). Fallback: **AI crawl** từ whoscored / oddsportal / trang dự đoán (`15 §1,§3`). |
| **OQ-04** | Xếp hạng global | **ROI-based** (không dùng số dư thuần) → **tránh farm điểm danh**. ROI% = lãi ròng / tổng stake (kèo đã settle); điểm danh KHÔNG tính vào ROI. Yêu cầu tối thiểu N kèo settled để được xếp hạng (chống mẫu nhỏ). Chi tiết `04 §9`. *(Tinh chỉnh có chủ đích so với chữ "số điểm" trong requirements.)* |
| **OQ-05** | Cân bằng kinh tế điểm | **Không cần cân bằng thêm** — ROI-based đã trung hoà lạm phát điểm (điểm danh không nâng hạng). |
| **OQ-06** | Biểu diễn `winnings` lobby | **Suy từ `PointLedger`** (context=lobby) — đối soát & audit tốt hơn lưu số gộp. |
| **OQ-07** | Timezone mốc "ngày" | **Giờ Việt Nam (UTC+7).** Áp cho điểm danh, reset nhiệm vụ, mốc khoá theo ngày. |
| **OQ-08** | `bonus_rate` tỉ số knockout | **1.0** (điều chỉnh theo dữ liệu sau). |
| **OQ-09** | Underdog bonus | Ngưỡng **`m≥2.0`**, thưởng **+15% payout**; theo dõi cân bằng. |
| **OQ-10** | Trọng số Bracket vào điểm tổng | **Leaderboard bracket riêng** + cộng **có trần** vào tổng. |
| **OQ-11** | Double Down (v2/P2) | **Chỉ x2 phần thắng** (không nhân rủi ro thua). |
| **OQ-12** | Combo VOID 1 chân (P2) | **Loại chân void**, tính tích các chân còn lại. |
| **OQ-13** | In-play (P2) | Theo recommend: **đánh giá nguồn real-time trước khi cam kết**; bỏ nếu rủi ro độ trễ cao. |
| **OQ-14** | Cosmetic shop bán power-up? | **Không** — chỉ bán cosmetic thuần; power-up từ nhiệm vụ/thành tựu. |
| **OQ-15** | Công thức tiers mùa | **Accuracy + volume tối thiểu**; chốt số liệu khi có dữ liệu. |
| **OQ-16** | Referral mốc & thưởng | Kích hoạt = **đặt 1 kèo**; **+300 mỗi bên**; chống tự-refer bằng IP/UA. |
| **OQ-17** | Retention IP/UA | Theo recommend: định thời hạn (vd **12 tháng**) rồi ẩn danh; chốt cuối theo tư vấn pháp lý. |
| **OQ-18** | Cổng tuổi / khu vực pháp lý | **Không áp dụng giới hạn** (theo quyết định chủ sản phẩm). Vẫn giữ disclaimer "point ảo, không quy đổi" ở `16`. |
| **OQ-19** | Giới hạn đa tài khoản | **Không giới hạn cứng** theo thiết bị/IP. Vẫn giữ **risk-engine flag + admin review** (không chặn, chỉ giám sát) ở `16`. |
| **OQ-20** | Ngưỡng KPI/SLO | Dùng **mục tiêu định hướng** (`00`,`17`); chốt OKR sau soft-launch. |
| **OQ-21** | Proxy AI | ✅ **9router** (`github.com/decolua/9router`), Claude primary → OpenAI fallback. |

## 🔓 Còn mở (chuyển sang giai đoạn sau)

| ID | Vấn đề | Hướng |
|---|---|---|
| **OQ-22** | **Stack kỹ thuật** (FE/BE/DB/hạ tầng/hosting) | Ngoài phạm vi PRD → xử lý ở **Solution Design**. |
| **OQ-23** | Lựa chọn **provider cuối cùng** cho data & odds (trong các candidate free đã nghiên cứu) + giới hạn quota thực tế | Chốt khi spike test ở đầu giai đoạn build (phụ thuộc coverage WC2026 thực tế). |

> Lưu ý kỹ thuật cho OQ-02/03: free-tier thường **giới hạn request** → cần cache mạnh + ưu tiên webhook/polling hợp lý; chuẩn bị **AI-crawl** như đường lui khi quota cạn hoặc thiếu real-time.
