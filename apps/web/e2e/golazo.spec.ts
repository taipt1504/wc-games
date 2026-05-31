import { test, expect } from '@playwright/test';
import { PrismaClient } from '@wc/db';
import { settleMatch, placeBet } from '@wc/prediction';
import { registerUser } from '@wc/auth';

const TEST_DB = 'postgresql://wc:wc@localhost:5433/wc_game';
async function withDb<T>(fn: (p: PrismaClient) => Promise<T>): Promise<T> {
  const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB } } });
  try {
    return await fn(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

test.describe('GOLAZO — guest browse', () => {
  test('landing renders hero + primary CTA', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('WHOLE WORLD CUP')).toBeVisible();
    await expect(page.getByRole('button', { name: /Claim your 1,000 points/i })).toBeVisible();
  });

  test('guest browses Matches via public nav', async ({ page }) => {
    await page.goto('/');
    await page.locator('.pub-nav').getByText('Matches').click();
    await expect(page.getByText('Match schedule')).toBeVisible();
  });

  test('guest browses public Leaderboard with conversion CTA', async ({ page }) => {
    await page.goto('/');
    await page.locator('.pub-nav').getByText('Leaderboard').click();
    await expect(page.getByText(/Join the board/i)).toBeVisible();
  });

  test('Sign up free opens the auth screen', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /^Sign up free$/ }).click();
    await expect(page.getByText('Create your account')).toBeVisible();
  });
});

test.describe('GOLAZO — real flow (live API + Postgres)', () => {
  async function registerNewUser(page: import('@playwright/test').Page, tag: string) {
    await page.goto('/');
    await page.getByRole('button', { name: /Claim your 1,000 points/i }).click();
    const email = `e2e_${Date.now()}_${tag}@golazo.test`;
    await page.getByPlaceholder('you@email.com').fill(email);
    await page.locator('input[type="password"]').fill('password123');
    await page.getByRole('button', { name: /Claim 1,000 points & play/i }).click();
  }

  test('register via real API reaches the Home dashboard', async ({ page }) => {
    await registerNewUser(page, 'home');
    await expect(page.getByText("Today's matches")).toBeVisible();
    await expect(page.getByText(/Hey /)).toBeVisible();
  });

  test('register -> place bet -> read back persisted bet + ledger from Postgres', async ({ page }) => {
    await registerNewUser(page, 'bet');
    await expect(page.getByText("Today's matches")).toBeVisible();
    // open a scheduled match's odds -> bet slip
    await page.locator('.odds:not([disabled])').first().click();
    await expect(page.getByText('Bet slip')).toBeVisible();
    // confirm at the default stake -> POST /predictions (real escrow in DB)
    await page.getByRole('button', { name: /Confirm bet/i }).click();
    await expect(page.getByText(/Bet placed/i)).toBeVisible();

    // read-back: My Bets shows the persisted OPEN bet (refreshUser -> GET /me/predictions)
    await page.locator('.rail').getByText('My bets').click();
    await expect(page.getByText('OPEN').first()).toBeVisible();

    // Wallet shows the persisted ledger read from Postgres (signup grant + the stake)
    await page.locator('.rail').getByText('Wallet').click();
    await expect(page.getByText('Welcome bonus')).toBeVisible();
    await expect(page.getByText('Stake placed')).toBeVisible();
  });

  test('full journey: register -> bet -> settle -> ranked on the live leaderboard', async ({ page }) => {
    // fresh slate so this user is the only ranked predictor and match 27 is unsettled
    await withDb(async (p) => {
      await p.pointLedger.deleteMany();
      await p.prediction.deleteMany();
      await p.settlement.deleteMany();
      await p.predictionUserStats.deleteMany();
      await p.wallet.deleteMany();
      await p.user.deleteMany();
    });

    const handle = `journey${Date.now()}`;
    await page.goto('/');
    await page.getByRole('button', { name: /Claim your 1,000 points/i }).click();
    await page.getByPlaceholder('you@email.com').fill(`${handle}@golazo.test`);
    await page.locator('input[type="password"]').fill('password123');
    await page.getByRole('button', { name: /Claim 1,000 points & play/i }).click();
    await expect(page.getByText("Today's matches")).toBeVisible();

    // bet HOME on the first scheduled match (match 27)
    await page.locator('.odds:not([disabled])').first().click();
    await page.getByRole('button', { name: /Confirm bet/i }).click();
    await expect(page.getByText(/Bet placed/i)).toBeVisible();

    // settle that match (HOME win) — simulates the settlement worker
    await withDb((p) => settleMatch(p, 27n, { home: 2, away: 1 }));

    // the live leaderboard (GET /api/v1/leaderboard) now ranks this user
    await page.locator('.rail').getByText('Leaderboard').click();
    // ranked user appears in both the podium card and the table row -> .first()
    await expect(page.getByText(handle).first()).toBeVisible();
  });

  test('register -> create a private lobby -> appears in Your lobbies (live)', async ({ page }) => {
    await registerNewUser(page, 'lobby');
    await expect(page.getByText("Today's matches")).toBeVisible();
    await page.locator('.rail').getByText('Lobbies').click();
    await page.getByRole('button', { name: /^Create lobby$/i }).click();
    await expect(page.getByText('Create a lobby')).toBeVisible();
    const lobbyName = `Crew ${Date.now()}`;
    await page.getByPlaceholder('Office League · ABC Corp').fill(lobbyName);
    await page.getByRole('button', { name: /Create lobby & get invite link/i }).click();
    // back on the Lobbies list -> the new lobby (POST /api/v1/lobbies) is listed
    await expect(page.getByText(lobbyName)).toBeVisible();
  });
});

