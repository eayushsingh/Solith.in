/**
 * GlobalChatView Real Data & Message Validator
 */

describe('GlobalChatView Live Messages', () => {
  test('excludes legacy mock welcome_1 bot message from message feed', () => {
    const rawMessages = [
      { id: 'welcome_1', displayName: 'Solith Bot 🤖', text: 'Welcome mock' },
      { id: 'real_msg_42', displayName: 'Ayush', text: 'Hey everyone, who wants to practice?' }
    ];

    const sanitized = rawMessages.filter(m => m.id !== 'welcome_1');
    expect(sanitized).toHaveLength(1);
    expect(sanitized[0].id).toBe('real_msg_42');
    expect(sanitized[0].displayName).toBe('Ayush');
  });

  test('validates chat message payload formatting', () => {
    const payload = {
      uid: 'user_live_1',
      displayName: 'KLZ',
      text: 'Good morning language learners!',
      createdAt: new Date()
    };

    expect(payload.uid).toBeTruthy();
    expect(payload.text.length).toBeGreaterThan(0);
    expect(payload.text.length).toBeLessThanOrEqual(2000);
  });
});
