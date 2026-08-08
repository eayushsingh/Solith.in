import re

with open('src/App.jsx', 'r') as f:
    content = f.read()

# 1. Find AppLayout definition
app_layout_start = content.find('const AppLayout = ({ children }) => (')
app_layout_end = content.find('  );', app_layout_start) + 4

# 2. Extract Modals block (from CREATE ROOM MODAL to the end of AppLayout in the Lobby return)
modals_start_str = '{/* CREATE ROOM MODAL */}'
modals_start_idx = content.find(modals_start_str)

modals_end_str = '</AppLayout>'
modals_end_idx = content.rfind(modals_end_str)

modals_block = content[modals_start_idx:modals_end_idx].strip()

# 3. Remove Modals block from original position
new_content = content[:modals_start_idx] + content[modals_end_idx:]

# 4. Insert Modals block into AppLayout definition
# AppLayout looks like:
#   const AppLayout = ({ children }) => (
#     <div className="layout-container relative">
#       ...
#       <div className="main-content hide-scrollbar z-10 relative">
#         {children}
#       </div>
#     </div>
#   );

new_app_layout = f"""  const AppLayout = ({{ children }}) => (
    <div className="layout-container relative">
      <Meteors number={{4}} />
      <Sidebar {{...layoutProps}} />
      <div className="main-content hide-scrollbar z-10 relative">
        {{children}}
      </div>
      
      {{/* MODALS MOVED HERE FOR GLOBAL ACCESS */}}
      {modals_block}
    </div>
  );"""

new_content = new_content[:app_layout_start] + new_app_layout + new_content[app_layout_end:]

with open('src/App.jsx', 'w') as f:
    f.write(new_content)

print("Modals refactored successfully.")
