const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const endpoint = `
app.post('/api/rooms/:id/agent-chat', express.json(), (req, res) => {
  const { id: roomId } = req.params;
  const { text } = req.body;
  if (!roomId || !text) return res.status(400).send('Missing args');
  
  const newMessage = {
      id: 'msg-' + Date.now(),
      senderId: 'agent-ananya',
      senderName: 'Ananya',
      senderEmoji: '🤖',
      senderColor: '#8B5CF6',
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
  
  io.to(roomId).emit('chat-message', newMessage);
  res.status(200).send('OK');
});
`;

if (!code.includes('/api/rooms/:id/agent-chat')) {
  code = code.replace("app.post('/api/messages/send'", endpoint + "\napp.post('/api/messages/send'");
  fs.writeFileSync('server.js', code);
}
