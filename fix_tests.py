import re

with open("client/tests/solith.spec.js", "r") as f:
    content = f.read()

# For any test that expects lobby elements, we should add:
# await page.click('button:has-text("enter a room")');
# right after await page.goto(BASE_URL);

def inject_lobby_navigation(match):
    return match.group(0) + "\n  try { await page.click('button:has-text(\"enter a room\")', { timeout: 2000 }); } catch (e) {}"

content = re.sub(r"await page\.goto\(BASE_URL\);(?:\n\s*await page\.waitForLoadState\('domcontentloaded'\);)?", inject_lobby_navigation, content)

with open("client/tests/solith.spec.js", "w") as f:
    f.write(content)
