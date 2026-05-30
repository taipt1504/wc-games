# ADR-0006 — Frontend: GOLAZO design system, CSS-class port, Next App Router + client shell

> **Status**: Accepted · **Date**: 2026-05-31

## Context
Claude Design bàn giao prototype **GOLAZO** (HTML/CSS/JS — Babel-in-browser, global `window` components, global `WC` store). Cần recreate pixel-faithful trong app Next.js (scaffold sẵn), giữ PRD/solution-design làm source of truth cho logic.

## Decision
1. **Port `styles.css` verbatim → `apps/web/app/globals.css`**; component React dùng **đúng class names** GOLAZO (`.btn`, `.card`, `.odds`, …). Không Tailwind/CSS-modules cho phần này.
2. **Primitives** port `components.jsx` → `apps/web/components/ui/*.tsx` (ES modules, `'use client'` khi cần state/event).
3. **Routing:** Next **App Router** (file-based) mirror `ROUTES` của prototype; một **client `AppShell` + React Context store** thay cho router/store thủ công trong `app.jsx`; điều hướng qua `next/navigation`. Guest shell vs authed shell theo `authed`.
4. **Data:** `lib/wc.ts` port `data.js` thành typed mock (tạm); thay dần bằng API thật.
5. **Scoring** tách `packages/core` (pure TS) dùng chung web + worker.

## Consequences
**+** Nhanh & **pixel-faithful** (giữ nguyên hệ class đã polish); dễ đối chiếu với bundle design.
**+** Một nguồn token (globals.css); Ora/primitives tái dùng mọi screen.
**−** Global CSS (không scoped) — chấp nhận vì class GOLAZO đặt tên rõ, ít va chạm; có thể bọc `.gz-*` sau nếu cần.
**−** Mock `WC` còn tồn tại tới khi API thật thay — đánh dấu TODO theo từng màn.

## Alternatives
- **Tailwind/shadcn:** loại — phải dịch lại toàn bộ design đã hoàn thiện sang utility → chậm, dễ lệch pixel.
- **CSS Modules per-component:** loại cho v1 — chia nhỏ token đã thống nhất, tốn công; cân nhắc refactor sau.
