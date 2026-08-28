const fs = require('fs');
let content = fs.readFileSync('client/tests/solith.spec.js', 'utf8');

// Use 127.0.0.1 instead of localhost
content = content.replace("http://localhost:5173", "http://127.0.0.1:5173");

// Fix language pills casing since text= locator might be case sensitive for literal DOM text
content = content.replace("'text=ENGLISH'", "'text=English'");
content = content.replace("'text=HINDI'", "'text=Hindi'");
content = content.replace("'text=ARABIC'", "'text=Arabic'");

fs.writeFileSync('client/tests/solith.spec.js', content);
