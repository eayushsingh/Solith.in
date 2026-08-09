import os

target_dir = 'client/src'
replacements = {
    '#ef4444': '#cd1c18',
    '#EF4444': '#CD1C18',
    'rgba(239,68,68,': 'rgba(205,28,24,',
    'rgba(239, 68, 68,': 'rgba(205, 28, 24,',
    '#f87171': '#e5322d',
    '#F87171': '#E5322D',
}

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
        
    original = content
    for old, new in replacements.items():
        content = content.replace(old, new)
        
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Updated {filepath}")

for root, _, files in os.walk(target_dir):
    for file in files:
        if file.endswith(('.jsx', '.js', '.css', '.html')):
            process_file(os.path.join(root, file))

