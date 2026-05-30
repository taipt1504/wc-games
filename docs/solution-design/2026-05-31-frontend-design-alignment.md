# Frontend / Design Alignment — GOLAZO

> **Version**: 1.0 · **Date**: 2026-05-31 · **Status**: Active build checklist
> **Sources of truth (bắt buộc tuân theo):** Claude Design bundle [`docs/design/predict-wc-2026/`](../design/predict-wc-2026/README.md) cho **UI/UX**; [`docs/prd/`](../prd/README.md) + [solution-design](./README.md) cho **hành vi/dữ liệu/scoring**. Khi 2 nguồn lệch: UI theo design, logic/điểm theo PRD.

Tài liệu này là **checklist build** cho phần implement. Brand: **GOLAZO**.

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
