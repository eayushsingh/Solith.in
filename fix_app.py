import re

with open("client/src/App.jsx", "r") as f:
    content = f.read()

# Fix the button around line 2746
pattern_wrong_button = r'''(\s*<button\s*onClick=\{\(\) => setShowSocialPanel\(!showSocialPanel\)\}\s*style=\{\{\s*)position: 'fixed', right: 24, zIndex: 90,(\s*)width: 56, height: 56, borderRadius: '50%',(\s*)background: 'var\(--accent-primary\)',(\s*)boxShadow: '0 0 20px var\(--accent-primary-glow\)',(\s*)border: '1px solid rgba\(255,255,255,0\.1\)',(\s*)cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',(\s*)transition: 'all 0\.2s',(\s*)animation: 'pulse-speaking 2s infinite'(\s*)\}\}(\s*)className="bottom-\[90px\] md:bottom-6"(\s*)title="Social"\s*>'''

replacement_correct = r'''\1width: 40, height: 40, borderRadius: '50%',\2background: showSocialPanel ? '#1877f2' : 'rgba(255,255,255,0.08)',\3border: '1px solid rgba(255,255,255,0.1)',\4cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',\5transition: 'all 0.2s'\8}}\10title="Social">'''

content = re.sub(pattern_wrong_button, replacement_correct, content)

# Fix the floating button around 2320
pattern_floating_button = r'''(\s*<button \s*onClick=\{\(\) => setShowFollowList\(true\)\}\s*style=\{\{\s*)position: 'fixed', bottom: 24, right: 24, zIndex: 90,(\s*)width: 56, height: 56, borderRadius: '50%',(\s*)background: 'var\(--accent-primary\)',(\s*)boxShadow: '0 0 20px var\(--accent-primary-glow\)',(\s*)border: '1px solid rgba\(255,255,255,0\.1\)',(\s*)cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',(\s*)transition: 'all 0\.2s',(\s*)animation: 'pulse-speaking 2s infinite'(\s*)\}\}(\s*)title="Social"\s*>'''

replacement_floating = r'''\1position: 'fixed', right: 24, zIndex: 90,\2width: 56, height: 56, borderRadius: '50%',\3background: 'var(--accent-primary)',\4boxShadow: '0 0 20px var(--accent-primary-glow)',\5border: '1px solid rgba(255,255,255,0.1)',\6cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',\7transition: 'all 0.2s',\8animation: 'pulse-speaking 2s infinite'\9}}\n                className="bottom-[90px] md:bottom-6"\10title="Social">'''

content = re.sub(pattern_floating_button, replacement_floating, content)

with open("client/src/App.jsx", "w") as f:
    f.write(content)

print("Done")
