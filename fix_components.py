import re

def insert_get_fresh_token(filepath):
    with open(filepath, "r") as f:
        content = f.read()

    # Import auth
    if "import { auth }" not in content and "import { db, auth }" not in content:
        content = content.replace("import { db } from '../firebase';", "import { db, auth } from '../firebase';")
        content = content.replace("import React,", "import { auth } from '../firebase';\nimport React,")

    # Add getFreshToken
    token_func = """
  const getFreshToken = async () => {
    if (!auth?.currentUser) return user?.token || '';
    return await auth.currentUser.getIdToken(false);
  };
"""
    if "const getFreshToken" not in content:
        # Insert after component declaration
        comp_match = re.search(r"const \w+\s*=\s*\([^)]*\)\s*=>\s*{", content)
        if comp_match:
            end = comp_match.end()
            content = content[:end] + token_func + content[end:]
    
    # Replace user.token usages
    content = content.replace("user.token", "(await getFreshToken())")
    
    with open(filepath, "w") as f:
        f.write(content)

insert_get_fresh_token("client/src/components/PremiumSubscription.jsx")
insert_get_fresh_token("client/src/components/AdminPanel.jsx")
