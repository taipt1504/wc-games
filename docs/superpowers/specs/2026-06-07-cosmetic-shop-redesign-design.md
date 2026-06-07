# Design: Cosmetic Shop UI Redesign

**Date:** 2026-06-07
**Status:** Approved (design) — pending spec review → writing-plans
**Scope:** One component — `CosmeticShop` in `apps/web/components/screens-compete.tsx`. No backend, no schema, no new deps. Reuses the existing `/api/v1/shop`, `/shop/buy`, `/shop/equip` + `Avatar`/`Icon`.

## Problem

The current shop is a flat single-column list of full-width rows: a generic kind-icon tile + name + "kind · price" + Buy/Equip. No grouping, no preview of the cosmetic, no affordability feedback; long to scroll, repetitive.

## Decisions (locked)

- **Layout A** — category-grouped preview grid.
- **Derived visual previews** — no per-item art exists; render a representative preview per kind with a deterministic accent colour. No new assets/backend.

## Design

Rewrite `CosmeticShop`'s render (data-fetch + `handleBuy`/`handleEquip`/`fetchShop` logic unchanged).

### Header
`COSMETIC SHOP` eyebrow + a balance chip on the right: `◇ {s.points.toLocaleString()} pts`.

### Grouping
Group `items` by `kind` into ordered sections: **Avatars** (`avatar`), **Frames** (`frame`), **Themes** (`theme`); any other kind falls into a trailing "More" section. Each section: a small header label + a responsive grid `gridTemplateColumns: repeat(auto-fill, minmax(150px, 1fr))`, `gap: 12`.

### Item card
Each item → a `card card-pad` tile, centred, containing:
1. **Preview** (deterministic accent colour `accentFor(item.code)`):
   - `avatar` → `<Avatar initials={initialsOf(item.name)} color={accent} size={52} />`
   - `frame`  → `<Avatar initials={initialsOf(item.name)} color="var(--surface-2)" ring={accent} size={52} />` (avatar inside the frame's coloured ring)
   - `theme`  → a 52×52 rounded swatch with `background: linear-gradient(135deg, {accent}, var(--bg-2))`
2. **Name** — `small`, bold.
3. **Price chip** — `★ {Number(item.price)} pts` (gold).
4. **Action / state:**
   - owned + equipped → `<Btn variant="primary" disabled>Equipped</Btn>` + a small "Equipped" highlight (card border `rgba(43,224,138,.4)`).
   - owned, not equipped → `<Btn variant="ghost" onClick={handleEquip(id)}>Equip</Btn>`.
   - not owned, affordable (`s.points >= price`) → `<Btn variant="gold" onClick={handleBuy(code)}>Buy</Btn>`.
   - not owned, unaffordable → `<Btn variant="gold" disabled>Buy</Btn>` + a `tiny muted` line `Need {price - s.points} more`.

### Helpers (module-level in screens-compete)
- `accentFor(code: string): string` — sum char codes → index into a fixed palette (`['var(--gold)','var(--sky)','var(--green)','var(--magenta)','var(--purple)']`). Deterministic, gives per-item variety.
- `initialsOf(name: string): string` — first letters of up to 2 words, uppercased.

### Empty / loading
`items.length === 0` → keep the "Loading items…" card.

## ASCII reference
```
COSMETIC SHOP                                    ◇ 350 pts
AVATARS
┌──────────┐ ┌──────────┐ ┌──────────┐
│  (OR)    │ │  (NO)    │ │   …      │
│ Ora      │ │ Nova     │ │          │
│ ★500 pts │ │ ★800 pts │ │          │
│ [ Buy ]  │ │ [Equipped]│ │          │
FRAMES
┌──────────┐ ┌──────────┐
│ ⟨(GO)⟩    │ │ ⟨(FI)⟩    │   (avatar inside coloured ring)
│ Gold     │ │ Fire     │
│ ✓ owned  │ │ ★700 pts │
│ [ Equip ]│ │ [ Buy ]  │
THEMES
┌──────────┐ ┌──────────┐
│ ▦▦▦▦      │ │ ▦▦▦▦      │   (gradient swatch)
│ Night    │ │ Golazo   │
│ ★1200 pts│ │ ★2000 pts│
│[Need 850 │ │ [ Buy ]  │
│  more]   │ │          │
```

## Testing
- Component test (jsdom + mock `/api/v1/shop`): renders category headers (Avatars/Frames/Themes), a Buy button for an unowned affordable item, "Equipped" for an equipped item, and "Need … more" when `s.points < price`.
- tsc clean + full web suite green.

## Out of scope
- Real per-item cosmetic art/assets; actually applying themes/frames site-wide (separate feature).
- Backend/shop API changes.
