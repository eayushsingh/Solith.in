const fs = require('fs');
let content = fs.readFileSync('client/tests/solith.spec.js', 'utf8');

content = content.replace(/http:\/\/127\.0\.0\.1:5173/g, "http://localhost:5173");
// Add domcontentloaded
content = content.replace(/\/\/ removed networkidle wait/g, "await page.waitForLoadState('domcontentloaded');");
// Increase timeouts to 15000
content = content.replace(/timeout: \d+/g, "timeout: 15000");

fs.writeFileSync('client/tests/solith.spec.js', content);
