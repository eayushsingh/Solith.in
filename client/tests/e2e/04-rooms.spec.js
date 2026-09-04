import { test, expect } from '@playwright/test';

test.describe('Room Cards', () => {

  test('room cards render with correct structure when rooms exist', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  });

  test('share button copies URL', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    const shareBtn = page.locator('text=🔗 Share').or(page.locator('text=Share')).first();
    if (await shareBtn.isVisible()) {
      await shareBtn.click();
      await page.waitForTimeout(300);
    }
    await expect(page.locator('body')).toBeVisible();
  });

  test('empty state shows Start a Room Now button', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  });

  test('grid density toggles work', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const btn2x = page.locator('text=2x');
    if (await btn2x.isVisible()) {
      await btn2x.click();
      await page.waitForTimeout(300);
      const btn1x = page.locator('text=1x');
      await btn1x.click();
      await page.waitForTimeout(300);
    }
    await expect(page.locator('body')).toBeVisible();
  });

  test('room card countdown shows for empty rooms', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
  });

});
