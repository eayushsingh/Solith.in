fetch('http://localhost:3000/api/rooms', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Test Room', tags: [] })
}).then(r => r.json()).then(console.log);
