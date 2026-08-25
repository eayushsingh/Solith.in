import React from 'react';
import { Heart, Phone, Users, Globe, Lock } from 'lucide-react';
import PremiumBadge from './PremiumBadge';

export default function RoomCard({ room, onJoin }) {
  const isPremium = room.ownerIsPremium || false;
  
  // Free4Talk often has a 3-slot visual, or just a row of users
  const maxDisplay = 3;
  const participants = room.participants || [];
  const displayParticipants = participants.slice(0, maxDisplay);
  const remaining = participants.length > maxDisplay ? participants.length - maxDisplay : 0;
  
  return (
    <div className={`relative w-full rounded-3xl overflow-hidden flex flex-col p-6 bg-gradient-to-br from-[#1a1d24] to-[#12141a] border border-white/5 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl group
      ${isPremium ? 'border-amber-400/30 hover:border-amber-400/60 shadow-[0_8px_30px_rgba(251,191,36,0.1)]' : 'hover:border-[var(--accent-primary)]/40 shadow-[0_8px_30px_rgba(0,0,0,0.5)]'}
    `}>
      {isPremium && (
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/5 to-amber-500/0 pointer-events-none group-hover:via-amber-500/10 transition-colors duration-500"></div>
      )}
      
      {/* Top Header Row */}
      <div className="flex items-center justify-between w-full mb-4 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isPremium ? 'bg-amber-500/20 text-amber-400' : 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]'}`}>
            <Globe className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
             <span className="text-text-primary font-bold text-sm tracking-wide leading-none">
               {room.language || 'English'}
             </span>
             <span className="text-text-secondary text-[10px] font-medium uppercase tracking-wider mt-1">
               {room.tags && room.tags.length > 0 ? room.tags[0] : 'Casual'}
             </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 border border-white/5 text-text-primary text-xs font-bold backdrop-blur-sm" title={`${participants.length} participants`}>
          <Users className="w-3 h-3 text-text-secondary" />
          {participants.length} <span className="text-text-secondary font-normal mx-0.5">/</span> 25
        </div>
      </div>

      {/* Topic Title */}
      <div className="mb-6 line-clamp-2 min-h-[48px] relative z-10">
        {isPremium && <PremiumBadge showText={false} className="mr-2 mb-1 inline-flex align-middle" />}
        <h3 className={`inline text-lg font-extrabold tracking-tight ${isPremium ? 'text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500' : 'text-white'}`}>
          {room.name || 'Practice English Here'}
        </h3>
        {room.topic && <p className="text-sm text-text-secondary mt-1 line-clamp-1">{room.topic}</p>}
      </div>

      {/* Avatars */}
      <div className="flex items-center justify-center gap-4 mb-8 flex-1 relative z-10">
        {[0, 1, 2].map((slotIdx) => {
          const participant = displayParticipants[slotIdx];
          
          if (participant) {
            return (
              <div key={participant.id || slotIdx} className="flex flex-col items-center group/avatar relative">
                <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full border-[3px] overflow-hidden mb-2 relative transition-transform duration-300 group-hover/avatar:scale-110 ${isPremium ? 'border-amber-400/50' : 'border-[var(--accent-primary)]'}`}>
                  {participant.photoUrl ? (
                    <img src={participant.photoUrl} alt={participant.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[#2a2d36] flex items-center justify-center text-2xl font-bold text-white">
                      {participant.name ? participant.name.charAt(0).toUpperCase() : '?'}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 text-text-secondary text-[10px] font-bold bg-black/40 px-2 py-0.5 rounded-full border border-white/5">
                  <Heart className="w-2.5 h-2.5 fill-red-500 text-red-500" />
                  <span>{participant.followersCount || 0}</span>
                </div>
                {/* Tooltip */}
                <div className="absolute -bottom-8 opacity-0 group-hover/avatar:opacity-100 transition-opacity bg-black text-white text-xs px-2 py-1 rounded-md whitespace-nowrap pointer-events-none z-20">
                  {participant.name}
                </div>
              </div>
            );
          } else {
            // Empty placeholder slot
            return (
              <div key={`empty-${slotIdx}`} className="flex flex-col items-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-[2px] border-dashed border-white/10 mb-2 relative group-hover:border-white/20 transition-colors duration-300 flex items-center justify-center bg-white/[0.02]">
                   <span className="text-white/10 text-xl font-light">+</span>
                </div>
              </div>
            );
          }
        })}
      </div>

      {/* Join Button */}
      <div className="w-full mt-auto relative z-10">
        {participants.length >= 25 ? (
          <button disabled className="w-full py-3.5 rounded-xl bg-white/5 text-text-secondary text-sm font-bold flex items-center justify-center gap-2 cursor-not-allowed border border-white/5">
            <Lock className="w-4 h-4" /> Room is Full
          </button>
        ) : (
          <button 
            onClick={() => onJoin(room)}
            className={`w-full py-3.5 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 ${
              isPremium 
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:shadow-[0_0_20px_rgba(245,158,11,0.4)]' 
                : 'bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] hover:shadow-[0_0_20px_var(--accent-primary-glow)]'
            }`}
          >
            <Phone className="w-4 h-4" /> Join Room
          </button>
        )}
      </div>
      
    </div>
  );
}
