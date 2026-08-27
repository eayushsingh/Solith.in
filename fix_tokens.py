import re

with open("client/src/App.jsx", "r") as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    if "user.token" in line and "Authorization" in line:
        # replace ${user.token} with ${await getFreshToken()}
        # also handle ${token || user.token} -> if it's there, maybe we just await getFreshToken()
        line = line.replace("${user.token}", "${await getFreshToken()}")
        line = line.replace("${token || user.token}", "${await getFreshToken()}")
    new_lines.append(line)

with open("client/src/App.jsx", "w") as f:
    f.writelines(new_lines)
