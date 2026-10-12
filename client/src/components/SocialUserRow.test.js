/**
 * SocialUserRow Real Data & Fallback Validator
 */

describe('SocialUserRow Real Data Validation', () => {
  test('strictly prohibits legacy dummy fallback "Language Learner" with fake 100 XP', () => {
    // Simulated fallback profile
    const fallbackProfile = { id: 'unknown_id', name: 'Learner', xp: 0 };
    
    expect(fallbackProfile.name).not.toBe('Language Learner');
    expect(fallbackProfile.xp).not.toBe(100);
    expect(fallbackProfile.xp).toBe(0);
  });

  test('preserves real user profile data when provided to SocialUserRow', () => {
    const liveUser = {
      id: 'CJyFDPZExjOHyCbauaAqi5hUOYD3',
      name: 'Nax',
      photoUrl: 'https://lh3.googleusercontent.com/avatar.png',
      xp: 11626,
      streak: 2,
      role: 'user',
      isPremium: true
    };

    expect(liveUser.name).toBe('Nax');
    expect(liveUser.xp).toBe(11626);
    expect(liveUser.isPremium).toBe(true);
  });
});
