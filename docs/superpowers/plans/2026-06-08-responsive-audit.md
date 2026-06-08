# Responsive Audit — Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Finish player-facing responsiveness — fix the non-wrapping-row bug, the public shell, and bottom-nav parity. Frontend/CSS only; no business logic; reuse `app/responsive.css`.

**Spec:** `docs/superpowers/specs/2026-06-08-responsive-audit-design.md`

**Verify every phase:** `pnpm --filter @wc/web exec tsc --noEmit` (0 errors) + `pnpm --filter @wc/web test` (122 pass). Commits held.

---

## Task P1: wrap-w sweep + public shell + schedule search

**Files:** `components/screens-{core,match,compete,lobby,tournament}.tsx`, `components/screens-news.tsx`, `components/app-shell.tsx`, `app/globals.css`

- [ ] **Step 1 — `wrap`→add `wrap-w`** on these player rows (add `wrap-w` to the className, keep the rest):
  - screens-core: L30 (`row center gap-12 wrap fade-up`), L34 (`row center gap-24 wrap`)
  - screens-match: L232 (`row between wrap gap-12`)
  - screens-compete: L54, L67, L263, L762, L923 (all `row between wrap …`)
  - screens-lobby: L412, L689, L705, L726, L867
  - screens-news: L137
  - screens-tournament: L288
  - app-shell: L293 (guest promo panel)
  (admin rows excluded.)

- [ ] **Step 2 — pubbar shrink-safe** (`app-shell.tsx` L275 brand + L279 auth row):

```tsx
// L275 brand
<span className="rail-logo pointer ellip" style={{ padding: 0, fontSize: 'clamp(15px, 4.5vw, 24px)', flex: 1, minWidth: 0 }} onClick={() => { setRoute('landing'); setParam({}); }}>{BRAND}</span>
// L279 auth row
<div className="row gap-10" style={{ flexShrink: 0 }}>
```

- [ ] **Step 3 — globals.css** `.pubbar-inner` gap + `.tab-i` padding:

```css
.pubbar-inner{ max-width:1200px; margin:0 auto; height:64px; display:flex; align-items:center; gap:clamp(8px, 2vw, 24px); padding:0 var(--page-pad-x); }
.tab-i{ display:flex; flex-direction:column; align-items:center; gap:3px; color:var(--muted); font-size:10px; font-weight:600; padding:6px 8px; }
```

- [ ] **Step 4 — schedule search fluid** (`screens-match.tsx` L238 input):

```tsx
<input className="input" style={{ border: 0, background: 'transparent', padding: '4px 0', flex: 1, minWidth: 0 }} placeholder={t('schedule.searchPh')} value={q} onChange={e => setQ(e.target.value)} />
```
(also ensure its parent search card can grow: the `row gap-8 card` wrapper — leave; the row L232 now has `wrap-w` so on narrow the search card drops below filters.)

- [ ] **Step 5 — verify** tsc + 122 tests; grep `components/screens-*.tsx components/app-shell.tsx` for bare `wrap` rows → only admin remains. STOP for review.

---

## Task P2: bottom-nav parity (More menu)

**Files:** `lib/i18n/dictionaries/en.ts`, `lib/i18n/dictionaries/vi.ts`, `components/app-shell.tsx`

- [ ] **Step 1 — i18n key `nav.more`** (both catalogs, in the `nav` block):
  - en.ts: add `more: 'More',`
  - vi.ts: add `more: 'Thêm',`

- [ ] **Step 2 — TABS relabel + More** (`app-shell.tsx` L39):

```tsx
const TABS: [string, string, string][] = [['home', 'nav.home', 'home'], ['schedule', 'nav.matches', 'calendar'], ['leaderboard', 'nav.leaderboard', 'trophy'], ['lobbies', 'nav.lobbies', 'users'], ['more', 'nav.more', 'menu']];
const PRIMARY_TABS = new Set(['home', 'schedule', 'leaderboard', 'lobbies']);
```

- [ ] **Step 3 — `moreOpen` state** (near other app-shell state):

```tsx
const [moreOpen, setMoreOpen] = useState(false);
```

- [ ] **Step 4 — tabs render** (the `.tabs` nav): the `more` tab toggles the sheet; other tabs navigate; More active when route is secondary:

```tsx
<nav className="tabs">
  {TABS.map(([k, l, ic]) => {
    const isMore = k === 'more';
    const act = isMore ? !PRIMARY_TABS.has(route) : active === k;
    return (
      <button key={k} className={`tab-i ${act ? 'active' : ''}`} onClick={() => isMore ? setMoreOpen(true) : go(k)}>
        <Icon name={ic} size={21} />{t(l)}
      </button>
    );
  })}
</nav>
{moreOpen && (
  <div className="overlay only-desktop-hide" onClick={() => setMoreOpen(false)} style={{ zIndex: 100 }}>
    <div className="modal scale-in" style={{ padding: 14 }} onClick={(e) => e.stopPropagation()}>
      {RAIL.slice(1).map((grp) => (
        <div key={grp.sec ?? ''} style={{ marginBottom: 8 }}>
          {grp.sec && <div className="eyebrow" style={{ padding: '6px 8px' }}>{t(grp.sec)}</div>}
          {grp.items.map(([rk, rl, ic]) => (
            <button key={rk} className="nav-i" style={{ width: '100%' }} onClick={() => { setMoreOpen(false); go(rk); }}>
              <Icon name={ic} size={18} />{t(rl)}
            </button>
          ))}
        </div>
      ))}
    </div>
  </div>
)}
```
(`RAIL.slice(1)` = Tournament + Account sections. Reuses `.overlay`/`.modal` → bottom-sheet ≤640. The home/primary section is already in the tab bar.)

- [ ] **Step 5 — verify** tsc + 122 tests (if a test asserts the old "Bảng"/"Bạn" tab labels, update to the new labels). Audit grep clean. STOP — responsive complete; manual device check incl. landscape.
