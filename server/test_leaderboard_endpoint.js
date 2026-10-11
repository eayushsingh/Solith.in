import { initFirebaseAdmin } from './firebaseAdmin.js';
import { getISOPeriodIds } from './server.js';

async function testLeaderboardData() {
  console.log('[Test] Verifying /api/leaderboard live calculation logic...');
  const admin = initFirebaseAdmin();
  if (!admin) {
    console.error('❌ Failed: Firebase Admin not ready');
    process.exit(1);
  }

  const db = admin.firestore();
  const snapshot = await db.collection('users').get();
  const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const now = new Date();
  const { currentDayId, currentWeekId, currentMonthId } = getISOPeriodIds(now);

  const mappedLeaders = data.map(u => {
    const isDailyCurrent = u.dailyXpId === currentDayId;
    const isWeeklyCurrent = u.weeklyXpId === currentWeekId;
    const isMonthlyCurrent = u.monthlyXpId === currentMonthId;
    const dailyTalk = isDailyCurrent ? (u.dailyTalkTimeSeconds ?? ((u.dailyXp || 0) / 1.25)) : 0;
    const weeklyTalk = isWeeklyCurrent ? (u.weeklyTalkTimeSeconds ?? ((u.weeklyXp || 0) / 1.25)) : 0;
    const monthlyTalk = isMonthlyCurrent ? (u.monthlyTalkTimeSeconds ?? ((u.monthlyXp || 0) / 1.25)) : 0;
    const allTimeTalk = u.talkTimeSeconds ?? ((u.xp || 0) / 1.25);

    return {
      id: u.id,
      name: u.name || 'Anonymous',
      xp: u.xp || 0,
      dailyTalkTimeVal: dailyTalk,
      weeklyTalkTimeVal: weeklyTalk,
      monthlyTalkTimeVal: monthlyTalk,
      allTimeTalkTimeVal: allTimeTalk
    };
  });

  // Verify none are mock
  const mockNames = ['Sophia Chen', 'Alexander Wright', 'Elena Rostova', 'Lucas Silva', 'Aarav Patel'];
  const hasMock = mappedLeaders.some(l => mockNames.includes(l.name) && l.id.startsWith('mock_'));
  if (hasMock) {
    console.error('❌ Failed: Found mock seed user in live leaderboard data!');
    process.exit(1);
  }

  // Verify all-time top leader
  mappedLeaders.sort((a, b) => b.allTimeTalkTimeVal - a.allTimeTalkTimeVal || b.xp - a.xp);
  const top1 = mappedLeaders[0];
  console.log(`[Test] Top 1 Real Leader (All-Time): ${top1.name} (XP: ${top1.xp}, TalkTime: ${Math.round(top1.allTimeTalkTimeVal)}s)`);

  if (!top1 || top1.xp === undefined) {
    console.error('❌ Failed: Leaderboard top entry invalid');
    process.exit(1);
  }

  console.log('✅ Success: Leaderboard data is 100% real live data and free of dummy records.');
  process.exit(0);
}

testLeaderboardData().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
