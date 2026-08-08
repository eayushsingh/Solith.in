import os

target_dir = 'client/src'
replacements = {
    '#00d859': '#ef4444',
    'rgba(0,216,89,': 'rgba(239,68,68,',
    '#33e07a': '#f87171',
    'shadow-green-': 'shadow-red-',
    'border-green-': 'border-red-',
    'text-green-': 'text-red-',
    'bg-green-': 'bg-red-',
    'Talk4Now Green': 'Talk4Now Red'
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

