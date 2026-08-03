const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.stack));

  await page.route('**/api/rooms/list', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([
      { id: '1', name: 'cold drinks', language: 'English', maxUsers: 8 }
    ])
  }));

  await page.goto('http://localhost:5173');
  await page.waitForTimeout(1000);
  
  const enterBtn = await page.getByText('ENTER', { exact: false }).first();
  if (enterBtn) {
    console.log('Clicking ENTER...');
    await enterBtn.click();
  } else {
    console.log('No ENTER button found');
  }
  
  await page.waitForTimeout(2000);
  await browser.close();
})();
