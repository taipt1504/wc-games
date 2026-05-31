# Frontend / Design Alignment — GOLAZO

> **Version**: 1.0 · **Date**: 2026-05-31 · **Status**: Active build checklist
> **Sources of truth (bắt buộc tuân theo):** Claude Design bundle [`docs/design/predict-wc-2026/`](../design/predict-wc-2026/README.md) cho **UI/UX**; [`docs/prd/`](../prd/README.md) + [solution-design](./README.md) cho **hành vi/dữ liệu/scoring**. Khi 2 nguồn lệch: UI theo design, logic/điểm theo PRD.

Tài liệu này là **checklist build** cho phần implement. Brand: **GOLAZO**.

### Design provenance & verification (2026-05-31)
- **Nguồn:** Claude Design share `https://api.anthropic.com/v1/design/h/a0eo169Wls0sIZWdRxlYsw`. Re-fetch hôm nay trả **404 (share link đã hết hạn)** — bản trích xuất verbatim của chính URL đó đã lưu tại [`docs/design/predict-wc-2026/`](../design/predict-wc-2026/) (README + `chats/chat1.md` + `project/*`) là bản gốc dùng để build.
- **Đã đọc lại** README + toàn bộ `chats/chat1.md` (8 vòng iterate của user). **Final state của design** đã được verify hiện diện trong code port:

| Design feature (chốt trong chat) | Ported |
|---|---|
| 7 màn + design system (styles→globals.css, components→ui, app→app-shell, data→lib/wc) | ✅ 1:1 |
| Formation-pitch lineups | ✅ `LineupsPanel` (screens-match) |
| Host borrow-request approval queue (Approve-all, Frequent-borrower flag, isHost) | ✅ `LobbyRequests` (screens-lobby) |
| Lobby: search + join code/link, Your-lobbies vs Discover, isolated workspace, host odds/trận | ✅ screens-lobby |
| Scope presets (Whole/Group/R32/R16/QF/SF/Final + custom picker) | ✅ screens-lobby |
| Public guest shell + sign-up wall + public leaderboard | ✅ `pubbar`/`GATED`/`FULLBLEED` (app-shell), Leaderboard guest-aware |
| Admin detail views: user / lobby-risk / match / team / news-review | ✅ `AdmUserDetail`/`AdmRiskDetail`/`AdmMatchDetail`/`AdmTeamDetail`/`AdmNewsDetail` |

## 1. Design system GOLAZO (đã port → `apps/web/app/globals.css`)
Dark, sporty, high-energy. Tokens & component-classes lấy **verbatim** từ `docs/design/.../styles.css`:
- **Màu:** green `#2BE08A` (action/win), gold `#FFC83D` (point/streak), sky `#3FC0F0` (AI/info), magenta `#FF4D8D` (live), danger `#FF5A65` (loss), purple `#9B7DFF`. Surfaces `#070B16→#20304F`.
- **Font:** Archivo (display), Sora (body), Space Mono (số/odds) — qua Google Fonts @import.
- **Component classes:** `.btn`(primary/gold/ghost/outline/danger), `.card`, `.chip`, `.badge-*`, `.odds`(.sel/.up), `.flag`, `.stat`, `.tbl`, `.bar`, `.panel`, app-shell (`.rail`/`.tabs`/`.topbar`/`.pubbar`), `.overlay`/`.modal`/sheet, `.ticket-notch`.
- **Mascot Ora:** AI Pundit broadcast-owl (SVG, moods idle/happy/think) → `components/ui/pundit.tsx`.

## 2. Tính năng design BỔ SUNG so với PRD (đã chấp nhận, phải build)
> Đây là phần design iterate thêm — cập nhật vào scope.

