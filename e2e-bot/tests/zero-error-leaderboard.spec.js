import { test, expect } from '@playwright/test';

test.describe('Zero Error Guarantee', () => {
  test('Leaderboard never shows connection error screen', async ({ page }) => {
    // Force fail all network requests
    await page.route('**/*', route => {
      if (route.request().url().includes('/api/') || route.request().url().includes('firestore')) {
        return route.abort();
      }
      return route.continue();
    });

    await page.goto('http://localhost:5173');

    // Assert "Firebase connection failed" text is NOT present
    const errorText = page.locator('text="Firebase connection failed"');
    await expect(errorText).toHaveCount(0);
  });
});
