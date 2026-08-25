import puppeteer from 'puppeteer';

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    // Catch page errors
    page.on('pageerror', error => {
      console.log('PAGE ERROR:', error.message);
      console.log(error.stack);
    });

    await page.goto('http://localhost:5173');
    
    // Wait for either the app to render or an error to appear
    await new Promise(r => setTimeout(r, 2000));
    
    // Evaluate to create a mock room
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('test-inject-rooms'));
    });
    
    await new Promise(r => setTimeout(r, 2000));

    // Check if error overlay exists
    const errorText = await page.evaluate(() => {
      const el = document.querySelector('body');
      return el ? el.innerText : null;
    });
    console.log("Body text:");
    console.log(errorText.substring(0, 500));

    await browser.close();
  } catch (err) {
    console.log("Script error:", err);
  }
})();
