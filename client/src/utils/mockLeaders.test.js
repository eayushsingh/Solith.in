import { SAMPLE_LEADER_FIXTURES, getFixtureLeadersForPeriod, DEFAULT_MOCK_LEADERS, getMockLeadersForPeriod } from './mockLeaders.js';

describe('leaderboardFixtures', () => {
  test('SAMPLE_LEADER_FIXTURES contains real user schemas', () => {
    expect(Array.isArray(SAMPLE_LEADER_FIXTURES)).toBe(true);
    expect(SAMPLE_LEADER_FIXTURES.length).toBeGreaterThan(0);
    expect(SAMPLE_LEADER_FIXTURES[0]).toHaveProperty('name', 'Ayush Singh');
    expect(SAMPLE_LEADER_FIXTURES[0]).toHaveProperty('xp', 49623);
    expect(SAMPLE_LEADER_FIXTURES[0]).toHaveProperty('talkTimeSeconds', 24420);
  });

  test('getFixtureLeadersForPeriod calculates period talk time', () => {
    const daily = getFixtureLeadersForPeriod('daily');
    const monthly = getFixtureLeadersForPeriod('monthly');
    const allTime = getFixtureLeadersForPeriod('allTime');
    expect(daily[0].talkTimeVal).toBe(3600);
    expect(monthly[0].talkTimeVal).toBe(72000);
    expect(allTime[0].talkTimeVal).toBe(24420);
  });

  test('backward-compatibility aliases work as expected', () => {
    expect(DEFAULT_MOCK_LEADERS).toBe(SAMPLE_LEADER_FIXTURES);
    expect(getMockLeadersForPeriod).toBe(getFixtureLeadersForPeriod);
  });
});
