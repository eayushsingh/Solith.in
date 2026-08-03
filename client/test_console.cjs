const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(1000);
  
  // Set user state globally to mock being logged in
  await page.evaluate(() => {
    // This is hard since user is in React state. 
    // We can just click the create room button. It will open auth modal.
  });
  
  // Wait, if I'm not logged in, clicking Create Room opens auth modal.
  // I need to mock user. I can intercept API and mock firebase auth.
  // Let's just find the room card and click it, wait it also needs auth.
  
  await browser.close();
})();
