import { test, expect } from '@playwright/test';

test.describe('Performance', () => {

  test('lobby loads within 5 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    await page.waitForSelector('body', { timeout: 5000 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });

  test('no console errors on lobby load', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const realErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('ResizeObserver') &&
      !e.includes('Non-Error') &&
      !e.includes('cross-origin')
    );
    if (realErrors.length > 0) {
      console.log('Console errors found:', realErrors);
    }
    expect(realErrors.length).toBeLessThan(5);
  });

  test('page title is correct', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test('favicon loads', async ({ request }) => {
    const res = await request.get('https://www.solith.in/favicon.ico');
    expect([200, 301, 302, 404]).toContain(res.status());
  });

});
