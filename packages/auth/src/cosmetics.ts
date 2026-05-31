/**
 * Cosmetic shop service (AIMETA-02) — buy avatar/frame/theme cosmetics as a point sink.
 * Source of truth: PRD §08.
 */
import type { PrismaClient } from '@wc/db';

// ─────────────────────────── CATALOG ───────────────────────────

export interface CatalogEntry {
  code: string;
  name: string;
  kind: string;
  price: bigint;
}

export const CATALOG: CatalogEntry[] = [
  { code: 'avatar_ora',   name: 'Ora Avatar',      kind: 'avatar', price: 500n  },
  { code: 'avatar_nova',  name: 'Nova Avatar',     kind: 'avatar', price: 800n  },
  { code: 'frame_gold',   name: 'Gold Frame',      kind: 'frame',  price: 300n  },
  { code: 'frame_fire',   name: 'Fire Frame',      kind: 'frame',  price: 700n  },
  { code: 'theme_night',  name: 'Night Theme',     kind: 'theme',  price: 1200n },
  { code: 'theme_golazo', name: 'Golazo Theme',    kind: 'theme',  price: 2000n },
];

/** Upsert all CATALOG rows by code. Idempotent. */
export async function ensureCosmetics(prisma: PrismaClient): Promise<void> {
  await Promise.all(
    CATALOG.map((item) =>
      prisma.cosmeticItem.upsert({
        where:  { code: item.code },
        create: { code: item.code, name: item.name, kind: item.kind, price: item.price },
        update: { name: item.name, kind: item.kind, price: item.price },
      }),
    ),
  );
}

// ─────────────────────────── LIST ───────────────────────────

export interface CosmeticListItem {
  id: bigint;
  code: string;
  name: string;
  kind: string;
  price: bigint;
  owned: boolean;
  equipped: boolean;
}

/**
 * Ensure catalog exists, then return all items with owned/equipped flags for this user.
 */
export async function listCosmetics(
  prisma: PrismaClient,
  userId: bigint,
): Promise<CosmeticListItem[]> {
  await ensureCosmetics(prisma);

  const [items, userCosmetics] = await Promise.all([
    prisma.cosmeticItem.findMany({ orderBy: [{ kind: 'asc' }, { price: 'asc' }] }),
    prisma.userCosmetic.findMany({ where: { userId } }),
  ]);

  const ownedMap = new Map<bigint, { equipped: boolean }>();
  for (const uc of userCosmetics) {
    ownedMap.set(uc.itemId, { equipped: uc.equipped });
  }

  return items.map((item) => {
    const entry = ownedMap.get(item.id);
    return {
      id:       item.id,
      code:     item.code,
      name:     item.name,
      kind:     item.kind,
      price:    item.price,
      owned:    !!entry,
      equipped: entry?.equipped ?? false,
    };
  });
}

// ─────────────────────────── BUY ───────────────────────────

export interface BuyResult {
  ok: true;
  balance: bigint;
}

/**
 * Buy a cosmetic item for the user.
 * Throws: 'ITEM_NOT_FOUND' | 'ALREADY_OWNED' | 'INSUFFICIENT_BALANCE'
 */
export async function buyCosmetic(
  prisma: PrismaClient,
  userId: bigint,
  code: string,
): Promise<BuyResult> {
  const item = await prisma.cosmeticItem.findUnique({ where: { code } });
  if (!item) throw new Error('ITEM_NOT_FOUND');

  const alreadyOwned = await prisma.userCosmetic.findUnique({
    where: { userId_itemId: { userId, itemId: item.id } },
  });
  if (alreadyOwned) throw new Error('ALREADY_OWNED');

  const wallet = await prisma.wallet.findFirstOrThrow({
    where: { userId, contextType: 'GLOBAL', contextId: null },
  });
  if (wallet.balance < item.price) throw new Error('INSUFFICIENT_BALANCE');

  const newBalance = wallet.balance - item.price;

  await prisma.$transaction(async (tx) => {
    await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBalance } });
    await tx.pointLedger.create({
      data: {
        userId,
        contextType: 'GLOBAL',
        type: 'PURCHASE',
        amount: -item.price,
        balanceAfter: newBalance,
        refType: 'COSMETIC',
        refId: item.id,
      },
    });
    await tx.userCosmetic.create({ data: { userId, itemId: item.id, equipped: false } });
  });

  return { ok: true, balance: newBalance };
}

// ─────────────────────────── EQUIP ───────────────────────────

export interface EquipResult {
  ok: true;
}

/**
 * Equip a cosmetic item. Unequips other owned items of the same kind (one equipped per kind).
 * Throws: 'NOT_OWNED'
 */
export async function equipCosmetic(
  prisma: PrismaClient,
  userId: bigint,
  itemId: bigint,
): Promise<EquipResult> {
  const owned = await prisma.userCosmetic.findUnique({
    where: { userId_itemId: { userId, itemId } },
  });
  if (!owned) throw new Error('NOT_OWNED');

  const item = await prisma.cosmeticItem.findUniqueOrThrow({ where: { id: itemId } });

  // Find all user-owned items of the same kind to unequip them
  const sameKindItems = await prisma.cosmeticItem.findMany({ where: { kind: item.kind } });
  const sameKindIds = sameKindItems.map((i) => i.id);

  await prisma.$transaction(async (tx) => {
    // Unequip all owned items of the same kind
    await tx.userCosmetic.updateMany({
      where: { userId, itemId: { in: sameKindIds }, equipped: true },
      data: { equipped: false },
    });
    // Equip the target item
    await tx.userCosmetic.update({
      where: { userId_itemId: { userId, itemId } },
      data: { equipped: true },
    });
  });

  return { ok: true };
}
