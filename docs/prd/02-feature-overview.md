# 02 — Tổng Quan Tính Năng (Feature Matrix)

Ma trận toàn bộ tính năng theo **epic**, kèm ID, ưu tiên **MoSCoW**, **phase**, persona chính, và phụ thuộc. Đặc tả chi tiết nằm ở các file `03`–`10`.

**Phase:** MVP / v1 / v2 — **MoSCoW:** M=Must, S=Should, C=Could.

> **OQ-01:** toàn bộ tính năng **launch cùng 1 lần trước 11/06**. Cột Phase = **thứ tự ưu tiên build** (MVP=P0 → v1=P1 → v2=P2, cut-line), **không** phải mốc release riêng.

---

## Epic A — Auth & Tài khoản (`03-features-core.md`)

| ID | Tính năng | Phase | MoSCoW | Persona | Phụ thuộc |
|---|---|---|---|---|---|
| FR-AUTH-01 | Đăng ký (email/username + password) | MVP | M | P1,P2 | — |
| FR-AUTH-02 | Đăng nhập, JWT + cookie (httpOnly) | MVP | M | tất cả | — |
| FR-AUTH-03 | Thu thập & lưu IP + User-Agent mỗi session | MVP | M | P4 | AUTH-02 |
| FR-AUTH-04 | Đăng xuất, refresh token, hết hạn | MVP | M | tất cả | AUTH-02 |
| FR-AUTH-05 | Tặng **1000 point** khi đăng ký lần đầu | MVP | M | P1,P2 | SCORE |
| FR-AUTH-06 | Trang Profile (thông tin, đổi mật khẩu) | MVP | M | tất cả | AUTH-02 |
| FR-AUTH-07 | Trang ví Point + lịch sử giao dịch | MVP | M | P1,P2 | SCORE, ledger |
| FR-AUTH-08 | Quên/đặt lại mật khẩu | v1 | S | tất cả | email |

## Epic B — Dữ liệu giải đấu (`03-features-core.md` + `15`)

| ID | Tính năng | Phase | MoSCoW | Persona | Phụ thuộc |
|---|---|---|---|---|---|
| FR-DATA-01 | Trang danh sách 48 đội + chi tiết đội | MVP | M | P1,P2 | pipeline |
| FR-DATA-02 | 12 bảng đấu + bảng xếp hạng vòng bảng | MVP | M | P1,P2 | pipeline |
| FR-DATA-03 | Lịch thi đấu chi tiết (104 trận, lọc theo đội/ngày/vòng) | MVP | M | tất cả | pipeline |
| FR-DATA-04 | Chi tiết trận (giờ, sân, đội hình, tỉ lệ) | MVP | M | P2 | pipeline, odds |
| FR-DATA-05 | Danh sách cầu thủ theo đội | MVP | S | P2 | pipeline |
| FR-DATA-06 | Sơ đồ nhánh knockout (bracket view) | v1 | S | P1,P2 | DATA-03 |
| FR-DATA-07 | Cập nhật tỉ số trực tiếp/gần real-time | MVP | M | tất cả | pipeline |

## Epic C — Global Mode (`03-features-core.md`)

| ID | Tính năng | Phase | MoSCoW | Persona | Phụ thuộc |
|---|---|---|---|---|---|
| FR-GLOBAL-01 | Đặt kèo 1X2 cho bất kỳ trận nào toàn giải | MVP | M | tất cả | SCORE, DATA |
| FR-GLOBAL-02 | Khoá kèo tại giờ bóng lăn | MVP | M | tất cả | DATA-03 |
| FR-GLOBAL-03 | Leaderboard global (toàn hệ thống) | MVP | M | P2 | SCORE |
| FR-GLOBAL-04 | Lịch sử kèo cá nhân + ROI | MVP | S | P2 | ledger |
| FR-GLOBAL-05 | Điểm danh hằng ngày +200 point | MVP | M | P1 | SCORE |

