import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@wc/db';
import { ensureCosmetics, listCosmetics, buyCosmetic, equipCosmetic, CATALOG } from './cosmetics';

const prisma = new PrismaClient();

async function clean() {
  await prisma.userCosmetic.deleteMany();
  await prisma.pointLedger.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.user.deleteMany();
  await prisma.cosmeticItem.deleteMany();
}

beforeAll(async () => { await clean(); });
afterAll(async () => { await clean(); await prisma.$disconnect(); });

describe('ensureCosmetics', () => {
  it('seeds the catalog (idempotent — run twice, count stable)', async () => {
    await ensureCosmetics(prisma);
    const count1 = await prisma.cosmeticItem.count();
    expect(count1).toBe(CATALOG.length);

    await ensureCosmetics(prisma);
    const count2 = await prisma.cosmeticItem.count();
    expect(count2).toBe(CATALOG.length);
  });
});

describe('buyCosmetic', () => {
  let userId: bigint;

  beforeAll(async () => {
    // Create a user with a GLOBAL wallet of 1000
    const user = await prisma.user.create({
      data: { email: 'shop-buyer@test.io', passwordHash: 'x' },
    });
    userId = user.id;
    await prisma.wallet.create({ data: { userId, contextType: 'GLOBAL', balance: 1000n } });
    await ensureCosmetics(prisma);
  });

  it('buys a 500-price item: balance becomes 500, UserCosmetic created, PURCHASE ledger -500', async () => {
    // avatar_ora costs 500
    const result = await buyCosmetic(prisma, userId, 'avatar_ora');
    expect(result.ok).toBe(true);
    expect(result.balance).toBe(500n);

    const wallet = await prisma.wallet.findFirstOrThrow({ where: { userId, contextType: 'GLOBAL' } });
    expect(wallet.balance).toBe(500n);

    const item = await prisma.cosmeticItem.findUniqueOrThrow({ where: { code: 'avatar_ora' } });
    const uc = await prisma.userCosmetic.findUnique({ where: { userId_itemId: { userId, itemId: item.id } } });
    expect(uc).not.toBeNull();

    const ledger = await prisma.pointLedger.findMany({ where: { userId, type: 'PURCHASE' } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].amount).toBe(-500n);
    expect(ledger[0].balanceAfter).toBe(500n);
    expect(ledger[0].refType).toBe('COSMETIC');
    expect(ledger[0].refId).toBe(item.id);
  });

  it('buying the same item again throws ALREADY_OWNED', async () => {
    await expect(buyCosmetic(prisma, userId, 'avatar_ora')).rejects.toThrow('ALREADY_OWNED');
  });

  it('buying a 2000-price item with 500 balance throws INSUFFICIENT_BALANCE', async () => {
    // theme_golazo costs 2000, user only has 500
    await expect(buyCosmetic(prisma, userId, 'theme_golazo')).rejects.toThrow('INSUFFICIENT_BALANCE');
  });

  it('unknown code throws ITEM_NOT_FOUND', async () => {
    await expect(buyCosmetic(prisma, userId, 'nonexistent_code')).rejects.toThrow('ITEM_NOT_FOUND');
  });
});

describe('equipCosmetic', () => {
  let userId: bigint;
  let item1Id: bigint;
  let item2Id: bigint;

  beforeAll(async () => {
    // Create a fresh user with enough balance to buy two frames
    const user = await prisma.user.create({
      data: { email: 'shop-equip@test.io', passwordHash: 'x' },
    });
    userId = user.id;
    await prisma.wallet.create({ data: { userId, contextType: 'GLOBAL', balance: 5000n } });
    await ensureCosmetics(prisma);

    // Buy two frame items (frame_gold: 300, frame_fire: 700)
    await buyCosmetic(prisma, userId, 'frame_gold');
    await buyCosmetic(prisma, userId, 'frame_fire');

    const i1 = await prisma.cosmeticItem.findUniqueOrThrow({ where: { code: 'frame_gold' } });
    const i2 = await prisma.cosmeticItem.findUniqueOrThrow({ where: { code: 'frame_fire' } });
    item1Id = i1.id;
    item2Id = i2.id;
  });

  it('equipping one frame equips it and leaves others unequipped', async () => {
    const r1 = await equipCosmetic(prisma, userId, item1Id);
    expect(r1.ok).toBe(true);

    const uc1 = await prisma.userCosmetic.findUnique({ where: { userId_itemId: { userId, itemId: item1Id } } });
    expect(uc1?.equipped).toBe(true);

    // item2 should still be unequipped
    const uc2 = await prisma.userCosmetic.findUnique({ where: { userId_itemId: { userId, itemId: item2Id } } });
    expect(uc2?.equipped).toBe(false);
  });

  it('equipping a second frame of same kind unequips the first', async () => {
    await equipCosmetic(prisma, userId, item2Id);

    const uc1 = await prisma.userCosmetic.findUnique({ where: { userId_itemId: { userId, itemId: item1Id } } });
    expect(uc1?.equipped).toBe(false);

    const uc2 = await prisma.userCosmetic.findUnique({ where: { userId_itemId: { userId, itemId: item2Id } } });
    expect(uc2?.equipped).toBe(true);
  });

  it('equipping an item not owned by the user throws NOT_OWNED', async () => {
    const unownedItem = await prisma.cosmeticItem.findUniqueOrThrow({ where: { code: 'theme_night' } });
    await expect(equipCosmetic(prisma, userId, unownedItem.id)).rejects.toThrow('NOT_OWNED');
  });
});
