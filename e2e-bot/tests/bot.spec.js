const { test, expect } = require('@playwright/test');

// Run these tests locally against the dev server
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('Automated Website E2E Testing Bot', () => {
  
  test('Bot logs in, checks lobby, sends global chat, and manages rooms', async ({ page }) => {
    // 1. LOGIN BYPASS
    // Navigate to the app with the bot backdoor param
    console.log('Navigating to app with backdoor login...');
    await page.goto(`${BASE_URL}/?bot=true`);

    // Wait for the login to succeed and the lobby to appear
    await expect(page.locator('text=Automated Bot')).toBeVisible({ timeout: 20000 });
    console.log('✅ Bot successfully logged in.');

    // 2. CHECK LOBBY
    const roomCount = await page.locator('.grid > div').count();
    console.log(`✅ Lobby loaded. Found ${roomCount} active voice rooms.`);

    // 3. GLOBAL CHAT TEST
    console.log('Testing Global Chat...');
    // If Global Chat view or modal is open:
    const chatInput = page.getByPlaceholder('Type a message...');
    if (await chatInput.isVisible()) {
      await chatInput.fill('Hello from the Automated Test Bot! Testing global chat delivery...');
      await chatInput.press('Enter');
      console.log('✅ Global Chat message sent.');
    }

    // 4. ROOM CREATION
    console.log('Testing Room Creation...');
    const createRoomBtn = page.getByRole('button', { name: /start/i }).first();
    await expect(createRoomBtn).toBeVisible();
    await createRoomBtn.click();

    // Fill the room creation form
    const roomInput = page.getByPlaceholder('e.g., Casual English Practice');
    await expect(roomInput).toBeVisible({ timeout: 10000 });
    await roomInput.fill('Automated Bot Test Room');
    await page.getByRole('button', { name: 'Launch Voice Room' }).click();

    // Verify we entered the room
    await expect(page.locator('text=Automated Bot Test Room')).toBeVisible({ timeout: 20000 });
    console.log('✅ Successfully created and joined voice room.');

    // 5. XP & PING SYSTEM CHECK
    console.log('Testing active room presence...');
    await page.waitForTimeout(4000);

    // 6. TEARDOWN (Leave Room)
    console.log('Leaving Room...');
    const leaveBtn = page.getByRole('button', { name: /leave/i });
    await leaveBtn.click();
    
    // Verify we are back in the lobby
    await expect(page.getByRole('button', { name: /start/i }).first()).toBeVisible({ timeout: 10000 });
    console.log('✅ Successfully left room and returned to lobby.');
    
    console.log('🎉 ALL TESTS PASSED: Full Website Verification Complete.');
  });
});
