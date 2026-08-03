import { test, expect } from '@playwright/test';

test.describe('TALKFREE Core Flows', () => {

  test('Landing Page loads successfully', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173/');
    
    // Check if the landing page title/headline is present
    await expect(page.getByText('talk to anyone.')).toBeVisible({ timeout: 15000 });
    
    // Check if the Join / Create Room button is present
    const ctaButton = page.locator('button', { hasText: /enter a room/i });
    await expect(ctaButton).toBeVisible();
  });

  test('Admin Dashboard loads and handles unauthenticated state', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173/admin');
    
    // Should show login prompt since we are not authenticated
    await expect(page.getByText('Admin Portal', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Sign in with an administrator account')).toBeVisible();
  });

  test('Can mock admin login by interacting with the page', async ({ page }) => {
    // For a real production grade test, we would ideally set up a mock service worker
    // or stub the firebase auth. We'll simply verify the login container is robust.
    await page.goto('http://127.0.0.1:5173/admin');
    
    const signInButton = page.locator('button', { hasText: 'Sign In with Google' });
    await expect(signInButton).toBeVisible({ timeout: 15000 });
    
    const returnButton = page.locator('button', { hasText: 'Return to App' });
    await expect(returnButton).toBeVisible();
    
    // Test navigation back
    await returnButton.click();
    await expect(page).toHaveURL('http://127.0.0.1:5173/');
  });
  
});
