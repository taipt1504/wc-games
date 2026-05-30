/**
 * @wc/risk — anti-abuse risk engine (PRD §16 / §09 ADMIN-02).
 * Heuristic scan over lobbies to flag patterns that look like real-money abuse:
 * small lobbies with borrowing (collusion), high borrow volume, heavy borrowers.
 * Creates one OPEN RiskFlag per flagged lobby (idempotent). Admin reviews/acts.
 */
import type { PrismaClient } from '@wc/db';

export interface RiskScanResult {
  scanned: number;
  flagged: number;
}

const SMALL_LOBBY = 2;
const HIGH_BORROW = 500n;

export async function scanLobbyRisk(prisma: PrismaClient): Promise<RiskScanResult> {
  const lobbies = await prisma.lobby.findMany({ include: { memberships: true } });
  let flagged = 0;

  for (const lobby of lobbies) {
    const members = lobby.memberships.length;
    const totalBorrowed = lobby.memberships.reduce((sum, m) => sum + m.borrowed, 0n);
    const heavyBorrowers = lobby.memberships.filter((m) => m.borrowed >= HIGH_BORROW).length;

    const reasons: string[] = [];
    let score = 0;
    if (members > 0 && members <= SMALL_LOBBY && totalBorrowed > 0n) {
      reasons.push('Small lobby with borrowing (collusion risk)');
      score += 50;
    }
    if (totalBorrowed >= HIGH_BORROW) {
      reasons.push('High borrow volume');
      score += 30;
    }
    if (heavyBorrowers > 0) {
      reasons.push('Member at high borrow exposure');
      score += 20;
    }
    if (!reasons.length) continue;

    const severity = score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low';
    const existing = await prisma.riskFlag.findFirst({
      where: { targetType: 'LOBBY', targetId: lobby.id, status: 'OPEN' },
    });
    if (!existing) {
      await prisma.riskFlag.create({
        data: { targetType: 'LOBBY', targetId: lobby.id, rule: reasons.join('; '), severity, status: 'OPEN' },
      });
      flagged++;
    }
  }

  return { scanned: lobbies.length, flagged };
}
