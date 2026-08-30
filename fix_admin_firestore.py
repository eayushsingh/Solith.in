import os

file_path = 'server/server.js'
with open(file_path, 'r') as f:
    content = f.read()

content = content.replace('adminInstance.firestore.FieldValue', 'admin.firestore.FieldValue')

with open(file_path, 'w') as f:
    f.write(content)

print("Replaced all occurrences of adminInstance.firestore.FieldValue")
