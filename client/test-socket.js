const { io } = require("socket.io-client");
const socket = io("http://localhost:3000");

socket.on("connect", () => {
  console.log("Connected to local socket server");
  
  // We don't have authentication in this test script, but server.js requires req.user.uid.
  // Wait, server.js uses Express REST for /api/rooms.
});
