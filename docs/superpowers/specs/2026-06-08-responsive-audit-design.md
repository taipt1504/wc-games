# Responsive Audit — Completion Design

**Date:** 2026-06-08 (follow-up to `2026-06-08-responsive-design.md`)
**Scope:** `apps/web` player-facing surface. Admin out of scope.
**Constraint:** Frontend/CSS only — no business-logic/data changes, no new deps. Reuse `app/responsive.css` (canonical breakpoints 768/1024/640, `.grid-auto`/`.grid-fill`/`.scroll-x`/`.grid-stack-md`, fluid `--page-pad`).

## Why

The first pass converted grids/tables but missed three breakage classes confirmed on-device: a pervasive non-wrapping-row bug, the public/landing shell, and a bottom-nav ↔ sidebar mismatch. This completes responsiveness to "100% on the player surface."

## Findings (audit)

1. **`wrap` ≠ flex-wrap (root cause).** 16 player `.row between` blocks use the bare `wrap` class, which is the *container* utility (`.wrap{ max-width/margin/padding }`), not `.wrap-w{ flex-wrap }`. So they never wrap → squish/overflow: leaderboard "your rank" card (compete L67, text wraps char-by-char), landing hero CTAs (core L30), trust row (core L34), schedule filter row (match L232), and bet-CTA banners (lobby L412/L689/L705/L726/L867, news L137, tournament L288, compete L54/L263/L762/L923, app-shell L293 guest promo).
2. **Public shell (pubbar).** Brand (`fontSize:24`, no nowrap) wraps to 3 lines; brand + login + "Đăng ký miễn phí" overflow the 64px bar.
3. **Bottom nav.** `TABS` labels (`leaderboard`→`nav.tabBoard`="Bảng", `profile`→`nav.tabYou`="Bạn") differ from `RAIL` (`Xếp hạng`/`Hồ sơ`). Sidebar exposes 11 destinations; bottom bar has 5 → 6 secondary items (Teams/Groups/Bracket/News/My bets/Wallet) have no global mobile nav.
4. **Schedule search** input is fixed `width:160` (should fill on mobile). Matches page otherwise fine.

## Design

### 1. `wrap` → `wrap-w` sweep
Add `wrap-w` (keep existing classes) to all 16 player-facing bare-`wrap` rows. Opt-in flex-wrap; no desktop change (the unintended `.wrap` container styling stays but is inert on these inner rows). Convention: a row meaning "wrap" must use `wrap-w`.

### 2. Public shell (pubbar) — shrink-safe
In `app-shell.tsx` pubbar:
- Brand `<span>`: add `ellip`, change `fontSize:24` → `clamp(15px, 4.5vw, 24px)`.
- Wrap brand-side so it can shrink: brand stays first child of `.pubbar-inner`; give it `flex:1, minWidth:0` (via inline style on the brand span — it is the flexible child since `.pub-nav` is hidden <1024).
- Auth row (`<div className="row gap-10">`): `flexShrink:0` so login/signup never clip.
- `.pubbar-inner` gap `24px` → `clamp(8px, 2vw, 24px)` (globals.css).
Result: brand truncates gracefully, controls always fit. Mirrors the authed-topbar fix already shipped.

### 3. Bottom nav — parity with sidebar
- `TABS = [['home','nav.home','home'], ['schedule','nav.matches','calendar'], ['leaderboard','nav.leaderboard','trophy'], ['lobbies','nav.lobbies','users'], ['more','nav.more','menu']]`. The 4 primary tabs reuse rail label keys; 5th is **More**.
- New i18n key `nav.more` — EN `"More"`, VI `"Thêm"` (added to both catalogs; parity preserved). `nav.tabBoard`/`nav.tabYou` left unused (harmless).
- New **`MoreSheet`** component (in `app-shell.tsx` or a small sibling file): a bottom-sheet overlay reusing the existing `.overlay`/`.modal` styles (already bottom-anchored ≤640). It renders the RAIL **Tournament + Account** sections (`teams/groups/bracket/news` + `mybets/wallet/profile`) as tappable rows → `go(route)` then close. Section headers reuse `nav.secTournament`/`nav.secAccount`.
- `moreOpen` UI state in app-shell (presentational nav state only; routing via existing `go()`). The More tab toggles it; selecting an item navigates + closes.
- "More" tab `active` when the current route ∈ secondary set (`teams/groups/bracket/news/mybets/wallet/profile/team/lobby/article/...` — i.e. any route not in the 4 primary tabs).
- `.tab-i` horizontal padding `14px` → `8px` (globals.css) so 5 sidebar-matching labels fit at 360px; keep `font-size:10px`.

### 4. Schedule search
`screens-match.tsx` search `<input>`: `width:160` → `flex:1, minWidth:0` (its row gets `wrap-w`, search fills remaining width / drops below filters on narrow).

## Phasing (one phase per run, stop for review)

- **P1 — sweep + shell + search:** 16-row `wrap-w` sweep; pubbar shrink-safe; `.pubbar-inner`/`.tab-i` globals tweaks; schedule search fluid. Verify.
- **P2 — bottom-nav parity:** `nav.more` catalog key; `TABS` relabel + More entry; `MoreSheet`; `moreOpen` state + active logic. Verify.

## Verification

- `pnpm --filter @wc/web exec tsc --noEmit` → 0 errors.
- `pnpm --filter @wc/web test` → 122 passed (class swaps + the new sheet must not break asserted text/roles; if a nav test asserts "Bảng"/"Bạn" labels, update it to the new labels).
- Audit greps: zero bare-`wrap` rows on player screens; zero raw `auto-fit/fill` grids; no fixed-width forcing >360 overflow.
- Manual device check at 360 / 414 / 768 / 1024 + landscape (jsdom has no layout engine — visual correctness is not test-covered).

## Out of scope
Admin console; business-logic/data/behavior changes; new deps; visual redesign beyond responsiveness.

## Success criteria
Every player page usable with no horizontal overflow / clipped content / squished text from 360px through desktop, portrait + landscape; bottom nav reaches every destination the sidebar does and uses consistent labels.
