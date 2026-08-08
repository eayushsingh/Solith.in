import re

with open('src/App.jsx', 'r') as f:
    content = f.read()

# Replace definition
content = content.replace('const AppLayout = ({ children }) => (', 'const renderAppLayout = (children) => (')

# Replace single-line usage
content = re.sub(r'<AppLayout>(.*?)</AppLayout>', r'{renderAppLayout(\1)}', content)

# Replace multi-line usage
# e.g. <AppLayout>\n  <GlobalChatView />\n</AppLayout>
# We can use regex with re.DOTALL
content = re.sub(r'<AppLayout>\s*(.*?)\s*</AppLayout>', r'renderAppLayout(\n\1\n)', content, flags=re.DOTALL)

with open('src/App.jsx', 'w') as f:
    f.write(content)

print("AppLayout fixed")
