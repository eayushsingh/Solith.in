
import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

async function runTests() {
  console.log('--- RUNNING SERVER TESTS ---');

  // Start the server as a child process on a different port
  const serverProcess = spawn('node', ['server.js'], {
    env: { ...process.env, PORT: 3001 },
    stdio: 'pipe'
  });

  serverProcess.stdout.on('data', (data) => {
    // console.log(`[Server]: ${data}`);
  });
  
  serverProcess.stderr.on('data', (data) => {
    // console.error(`[Server Error]: ${data}`);
  });

  // Give the server a moment to start up
  await setTimeout(2000);

  // Test 1: Health Check
  try {
    const healthRes = await fetch('http://localhost:3001/api/health');
    console.log(`[GET /api/health] Status: ${healthRes.status}`);
    const healthText = await healthRes.text();
    console.log(`[GET /api/health] Body: ${healthText}`);
    
    if (healthRes.status === 200 && healthText === 'OK') {
      console.log('✅ Health check passed.');
    } else {
      console.error('❌ Health check failed.');
    }
  } catch (err) {
    console.error('❌ Health check error:', err.message);
  }

  console.log('\n-----------------------------------\n');

  // Test 2: Create Room
  try {
    const roomRes = await fetch('http://localhost:3001/api/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: 'Test Room', language: 'English' })
    });
    
    console.log(`[POST /api/rooms] Status: ${roomRes.status}`);
    const roomData = await roomRes.json();
    console.log(`[POST /api/rooms] Response:`, roomData);

    if (roomData.dailyUrl) {
      if (roomData.dailyUrl.includes('mock') || roomData.dailyUrl.includes('demo')) {
        console.error('❌ Room creation failed. Returned a mock/demo URL:', roomData.dailyUrl);
      } else {
        console.log('✅ Room creation passed. Returned a real Daily.co URL:', roomData.dailyUrl);
      }
    } else {
      console.error('❌ Room creation failed. No dailyUrl in response.');
    }
  } catch (err) {
    console.error('❌ Room creation error:', err.message);
  }

  // Cleanup: kill the child process
  serverProcess.kill();
  console.log('--- TESTS COMPLETE ---');
}

runTests();
