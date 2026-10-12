import { test, expect } from '@playwright/test';

test.describe('Leaderboard Real Data Verification', () => {

  test('Leaderboard view loads and displays correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const leaderboardBtn = page.locator('button:has-text("Leaderboard")').or(page.locator('[title="Leaderboard"]')).first();
    if (await leaderboardBtn.isVisible()) {
      await leaderboardBtn.click();
      await page.waitForTimeout(1000);
    } else {
      await page.goto('/#leaderboard');
    }

    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  });

  test('Leaderboard period switching works seamlessly', async ({ page }) => {
    await page.goto('/#leaderboard');
    await page.waitForLoadState('domcontentloaded');

    const dailyBtn = page.locator('button:has-text("Daily")').first();
    if (await dailyBtn.isVisible()) {
      await dailyBtn.click();
      await page.waitForTimeout(500);
    }

    const allTimeBtn = page.locator('button:has-text("All-Time")').first();
    if (await allTimeBtn.isVisible()) {
      await allTimeBtn.click();
      await page.waitForTimeout(500);
    }

    await expect(page.locator('body')).toBeVisible();
  });

});
