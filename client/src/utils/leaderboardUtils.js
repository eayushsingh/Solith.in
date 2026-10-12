/**
 * Utility functions for Leaderboard date/period calculations, sorting, and formatting.
 */

export function getCurrentPeriodIds(now = new Date()) {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  
  const currentWeekId = `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
  const currentMonthId = `${now.getUTCFullYear()}-${(now.getUTCMonth() + 1).toString().padStart(2, '0')}`;
  const currentDayId = `${now.getUTCFullYear()}-${(now.getUTCMonth() + 1).toString().padStart(2, '0')}-${now.getUTCDate().toString().padStart(2, '0')}`;

  return { currentDayId, currentWeekId, currentMonthId };
}

export function mapAndSortLeaders(users = [], activeTab = 'daily', now = new Date()) {
  if (!Array.isArray(users) || users.length === 0) return [];
  const { currentDayId, currentWeekId, currentMonthId } = getCurrentPeriodIds(now);

  const mappedLeaders = users.map(u => {
    const isDailyCurrent = u.dailyXpId === currentDayId;
    const isWeeklyCurrent = u.weeklyXpId === currentWeekId;
    const isMonthlyCurrent = u.monthlyXpId === currentMonthId;
    return {
      ...u,
      dailyXpVal: isDailyCurrent ? (u.dailyXp || 0) : 0,
      weeklyXpVal: isWeeklyCurrent ? (u.weeklyXp || 0) : 0,
      monthlyXpVal: isMonthlyCurrent ? (u.monthlyXp || 0) : 0,
      allTimeXpVal: u.xp || 0,
      dailyTalkTimeVal: isDailyCurrent ? (u.dailyTalkTimeSeconds ?? ((u.dailyXp || 0) / 1.25)) : 0,
      weeklyTalkTimeVal: isWeeklyCurrent ? (u.weeklyTalkTimeSeconds ?? ((u.weeklyXp || 0) / 1.25)) : 0,
      monthlyTalkTimeVal: isMonthlyCurrent ? (u.monthlyTalkTimeSeconds ?? ((u.monthlyXp || 0) / 1.25)) : 0,
      allTimeTalkTimeVal: u.talkTimeSeconds ?? ((u.xp || 0) / 1.25)
    };
  });

  if (activeTab === 'daily') {
    mappedLeaders.sort((a, b) => b.dailyTalkTimeVal - a.dailyTalkTimeVal || b.allTimeTalkTimeVal - a.allTimeTalkTimeVal || (a.name || '').localeCompare(b.name || ''));
  } else if (activeTab === 'weekly') {
    mappedLeaders.sort((a, b) => b.weeklyTalkTimeVal - a.weeklyTalkTimeVal || b.allTimeTalkTimeVal - a.allTimeTalkTimeVal || (a.name || '').localeCompare(b.name || ''));
  } else if (activeTab === 'monthly') {
    mappedLeaders.sort((a, b) => b.monthlyTalkTimeVal - a.monthlyTalkTimeVal || b.allTimeTalkTimeVal - a.allTimeTalkTimeVal || (a.name || '').localeCompare(b.name || ''));
  } else {
    mappedLeaders.sort((a, b) => b.allTimeTalkTimeVal - a.allTimeTalkTimeVal || (a.name || '').localeCompare(b.name || ''));
  }

  return mappedLeaders;
}

export function safeNumber(val, defaultVal = 0) {
  if (typeof val !== 'number' || isNaN(val)) return defaultVal;
  return val;
}

export function formatMinutes(seconds) {
  const safeSec = safeNumber(seconds, 0);
  const mins = Math.floor(safeSec / 60);
  return mins > 0 ? mins.toLocaleString() : "0";
}

export function formatHoursAndMinutes(seconds) {
  const safeSec = safeNumber(seconds, 0);
  const totalMins = Math.floor(safeSec / 60);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

export function calculateStreakTier(streak = 1) {
  const s = safeNumber(streak, 1);
  if (s >= 30) return { tier: 'Legend', color: '#F59E0B' };
  if (s >= 14) return { tier: 'Diamond', color: '#3B82F6' };
  if (s >= 7) return { tier: 'Gold', color: '#EAB308' };
  if (s >= 3) return { tier: 'Silver', color: '#94A3B8' };
  return { tier: 'Bronze', color: '#CD7F32' };
}
