import React, { useState, useEffect } from 'react';
import { Award, Trophy, Medal, ChevronLeft, Calendar, BarChart3, Globe, AlertCircle, RefreshCw, Crown } from 'lucide-react';
import { db, collection, getDocs } from '../firebase';
import { Meteors } from './Meteors';

export default function Leaderboard({ onBack, user, openUserProfile }) {
  const [activeTab, setActiveTab] = useState('weekly');
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      setError('');
      try {
        // Fetch all users with a 4-second timeout protection in case Cloud Firestore API is disabled
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Firebase connection timeout. Please make sure the Cloud Firestore API is enabled in your Firebase Console project (solith-df915).")), 4000)
        );
        const snapshot = await Promise.race([
          getDocs(collection(db, 'users')),
          timeoutPromise
        ]);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const now = new Date();
        const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        const currentWeekId = `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
        const currentMonthId = `${now.getUTCFullYear()}-${(now.getUTCMonth() + 1).toString().padStart(2, '0')}`;

        // Map users to have explicit XP scores for active scopes (defaulting to 0) so we rank everyone
        const mappedLeaders = data.map(u => {
          const isWeeklyCurrent = u.weeklyXpId === currentWeekId;
          const isMonthlyCurrent = u.monthlyXpId === currentMonthId;
          return {
            ...u,
            weeklyXpVal: isWeeklyCurrent ? (u.weeklyXp || 0) : 0,
            monthlyXpVal: isMonthlyCurrent ? (u.monthlyXp || 0) : 0,
            allTimeXpVal: u.xp || 0
          };
        });

        if (activeTab === 'weekly') {
          mappedLeaders.sort((a, b) => b.weeklyXpVal - a.weeklyXpVal || b.allTimeXpVal - a.allTimeXpVal || a.name.localeCompare(b.name));
        } else if (activeTab === 'monthly') {
          mappedLeaders.sort((a, b) => b.monthlyXpVal - a.monthlyXpVal || b.allTimeXpVal - a.allTimeXpVal || a.name.localeCompare(b.name));
        } else {
          mappedLeaders.sort((a, b) => b.allTimeXpVal - a.allTimeXpVal || a.name.localeCompare(b.name));
        }

        setLeaders(mappedLeaders.slice(0, 50));
      } catch (err) {
        console.error('Failed to fetch leaderboard:', err);
        setError(err.message || 'Failed to load leaderboard. Check your connection.');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [activeTab]);

  const userRankIndex = leaders.findIndex(l => l.id === user?.id);
  const currentUserInTop50 = userRankIndex !== -1;

  const renderRankIcon = (index) => {
    if (index === 0) return <Trophy className="w-5 h-5 text-accent-primary" />;
    if (index === 1) return <Medal className="w-5 h-5 text-text-secondary" />;
    if (index === 2) return <Medal className="w-5 h-5 text-accent-secondary" />;
    return <span className="font-mono text-text-primary/50 w-5 text-center">{index + 1}</span>;
  };

  return (
    <div className="w-full min-h-screen bg-[#0B0D12] relative overflow-x-hidden">
      <Meteors number={20} />
      
      <div className="w-full max-w-4xl mx-auto py-10 sm:py-12 px-4 md:px-8 animate-fade-in relative z-20">
        <button 
          onClick={onBack}
          className="mb-8 flex items-center gap-2 text-white/50 hover:text-white transition-colors group"
        >
          <div className="bg-white/5 p-2 rounded-xl group-hover:bg-white/10 transition-colors border border-white/5">
            <ChevronLeft className="w-5 h-5" />
          </div>
          <span className="font-bold tracking-widest text-sm uppercase">Back</span>
        </button>

        <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-6">
          <div className="flex flex-col items-start">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 mb-4">
               <Award className="w-4 h-4 text-[var(--accent-primary)]" />
               <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--accent-primary)]">Leaderboard</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-white/40 tracking-tight flex items-center gap-4 drop-shadow-2xl">
              Hall of Fame
            </h1>
            <p className="text-white/50 mt-3 font-medium text-lg">The most active language learners on solith.in.</p>
          </div>

          <div className="flex flex-wrap justify-center bg-white/[0.03] border border-white/10 rounded-2xl p-1.5 backdrop-blur-xl gap-1 shadow-2xl">
            <button 
              onClick={() => setActiveTab('weekly')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'weekly' ? 'bg-[var(--accent-primary)] text-white shadow-[0_0_20px_rgba(24,119,242,0.4)]' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
            >
              <Calendar className="w-4 h-4" /> Weekly
            </button>
            <button 
              onClick={() => setActiveTab('monthly')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'monthly' ? 'bg-[var(--accent-primary)] text-white shadow-[0_0_20px_rgba(24,119,242,0.4)]' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
            >
              <BarChart3 className="w-4 h-4" /> Monthly
            </button>
            <button 
              onClick={() => setActiveTab('allTime')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'allTime' ? 'bg-[var(--accent-primary)] text-white shadow-[0_0_20px_rgba(24,119,242,0.4)]' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
            >
              <Globe className="w-4 h-4" /> All-Time
            </button>
          </div>
          </div>
        </div>

        {/* Subscription Banner */}
        <div className="mb-8 w-full bg-gradient-to-r from-amber-500/20 via-amber-400/30 to-amber-500/20 border border-amber-400/30 rounded-2xl p-4 sm:p-5 flex items-center gap-4 sm:gap-6 shadow-[0_0_30px_rgba(251,191,36,0.15)] animate-fade-in relative overflow-hidden group cursor-default">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
          <div className="w-12 h-12 shrink-0 bg-amber-400/20 rounded-full flex items-center justify-center border border-amber-400/30 shadow-inner">
            <Crown className="w-6 h-6 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)] animate-pulse" />
          </div>
          <div>
            <h3 className="text-amber-400 font-extrabold text-lg leading-tight mb-1 tracking-tight">Premium Subscription Reward!</h3>
            <p className="text-amber-100/70 text-sm font-medium">Rank in the <strong className="text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">Top 3</strong> this month to automatically win a free Premium Subscription!</p>
          </div>
        </div>

      <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl relative min-w-0">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--accent-primary)] via-purple-500 to-[var(--accent-primary)] opacity-50"></div>
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-12 h-12 border-4 border-white/10 border-t-[var(--accent-primary)] rounded-full animate-spin"></div>
            <div className="text-white/50 text-[11px] font-extrabold tracking-[0.25em] uppercase">Loading Rankings...</div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-center px-8">
            <AlertCircle className="w-12 h-12 text-red-400/60" />
            <p className="text-white/40 text-sm">{error}</p>
            <button
              onClick={() => setActiveTab(t => t)}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors text-sm font-semibold"
            >
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </div>
        ) : (
          <>
            <div className="divide-y divide-white/5">
              {leaders.length === 0 ? (
                <div className="py-24 flex flex-col items-center justify-center gap-4 text-center px-8">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-2">
                    <Trophy className="w-8 h-8 text-white/20" />
                  </div>
                  <h3 className="text-xl font-bold text-white/60">No rankings yet</h3>
                  <p className="text-white/30 text-sm max-w-xs leading-relaxed">
                    {activeTab === 'weekly'
                      ? 'No one has earned XP this week. Join a voice room to be first on the weekly board!'
                      : activeTab === 'monthly'
                      ? 'No XP earned this month yet. Start practicing to claim the #1 spot!'
                      : 'No users have earned XP yet. Be the first to rank up!'}
                  </p>
                </div>
              ) : (
                leaders.map((leader, index) => (
                  <div 
                    key={leader.id} 
                    onClick={() => {
                      if (openUserProfile) openUserProfile(leader.id);
                    }}
                    className={`flex items-center gap-4 sm:gap-6 px-6 sm:px-8 py-5 transition-all group cursor-pointer ${
                      leader.id === user?.id 
                        ? 'bg-[var(--accent-primary)]/10' 
                        : (index < 3 ? 'bg-gradient-to-r from-amber-500/10 to-transparent hover:from-amber-500/20' : 'hover:bg-white/[0.02]')
                    } ${index < 3 ? 'border-l-4 border-amber-400' : 'border-l-4 border-transparent'}`}
                  >
                    <div className="w-10 flex justify-center flex-shrink-0">
                      {renderRankIcon(index)}
                    </div>
                    
                    <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden bg-white/10 flex items-center justify-center flex-shrink-0 shadow-lg ${leader.id === user?.id ? 'border-2 border-[var(--accent-primary)]' : 'border border-white/10 group-hover:border-white/20 transition-colors'}`} style={{ backgroundColor: leader.color || '#333' }}>
                      {leader.photoUrl ? (
                        <img src={leader.photoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl">{leader.emoji || '👤'}</span>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="font-extrabold text-white text-lg sm:text-xl truncate tracking-tight">{leader.name}</span>
                        {leader.id === user?.id && (
                          <span className="bg-[var(--accent-primary)] text-white text-[10px] uppercase tracking-widest font-black px-2.5 py-1 rounded-full shadow-[0_0_10px_var(--accent-primary)]">You</span>
                        )}
                      </div>
                      <div className="text-white/40 text-sm font-medium mt-0.5">
                        {activeTab === 'allTime' ? 'Legend' : (activeTab === 'monthly' ? 'Dedicated' : 'Active')}
                      </div>
                    </div>
                    
                    <div className="text-right flex flex-col items-end justify-center">
                      <div className="font-black text-2xl sm:text-3xl text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60 drop-shadow-sm leading-none mb-1">
                        {activeTab === 'weekly' ? leader.weeklyXpVal : (activeTab === 'monthly' ? leader.monthlyXpVal : leader.allTimeXpVal)}
                      </div>
                      <div className="text-[11px] text-[var(--accent-primary)] font-extrabold uppercase tracking-[0.2em]">XP</div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Pinned Current User if not in Top 50 */}
            {!loading && user && !currentUserInTop50 && (
              <div className="border-t border-[var(--accent-primary)]/30 bg-black/60 p-6 relative overflow-hidden mt-4">
                 <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent-primary)]/10 to-transparent pointer-events-none"></div>
                 <div className="flex items-center gap-4 sm:gap-6 px-2 relative z-10">
                    <div className="w-10 flex justify-center">
                      <span className="font-mono text-white/30 text-sm font-bold">-</span>
                    </div>
                    
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden bg-white/10 flex items-center justify-center flex-shrink-0 border-2 border-[var(--accent-primary)]/50 shadow-[0_0_15px_rgba(24,119,242,0.2)]" style={{ backgroundColor: user.color || '#333' }}>
                      {user.photoUrl ? (
                        <img src={user.photoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl">{user.emoji || '👤'}</span>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-extrabold text-white text-lg sm:text-xl truncate">{user.name}</span>
                        <span className="bg-[var(--accent-primary)] text-white text-[10px] uppercase tracking-widest font-black px-2.5 py-1 rounded-full shadow-[0_0_10px_var(--accent-primary)]">You</span>
                      </div>
                      <div className="text-[var(--accent-primary)] text-sm font-bold tracking-wide">Keep talking to rank up!</div>
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
