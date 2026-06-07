# Cosmetic Shop Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [ ]`). **Commits HELD** (on `main`, commit-when-asked) — finish with verification, no `git commit`.

**Goal:** Redesign `CosmeticShop` into a category-grouped preview grid with derived previews + affordability/equipped states.

**Architecture:** Pure client-render change in one component (`screens-compete.tsx`). Export `CosmeticShop`, add `accentFor`/`initialsOf`/`ShopPreview` helpers, rewrite the return. Fetch/buy/equip logic unchanged. Reuse `Avatar`/`Icon`/`Btn`.

**Tech Stack:** React 19, Vitest (jsdom), existing `/api/v1/shop` endpoints.

---

### Task 1: Redesign CosmeticShop (grouped preview grid)

**Files:**
- Modify: `apps/web/components/screens-compete.tsx`
- Test: `apps/web/components/screens-compete.test.tsx`

- [ ] **Step 1: Add helpers + preview component** above `function CosmeticShop` (just after the `KIND_ICON` const):

```tsx
const SHOP_ACCENTS = ['var(--gold)', 'var(--sky)', 'var(--green)', 'var(--magenta)', 'var(--purple)'];
function accentFor(code: string): string {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h + code.charCodeAt(i)) % 997;
  return SHOP_ACCENTS[h % SHOP_ACCENTS.length];
}
function initialsOf(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
}
const SHOP_SECTIONS: [string, string][] = [['avatar', 'Avatars'], ['frame', 'Frames'], ['theme', 'Themes']];

function ShopPreview({ kind, code, name }: { kind: string; code: string; name: string }) {
  const accent = accentFor(code);
  if (kind === 'theme') return <div style={{ width: 52, height: 52, borderRadius: 12, background: `linear-gradient(135deg, ${accent}, var(--bg-2))`, border: '1px solid var(--line-strong)' }} />;
  if (kind === 'frame') return <Avatar initials={initialsOf(name)} color="var(--surface-2)" ring={accent} size={52} />;
  return <Avatar initials={initialsOf(name)} color={accent} size={52} />;
}
```

- [ ] **Step 2: Export + rewrite the render.** Change `function CosmeticShop` → `export function CosmeticShop`, and replace the `return (...)` block (keep `items` state, `fetchShop`, `useEffect`, `handleBuy`, `handleEquip`, `if (!s.authed) return null;` exactly as-is):

```tsx
  if (!s.authed) return null;

  const sections: [string, ShopItem[]][] = [];
  for (const [k, label] of SHOP_SECTIONS) {
    const list = items.filter((i) => i.kind === k);
    if (list.length) sections.push([label, list]);
  }
  const other = items.filter((i) => !['avatar', 'frame', 'theme'].includes(i.kind));
  if (other.length) sections.push(['More', other]);

  return (
    <div>
      <div className="row between mt-24" style={{ marginBottom: 12 }}>
        <span className="eyebrow">Cosmetic shop</span>
        <span className="badge badge-gold tnum">◇ {s.points.toLocaleString()} pts</span>
      </div>
      {items.length === 0 && <div className="card card-pad"><span className="tiny muted">Loading items…</span></div>}
      <div className="stack gap-18">
        {sections.map(([label, list]) => (
          <div key={label}>
            <div className="tiny muted" style={{ fontWeight: 700, letterSpacing: '.06em', marginBottom: 8 }}>{label.toUpperCase()}</div>
            <div className="grid gap-12" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))' }}>
              {list.map((item) => {
                const price = Number(item.price);
                const afford = s.points >= price;
                return (
                  <div key={item.code} className="card card-pad stack center gap-8" style={{ textAlign: 'center', borderColor: item.equipped ? 'rgba(43,224,138,.4)' : 'var(--line)' }}>
                    <ShopPreview kind={item.kind} code={item.code} name={item.name} />
                    <div className="small" style={{ fontWeight: 700 }}>{item.name}</div>
                    <span className="badge badge-gold tnum">★ {price} pts</span>
                    {item.owned
                      ? <Btn variant={item.equipped ? 'primary' : 'ghost'} size="sm" className="btn-block" disabled={item.equipped} onClick={() => handleEquip(item.id)}>{item.equipped ? 'Equipped' : 'Equip'}</Btn>
                      : (
                        <>
                          <Btn variant="gold" size="sm" className="btn-block" disabled={!afford} onClick={() => handleBuy(item.code)}>Buy</Btn>
                          {!afford && <span className="tiny muted">Need {(price - s.points).toLocaleString()} more</span>}
                        </>
                      )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: tsc** — `pnpm --filter @wc/web exec tsc --noEmit` → no errors.

- [ ] **Step 4: Write the component test** — append to `screens-compete.test.tsx` (uses the file's existing `mockStore` + `vi.spyOn(global,'fetch')`; add `CosmeticShop` to the import on line 3):

```tsx
describe('CosmeticShop', () => {
  it('groups items by kind and shows equipped + affordability', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [
        { id: 1, code: 'ora', name: 'Ora Avatar', kind: 'avatar', price: 500, owned: false, equipped: false },
        { id: 2, code: 'gold', name: 'Gold Frame', kind: 'frame', price: 300, owned: true, equipped: true },
        { id: 3, code: 'night', name: 'Night Theme', kind: 'theme', price: 1200, owned: false, equipped: false },
      ] }),
    } as Response);
    render(<CosmeticShop s={mockStore({ authed: true, points: 350 })} />);
    expect(await screen.findByText('AVATARS')).toBeInTheDocument();
    expect(screen.getByText('FRAMES')).toBeInTheDocument();
    expect(screen.getByText('THEMES')).toBeInTheDocument();
    expect(screen.getByText('Equipped')).toBeInTheDocument();      // owned+equipped frame
    expect(screen.getByText(/Need 150 more/)).toBeInTheDocument(); // ora 500 > balance 350
  });
});
```
(The import line becomes `import { Leaderboard, MyBets, Wallet, Profile, CosmeticShop } from '@/components/screens-compete';`. Confirm `mockStore` includes `points` + `me`; if not, pass them via the `over` arg — the test already passes `points: 350`.)

- [ ] **Step 5: Run tests** — `pnpm --filter @wc/web test` → all pass (incl. the new CosmeticShop test).

- [ ] **Step 6: STOP — done. Print changed files, await review.** (No commit — held.)

---

## Self-review notes (addressed)

- **Spec coverage:** header balance chip ✓ (Step 2); grouping Avatars/Frames/Themes + More ✓; preview per kind ✓ (`ShopPreview`); price chip ✓; affordability dim + "Need X more" ✓; equipped highlight + disabled ✓; loading state kept ✓; helpers `accentFor`/`initialsOf` ✓ (Step 1); test ✓ (Step 4).
- **Placeholders:** full code in every step.
- **Type consistency:** `ShopItem` (existing) reused; `ShopPreview` props match the call; `sections: [string, ShopItem[]][]` mutable for the `More` push; `export function CosmeticShop` matches the test import.
- **Note:** `CosmeticShop` is rendered inside `Profile` (unchanged call site `<CosmeticShop s={s} />`); exporting it is additive.