test.describe('GOLAZO — live scores (DATA-07)', () => {
  test('a LIVE match surfaces on the public live feed', async ({ page }) => {
    const liveId = BigInt(Date.now());
    await withDb(async (p) => {
      await p.match.create({
        data: { id: liveId, round: 'GROUP', homeTeamId: 5n, awayTeamId: 6n, kickoffAt: new Date(Date.now() - 600_000), status: 'LIVE', scoreHome90: 1, scoreAway90: 0 },
      });
    });
    await page.goto('/');
    const res = await page.request.get('/api/v1/matches/live');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const m = (body.data as { id: number; home: number; away: number }[]).find((x) => x.id === Number(liveId));
    expect(m).toBeTruthy();
    expect(m!.home).toBe(1);
    expect(m!.away).toBe(0);
  });
});

test.describe('GOLAZO — exact-score knockout bonus (FR-SCORE-03)', () => {
  test('bettor calls an exact knockout score via the live API -> settle awards the bonus', async ({ page }) => {
    const stamp = Date.now();
    const email = `ko_${stamp}@golazo.test`;
    // The fixture set is all group-stage; seed a knockout match so the bonus path applies.
    // Explicit per-run id: fixtures occupy 1..72 (seeded with explicit ids, so the
    // autoincrement sequence is behind) and a unique id avoids any prior-run settlement.
    const koId = BigInt(stamp);
    await withDb(async (p) => {
      await p.match.create({
        data: { id: koId, round: 'R16', homeTeamId: 5n, awayTeamId: 6n, kickoffAt: new Date(Date.now() + 3_600_000), status: 'SCHEDULED' },
      });
      await p.matchOdds.create({ data: { matchId: koId, mHome: 1.0, mDraw: 1.2, mAway: 1.6, source: 'API' } });
    });

    // register via UI -> real session cookie in the browser context
    await page.goto('/');
    await page.getByRole('button', { name: /Claim your 1,000 points/i }).click();
    await page.getByPlaceholder('you@email.com').fill(email);
    await page.locator('input[type="password"]').fill('password123');
    await page.getByRole('button', { name: /Claim 1,000 points & play/i }).click();
    await expect(page.getByText("Today's matches")).toBeVisible();

    // place a HOME bet @1.0 with an exact 2-1 call via the real API (carries the auth cookie)
    const res = await page.request.post('/api/v1/predictions', {
      data: { matchId: Number(koId), outcome: '1', stake: 100, exactHome: 2, exactAway: 1 },
    });
    expect(res.ok()).toBeTruthy();

    // settle exactly 2-1 -> base 200 (1X2) + knockout exact bonus 100 = 300
    await withDb((p) => settleMatch(p, koId, { home: 2, away: 1 }));
    const pred = await withDb((p) => p.prediction.findFirstOrThrow({ where: { matchId: koId }, orderBy: { id: 'desc' } }));
    expect(pred.status).toBe('WON');
    expect(pred.exactHome).toBe(2);
    expect(Number(pred.payout)).toBe(300);
  });
});

