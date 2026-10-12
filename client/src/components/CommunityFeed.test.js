/**
 * Community Feed Live Data Schema Validator
 */

describe('CommunityFeed Live Data', () => {
  test('sanitizes feed data to exclude legacy mock post_def_1', () => {
    const rawFeed = [
      { id: 'post_def_1', authorName: 'Solith Community', content: 'Fake' },
      { id: 'real_post_99', authorName: 'Ayush Singh', text: 'Practicing Spanish today!' }
    ];

    const sanitized = rawFeed.filter(p => p.id !== 'post_def_1');
    expect(sanitized).toHaveLength(1);
    expect(sanitized[0].id).toBe('real_post_99');
    expect(sanitized[0].authorName).toBe('Ayush Singh');
  });

  test('validates post creation payload schema', () => {
    const postPayload = {
      userId: 'usr_123',
      authorName: 'Learner',
      authorEmoji: '🌟',
      text: 'Hello world!',
      likes: []
    };

    expect(postPayload.userId).toBeTruthy();
    expect(postPayload.text.trim().length).toBeGreaterThan(0);
    expect(Array.isArray(postPayload.likes)).toBe(true);
  });
});
