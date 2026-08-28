const fs = require('fs');
let content = fs.readFileSync('client/tests/solith.spec.js', 'utf8');

// Remove networkidle because WebSockets prevent networkidle
content = content.replace(/await page\.waitForLoadState\('networkidle'\);/g, "// removed networkidle wait");

fs.writeFileSync('client/tests/solith.spec.js', content);
