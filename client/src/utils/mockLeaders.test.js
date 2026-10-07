import { DEFAULT_MOCK_LEADERS, getMockLeadersForPeriod } from './mockLeaders.js';

describe('mockLeaders', () => {
  test('DEFAULT_MOCK_LEADERS contains valid user array', () => {
    expect(Array.isArray(DEFAULT_MOCK_LEADERS)).toBe(true);
    expect(DEFAULT_MOCK_LEADERS.length).toBeGreaterThan(0);
    expect(DEFAULT_MOCK_LEADERS[0]).toHaveProperty('name');
    expect(DEFAULT_MOCK_LEADERS[0]).toHaveProperty('xp');
  });

  test('getMockLeadersForPeriod calculates period talk time', () => {
    const daily = getMockLeadersForPeriod('daily');
    const monthly = getMockLeadersForPeriod('monthly');
    expect(daily[0].talkTimeVal).toBe(3600);
    expect(monthly[0].talkTimeVal).toBe(72000);
  });
});
