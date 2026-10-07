import { getCurrentPeriodIds, mapAndSortLeaders, formatMinutes } from './leaderboardUtils.js';

describe('leaderboardUtils', () => {
  test('getCurrentPeriodIds returns correctly formatted date strings', () => {
    const fixedDate = new Date('2026-10-07T12:00:00Z');
    const { currentDayId, currentWeekId, currentMonthId } = getCurrentPeriodIds(fixedDate);

    expect(currentDayId).toBe('2026-10-07');
    expect(currentMonthId).toBe('2026-10');
    expect(currentWeekId).toMatch(/^2026-W\d{2}$/);
  });

  test('mapAndSortLeaders ranks users correctly by daily talk time', () => {
    const users = [
      { id: 'u1', name: 'Alice', dailyXp: 100, dailyXpId: '2026-10-07' },
      { id: 'u2', name: 'Bob', dailyXp: 200, dailyXpId: '2026-10-07' },
    ];
    const sorted = mapAndSortLeaders(users, 'daily', new Date('2026-10-07T12:00:00Z'));
    expect(sorted[0].name).toBe('Bob');
    expect(sorted[1].name).toBe('Alice');
  });

  test('formatMinutes formats seconds into formatted minute strings', () => {
    expect(formatMinutes(0)).toBe('0');
    expect(formatMinutes(120)).toBe('2');
    expect(formatMinutes(3600)).toBe('60');
  });
});
