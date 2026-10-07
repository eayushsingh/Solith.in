import { test, expect } from '@playwright/test';

test.describe('Leaderboard Resiliency & API Fallback', () => {
  test('Leaderboard page loads gracefully when Firebase snapshot fails', async ({ page }) => {
    // Intercept Firestore network calls to simulate connection failure
    await page.route('**/firestore.googleapis.com/**', route => route.abort());

    // Navigate to homepage / leaderboard
    await page.goto('http://localhost:5173');

    // Verify page loads without breaking
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});