## Epic D — Private Lobby (`03-features-core.md`)

| ID | Tính năng | Phase | MoSCoW | Persona | Phụ thuộc |
|---|---|---|---|---|---|
| FR-LOBBY-01 | Tạo lobby (mật khẩu, point default, scope vòng) | v1 | M | P3 | SCORE |
| FR-LOBBY-02 | Mời qua invite link + tham gia bằng mật khẩu | v1 | M | P3,P1 | LOBBY-01 |
| FR-LOBBY-03 | Scope lobby: cả giải / vòng bảng / Vòng 32 đội / tứ kết… / 1 trận | v1 | M | P3 | DATA-03 |
| FR-LOBBY-04 | Leaderboard riêng của lobby | v1 | M | P3 | SCORE |
| FR-LOBBY-05 | Mượn point: request + chủ phòng duyệt | v1 | M | P3 | ledger |
| FR-LOBBY-06 | Chủ phòng set point mượn trực tiếp | v1 | S | P3 | ledger |
| FR-LOBBY-07 | Chủ phòng set tỉ lệ kèo thủ công (override) | v1 | C | P3 | odds |
| FR-LOBBY-08 | Quản lý thành viên (kick, chuyển quyền) | v1 | S | P3 | — |

## Epic E — Scoring Engine (`04-scoring-engine.md`)

| ID | Tính năng | Phase | MoSCoW | Persona | Phụ thuộc |
|---|---|---|---|---|---|
| FR-SCORE-01 | Tính điểm 1X2 theo odds (đúng: `S×(1+m)`) | MVP | M | tất cả | DATA-04 |
| FR-SCORE-02 | Quy ước knockout: 1X2 theo kết quả 90' | MVP | M | P2 | — |
| FR-SCORE-03 | Bonus tỉ số chính xác (chỉ knockout) | v1 | S | P2 | SCORE-02 |
| FR-SCORE-04 | Settle trận + chia điểm tự động | MVP | M | tất cả | DATA-07 |
| FR-SCORE-05 | Sổ cái điểm (PointLedger) bất biến | MVP | M | P4 | — |
| FR-SCORE-06 | Công thức điểm lobby có mượn point | v1 | M | P3 | LOBBY-05 |
| FR-SCORE-07 | Hoàn điểm khi trận bị hoãn/huỷ (void) | MVP | M | tất cả | DATA-07 |

## Epic F — Engagement (`05-features-engagement.md`)

| ID | Tính năng | Phase | MoSCoW | Persona | Phụ thuộc |
|---|---|---|---|---|---|
| FR-ENG-01 | Streak điểm danh (hệ số tăng dần) | MVP→v1 | S | P1 | GLOBAL-05 |
| FR-ENG-02 | Streak chuỗi thắng | v1 | S | P1,P2 | SCORE-04 |
| FR-ENG-03 | Nhiệm vụ hằng ngày (missions) | v1 | S | P1 | — |
| FR-ENG-04 | Thành tựu & huy hiệu (achievements) | v1 | C | P1,P2 | — |
| FR-ENG-05 | Thông báo (web push + email): nhắc khoá kèo, kết quả, streak-at-risk | MVP-lite→v1 | M | P1 | push/email |

## Epic G — Prediction Depth (`06-features-prediction-depth.md`)

| ID | Tính năng | Phase | MoSCoW | Persona | Phụ thuộc |
|---|---|---|---|---|---|
| FR-DEPTH-01 | Bracket Predictor (điền nhánh knockout) | v1 | S | P1,P2 | DATA-06 |
| FR-DEPTH-02 | Futures (vô địch, vua phá lưới…) | v1 | S | P2 | DATA |
| FR-DEPTH-03 | Underdog bonus | v1 | S | P2 | SCORE, odds |
| FR-DEPTH-04 | Power-ups (Double Down, Insurance, Streak Shield) | v2 | C | P1,P2 | shop/SCORE |
| FR-DEPTH-05 | Combo/Parlay nhiều trận | v2 | C | P2 | SCORE |
| FR-DEPTH-06 | In-play micro-prediction | v2 | C | P1,P2 | DATA-07 real-time |

