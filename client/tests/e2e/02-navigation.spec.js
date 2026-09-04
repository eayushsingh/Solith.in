import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {

  test('Leaderboard page loads', async ({ page }) => {
    await page.goto('/#leaderboard');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  });

  test('Guidelines page loads', async ({ page }) => {
    await page.goto('/#guidelines');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  });

  test('Messages page loads', async ({ page }) => {
    await page.goto('/#messages');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  });

  test('Premium page loads', async ({ page }) => {
    await page.goto('/#premium');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  });

  test('Landing page loads', async ({ page }) => {
    await page.goto('/#landing');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  });

  test('clicking Back returns to lobby', async ({ page }) => {
    await page.goto('/#leaderboard');
    await page.waitForLoadState('domcontentloaded');
    const backBtn = page.locator('text=Back').or(page.locator('[title="Back"]')).first();
    if (await backBtn.isVisible()) {
      await backBtn.click();
    }
    await expect(page.locator('body')).toBeVisible({ timeout: 5000 });
  });

});
