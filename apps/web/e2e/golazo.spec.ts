import { test, expect } from '@playwright/test';

test.describe('GOLAZO — guest + auth flows', () => {
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

  test('login reaches the Home dashboard with points', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Claim your 1,000 points/i }).click();
    await page.getByRole('button', { name: /Claim 1,000 points & play/i }).click();
    await expect(page.getByText(/Hey Alex/)).toBeVisible();
    await expect(page.getByText("Today's matches")).toBeVisible();
  });

  test('authed user opens bet slip from a match', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Claim your 1,000 points/i }).click();
    await page.getByRole('button', { name: /Claim 1,000 points & play/i }).click();
    await expect(page.getByText(/Hey Alex/)).toBeVisible();
    // open first scheduled match's odds from Today's matches -> bet slip overlay
    await page.locator('.odds:not([disabled])').first().click();
    await expect(page.locator('.overlay, .modal').first()).toBeVisible();
  });
});
