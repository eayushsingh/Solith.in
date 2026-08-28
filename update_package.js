const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('client/package.json', 'utf8'));
pkg.scripts = pkg.scripts || {};
pkg.scripts.test = "playwright test";
pkg.scripts["test:headed"] = "playwright test --headed";
pkg.scripts["test:report"] = "playwright show-report";
fs.writeFileSync('client/package.json', JSON.stringify(pkg, null, 2));
