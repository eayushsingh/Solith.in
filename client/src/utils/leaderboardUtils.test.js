import { getCurrentPeriodIds, formatMinutes, formatHoursAndMinutes, calculateStreakTier, safeNumber } from './leaderboardUtils.js';

describe('leaderboardUtils Edge Cases', () => {
  test('getCurrentPeriodIds returns correct formats for standard dates', () => {
    const testDate = new Date(Date.UTC(2026, 9, 12)); // Oct 12, 2026
    const { currentDayId, currentWeekId, currentMonthId } = getCurrentPeriodIds(testDate);
    
    expect(currentDayId).toBe('2026-10-12');
    expect(currentMonthId).toBe('2026-10');
    expect(currentWeekId).toMatch(/^2026-W\d{2}$/);
  });

  test('getCurrentPeriodIds handles year-end and leap years properly', () => {
    // Leap year Feb 29
    const leapDate = new Date(Date.UTC(2028, 1, 29));
    const { currentDayId, currentMonthId } = getCurrentPeriodIds(leapDate);
    expect(currentDayId).toBe('2028-02-29');
    expect(currentMonthId).toBe('2028-02');
  });

  test('formatMinutes handles zeros, nulls, and large inputs', () => {
    expect(formatMinutes(0)).toBe('0');
    expect(formatMinutes(null)).toBe('0');
    expect(formatMinutes(undefined)).toBe('0');
    expect(formatMinutes(NaN)).toBe('0');
    expect(formatMinutes(60)).toBe('1');
    expect(formatMinutes(3600)).toBe('60');
    expect(formatMinutes(72000)).toBe('1,200');
  });

  test('formatHoursAndMinutes formats properly', () => {
    expect(formatHoursAndMinutes(45 * 60)).toBe('45m');
    expect(formatHoursAndMinutes(125 * 60)).toBe('2h 5m');
    expect(formatHoursAndMinutes(0)).toBe('0m');
  });

  test('calculateStreakTier returns appropriate tiers', () => {
    expect(calculateStreakTier(1).tier).toBe('Bronze');
    expect(calculateStreakTier(5).tier).toBe('Silver');
    expect(calculateStreakTier(10).tier).toBe('Gold');
    expect(calculateStreakTier(20).tier).toBe('Diamond');
    expect(calculateStreakTier(50).tier).toBe('Legend');
  });

  test('safeNumber guards against unexpected non-numbers', () => {
    expect(safeNumber(42)).toBe(42);
    expect(safeNumber('hello', 0)).toBe(0);
    expect(safeNumber(NaN, 10)).toBe(10);
    expect(safeNumber(undefined, 5)).toBe(5);
  });

  test('mapAndSortLeaders correctly ranks realistic user dataset', () => {
    const fixedNow = new Date('2026-10-12T12:00:00Z');
    const { currentDayId } = getCurrentPeriodIds(fixedNow);

    const testUsers = [
      { id: '1', name: 'Ayush Singh', xp: 49623, talkTimeSeconds: 24420, dailyXpId: currentDayId, dailyTalkTimeSeconds: 3600 },
      { id: '2', name: 'KLZ', xp: 24172, talkTimeSeconds: 19321, dailyXpId: currentDayId, dailyTalkTimeSeconds: 4200 },
      { id: '3', name: 'Nax', xp: 11626, talkTimeSeconds: 9289, dailyXpId: '2026-09-01', dailyTalkTimeSeconds: 5000 }
    ];

    const dailySorted = mapAndSortLeaders(testUsers, 'daily', fixedNow);
    expect(dailySorted[0].name).toBe('KLZ');
    expect(dailySorted[1].name).toBe('Ayush Singh');
    expect(dailySorted[2].name).toBe('Nax');

    const allTimeSorted = mapAndSortLeaders(testUsers, 'allTime', fixedNow);
    expect(allTimeSorted[0].name).toBe('Ayush Singh');
    expect(allTimeSorted[1].name).toBe('KLZ');
    expect(allTimeSorted[2].name).toBe('Nax');
  });
});
