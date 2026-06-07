import { PrismaClient as BasePrismaClient } from '@prisma/client';

export * from '@prisma/client';

/**
 * Test-database guard. The integration suites (`*.int.test.ts`) wipe whole tables in their
 * `clean()` helpers (`deleteMany()`), so running them against the dev/prod DB destroys real
 * data. To make that impossible by accident, the guarded `PrismaClient` below refuses to
 * construct under a test runner (`VITEST` set) unless `DATABASE_URL` points at the dedicated
 * test DB named by `TEST_DATABASE_URL`. App/worker runtime (no `VITEST`) is unaffected.
 */
function assertTestDbWhenUnderVitest(): void {
  if (!process.env.VITEST) return; // only fires under the test runner
  const url = process.env.DATABASE_URL ?? '';
  const testUrl = process.env.TEST_DATABASE_URL ?? '';
  if (testUrl && url === testUrl) return; // explicitly pointed at the designated test DB
  const redacted = url.replace(/:\/\/[^@]*@/, '://***@');
  throw new Error(
    'Refusing to construct PrismaClient under a test runner against a non-test database. ' +
      'Integration tests wipe tables and would destroy this data. ' +
      'Set TEST_DATABASE_URL to a dedicated test database and ensure DATABASE_URL === TEST_DATABASE_URL. ' +
      `Current DATABASE_URL=${redacted || '(unset)'}.`,
  );
}

/** Guarded re-export — shadows the star-exported `PrismaClient` (local export wins). */
export class PrismaClient extends BasePrismaClient {
  constructor(...args: ConstructorParameters<typeof BasePrismaClient>) {
    assertTestDbWhenUnderVitest();
    super(...args);
  }
}

/**
 * Singleton PrismaClient — tránh tạo nhiều connection khi hot-reload (Next.js dev).
 */
const globalForPrisma = globalThis as unknown as { prisma?: BasePrismaClient };

// Uses the UNGUARDED base client: the singleton is imported app-wide (and by some unit tests),
// so it must never trip the test-DB guard merely by being imported. The guard lives only on the
// exported `PrismaClient` class that integration tests construct explicitly.
export const prisma =
  globalForPrisma.prisma ??
  new BasePrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
