import re

file_path = 'client/src/components/RoomPanel.jsx'
with open(file_path, 'r') as f:
    content = f.read()

# Add compressImage function
compress_fn = """
  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_SIZE = 800;
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };
"""

if 'const compressImage =' not in content:
    content = content.replace("const handleFileChange = (e) => {", compress_fn + "\n  const handleFileChange = async (e) => {")
else:
    content = content.replace("const handleFileChange = (e) => {", "const handleFileChange = async (e) => {")

handle_file_old = """    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result;
      // Send message with photo
      sendChatMessageWithPayload({ text: '', fileUrl: base64data });
    };
    reader.readAsDataURL(file);"""

handle_file_new = """    const base64data = await compressImage(file);
    // Send message with photo
    sendChatMessageWithPayload({ text: '', fileUrl: base64data });"""

content = content.replace(handle_file_old, handle_file_new)

with open(file_path, 'w') as f:
    f.write(content)

print("RoomPanel.jsx updated")