## Epic H — Social (`07-features-social.md`)

| ID | Tính năng | Phase | MoSCoW | Persona | Phụ thuộc |
|---|---|---|---|---|---|
| FR-SOCIAL-01 | Chat + reaction trong lobby | v1 | S | P3,P1 | LOBBY |
| FR-SOCIAL-02 | Share card kết quả (ảnh tự sinh) | v1 | S | P1 | — |
| FR-SOCIAL-03 | Referral (mời bạn, cả hai nhận point) | v1 | S | P1 | AUTH |
| FR-SOCIAL-04 | Duel 1v1 (head-to-head) | v2 | C | P1,P2 | SCORE |
| FR-SOCIAL-05 | Activity feed bạn bè (sau khi khoá kèo) | v2 | C | P1 | LOBBY/friends |

## Epic I — AI & Meta (`08-features-ai-meta.md`)

| ID | Tính năng | Phase | MoSCoW | Persona | Phụ thuộc |
|---|---|---|---|---|---|
| FR-AIMETA-01 | AI Pundit: preview trận, smart pick, phong độ, đối đầu | v1 | S | P1,P2 | 9router, DATA |
| FR-AIMETA-02 | Cosmetic shop (point sink: avatar/khung/theme) | v2 | C | P1 | ledger |
| FR-AIMETA-03 | Predictor tiers (Đồng→Huyền thoại, reset mùa) | v2 | C | P2 | SCORE |

## Epic J — Admin (`09-admin.md`)

| ID | Tính năng | Phase | MoSCoW | Persona | Phụ thuộc |
|---|---|---|---|---|---|
| FR-ADMIN-01 | Quản lý user (xem, khoá/ban, reset) | MVP | M | P4 | AUTH |
| FR-ADMIN-02 | Giám sát lobby + cờ cảnh báo lạm dụng | v1 | M | P4 | LOBBY, audit |
| FR-ADMIN-03 | Action lobby/user: cảnh cáo, ban, ghi hồ sơ vi phạm | v1 | M | P4 | — |
| FR-ADMIN-04 | Quản lý đội/lịch/tỉ lệ (CRUD + override) | MVP | M | P4 | pipeline |
| FR-ADMIN-05 | Quản lý tin tức + review queue | MVP | M | P4 | NEWS |
| FR-ADMIN-06 | Audit log (IP/UA, giao dịch point) | MVP | M | P4 | AUTH-03 |
| FR-ADMIN-07 | Dashboard pipeline AI (job, quota, fallback) | v1 | S | P5 | 9router |

## Epic K — Tin tức (`10-news.md`)

| ID | Tính năng | Phase | MoSCoW | Persona | Phụ thuộc |
|---|---|---|---|---|---|
| FR-NEWS-01 | AI crawl + sinh bài tin bên lề tự động | MVP | S | P1 | 9router |
| FR-NEWS-02 | Review queue (admin duyệt trước publish) | MVP | M | P4 | NEWS-01 |
| FR-NEWS-03 | Trang đọc tin + phân loại/tag | MVP | S | P1 | NEWS-01 |
| FR-NEWS-04 | Auto-publish theo lịch (sau duyệt) | v1 | C | P5 | NEWS-02 |

---

## Tóm tắt theo phase

- **MVP (Must trước 11/06):** Epic A (trừ AUTH-08), B (trừ DATA-06), C, E (trừ SCORE-03/06), J (core), K (NEWS-01/02/03), ENG-01/05-lite, pipeline AI ingest.
- **v1:** Epic D (lobby), G, H, I (AI Pundit), phần còn lại của E/F, ADMIN-02/03/07.
- **v2:** DEPTH-04/05/06, SOCIAL-04/05, AIMETA-02/03.
