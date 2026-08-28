import re

with open("client/tests/solith.spec.js", "r") as f:
    content = f.read()

# Fix strict mode violation 1
content = content.replace("page.locator('text=Sign in with Google')).toBeVisible", "page.locator('text=Sign in with Google').first()).toBeVisible")

# Fix strict mode violation 2
content = content.replace("page.locator('[title=\"Social\"]');", "page.locator('[title=\"Social\"]').first();")

# I'll also fix "Social panel opens on click" which might also use page.click('[title="Social"]')
content = content.replace("page.click('[title=\"Social\"]');", "page.locator('[title=\"Social\"]').first().click();")


with open("client/tests/solith.spec.js", "w") as f:
    f.write(content)