| # | Bổ sung | Khớp PRD? |
|---|---|---|
| D1 | **Guest mode**: khách xem công khai Matches/Match/Teams/Team/Groups/Bracket/News/**Leaderboard** không cần account; **sign-up wall** khi đặt kèo / vào khu account | Mới (hỗ trợ growth) — gate đúng tinh thần PRD |
| D2 | **Public leaderboard** + conversion card "Where would you rank?" | Mở rộng FR-GLOBAL-03 |
| D3 | **Lobby = workspace isolate**: danh sách trận theo host chọn; **host chỉnh odds từng trận trong lobby**; lobby-wallet strip; join bằng **code/link**; tách "Your lobbies" vs "Discover"; **scope presets** (whole/group/R32/R16/QF/SF/final/custom picker) | FR-LOBBY-01/02/03/07 |
| D4 | **Host borrow-request approval queue** (tab Requests, approve/reject, cờ "frequent borrower") | FR-LOBBY-05/06 |
| D5 | **Lineups = sơ đồ sân (formation pitch)** thay vì list | Mới (UI) |
| D6 | **Admin detail pages**: user detail (IP cluster/linked accounts), lobby-risk detail (risk breakdown/point-flow), **tournament mgmt** (score override, settle, betting lock, **odds adjust**), match detail (bet distribution), team detail (squad), **news review detail** (grounding-confidence, verbatim-overlap, citations) | FR-ADMIN-01..07, mở rộng |
| D7 | **Ora mascot** xuyên suốt (AI Pundit) | FR-AIMETA-01 |
| D8 | Home: daily check-in/streak, missions claimable, mini-leaderboard, stat tiles | FR-ENG-01/03, FR-GLOBAL-05 |
| D9 | **Bet slip** overlay (ticket) + toast feedback | FR-GLOBAL-01 |

## 3. Screen inventory (route → màn → backend cần)
Public: `landing` · `schedule` · `match`(+bet slip) · `teams`/`team` · `groups` · `bracket` · `news`/`article` · `leaderboard`.
Gated: `home` · `mybets` · `wallet` · `profile` · `lobbies`/`lobby-create`/`lobby` · `admin`.
Auth: `auth` (login/signup). Mỗi màn → file `screens-*.jsx` tương ứng trong bundle (đọc khi build từng màn).

Shell: desktop **rail** (Home/Matches/Leaderboard/Lobbies · Tournament: Teams/Groups/Bracket/News · Account: My bets/Wallet/Profile · Admin) + mobile **bottom tabs** (Home/Matches/Board/Lobbies/You) + **guest pubbar**.

## 4. Frontend architecture (port prototype → Next.js)
- **Next App Router** + **client `AppShell` + store context** (port `app.jsx` store: route helpers thay bằng `next/navigation`, state points/bets/streak/checkin/betSlip/toast). File-based routes mirror `ROUTES`; guest vs authed shell theo `authed`.
- **CSS:** port `styles.css` → `app/globals.css` verbatim; component dùng đúng class names (port nhanh, pixel-faithful). (ADR-0006)
- **Primitives** → `components/ui/*.tsx` (port `components.jsx`: Icon, Flag, Avatar, Button, Pundit, Spark, OddsRow, MatchCard, SecHead, TierPill, Toast).
- **Data layer:** `lib/wc.ts` (port `data.js` thành typed mock) — **tạm thời**; thay dần bằng API thật (pipeline/DB). Real WC2026 data theo PRD §15.
- **Scoring dùng chung:** `packages/core` (pure TS) — payout 1X2, bonus knockout, ROI, lobby score (PRD §04). Dùng bởi web (payout-preview) + worker (settle).

## 5. Test strategy (cho "100% pass")
- **Unit:** `packages/core` scoring (vitest) — PRD-exact, flake-free. `apps/*` utils.
- **Component:** vitest + React Testing Library (jsdom) — render primitives + screens.
- **Integration:** worker/API + Testcontainers/Docker Postgres (escrow, idempotent settle).
- **E2E:** Playwright — guest browse → signup wall → bet flow → leaderboard.
- Quy tắc: chỉ tuyên bố "pass" khi **chạy thật + show output**; mỗi slice kèm test xanh trước khi ship.

## 6. Build order (vertical slices, foundation-first)
1. ✅ Align (doc này) + ADR-0006.
2. **Foundation contract (inline, freeze trước khi fan-out):** globals.css · types · lib/wc.ts · primitives · AppShell/store · scoring core + tests · test harness (vitest/RTL/Playwright).
3. **Prove 1 screen E2E** (Landing trong guest shell) + render test xanh.
4. **Fan-out (agents/Workflow):** 1 agent/screen theo primitives đã freeze (+ render test); 1 agent/service-design backend (scoring→auth→prediction/settle→...) TDD. Barrier dedup/integration sau mỗi batch.
5. Integration + E2E happy paths → xanh 100% → ship slice.

## 7. Implementation status — Admin & Ops (PRD §09)

> Cập nhật alignment sau khi build admin console. **Live** = wired tới API + Postgres + có test; **Mock** = UI port từ design nhưng còn đọc `lib/wc.ts`. Test gate hiện tại: **136 unit/integration + 12 E2E = 148, pass 100%** (`pnpm test` serial + Playwright). Static gate = `tsc` qua `next build` (xanh). ESLint chưa được cấu hình trong scaffold (pre-existing) → không nằm trong gate.

| Req | Mức | Trạng thái | API / service | Test |
|---|---|---|---|---|
| **ADMIN-01** Quản lý user | MVP | **Live (core)** — list user thật, **ban + AuditLog**, role-gated nav (ẩn Admin với non-admin). *Còn mock:* search filter, session IP/UA trong profile, lock/unlock, point clawback | `GET /admin/users`, `POST /admin/users/:id/ban`, `requireAdmin()` | e2e "bans a victim → BANNED in Postgres" |
| **ADMIN-02** ⭐ Risk lobby | v1 | **Live (engine+queue)** — `scanLobbyRisk` heuristics, RiskFlag queue, "Run scan". *Còn mock:* trang điều tra (point-flow/chat/IP) | `@wc/risk` `scanLobbyRisk`, `GET /admin/risk-flags`, `POST /admin/risk/scan` | risk-engine int (2), e2e risk read |
| **ADMIN-03** Xử lý vi phạm | v1 | **Partial** — ban (live). *Chưa build:* case-file/export, đóng lobby, escalation | — | — |
| **ADMIN-04** Data + re-settle | MVP | **Live** — `resettleMatch` (reverse settlement → re-apply, net-idempotent) + score override + audit. *Còn mock:* CRUD đội/lịch/odds đầy đủ | `resettleMatch`, `POST /admin/matches/:id/resettle` | prediction int (resettle+idempotent), e2e "score correction flips bet" |
| **ADMIN-05** News review | MVP | **Live** — queue PENDING, approve/reject → PUBLISHED/REJECTED + audit, public feed chỉ hiện PUBLISHED (human-in-the-loop) | `GET /admin/news`, `POST /admin/news/:id/{approve,reject}`, `GET /api/v1/news`, `seedNews` | e2e "approve → appears on public feed" |
| **ADMIN-06** Audit log | MVP | **Live** — login ghi IP/UA vào AuditLog (bất biến), admin audit view (filter action/actor) | `GET /admin/audit`, login route capture | e2e "login captured + visible to admin" |
| **ADMIN-07** Pipeline dashboard | v1 | **Mock** — KPI/jobs đọc `lib/wc.ts`; chưa wire AIJob/9router metrics thật | — | — |

**Còn lại (post-MVP / v1):** ADMIN-02 investigation detail, ADMIN-03 case-file/export + escalation, ADMIN-07 live AIJob/9router metrics; ADMIN-01 search/clawback/session-view; worker BullMQ AI-news job để sinh draft thật (hiện `seedNews` đứng thay); register-login audit (login đã có). Resettle UI (`ScoreEditModal → onSave → fetch`) đã compile + gọi đúng endpoint nhưng e2e drive qua `page.request` (chưa click nút).
