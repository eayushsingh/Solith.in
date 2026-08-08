import re

with open('src/App.jsx', 'r') as f:
    content = f.read()

# 1. Fix Profile Modal wrapper
content = re.sub(
    r'w-full max-w-sm rounded-3xl p-8 animate-fade-in relative bg-gradient-to-b from-\[#1a1814\] to-\[#0a0a0a\] border border-yellow-500/20 shadow-\[0_0_50px_rgba\(234,179,8,0.15\)\]',
    'w-full max-w-sm rounded-3xl p-8 animate-fade-in relative bg-[#121418] border border-[#24272e] shadow-xl',
    content
)

# 2. Fix Auth Modal wrapper
content = re.sub(
    r'bg-\[#1a1c23\]/95 backdrop-blur-2xl rounded-3xl p-10 max-w-md w-full border border-white/10 shadow-2xl relative',
    'w-full max-w-md rounded-3xl p-10 animate-fade-in relative bg-[#121418] border border-[#24272e] shadow-xl',
    content
)

# 3. Fix Settings Modal wrapper
content = re.sub(
    r'bg-\[var\(--bg\)\] rounded-3xl p-8 max-w-md w-full border border-\[var\(--line\)\] shadow-2xl relative',
    'w-full max-w-md rounded-3xl p-8 animate-fade-in relative bg-[#121418] border border-[#24272e] shadow-xl',
    content
)

# 4. Remove Profile Modal Yellow Glows
content = re.sub(
    r'<div className="absolute inset-0 bg-gradient-to-tr from-yellow-300 via-yellow-500 to-yellow-700 rounded-full blur-md opacity-70 animate-pulse"></div>',
    '',
    content
)
content = re.sub(
    r'border-4 border-\[#1a1814\]',
    'border-4 border-[#121418]',
    content
)

# 5. Fix Profile Title
content = re.sub(
    r'text-transparent bg-clip-text bg-gradient-to-r from-yellow-100 via-yellow-300 to-yellow-600',
    'text-white',
    content
)

# 6. Fix Profile Stats box
content = re.sub(
    r'bg-gradient-to-b from-yellow-500/10 to-transparent rounded-2xl p-4 text-center border border-yellow-500/20 shadow-inner',
    'bg-[#1a1c23] rounded-2xl p-4 text-center border border-[#24272e] shadow-inner',
    content
)
content = re.sub(
    r'text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-500',
    'text-[#00d859]',
    content
)

# 7. Fix Follow Button
content = re.sub(
    r'bg-gradient-to-r from-yellow-400 to-yellow-600 text-black hover:scale-\[1.02\] hover:shadow-yellow-500/30',
    'bg-[#00d859] text-black hover:scale-[1.02] hover:shadow-green-500/30',
    content
)
content = re.sub(
    r'bg-gradient-to-r from-yellow-400 to-yellow-600 text-black shadow-lg hover:scale-\[1.02\]',
    'bg-[#00d859] text-black shadow-lg hover:scale-[1.02]',
    content
)

with open('src/App.jsx', 'w') as f:
    f.write(content)

print("Modals fixed")
