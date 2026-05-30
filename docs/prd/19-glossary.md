# 19 — Glossary (Thuật ngữ)

| Thuật ngữ | Định nghĩa |
|---|---|
| **Point** | Tiền ảo trong game. Không tiền thật, không quy đổi, không chuyển nhượng giữa user. |
| **Stake (S)** | Số point đặt vào một cửa của một trận. |
| **Outcome / Cửa** | Kết quả dự đoán: `1` (chủ thắng), `X` (hòa), `2` (khách thắng). |
| **1X2** | Loại kèo dự đoán Thắng/Hòa/Thua. |
| **Odds / Hệ số (m)** | Hệ số nhân của một cửa (`m_home`, `m_draw`, `m_away`). Payout đúng = `S × (1 + m)`. |
| **Snapshot odds** | Hệ số lưu lại tại thời điểm đặt kèo (dùng để settle, không dùng odds hiện tại). |
| **Payout** | Số point nhận về khi thắng. |
| **Settle** | Chốt kết quả trận và chia điểm cho các kèo. |
| **Void** | Hoàn điểm (trận huỷ/không hợp lệ) — không lãi/lỗ. |
| **Escrow** | Trừ stake ngay khi đặt kèo, giữ tới khi settle. |
| **Kickoff** | Giờ bóng lăn — mốc khoá kèo. |
| **Result 90'** | Kết quả sau 90 phút + bù giờ (không tính hiệp phụ/penalty). Dùng cho kèo 1X2. |
| **Đội đi tiếp (advance)** | Đội qua vòng sau ET/penalty. Dùng cho Bracket & Futures (không phải 1X2). |
| **Vòng 32 đội (Round of 32)** | Vòng knockout đầu tiên của WC2026 (32 đội). Thống nhất gọi **"Vòng 32 đội (Round of 32)"** trong toàn PRD. Đối chiếu cách gọi khác: requirements gốc viết **"vòng 1/32"** (theo số đội), cách gọi phân số châu Âu là **"vòng 1/16"** (16 cặp đấu) — cả ba chỉ **cùng một vòng**. |
| **Vòng 16 đội (Round of 16)** | Vòng knockout thứ hai (16 đội) = cách gọi phân số **"vòng 1/8"**. Sau đó: Tứ kết → Bán kết → Tranh hạng 3 → Chung kết. |
| **Global mode** | Chế độ chơi chung toàn hệ thống trên toàn bộ 104 trận. |
| **Private lobby** | Phòng kín do user tạo, có mật khẩu/invite, scope vòng tuỳ chọn. |
| **Scope (lobby)** | Phạm vi trận của lobby: cả giải / vòng bảng / Vòng 32 đội / … / một trận. |
| **Default points** | Point khởi điểm chủ phòng cấp mỗi thành viên khi vào lobby. |
| **Borrow / Mượn point** | Số point ảo mượn trong lobby; `score_lobby = winnings + default − borrowed`. |
| **PointLedger** | Sổ cái giao dịch point append-only — nguồn chân lý về point. |
| **Leaderboard** | Bảng xếp hạng (global hoặc theo lobby). |
| **Bracket Predictor** | Dự đoán cả nhánh knockout (đội đi tiếp từng vòng). |
| **Futures** | Kèo dài hạn (vô địch, vua phá lưới…), settle cuối chặng. |
| **Underdog bonus** | Thưởng thêm khi đoán đúng cửa tỉ lệ cao (cửa dưới). |
| **Power-up** | Vật phẩm tạo hiệu ứng chiến thuật (Double Down, Insurance, Streak Shield). |
| **Combo / Parlay** | Vé gộp nhiều trận, nhân hệ số, thắng khi tất cả đúng. |
| **Streak** | Chuỗi liên tiếp (điểm danh hoặc thắng). |
| **AI Pundit** | Tính năng AI: preview trận, smart pick, phong độ, đối đầu. |
| **9router** | Proxy LLM (OpenAI-compatible) định tuyến Claude (primary) → OpenAI (fallback). |
| **Risk Engine** | Bộ luật heuristic gắn cờ lobby/user nghi lạm dụng. |
| **Case file** | Hồ sơ vi phạm (bằng chứng export được) phục vụ xử lý/tố cáo. |
| **PWA** | Progressive Web App — web cài được, hỗ trợ push. |
| **RBAC** | Phân quyền theo vai trò. |
| **MoSCoW** | Phân loại ưu tiên: Must/Should/Could/Won't. |
