import { test, expect } from '@playwright/test';

const API = 'https://talk2me-backend-loh6.onrender.com';

test.describe('Backend API', () => {

  test('health endpoint returns OK', async ({ request }) => {
    const res = await request.get(`${API}/api/health`);
    expect(res.status()).toBe(200);
    expect(await res.text()).toBe('OK');
  });

  test('rooms endpoint returns array', async ({ request }) => {
    const res = await request.get(`${API}/api/rooms`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('rooms never include invite-only rooms', async ({ request }) => {
    const res = await request.get(`${API}/api/rooms`);
    const rooms = await res.json();
    const inviteRooms = rooms.filter(r => r.accessType === 'invite');
    expect(inviteRooms).toHaveLength(0);
  });

  test('rooms have required fields', async ({ request }) => {
    const res = await request.get(`${API}/api/rooms`);
    const rooms = await res.json();
    rooms.forEach(room => {
      expect(room).toHaveProperty('id');
      expect(room).toHaveProperty('name');
      expect(room).toHaveProperty('language');
      expect(room).toHaveProperty('participants');
      expect(Array.isArray(room.participants)).toBe(true);
    });
  });

  test('settings endpoint returns JSON not HTML', async ({ request }) => {
    const res = await request.get(`${API}/api/settings/public`);
    expect(res.status()).toBe(200);
    const contentType = res.headers()['content-type'];
    expect(contentType).toContain('application/json');
    const data = await res.json();
    expect(data).toHaveProperty('premiumPrice');
  });

  test('config endpoint returns livekit info', async ({ request }) => {
    const res = await request.get(`${API}/api/config`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('hasApiKey');
    expect(data).toHaveProperty('livekitUrl');
    expect(typeof data.livekitUrl).toBe('string');
  });

  test('unknown API routes return JSON not HTML', async ({ request }) => {
    const res = await request.get(`${API}/api/nonexistent-route`);
    const contentType = res.headers()['content-type'] || '';
    expect(contentType).toContain('application/json');
  });

});
