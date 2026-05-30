# 08 — AI & Meta

Nhóm tận dụng **hạ tầng AI** (yêu cầu sẵn có) làm tính năng đặc sản, cùng các hệ thống "meta" tạo vòng lặp dài hạn. Pipeline AI chi tiết ở `15-data-pipeline-ai.md`.

---

## AIMETA-01 — AI Pundit / Gợi ý thông minh (v1) ⭐ đặc sản

**Mô tả:** "Bình luận viên AI" cá nhân hoá: sinh preview trận, gợi ý "smart pick", tóm tắt phong độ & lịch sử đối đầu — giúp P1 đặt kèo tự tin và P2 có thêm góc nhìn.

**Năng lực:**
| Chức năng | Mô tả |
|---|---|
| **Match Preview** | Tóm tắt phong độ gần đây, đội hình, bối cảnh trước trận (sinh bằng LLM từ dữ liệu có cấu trúc). |
| **Smart Pick** | Gợi ý cửa nên cân nhắc + lý do ngắn; **luôn kèm disclaimer** "chỉ tham khảo, không đảm bảo". |
| **Head-to-Head** | Lịch sử đối đầu, chuỗi thành tích, dữ kiện đáng chú ý. |
| **Form Guide** | Bảng phong độ N trận gần nhất 2 đội. |

**Yêu cầu:**
- Gọi LLM **qua 9router** (Claude primary → OpenAI fallback); **prompt caching** dữ liệu nền để giảm chi phí.
- **Grounding bắt buộc:** chỉ dựa trên dữ liệu thực (fixtures/stats từ pipeline) → giảm "bịa". Hiển thị nguồn/độ tin cậy khi có thể.
- Cache preview theo trận; sinh trước cho các trận sắp diễn ra; cập nhật khi có đội hình.
- Disclaimer rõ ràng (gắn `16` — không phải lời khuyên cá cược).

**AC:** *Given* mở chi tiết trận sắp đá, *then* thấy preview AI + smart pick + form; *given* LLM lỗi/timeout, *then* fallback nguồn khác hoặc ẩn mượt (không vỡ trang).

**Chỉ số:** % user xem preview, % đặt kèo sau khi xem (xem `00 §5`).

---

## AIMETA-02 — Cosmetic Shop (v2) — point sink

**Mô tả:** Cửa hàng vật phẩm **trang trí** mua bằng point: avatar/khung viền, theme lobby, nhãn dán, hiệu ứng tên trên leaderboard. Mục tiêu: **hút bớt point** khỏi nền kinh tế (point sink) + cá nhân hoá, **không tạo lợi thế chơi**.

**Yêu cầu:**
- Danh mục item cosmetic; giá bằng point; mua → trừ point (ledger `PURCHASE`) → sở hữu vĩnh viễn.
- **Không bán** vật phẩm ảnh hưởng cân bằng (power-up gây tranh cãi → tách, chốt OQ).
- Không liên quan tiền thật (point không mua bằng tiền).

**AC:** *Given* đủ point, *when* mua khung avatar, *then* trừ point + áp dụng được; *given* không đủ, *then* chặn.

---

## AIMETA-03 — Predictor Tiers / Hạng đấu thủ (v2)

**Mô tả:** Hệ thống hạng theo **độ chính xác/thành tích**, reset theo **mùa** (mỗi giải/đợt) → tạo mục tiêu thăng hạng dài hạn.

**Bậc (ví dụ):** Đồng → Bạc → Vàng → Bạch kim → Kim cương → **Huyền thoại**.

**Yêu cầu:**
- Tính theo điểm xếp hạng mùa (accuracy, ROI, volume — công thức chốt ở OQ).
- Thăng/xuống hạng cuối mùa; phần thưởng theo hạng (badge/cosmetic, không phá cân bằng).
- Hiển thị huy hiệu hạng cạnh tên.

**AC:** *Given* kết mùa ở ngưỡng Vàng, *then* gán hạng Vàng + thưởng mùa + sang mùa mới reset điểm xếp hạng (không reset point ví).

---

## Nguyên tắc xuyên suốt cho AI

1. **Grounded, không bịa:** AI chỉ phát ngôn dựa trên dữ liệu thật; không bịa tỉ số/sự kiện.
2. **Human-in-the-loop cho nội dung công khai:** tin tức AI qua **review queue** (`10`), preview có thể tự động nhưng gắn disclaimer.
3. **Tiết kiệm & bền:** prompt caching, structured output, fallback 9router, quota tracking (`15`).
4. **Không tư vấn cá cược:** mọi gợi ý kèm disclaimer giải trí (`16`).
