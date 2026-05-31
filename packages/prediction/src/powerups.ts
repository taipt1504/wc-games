/**
 * @wc/prediction — Power-up inventory (DEPTH-04).
 * PRD §06: Double Down / Insurance / Streak Shield.
 */
import type { PrismaClient } from '@wc/db';

export type PowerUpType = 'DOUBLE_DOWN' | 'INSURANCE' | 'STREAK_SHIELD';

export const POWERUP_PRICES: Record<PowerUpType, bigint> = {
  DOUBLE_DOWN: 300n,
  INSURANCE: 200n,
  STREAK_SHIELD: 400n,
};

const VALID_TYPES = new Set<string>(['DOUBLE_DOWN', 'INSURANCE', 'STREAK_SHIELD']);

function assertValidType(type: string): asserts type is PowerUpType {
  if (!VALID_TYPES.has(type)) throw new Error('INVALID_POWERUP_TYPE');
}

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/** Buy 1 power-up: debit GLOBAL wallet (PURCHASE ledger, refType='POWERUP') → upsert PowerUp qty+1. */
export async function buyPowerUp(
  prisma: PrismaClient,
  userId: bigint,
  type: string,
): Promise<void> {
  assertValidType(type);
  const price = POWERUP_PRICES[type];

  await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findFirstOrThrow({
      where: { userId, contextType: 'GLOBAL', contextId: null },
    });
    if (wallet.balance < price) throw new Error('INSUFFICIENT_BALANCE');

    const newBal = wallet.balance - price;
    await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBal } });

    const existing = await tx.powerUp.findUnique({ where: { userId_type: { userId, type } } });
    await tx.powerUp.upsert({
      where: { userId_type: { userId, type } },
      create: { userId, type, qty: 1 },
      update: { qty: (existing?.qty ?? 0) + 1 },
    });

    await tx.pointLedger.create({
      data: {
        userId,
        contextType: 'GLOBAL',
        contextId: null,
        type: 'PURCHASE',
        amount: -price,
        balanceAfter: newBal,
        refType: 'POWERUP',
        refId: null,
      },
    });
  });
}

/** Grant n power-ups to a user without charging (test/admin helper). */
export async function grantPowerUp(
  prisma: PrismaClient,
  userId: bigint,
  type: string,
  n = 1,
): Promise<void> {
  assertValidType(type);
  const existing = await prisma.powerUp.findUnique({ where: { userId_type: { userId, type } } });
  await prisma.powerUp.upsert({
    where: { userId_type: { userId, type } },
    create: { userId, type, qty: n },
    update: { qty: (existing?.qty ?? 0) + n },
  });
}

/** Return the user's current power-up inventory as a {type: qty} map. */
export async function listPowerUps(
  prisma: PrismaClient,
  userId: bigint,
): Promise<Record<string, number>> {
  const rows = await prisma.powerUp.findMany({ where: { userId } });
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.type] = row.qty;
  }
  return result;
}

/** Consume 1 of a power-up from inventory inside an existing transaction. Throws NO_POWERUP if qty < 1. */
export async function consumePowerUp(tx: Tx, userId: bigint, type: string): Promise<void> {
  const row = await tx.powerUp.findUnique({ where: { userId_type: { userId, type } } });
  if (!row || row.qty < 1) throw new Error('NO_POWERUP');
  await tx.powerUp.update({
    where: { userId_type: { userId, type } },
    data: { qty: row.qty - 1 },
  });
}
