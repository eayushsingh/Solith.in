import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173'; // Using local server for tests to reflect local codebase

// ─── LOBBY TESTS ─────────────────────────────────────────────────────────────

test('Lobby loads without errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto(BASE_URL);
  await page.waitForLoadState('domcontentloaded');
  try { await page.click('button:has-text("enter a room")', { timeout: 2000 }); } catch (e) {}
  expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
  await expect(page.locator('text=Practice languages live on solith.in')).toBeVisible();
});

test('Language filter pills are visible', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.waitForLoadState('domcontentloaded');
  try { await page.click('button:has-text("enter a room")', { timeout: 2000 }); } catch (e) {}
  await expect(page.locator('text=English')).toBeVisible();
  await expect(page.locator('text=Hindi')).toBeVisible();
  await expect(page.locator('text=Arabic')).toBeVisible();
});

test('Search bar works', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.waitForLoadState('domcontentloaded');
  try { await page.click('button:has-text("enter a room")', { timeout: 2000 }); } catch (e) {}
  await page.fill('input[placeholder="Search rooms..."]', 'English');
  await expect(page.locator('input[placeholder="Search rooms..."]')).toHaveValue('English');
});

test('Background pattern is visible (not pure black)', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.waitForLoadState('domcontentloaded');
  try { await page.click('button:has-text("enter a room")', { timeout: 2000 }); } catch (e) {}
  const bgColor = await page.evaluate(() => {
    return window.getComputedStyle(document.body).backgroundColor;
  });
  // Should not be pure black rgb(0,0,0)
  expect(bgColor).not.toBe('rgb(0, 0, 0)');
});

// ─── ROOM CREATION TESTS ─────────────────────────────────────────────────────

test('Create room button shows auth modal when not logged in', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.waitForLoadState('domcontentloaded');
  try { await page.click('button:has-text("enter a room")', { timeout: 2000 }); } catch (e) {}
  await page.click('text=Start a Room');
  await expect(page.locator('text=Sign in with Google').first()).toBeVisible({ timeout: 15000 });
});

// ─── NAVIGATION TESTS ────────────────────────────────────────────────────────

test('Leaderboard page loads', async ({ page }) => {
  await page.goto(`${BASE_URL}/#leaderboard`);
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('text=Hall of Fame')).toBeVisible({ timeout: 15000 });
});

test('Guidelines page loads', async ({ page }) => {
  await page.goto(`${BASE_URL}/#guidelines`);
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('text=Guidelines')).toBeVisible({ timeout: 15000 });
});

test('Messages page loads', async ({ page }) => {
  await page.goto(`${BASE_URL}/#messages`);
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('text=Global Chat').first()).toBeVisible({ timeout: 15000 });
});

// ─── ROOM CARD TESTS ─────────────────────────────────────────────────────────

test('Room cards render correctly when rooms exist', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.waitForLoadState('domcontentloaded');
  try { await page.click('button:has-text("enter a room")', { timeout: 2000 }); } catch (e) {}
  // Wait up to 10s for rooms to load
  const hasRooms = await page.locator('text=Join and talk now!').count();
  if (hasRooms > 0) {
    // Check card structure
    await expect(page.locator('text=Join and talk now!').first()).toBeVisible();
    // Check share button exists
    await expect(page.locator('text=🔗 Share').first()).toBeVisible();
  }
});

test('Room card share button copies URL', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(BASE_URL);
  await page.waitForLoadState('domcontentloaded');
  try { await page.click('button:has-text("enter a room")', { timeout: 2000 }); } catch (e) {}
  const shareButtons = page.locator('text=🔗 Share');
  const count = await shareButtons.count();
  if (count > 0) {
    await shareButtons.first().click();
    await expect(page.locator('text=✓ Copied')).toBeVisible({ timeout: 15000 });
  }
});

// ─── ACTIVE ROOM BACKGROUND TEST ─────────────────────────────────────────────

test('Active room background is not pure black', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.waitForLoadState('domcontentloaded');
  try { await page.click('button:has-text("enter a room")', { timeout: 2000 }); } catch (e) {}
  
  // Check call-room-bg CSS class is defined with a non-black background
  const bgColor = await page.evaluate(() => {
    const el = document.createElement('div');
    el.className = 'call-room-bg';
    document.body.appendChild(el);
    const color = window.getComputedStyle(el).backgroundColor;
    document.body.removeChild(el);
    return color;
  });
  expect(bgColor).not.toBe('rgb(0, 0, 0)');
});

// ─── API HEALTH TESTS ────────────────────────────────────────────────────────

test('Backend health endpoint returns OK', async ({ request }) => {
  const response = await request.get('http://localhost:3000/api/health');
  expect(response.status()).toBe(200);
  const text = await response.text();
  expect(text).toBe('OK');
});

test('Rooms API returns array', async ({ request }) => {
  const response = await request.get('http://localhost:3000/api/rooms');
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(Array.isArray(data)).toBe(true);
});

test('Rooms API never returns invite-only rooms', async ({ request }) => {
  const response = await request.get('http://localhost:3000/api/rooms');
  const rooms = await response.json();
  const inviteRooms = rooms.filter(r => r.accessType === 'invite');
  expect(inviteRooms).toHaveLength(0);
});

// ─── SOCIAL PANEL TEST ───────────────────────────────────────────────────────

test('Social button is visible in lobby', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.waitForLoadState('domcontentloaded');
  try { await page.click('button:has-text("enter a room")', { timeout: 2000 }); } catch (e) {}
  // Social floating button should be visible
  const socialBtn = page.locator('[title="Social"]').first();
  await expect(socialBtn).toBeVisible({ timeout: 15000 });
});

test('Social panel opens on click', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.waitForLoadState('domcontentloaded');
  try { await page.click('button:has-text("enter a room")', { timeout: 2000 }); } catch (e) {}
  await page.locator('[title="Social"]').first().click();
  await expect(page.locator('text=Social')).toBeVisible({ timeout: 15000 });
});

// ─── RESPONSIVE TESTS ────────────────────────────────────────────────────────

test('Mobile layout renders correctly', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE_URL);
  await page.waitForLoadState('domcontentloaded');
  try { await page.click('button:has-text("enter a room")', { timeout: 2000 }); } catch (e) {}
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
  await expect(page.locator('text=Practice languages live on solith.in')).toBeVisible();
});

test('Tablet layout renders correctly', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(BASE_URL);
  await page.waitForLoadState('domcontentloaded');
  try { await page.click('button:has-text("enter a room")', { timeout: 2000 }); } catch (e) {}
  await expect(page.locator('text=Practice languages live on solith.in')).toBeVisible();
});
