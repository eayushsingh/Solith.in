import re

with open("client/tests/solith.spec.js", "r") as f:
    content = f.read()

content = content.replace("page.locator('text=Global Chat')).toBeVisible", "page.locator('text=Global Chat').first()).toBeVisible")

with open("client/tests/solith.spec.js", "w") as f:
    f.write(content)
