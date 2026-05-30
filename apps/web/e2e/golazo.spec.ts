import { test, expect } from '@playwright/test';

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

  test('register then place a real bet — persists via POST /predictions', async ({ page }) => {
    await registerNewUser(page, 'bet');
    await expect(page.getByText("Today's matches")).toBeVisible();
    // open a scheduled match's odds -> bet slip
    await page.locator('.odds:not([disabled])').first().click();
    await expect(page.getByText('Bet slip')).toBeVisible();
    // confirm at the default stake -> hits the real API + DB
    await page.getByRole('button', { name: /Confirm bet/i }).click();
    await expect(page.getByText(/Bet placed/i)).toBeVisible();
  });
});
