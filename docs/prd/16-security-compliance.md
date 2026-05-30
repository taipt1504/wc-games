# 16 — Security & Compliance

> Phần bảo mật & tuân thủ. Đây là xương sống pháp lý của sản phẩm: game **giải trí, không cá cược tiền thật**.

## 1. Lập trường tuân thủ (Compliance backbone)

Sản phẩm phải duy trì rõ ràng — trong điều khoản sử dụng (ToS), trong UI, và trong kiến trúc — rằng:

- **Point là tiền ảo.** Không thể mua point bằng tiền thật.
- **Không quy đổi.** Point không đổi ra tiền hoặc hiện vật có giá trị tiền tệ.
- **Không chuyển nhượng giữa người dùng.** Không có tính năng tặng/chuyển point user-to-user. Ví **global** và ví **mỗi lobby** tách biệt; point không chảy giữa các context.
- **"Mượn point" chỉ là số ảo trong phạm vi một lobby**, có sổ cái (ledger) và admin giám sát được — không phải khoản vay/nợ thực tế.
- **Không phải sàn cá cược.** Mọi gợi ý của AI Pundit kèm **disclaimer** "chỉ mang tính giải trí/tham khảo, không phải lời khuyên cá cược".

> Yêu cầu gốc nêu admin phải phát hiện "lobby lợi dụng point để cá cược" và có thể "tố cáo cơ quan pháp luật". Cơ chế mượn-point làm tăng rủi ro này → các biện pháp §5 là bắt buộc để giữ ranh giới giải trí.

(Cân nhắc: cổng tuổi/độ tuổi tối thiểu theo quy định địa phương — `20-open-questions.md`.)

## 2. Xác thực (Authentication)

- **JWT** access token ngắn hạn, lưu trong **cookie `httpOnly` + `Secure` + `SameSite`**; tránh lưu token trong localStorage (giảm rủi ro XSS đánh cắp token).
- **Refresh token** quay vòng (rotation), thu hồi được; phát hiện reuse → vô hiệu hoá phiên.
- **Mật khẩu** hash bằng **argon2id hoặc bcrypt** (cost phù hợp); không lưu plaintext; chính sách độ mạnh tối thiểu.
- **Rate limiting** & chống brute-force ở đăng nhập/đăng ký (theo IP + tài khoản); captcha khi vượt ngưỡng.
- **CSRF:** vì dùng cookie, áp dụng `SameSite=Lax/Strict` + CSRF token cho thao tác thay đổi trạng thái.
- Tuỳ chọn 2FA cho admin (Should).

## 3. Phân quyền (Authorization)

- **RBAC** (`09 §RBAC`): User / Moderator / Admin / Data-AI Ops / Super Admin.
- Kiểm tra quyền **phía server** trên mọi API nhạy cảm (không tin client).
- Phân tách rõ: user không truy cập dữ liệu/endpoint admin.

## 4. Thu thập dữ liệu & quyền riêng tư

- **Thu thập IP + User-Agent** mỗi session/đăng nhập (yêu cầu gốc) — mục đích: **chống gian lận, điều tra vi phạm**.
- **Cơ sở pháp lý & minh bạch:** nêu rõ trong Privacy Policy việc thu thập IP/UA và mục đích; có sự đồng ý khi đăng ký.
- **Chính sách lưu trữ (retention):** giữ log IP/UA trong thời hạn hợp lý phục vụ điều tra rồi xoá/ẩn danh (thời hạn cụ thể chốt ở `20`).
- **Tối thiểu hoá dữ liệu:** chỉ thu thập thứ cần cho chống gian lận & vận hành.
- Quyền người dùng: xem/yêu cầu xoá dữ liệu cá nhân theo quy định áp dụng.

## 5. Chống lạm dụng & chống cá cược (Anti-abuse)

**Risk Engine (heuristic) — gắn cờ tự động (`ADMIN-02`, `SEQ-12`):**
- Mượn point bất thường: volume lớn, lặp lại, dồn về một người.
- Nhiều tài khoản chung **IP/UA** trong cùng lobby.
- Dòng point **một chiều** có hệ thống (nghi chuyển giá trị).
- Lobby 2 người với pattern thua/thắng cố ý.
- Đăng ký hàng loạt cùng thiết bị/IP (multi-account); referral vòng tròn.

**Công cụ admin (`09`):**
- Điều tra: ledger đầy đủ, biểu đồ dòng point, IP/UA, chat log.
- Action: cảnh cáo, đóng lobby, ban (tạm/vĩnh viễn), thu hồi point gian lận.
- **Case file** + export bằng chứng phục vụ xử lý nội bộ hoặc **tố cáo cơ quan pháp luật**.

**Phòng ngừa thiết kế:**
- Không có chuyển point user-to-user (loại bỏ kênh "rửa" point).
- Ví tách context (global vs từng lobby).
- Snapshot odds + settle idempotent (chống thao túng).

## 6. Bảo mật ứng dụng (AppSec)

- Theo **OWASP Top 10**: validate & sanitize input, chống SQLi/XSS, output encoding.
- Chống IDOR: kiểm tra ownership trên mọi tài nguyên (kèo, lobby, ví).
- Bí mật (API key sports/LLM) lưu trong secret manager; không hardcode; xoay khoá.
- HTTPS bắt buộc; HSTS.
- Logging an toàn (không log mật khẩu/token); giám sát bất thường.
- Khoá kèo **phía server** theo `kickoff` (không tin giờ client).

## 7. Toàn vẹn dữ liệu game

- `POINT_LEDGER` append-only là nguồn chân lý; không sửa trực tiếp số dư.
- `AUDIT_LOG` bất biến cho mọi action admin/giao dịch.
- Settle có nguồn xác thực + idempotent + (khi cần) admin confirm.

## 8. AI an toàn

- Disclaimer giải trí trên mọi gợi ý AI (không phải lời khuyên cá cược).
- Tin tức AI qua review queue; gắn nhãn "hỗ trợ bởi AI"; dẫn nguồn (chống bản quyền).
- Không gửi dữ liệu cá nhân nhạy cảm tới LLM ngoài mục đích cần thiết.

## 9. Checklist tuân thủ (tóm tắt)

- [ ] ToS + Privacy Policy nêu rõ point ảo/không quy đổi + thu thập IP/UA.
- [ ] Không có kênh chuyển point user-to-user.
- [ ] Risk engine + dashboard cờ cảnh báo hoạt động.
- [ ] Audit log + case file export được.
- [ ] Disclaimer AI hiển thị.
- [ ] (Nếu áp dụng) cổng tuổi tối thiểu.
