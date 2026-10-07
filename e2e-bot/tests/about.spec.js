import { test, expect } from '@playwright/test';

test.describe('About Section Navigation & Interactivity', () => {
  test('About view loads and displays guided walkthrough and FAQ items', async ({ page }) => {
    await page.goto('http://localhost:5173/#about');

    // Verify main title renders
    const title = page.locator('h1');
    await expect(title).toContainText('Master Languages');

    // Verify step cards render
    const stepCards = page.locator('text="How solith.in Works"');
    await expect(stepCards).toBeVisible();

    // Verify FAQ items render
    const faqHeader = page.locator('text="Frequently Asked Questions"');
    await expect(faqHeader).toBeVisible();
  });
});
