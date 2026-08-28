import re

with open("client/src/App.jsx", "r") as f:
    content = f.read()

# Replace onJoin={joinVoiceRoom} with onJoin={(room) => window.open(`/?room=${room.id}`, '_blank')}
content = content.replace("onJoin={joinVoiceRoom}", "onJoin={(room) => window.open(`/?room=${room.id}`, '_blank')}")

with open("client/src/App.jsx", "w") as f:
    f.write(content)
