import os

filepath = 'client/src/App.jsx'
with open(filepath, 'r') as f:
    content = f.read()

content = content.replace('<Meteors number={4} />', '<Meteors number={20} />')

with open(filepath, 'w') as f:
    f.write(content)

