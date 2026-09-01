import React, { useState, useEffect } from 'react';
import { Award, Trophy, Medal, ChevronLeft, Calendar, BarChart3, Globe, AlertCircle, RefreshCw, Crown, Activity } from 'lucide-react';
import { db, collection, onSnapshot } from '../firebase';
import { Meteors } from './Meteors';

export default function Leaderboard({ onBack, user, openUserProfile }) {
  const [activeTab, setActiveTab] = useState('daily');
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');

    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      try {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const now = new Date();
        const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        const currentWeekId = `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
        const currentMonthId = `${now.getUTCFullYear()}-${(now.getUTCMonth() + 1).toString().padStart(2, '0')}`;
        const currentDayId = `${now.getUTCFullYear()}-${(now.getUTCMonth() + 1).toString().padStart(2, '0')}-${now.getUTCDate().toString().padStart(2, '0')}`;

        const mappedLeaders = data.map(u => {
          const isDailyCurrent = u.dailyXpId === currentDayId;
          const isWeeklyCurrent = u.weeklyXpId === currentWeekId;
          const isMonthlyCurrent = u.monthlyXpId === currentMonthId;
          return {
            ...u,
            dailyXpVal: isDailyCurrent ? (u.dailyXp || 0) : 0,
            weeklyXpVal: isWeeklyCurrent ? (u.weeklyXp || 0) : 0,
            monthlyXpVal: isMonthlyCurrent ? (u.monthlyXp || 0) : 0,
            allTimeXpVal: u.xp || 0
          };
        });

        if (activeTab === 'daily') {
          mappedLeaders.sort((a, b) => b.dailyXpVal - a.dailyXpVal || b.allTimeXpVal - a.allTimeXpVal || a.name.localeCompare(b.name));
        } else if (activeTab === 'weekly') {
          mappedLeaders.sort((a, b) => b.weeklyXpVal - a.weeklyXpVal || b.allTimeXpVal - a.allTimeXpVal || a.name.localeCompare(b.name));
        } else if (activeTab === 'monthly') {
          mappedLeaders.sort((a, b) => b.monthlyXpVal - a.monthlyXpVal || b.allTimeXpVal - a.allTimeXpVal || a.name.localeCompare(b.name));
        } else {
          mappedLeaders.sort((a, b) => b.allTimeXpVal - a.allTimeXpVal || a.name.localeCompare(b.name));
        }

        setLeaders(mappedLeaders.slice(0, 50));
        setLoading(false);
      } catch (err) {
        console.error('Failed to process leaderboard data:', err);
        setError(err.message || 'Failed to load leaderboard.');
        setLoading(false);
      }
    }, (err) => {
      console.error('Leaderboard snapshot error:', err);
      setError('Firebase connection failed. Check your config.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeTab]);

  const userRankIndex = leaders.findIndex(l => l.id === user?.id);
  const currentUserInTop50 = userRankIndex !== -1;

  const renderRankIcon = (index) => {
    if (index === 0) return <Trophy className="w-5 h-5 text-[#3B82F6]" />;
    if (index === 1) return <Medal className="w-5 h-5 text-[#888A92]" />;
    if (index === 2) return <Medal className="w-5 h-5 text-[#D1D3D8]" />;
    return <span className="font-mono text-[#555861] w-5 text-center font-bold">{index + 1}</span>;
  };

  const formatMinutes = (xp) => {
    const mins = Math.floor((xp || 0) / 75);
    return mins > 0 ? mins.toLocaleString() : "0";
  };

  return (
    <div className="w-full min-h-[100dvh] bg-[#090A0F] relative overflow-x-hidden text-white flex flex-col items-center">
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
         <Meteors number={15} />
      </div>
      
      <div className="w-full max-w-[800px] mx-auto py-12 px-5 relative z-20">
        <button 
          onClick={onBack}
          className="mb-8 flex items-center gap-2 text-[#555861] hover:text-white transition-colors group"
        >
          <div className="bg-[#12141C] p-2 rounded-xl group-hover:bg-[#1A1D27] transition-colors border border-[#1E212B]">
            <ChevronLeft className="w-[18px] h-[18px]" strokeWidth={2} />
          </div>
          <span className="font-bold tracking-[0.15em] text-[11px] uppercase">Back</span>
        </button>

        <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-6">
          <div className="flex flex-col items-start w-full md:w-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1A1D27] border border-[#2A2E3B] mb-5 shadow-sm">
               <Award className="w-3.5 h-3.5 text-[#3B82F6]" />
               <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#3B82F6]">Leaderboard</span>
            </div>
            <h1 className="text-[42px] font-bold text-white tracking-tight leading-tight mb-2">
              Hall of Fame
            </h1>
            <p className="text-[#888A92] font-medium text-[15px]">
              The most active language learners on solith.in.
            </p>
          </div>

          <div className="flex w-full md:w-auto overflow-x-auto custom-scrollbar pb-2 md:pb-0">
            <div className="flex flex-nowrap bg-[#0C0E14] border border-[#1E212B] rounded-2xl p-1.5 shadow-xl">
              <button 
                onClick={() => setActiveTab('daily')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-[12px] text-[13px] font-bold transition-all whitespace-nowrap ${activeTab === 'daily' ? 'bg-[#212C45] text-[#60A5FA] border border-[#2A3B5C]' : 'text-[#888A92] hover:text-white border border-transparent'}`}
              >
                <Activity className="w-4 h-4" /> Daily
              </button>
              <button 
                onClick={() => setActiveTab('weekly')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-[12px] text-[13px] font-bold transition-all whitespace-nowrap ${activeTab === 'weekly' ? 'bg-[#212C45] text-[#60A5FA] border border-[#2A3B5C]' : 'text-[#888A92] hover:text-white border border-transparent'}`}
              >
                <Calendar className="w-4 h-4" /> Weekly
              </button>
              <button 
                onClick={() => setActiveTab('monthly')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-[12px] text-[13px] font-bold transition-all whitespace-nowrap ${activeTab === 'monthly' ? 'bg-[#212C45] text-[#60A5FA] border border-[#2A3B5C]' : 'text-[#888A92] hover:text-white border border-transparent'}`}
              >
                <BarChart3 className="w-4 h-4" /> Monthly
              </button>
              <button 
                onClick={() => setActiveTab('allTime')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-[12px] text-[13px] font-bold transition-all whitespace-nowrap ${activeTab === 'allTime' ? 'bg-[#212C45] text-[#60A5FA] border border-[#2A3B5C]' : 'text-[#888A92] hover:text-white border border-transparent'}`}
              >
                <Globe className="w-4 h-4" /> All-Time
              </button>
            </div>
          </div>
        </div>

        {/* Subscription Banner */}
        <div className="mb-10 w-full bg-[#1A1D27] border border-[#2A2E3B] rounded-[20px] p-5 sm:p-6 flex items-center gap-5 shadow-xl relative overflow-hidden group">
          <div className="w-12 h-12 shrink-0 bg-[#3B82F6]/10 rounded-2xl flex items-center justify-center border border-[#3B82F6]/20">
            <Crown className="w-6 h-6 text-[#3B82F6]" />
          </div>
          <div>
            <h3 className="text-white font-bold text-[16px] mb-1 tracking-tight">Premium Subscription Reward</h3>
            <p className="text-[#888A92] text-[14px] font-medium">Rank in the <strong className="text-white">Top 3</strong> this month to automatically win a free Premium Subscription!</p>
          </div>
        </div>

      <div className="bg-[#0C0E14] border border-[#1E212B] rounded-[24px] overflow-hidden shadow-2xl relative min-w-0">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-8 h-8 border-2 border-[#1E212B] border-t-[#3B82F6] rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-center px-8">
            <AlertCircle className="w-10 h-10 text-red-400" />
            <p className="text-[#888A92] text-[15px]">{error}</p>
            <button
              onClick={() => setActiveTab(t => t)}
              className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-[#12141C] border border-[#1E212B] rounded-xl text-white hover:bg-[#1A1D27] transition-colors text-[13px] font-bold"
            >
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </div>
        ) : (
          <>
            <div className="divide-y divide-[#1E212B]">
              {leaders.length === 0 ? (
                <div className="py-24 flex flex-col items-center justify-center gap-4 text-center px-8">
                  <div className="w-16 h-16 rounded-2xl bg-[#12141C] border border-[#1E212B] flex items-center justify-center mb-2 shadow-inner">
                    <Trophy className="w-8 h-8 text-[#555861]" />
                  </div>
                  <h3 className="text-[17px] font-bold text-white">No active speakers yet</h3>
                  <p className="text-[#888A92] text-[14px] max-w-sm leading-relaxed mt-1">
                    {activeTab === 'daily'
                      ? 'No time spent talking today. Join a voice room to lead the daily board!'
                      : activeTab === 'weekly'
                      ? 'No one has spent time talking this week. Join a voice room to rank up!'
                      : activeTab === 'monthly'
                      ? 'No active speaking time this month yet. Start practicing!'
                      : 'No users have tracked time yet.'}
                  </p>
                </div>
              ) : (
                leaders.map((leader, index) => (
                  <div 
                    key={leader.id} 
                    onClick={() => {
                      if (openUserProfile) openUserProfile(leader.id);
                    }}
                    className={`flex items-center gap-4 sm:gap-6 px-6 sm:px-8 py-5 transition-all group cursor-pointer hover:bg-[#12141C] ${
                      leader.id === user?.id ? 'bg-[#12141C]/50' : ''
                    } ${index < 3 ? 'border-l-4 border-[#3B82F6]' : 'border-l-4 border-transparent'}`}
                  >
                    <div className="w-8 flex justify-center flex-shrink-0">
                      {renderRankIcon(index)}
                    </div>
                    
                    <div className="w-12 h-12 rounded-[14px] overflow-hidden bg-[#1E212B] flex items-center justify-center flex-shrink-0 shadow-sm border border-[#2A2E3B]" style={{ backgroundColor: leader.color || '#1E212B' }}>
                      {leader.photoUrl ? (
                        <img src={leader.photoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl">{leader.emoji || '👤'}</span>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-white text-[16px] truncate tracking-tight">{leader.name}</span>
                        {leader.id === user?.id && (
                          <span className="bg-[#212C45] border border-[#2A3B5C] text-[#60A5FA] text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-[6px]">You</span>
                        )}
                      </div>
                      <div className="text-[#555861] text-[13px] font-medium mt-1">
                        {activeTab === 'allTime' ? 'Legend' : (activeTab === 'monthly' ? 'Dedicated' : 'Active Speaker')}
                      </div>
                    </div>
                    
                    <div className="text-right flex flex-col items-end justify-center">
                      <div className="font-bold text-[20px] sm:text-[22px] text-white tracking-tight leading-none mb-1">
                        {formatMinutes(activeTab === 'daily' ? leader.dailyXpVal : (activeTab === 'weekly' ? leader.weeklyXpVal : (activeTab === 'monthly' ? leader.monthlyXpVal : leader.allTimeXpVal)))}
                      </div>
                      <div className="text-[10px] text-[#555861] font-bold uppercase tracking-[0.1em]">Minutes</div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Pinned Current User if not in Top 50 */}
            {!loading && user && !currentUserInTop50 && (
              <div className="border-t border-[#1E212B] bg-[#090A0F] p-6 relative overflow-hidden">
                 <div className="flex items-center gap-4 sm:gap-6 px-2 relative z-10">
                    <div className="w-8 flex justify-center">
                      <span className="font-mono text-[#555861] text-[13px] font-bold">-</span>
                    </div>
                    
                    <div className="w-12 h-12 rounded-[14px] overflow-hidden bg-[#1E212B] flex items-center justify-center flex-shrink-0 border border-[#2A2E3B] shadow-sm" style={{ backgroundColor: user.color || '#1E212B' }}>
                      {user.photoUrl ? (
                        <img src={user.photoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl">{user.emoji || '👤'}</span>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-bold text-white text-[16px] truncate tracking-tight">{user.name}</span>
                        <span className="bg-[#212C45] border border-[#2A3B5C] text-[#60A5FA] text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-[6px]">You</span>
                      </div>
                      <div className="text-[#3B82F6] text-[13px] font-bold tracking-wide">Keep talking to rank up!</div>
                    </div>
                 </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  </div>
  );
}