test.describe('GOLAZO — admin console (live API + Postgres)', () => {
  test('admin logs in, reads real users, bans a victim (read + write paths)', async ({ page }) => {
    const stamp = Date.now();
    const adminEmail = `admin_${stamp}@golazo.test`;
    const victimEmail = `victim_${stamp}@golazo.test`;
    // Seed an ADMIN + a victim USER right before login. The journey test wipes the
    // users table mid-run, so a global-setup admin would be gone — seed per-test.
    await withDb(async (p) => {
      await registerUser(p, { email: adminEmail, username: `admin${stamp}`, password: 'password123' });
      await p.user.update({ where: { email: adminEmail }, data: { role: 'ADMIN' } });
      await registerUser(p, { email: victimEmail, username: `victim${stamp}`, password: 'password123' });
    });

    // log in through the real auth UI as the admin
    await page.goto('/');
    await page.getByRole('button', { name: /I have an account/i }).click();
    await expect(page.getByText('Welcome back')).toBeVisible();
    await page.getByPlaceholder('you@email.com').fill(adminEmail);
    await page.locator('input[type="password"]').fill('password123');
    await page.getByRole('button', { name: 'Log in' }).last().click();
    await expect(page.getByText("Today's matches")).toBeVisible();

    // role-gated Admin nav appears only for admins (GET /me -> role) -> open the console
    await page.locator('.rail').getByRole('button', { name: 'Admin', exact: true }).click();
    await expect(page.getByText('Admin Console')).toBeVisible();

    // Users tab: real DB users are listed (read-side, GET /api/v1/admin/users)
    await page.getByRole('button', { name: 'Users', exact: true }).click();
    await expect(page.getByText('User management')).toBeVisible();
    await expect(page.getByText(victimEmail)).toBeVisible();

    // open the victim -> Ban (write-side, POST /admin/users/:id/ban) -> status flips
    await page.getByText(victimEmail).click();
    await expect(page.getByRole('button', { name: /Ban user/i })).toBeVisible();
    await page.getByRole('button', { name: /Ban user/i }).click();
    await expect(page.getByText('banned').first()).toBeVisible();

    // and it's persisted: the user row is BANNED in Postgres
    const banned = await withDb((p) => p.user.findUnique({ where: { email: victimEmail } }));
    expect(banned?.status).toBe('BANNED');
  });

  test('admin approves an AI news draft -> it appears on the public feed (human-in-the-loop)', async ({ page }) => {
    const stamp = Date.now();
    const adminEmail = `newsadmin_${stamp}@golazo.test`;
    const SPAIN = 'Spain edge Germany in a tactical classic'; // seeded PENDING draft
    await withDb(async (p) => {
      await registerUser(p, { email: adminEmail, username: `newsadmin${stamp}`, password: 'password123' });
      await p.user.update({ where: { email: adminEmail }, data: { role: 'ADMIN' } });
    });

    await page.goto('/');
    await page.getByRole('button', { name: /I have an account/i }).click();
    await page.getByPlaceholder('you@email.com').fill(adminEmail);
    await page.locator('input[type="password"]').fill('password123');
    await page.getByRole('button', { name: 'Log in' }).last().click();
    await expect(page.getByText("Today's matches")).toBeVisible();

    // Admin -> Review queue -> the seeded draft is PENDING
    await page.locator('.rail').getByRole('button', { name: 'Admin', exact: true }).click();
    await page.getByRole('button', { name: 'Review queue' }).click();
    const spainCard = page.locator('.card', { hasText: SPAIN });
    await expect(spainCard).toBeVisible();
    await expect(spainCard.getByText('PENDING')).toBeVisible();

    // approve it (POST /admin/news/:id/approve) -> badge flips to PUBLISHED
    await spainCard.getByRole('button', { name: 'Approve' }).click();
    await expect(spainCard.getByText('PUBLISHED')).toBeVisible();

    // public feed (GET /api/v1/news, PUBLISHED-only) now surfaces it
    await page.getByRole('button', { name: /Back to app/i }).click();
    await page.locator('.rail').getByRole('button', { name: 'News', exact: true }).click();
    await expect(page.getByText(SPAIN).first()).toBeVisible();
  });

  test('login is captured in the immutable audit log + visible to admin (ADMIN-06)', async ({ page }) => {
    const stamp = Date.now();
    const adminEmail = `auditadmin_${stamp}@golazo.test`;
    await withDb(async (p) => {
      await registerUser(p, { email: adminEmail, username: `auditadmin${stamp}`, password: 'password123' });
      await p.user.update({ where: { email: adminEmail }, data: { role: 'ADMIN' } });
    });

    // logging in writes a LOGIN audit row (POST /auth/login captures IP/UA)
    await page.goto('/');
    await page.getByRole('button', { name: /I have an account/i }).click();
    await page.getByPlaceholder('you@email.com').fill(adminEmail);
    await page.locator('input[type="password"]').fill('password123');
    await page.getByRole('button', { name: 'Log in' }).last().click();
    await expect(page.getByText("Today's matches")).toBeVisible();

    // it's persisted in the audit log
    const loginEntry = await withDb((p) =>
      p.auditLog.findFirst({ where: { action: 'LOGIN', target: adminEmail } }),
    );
    expect(loginEntry).toBeTruthy();

    // and the admin audit view (GET /api/v1/admin/audit) surfaces LOGIN actions
    await page.locator('.rail').getByRole('button', { name: 'Admin', exact: true }).click();
    await page.getByRole('button', { name: 'Audit log' }).click();
    await expect(page.getByText('LOGIN').first()).toBeVisible();
  });

  test('admin corrects a wrong score -> re-settle flips the bet + audits it (ADMIN-04)', async ({ page }) => {
    const stamp = Date.now();
    const adminEmail = `settleadmin_${stamp}@golazo.test`;
    const bettorEmail = `bettor_${stamp}@golazo.test`;

    // a bettor backs HOME on a scheduled match; it settles HOME 2-0 so they win
    const { matchId, predId } = await withDb(async (p) => {
      await registerUser(p, { email: adminEmail, username: `settleadmin${stamp}`, password: 'password123' });
      await p.user.update({ where: { email: adminEmail }, data: { role: 'ADMIN' } });
      const bettor = await registerUser(p, { email: bettorEmail, username: `bettor${stamp}`, password: 'password123' });
      const match = await p.match.findFirstOrThrow({ where: { status: 'SCHEDULED' }, orderBy: { id: 'asc' } });
      const pred = await placeBet(p, { userId: bettor.id, matchId: match.id, pick: '1', stake: 100n });
      await settleMatch(p, match.id, { home: 2, away: 0 });
      return { matchId: match.id, predId: pred.id };
    });
    const won = await withDb((p) => p.prediction.findUniqueOrThrow({ where: { id: predId } }));
    expect(won.status).toBe('WON');

    // admin logs in, then corrects the score to an AWAY win via the role-gated re-settle API
    // (same endpoint the admin match-detail "Save score & re-settle" action calls)
    await page.goto('/');
    await page.getByRole('button', { name: /I have an account/i }).click();
    await page.getByPlaceholder('you@email.com').fill(adminEmail);
    await page.locator('input[type="password"]').fill('password123');
    await page.getByRole('button', { name: 'Log in' }).last().click();
    await expect(page.getByText("Today's matches")).toBeVisible();

    const res = await page.request.post(`/api/v1/admin/matches/${matchId}/resettle`, {
      data: { home: 0, away: 2, reason: 'API feed was wrong' },
    });
    expect(res.ok()).toBeTruthy();

    // the previously-winning bet is now LOST and the correction is in the audit log
    const after = await withDb((p) => p.prediction.findUniqueOrThrow({ where: { id: predId } }));
    expect(after.status).toBe('LOST');
    const audit = await withDb((p) => p.auditLog.findFirst({ where: { action: 'RESETTLE_MATCH', target: `match:${matchId}` } }));
    expect(audit).toBeTruthy();
  });
});
