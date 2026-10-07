/**
 * Default fallback mock dataset for Leaderboard offline demo mode
 */

export const DEFAULT_MOCK_LEADERS = [
  { id: 'def_1', name: 'Sophia Chen', emoji: '🌟', xp: 4850, dailyTalkTimeVal: 3600, weeklyTalkTimeVal: 18000, monthlyTalkTimeVal: 72000, allTimeTalkTimeVal: 232000, streakDays: 14 },
  { id: 'def_2', name: 'Alexander Wright', emoji: '🎯', xp: 3920, dailyTalkTimeVal: 2800, weeklyTalkTimeVal: 14500, monthlyTalkTimeVal: 58000, allTimeTalkTimeVal: 188000, streakDays: 11 },
  { id: 'def_3', name: 'Elena Rostova', emoji: '👑', xp: 3410, dailyTalkTimeVal: 2400, weeklyTalkTimeVal: 12000, monthlyTalkTimeVal: 49000, allTimeTalkTimeVal: 163000, streakDays: 9 },
  { id: 'def_4', name: 'Lucas Silva', emoji: '🔥', xp: 2950, dailyTalkTimeVal: 1900, weeklyTalkTimeVal: 9800, monthlyTalkTimeVal: 39000, allTimeTalkTimeVal: 141000, streakDays: 7 },
  { id: 'def_5', name: 'Aarav Patel', emoji: '🚀', xp: 2600, dailyTalkTimeVal: 1600, weeklyTalkTimeVal: 8400, monthlyTalkTimeVal: 33000, allTimeTalkTimeVal: 124000, streakDays: 5 }
];

export function getMockLeadersForPeriod(period = 'daily') {
  return DEFAULT_MOCK_LEADERS.map(user => {
    let talkTime = user.dailyTalkTimeVal;
    if (period === 'weekly') talkTime = user.weeklyTalkTimeVal;
    if (period === 'monthly') talkTime = user.monthlyTalkTimeVal;
    if (period === 'allTime') talkTime = user.allTimeTalkTimeVal;
    return { ...user, talkTimeVal: talkTime };
  });
}
