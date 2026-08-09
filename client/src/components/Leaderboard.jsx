import React, { useState, useEffect } from 'react';
import { Award, Trophy, Medal, ChevronLeft, Calendar, BarChart3, Globe } from 'lucide-react';
import { db, collection, query, orderBy, limit, getDocs } from '../firebase';

export default function Leaderboard({ onBack, user }) {
  const [activeTab, setActiveTab] = useState('weekly'); // weekly, monthly, allTime
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        let field = 'xp';
        if (activeTab === 'weekly') field = 'weeklyXp';
        if (activeTab === 'monthly') field = 'monthlyXp';

        // NOTE: Firestore requires an index for ordering.
        const q = query(
          collection(db, 'users'),
          orderBy(field, 'desc'),
          limit(50)
        );

        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // For weekly and monthly, we need to filter out old data manually if weekId/monthId is stale.
        // Actually, users with stale weekId will just have old data.
        // To be perfectly accurate, we should ideally check their weekId against current weekId,
        // but for V1 we'll just display the raw values (they get reset when the user earns XP next anyway).
        // Since we didn't do a global cron job to reset everyone's XP to 0, stale users will remain on the leaderboard
        // UNLESS we filter them out. Let's filter them out for accuracy.

        const now = new Date();
        const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
        const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
        const currentWeekId = `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
        const currentMonthId = `${now.getUTCFullYear()}-${(now.getUTCMonth() + 1).toString().padStart(2, '0')}`;

        let validLeaders = data;
        if (activeTab === 'weekly') {
          validLeaders = data.filter(u => u.weeklyXpId === currentWeekId && u.weeklyXp > 0);
        } else if (activeTab === 'monthly') {
          validLeaders = data.filter(u => u.monthlyXpId === currentMonthId && u.monthlyXp > 0);
        } else {
          validLeaders = data.filter(u => u.xp > 0);
        }

        setLeaders(validLeaders);
      } catch (err) {
        console.error("Failed to fetch leaderboard:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [activeTab]);

  const userRankIndex = leaders.findIndex(l => l.id === user?.id);
  const currentUserInTop50 = userRankIndex !== -1;

  const renderRankIcon = (index) => {
    if (index === 0) return <Trophy className="w-5 h-5 text-yellow-400" />;
    if (index === 1) return <Medal className="w-5 h-5 text-gray-300" />;
    if (index === 2) return <Medal className="w-5 h-5 text-amber-700" />;
    return <span className="font-mono text-white/50 w-5 text-center">{index + 1}</span>;
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-10 sm:py-12 px-4 md:px-8 animate-fade-in relative z-20 overflow-x-hidden">
      <button 
        onClick={onBack}
        className="mb-8 flex items-center gap-2 text-white/60 hover:text-white transition-colors group"
      >
        <div className="bg-white/5 p-2 rounded-full group-hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </div>
        <span className="font-bold tracking-widest text-sm uppercase">Back</span>
      </button>

      <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent)] to-[#b042ff] tracking-tight flex items-center gap-4">
            <Award className="w-10 h-10 text-[var(--accent)]" /> 
            Hall of Fame
          </h1>
          <p className="text-white/60 mt-2">The most active language learners on SOLITH.IN.</p>
        </div>

        <div className="flex flex-wrap justify-center bg-black/40 border border-white/10 rounded-xl p-1.5 backdrop-blur-md gap-1">
          <button 
            onClick={() => setActiveTab('weekly')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'weekly' ? 'bg-[var(--accent)] text-white shadow-[0_0_15px_rgba(0,229,255,0.3)]' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
          >
            <Calendar className="w-4 h-4" /> Weekly
          </button>
          <button 
            onClick={() => setActiveTab('monthly')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'monthly' ? 'bg-[var(--accent)] text-white shadow-[0_0_15px_rgba(0,229,255,0.3)]' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
          >
            <BarChart3 className="w-4 h-4" /> Monthly
          </button>
          <button 
            onClick={() => setActiveTab('allTime')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'allTime' ? 'bg-[var(--accent)] text-white shadow-[0_0_15px_rgba(0,229,255,0.3)]' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
          >
            <Globe className="w-4 h-4" /> All-Time
          </button>
        </div>
      </div>

      <div className="bg-[#1a1c23]/80 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative min-w-0">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--accent)] to-[#b042ff]"></div>
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-white/10 border-t-[var(--accent)] rounded-full animate-spin mb-4"></div>
            <div className="text-white/50 text-sm font-bold tracking-widest uppercase">Loading ranks...</div>
          </div>
        ) : (
          <>
            <div className="divide-y divide-white/5">
              {leaders.length === 0 ? (
                <div className="py-20 text-center text-white/40">No activity yet. Be the first!</div>
              ) : (
                leaders.map((leader, index) => (
                  <div 
                    key={leader.id} 
                    className={`flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-4 transition-colors ${leader.id === user?.id ? 'bg-[var(--accent)]/10 border-l-4 border-l-[var(--accent)]' : 'hover:bg-white/5'}`}
                  >
                    <div className="w-8 flex justify-center">
                      {renderRankIcon(index)}
                    </div>
                    
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full overflow-hidden bg-white/10 flex items-center justify-center flex-shrink-0" style={{ backgroundColor: leader.color || '#333' }}>
                      {leader.photoUrl ? (
                        <img src={leader.photoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl">{leader.emoji || '👤'}</span>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-lg truncate">{leader.name}</span>
                        {leader.id === user?.id && (
                          <span className="bg-[var(--accent)] text-white text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full">You</span>
                        )}
                      </div>
                      <div className="text-white/40 text-sm">
                        {activeTab === 'allTime' ? 'Legend' : (activeTab === 'monthly' ? 'Dedicated' : 'Active')}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="font-black text-xl text-transparent bg-clip-text bg-gradient-to-br from-white to-white/50">
                        {activeTab === 'weekly' ? leader.weeklyXp : (activeTab === 'monthly' ? leader.monthlyXp : leader.xp)}
                      </div>
                      <div className="text-[10px] text-[var(--accent-light)] font-bold uppercase tracking-widest">XP</div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Pinned Current User if not in Top 50 */}
            {!loading && user && !currentUserInTop50 && (
              <div className="border-t-2 border-[var(--accent)] bg-black/40 p-4 relative overflow-hidden mt-4">
                 <div className="absolute inset-0 bg-[var(--accent)]/5 pointer-events-none"></div>
                 <div className="flex items-center gap-4 px-2">
                    <div className="w-8 flex justify-center">
                      <span className="font-mono text-white/30 text-sm">-</span>
                    </div>
                    
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-white/10 flex items-center justify-center flex-shrink-0" style={{ backgroundColor: user.color || '#333' }}>
                      {user.photoUrl ? (
                        <img src={user.photoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl">{user.emoji || '👤'}</span>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-lg truncate">{user.name}</span>
                        <span className="bg-[var(--accent)] text-white text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full">You</span>
                      </div>
                      <div className="text-white/40 text-sm">Keep talking to rank up!</div>
                    </div>
                 </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
