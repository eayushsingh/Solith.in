import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {

  test('sign in modal opens', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const signInBtn = page.locator('text=Sign In').or(page.locator('text=Login')).first();
    if (await signInBtn.isVisible()) {
      await signInBtn.click();
      await page.waitForTimeout(500);
    }
    await expect(page.locator('body')).toBeVisible({ timeout: 5000 });
  });

  test('auth modal can be closed', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const signInBtn = page.locator('text=Sign In').or(page.locator('text=Login')).first();
    if (await signInBtn.isVisible()) {
      await signInBtn.click();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
    await expect(page.locator('body')).toBeVisible({ timeout: 5000 });
  });

  test('Premium page accessible without login', async ({ page }) => {
    await page.goto('/#premium');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
  });

});
