# 10 — Tin Tức Bên Lề (AI Auto-Publish)

**Mô tả:** Trang tin tức xoay quanh World Cup 2026 để người chơi theo dõi, **do AI crawl + sinh nội dung tự động**, qua **review queue** trước khi đăng (theo requirements + nguyên tắc human-in-the-loop).

---

## NEWS-01 — AI Crawl & Sinh bài (MVP, Should)

**Yêu cầu:**
- Nguồn: trang tin thể thao/bóng đá uy tín (cấu hình danh sách nguồn ở admin/P5).
- Pipeline (chi tiết `15`): thu thập → LLM **tóm tắt/viết lại** (qua 9router) → gắn tag/thể loại → tạo bản nháp `PENDING`.
- **Chống vi phạm bản quyền:** viết lại/tóm tắt + **dẫn nguồn**, không copy nguyên văn; tôn trọng robots/ToS nguồn.
- Phân loại: tin đội tuyển, chuyển nhượng/đội hình, kết quả & nhận định, bên lề/giải trí.

**AC:** *Given* có bài nguồn mới, *when* pipeline chạy, *then* tạo bản nháp đã tóm tắt + tag + nguồn ở trạng thái `PENDING`.

---

## NEWS-02 — Review Queue (MVP, Must)

**Yêu cầu:**
- Admin (`ADMIN-05`) xem/sửa/duyệt/từ chối; chỉ **`PUBLISHED`** mới hiển thị công khai.
- Cảnh báo nội dung nhạy cảm/nghi sai lệch; kiểm tra "bịa" (grounding).

**AC:** *Given* bài `PENDING`, *when* duyệt, *then* `PUBLISHED`; *when* từ chối, *then* `REJECTED` + lý do (cải thiện prompt).

---

## NEWS-03 — Trang đọc tin (MVP, Should)

**Yêu cầu:**
- Danh sách tin (mới nhất/nổi bật), lọc theo tag/đội; trang chi tiết bài; **dẫn nguồn** rõ.
- Liên kết ngữ cảnh: bài về trận → nút "Đặt kèo trận này" (tăng chuyển đổi).
- SEO/Open Graph cho chia sẻ.

**AC:** *Given* có bài đã publish, *then* xuất hiện ở danh sách + mở đọc được + thấy nguồn.

---

## NEWS-04 — Auto-publish theo lịch (v1, Could)

**Yêu cầu:**
- Sau khi đạt tiêu chí tin cậy (vd nguồn whitelist + điểm chất lượng), cho phép **auto-publish** một số thể loại an toàn (vd "kết quả trận") theo lịch, **vẫn log & cho phép gỡ**.
- Thể loại nhạy cảm (nhận định/chuyển nhượng) vẫn bắt buộc review tay.

**AC:** *Given* bài thể loại "kết quả" từ nguồn whitelist đạt ngưỡng chất lượng, *then* auto-publish + ghi log + cho phép admin gỡ.

---

## Trạng thái bài viết

```
DRAFT(PENDING) → (review) → PUBLISHED
                          ↘ REJECTED
PUBLISHED → (gỡ) → UNPUBLISHED
```

## Lưu ý tuân thủ

- Luôn **dẫn nguồn**, ưu tiên tóm tắt/viết lại — tránh vi phạm bản quyền.
- AI có thể sai → **review tay** cho nội dung nhận định; auto chỉ cho thể loại an toàn.
- Gắn nhãn "nội dung hỗ trợ bởi AI" để minh bạch.
