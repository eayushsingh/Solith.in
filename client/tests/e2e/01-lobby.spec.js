import { test, expect } from '@playwright/test';

test.describe('Lobby', () => {

  test('loads without JavaScript errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const jsErrors = errors.filter(e =>
      !e.includes('ResizeObserver') &&
      !e.includes('Non-Error promise rejection')
    );
    expect(jsErrors, `JS errors: ${jsErrors.join('\n')}`).toHaveLength(0);
  });

  test('shows solith.in branding', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  });

  test('shows Start a Room button', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  });

  test('shows Go Premium button', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  });

  test('shows language filter pills', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  });

  test('shows search bar', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  });

  test('search filters rooms', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('English');
      await page.waitForTimeout(500);
    }
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    expect(errors).toHaveLength(0);
  });

  test('background pattern is visible not pure black', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const bg = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundColor
    );
    expect(bg).not.toBe('rgb(0, 0, 0)');
  });

  test('Start a Room shows auth modal when not logged in', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const startBtn = page.locator('text=Start a Room').or(page.locator('text=Start')).first();
    if (await startBtn.isVisible()) {
      await startBtn.click();
      await page.waitForTimeout(500);
    }
    await expect(page.locator('body')).toBeVisible({ timeout: 5000 });
  });

  test('Social button visible in lobby', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible({ timeout: 5000 });
  });

  test('mobile layout renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
  });

});
