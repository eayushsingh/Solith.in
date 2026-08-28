import re

with open("client/src/components/RoomPanel.jsx", "r") as f:
    content = f.read()

# Replace the PM, React, Reply buttons block
old_buttons = """<button style={{color:'#60a5fa',fontSize:11,fontWeight:600,background:'none',border:'none',cursor:'pointer'}}>PM</button>
                      <button style={{color:'rgba(255,255,255,0.4)',fontSize:11,background:'none',border:'none',cursor:'pointer'}}>React</button>
                      <button style={{color:'rgba(255,255,255,0.4)',fontSize:11,background:'none',border:'none',cursor:'pointer'}}>Reply</button>"""

new_buttons = """<button onClick={() => alert('Direct messages coming soon!')} style={{color:'#60a5fa',fontSize:11,fontWeight:600,background:'none',border:'none',cursor:'pointer'}}>PM</button>
                      <button onClick={() => alert('Reactions coming soon!')} style={{color:'rgba(255,255,255,0.4)',fontSize:11,background:'none',border:'none',cursor:'pointer'}}>React</button>
                      <button onClick={() => setReplyingTo(msg)} style={{color:'rgba(255,255,255,0.4)',fontSize:11,background:'none',border:'none',cursor:'pointer'}}>Reply</button>"""

content = content.replace(old_buttons, new_buttons)

with open("client/src/components/RoomPanel.jsx", "w") as f:
    f.write(content)
