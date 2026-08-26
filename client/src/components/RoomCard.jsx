import React from 'react';
import { Heart, Globe, Lock } from 'lucide-react';

export default function RoomCard({ room, onJoin, inThisRoom, isFeatured }) {
  const participants = room.participants || [];
  const maxDisplay = isFeatured ? 4 : 3;
  const displayParticipants = participants.slice(0, maxDisplay);
  const hasOverflow = participants.length > maxDisplay;
  const overflowCount = participants.length - maxDisplay;

  // Level tag helper
  const levelTag = room.tags && room.tags.length > 0 ? room.tags[0] : 'Any Level';

  return (
    <div className="relative w-full rounded-2xl p-5 bg-[#1a1d24] border border-white/5 shadow-xl transition-all duration-300 hover:border-white/10 flex flex-col justify-between">
      
      {/* "You're here" badge */}
      {inThisRoom && (
        <div className="absolute top-3 right-3 z-20 px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/40 rounded-full text-[9px] font-bold text-emerald-400 flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></span>
          You're here
        </div>
      )}

      <div>
        {/* Top row: Circular blue icon, language name, level tag */}
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
            <Globe className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-baseline gap-1.5 truncate">
            <span className="text-white font-bold text-sm tracking-wide">
              {room.language || 'English'}
            </span>
            <span className="italic text-text-secondary text-[10px] font-normal">
              {levelTag}
            </span>
          </div>
        </div>

        {/* Second row: Topic/room name in small blue text below the language */}
        <div className="text-[11px] font-semibold text-blue-400 pl-8 mb-4 break-words">
          {room.name || 'Practicing Club'}
        </div>

        {/* Middle: Avatar circles (4 for featured, 3 for smaller) */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          {[...Array(maxDisplay)].map((_, idx) => {
            const p = displayParticipants[idx];
            if (p) {
              return (
                <div 
                  key={p.id || idx} 
                  className="w-10 h-10 rounded-full overflow-hidden border border-white/15 flex-shrink-0 flex items-center justify-center text-white" 
                  style={{ backgroundColor: p.color || '#ff4d4d' }}
                  title={p.name}
                >
                  {p.photoUrl ? (
                    <img src={p.photoUrl} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <span className="text-sm">{p.emoji || '👤'}</span>
                  )}
                </div>
              );
            } else {
              return (
                <div 
                  key={`empty-${idx}`} 
                  className="w-10 h-10 rounded-full border border-dashed border-white/10 flex-shrink-0 flex items-center justify-center bg-white/[0.01] text-white/10 text-sm font-light select-none"
                >
                  +
                </div>
              );
            }
          })}
        </div>

        {/* 5th dashed circle on a second row for overflow */}
        {hasOverflow && (
          <div className="flex justify-start mb-3">
            <div 
              className="w-7 h-7 rounded-full border border-dashed border-white/20 bg-white/5 flex items-center justify-center text-[9px] font-bold text-white/50"
              title={`${overflowCount} more participants`}
            >
              +{overflowCount}
            </div>
          </div>
        )}

        {/* Host's followers count below avatars */}
        <div className="flex items-center gap-1 text-[11px] text-blue-400 font-bold mb-4">
          <span className="text-xs">❤</span>
          <span>{participants[0]?.followersCount || 18}</span>
        </div>
      </div>

      {/* Bottom: Dashed-border Join Button */}
      <div className="w-full mt-auto">
        <button 
          onClick={() => onJoin(room)}
          className="w-full py-2.5 rounded-xl border border-dashed border-emerald-500 bg-transparent hover:bg-emerald-500/10 text-emerald-400 font-bold text-xs tracking-wider transition-all duration-200"
        >
          🔗 Join and talk now!
        </button>
      </div>

    </div>
  );
}
