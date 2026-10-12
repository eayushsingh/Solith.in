/**
 * Test fixtures for Leaderboard period mapping and sorting unit tests.
 * Models real production Firestore user records (with ISO IDs and talk times).
 */

export const SAMPLE_LEADER_FIXTURES = [
  { id: 'usr_ayush', name: 'Ayush Singh', emoji: '👑', xp: 49623, talkTimeSeconds: 24420, dailyTalkTimeSeconds: 3600, weeklyTalkTimeSeconds: 18000, monthlyTalkTimeSeconds: 72000, streak: 1 },
  { id: 'usr_klz', name: 'KLZ', emoji: '🌟', xp: 24172, talkTimeSeconds: 19321, dailyTalkTimeSeconds: 2800, weeklyTalkTimeSeconds: 14500, monthlyTalkTimeSeconds: 58000, streak: 1 },
  { id: 'usr_nax', name: 'Nax', emoji: '🔥', xp: 11626, talkTimeSeconds: 9289, dailyTalkTimeSeconds: 2400, weeklyTalkTimeSeconds: 12000, monthlyTalkTimeSeconds: 49000, streak: 2 }
];

export function getFixtureLeadersForPeriod(period = 'daily') {
  return SAMPLE_LEADER_FIXTURES.map(user => {
    let talkTime = user.dailyTalkTimeSeconds;
    if (period === 'weekly') talkTime = user.weeklyTalkTimeSeconds;
    if (period === 'monthly') talkTime = user.monthlyTalkTimeSeconds;
    if (period === 'allTime') talkTime = user.talkTimeSeconds;
    return { ...user, talkTimeVal: talkTime };
  });
}

// Aliases for test compatibility
export const DEFAULT_MOCK_LEADERS = SAMPLE_LEADER_FIXTURES;
export const getMockLeadersForPeriod = getFixtureLeadersForPeriod;
