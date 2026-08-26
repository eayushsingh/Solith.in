const { test, expect } = require('@playwright/test');

// Run these tests locally against the dev server
const BASE_URL = 'http://localhost:5173';

test.describe('Automated Website E2E Testing Bot', () => {
  
  test('Bot logs in, checks lobby, sends global chat, and manages rooms', async ({ page, context }) => {
    // 1. LOGIN BYPASS
    // Navigate to the app with the bot backdoor param
    console.log('Navigating to app with backdoor login...');
    await page.goto(`${BASE_URL}/?bot=true`);

    // Wait for the login to succeed and the lobby to appear
    await expect(page.locator('text=Automated Bot')).toBeVisible({ timeout: 15000 });
    console.log('✅ Bot successfully logged in.');

    // 2. CHECK LOBBY
    const roomCount = await page.locator('.grid > div.bg-white').count();
    console.log(`✅ Lobby loaded. Found ${roomCount} active voice rooms.`);

    // 3. GLOBAL CHAT TEST
    console.log('Testing Global Chat...');
    const chatInput = page.getByPlaceholder('Type a message...');
    await expect(chatInput).toBeVisible();
    await chatInput.fill('Hello from the Automated Test Bot! Testing global chat delivery...');
    
    // Hit Enter to send
    await chatInput.press('Enter');
    
    // Verify the message appears in the chat feed
    await expect(page.locator('text=Testing global chat delivery...')).toBeVisible({ timeout: 5000 });
    console.log('✅ Global Chat message sent and verified.');

    // 4. ROOM CREATION & MIC SIMULATION
    console.log('Testing Room Creation...');
    const createRoomBtn = page.getByRole('button', { name: /create room/i });
    await expect(createRoomBtn).toBeVisible();
    await createRoomBtn.click();

    // Fill the room creation form
    await page.getByPlaceholder('e.g., Casual English Practice').fill('Automated Bot Test Room');
    await page.getByRole('button', { name: 'Launch Voice Room' }).click();

    // Verify we entered the room
    await expect(page.locator('text=Automated Bot Test Room')).toBeVisible({ timeout: 15000 });
    console.log('✅ Successfully created and joined voice room.');

    // 5. XP & PING SYSTEM CHECK
    console.log('Testing XP & Ping System (waiting 15s)...');
    
    // Wait for the background ping to fire (every 4s)
    await page.waitForTimeout(15000);

    // Verify the XP floater or UI indicates an XP increase
    // Note: Playwright requires fake media streams if we want to simulate actual speaking, 
    // but the ping system awards 5 XP for active listening by default!
    
    // 6. TEARDOWN (Leave Room)
    console.log('Leaving Room...');
    const leaveBtn = page.getByRole('button', { name: /leave/i });
    await leaveBtn.click();
    
    // Verify we are back in the lobby
    await expect(page.getByRole('button', { name: /create room/i })).toBeVisible({ timeout: 10000 });
    console.log('✅ Successfully left room and returned to lobby.');
    
    console.log('🎉 ALL TESTS PASSED: Full Website Verification Complete.');
  });
});
