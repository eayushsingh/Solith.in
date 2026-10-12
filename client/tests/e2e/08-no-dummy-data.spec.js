import { test, expect } from '@playwright/test';

test.describe('Zero Dummy Data E2E Regression Suite', () => {

  test('Leaderboard page does not display legacy mock users', async ({ page }) => {
    await page.goto('/#leaderboard');
    await page.waitForLoadState('domcontentloaded');

    // Ensure mock user legacy IDs are never present in DOM
    const mockIds = ['def_1', 'def_2', 'def_3', 'def_4', 'def_5'];
    for (const id of mockIds) {
      const mockElement = page.locator(`[data-user-id="${id}"]`);
      await expect(mockElement).toHaveCount(0);
    }
  });

  test('Community feed does not render post_def_1 mock post', async ({ page }) => {
    await page.goto('/#community');
    await page.waitForLoadState('domcontentloaded');

    const mockPost = page.locator('[data-post-id="post_def_1"]');
    await expect(mockPost).toHaveCount(0);
  });

  test('Global chat does not render welcome_1 bot message', async ({ page }) => {
    await page.goto('/#chat');
    await page.waitForLoadState('domcontentloaded');

    const mockBotMessage = page.locator('[data-message-id="welcome_1"]');
    await expect(mockBotMessage).toHaveCount(0);
  });

  test('LocalStorage cache is sanitized of mock leaderboard items', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const cacheKeys = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      return keys.filter(k => k.startsWith('solith_leaderboard_cache_'));
    });

    for (const key of cacheKeys) {
      const cached = await page.evaluate((k) => localStorage.getItem(k), key);
      expect(cached).not.toContain('Sophia Chen');
      expect(cached).not.toContain('def_1');
    }
  });

});
