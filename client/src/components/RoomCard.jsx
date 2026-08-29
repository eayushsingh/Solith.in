import React, { useState } from 'react';
import { Globe, Heart, Share2, Users } from 'lucide-react';

export default function RoomCard({ room, onJoin, inThisRoom, isJoining, anyRoomJoining }) {
  const [copied, setCopied] = useState(false);
  const participants = (room.participants || []).filter(p => p != null && p.id != null);
  const MAX_SLOTS = 4;
  const displaySlots = Array.from({ length: MAX_SLOTS }, (_, i) => participants[i] || null);
  const extraCount = participants.length > MAX_SLOTS ? participants.length - MAX_SLOTS : 0;
  
  const handleCardClick = () => {
    if (participants.length >= 25) return;
    if (anyRoomJoining) return;
    onJoin(room);
  };

  return (
    <div 
      onClick={handleCardClick}
      className={`relative flex flex-col gap-5 p-6 rounded-[24px] overflow-hidden transition-all duration-300 ${
        isJoining 
          ? 'scale-[0.98] border-blue-500 bg-blue-900/10' 
          : 'border-white/10 bg-[#1A1C23]/80 backdrop-blur-xl hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_12px_40px_rgba(0,0,0,0.2)] hover:bg-[#1A1C23]'
      } ${
        (participants.length >= 25 || anyRoomJoining) && !isJoining ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      }`}
      style={{ borderWidth: '1px', borderStyle: 'solid' }}
    >
      {/* Soft Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 pointer-events-none" />

      {inThisRoom && (
        <div className="absolute top-4 right-4 bg-green-500/10 border border-green-500/20 rounded-full px-3 py-1 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-green-500 text-[10px] font-bold uppercase tracking-wide">You're here</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-[14px] bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
            <Globe className="w-6 h-6 text-blue-500" />
          </div>
          <div className="flex flex-col justify-center">
            <div className="flex items-baseline gap-2">
              <h3 className="text-white font-bold text-lg leading-tight tracking-tight">{room.language}</h3>
            </div>
            <p className="text-white/40 text-sm font-medium mt-0.5 truncate max-w-[140px]">
              {room.name || (room.tags?.[0] || 'Casual Talk')}
            </p>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            const url = `${window.location.origin}/?room=${room.id}`;
            navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          title="Share Room"
        >
          {copied ? <span className="text-[10px] font-bold text-green-400">✓</span> : <Share2 className="w-4 h-4" />}
        </button>
      </div>

      {participants.length === 0 && room.emptySince && (
        <div className="text-xs text-orange-400/80 font-semibold flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400/80 animate-pulse" />
          Closes in {Math.max(0, 30 - Math.round((Date.now() - room.emptySince) / 60000))} min
        </div>
      )}

      {/* Avatars */}
      <div className="flex items-center gap-3 mt-2 relative z-10">
        <div className="flex -space-x-3">
          {displaySlots.map((participant, idx) => {
            if (participant) {
              const seed = participant.id || participant.name || `slot-${idx}`;
              const avatarSrc = (participant.photoUrl && participant.photoUrl.trim() !== '')
                ? participant.photoUrl
                : `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(seed)}`;

              return (
                <div key={participant.id || idx} className="relative group/avatar z-[1] hover:z-10 transition-all">
                  <div className={`w-12 h-12 rounded-full overflow-hidden border-[3px] border-[#1A1C23] bg-blue-500 shadow-sm ${idx === 0 ? 'ring-2 ring-blue-500/30' : ''}`}>
                    <img
                      src={avatarSrc}
                      alt={participant.name || ''}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentNode.innerHTML = `<div class="w-full h-full flex items-center justify-center text-sm font-bold text-white bg-blue-600">${(participant.name || '?').slice(0,2).toUpperCase()}</div>`;
                      }}
                    />
                  </div>
                </div>
              );
            } else {
              return (
                <div key={`empty-${idx}`} className="w-12 h-12 rounded-full border-2 border-dashed border-white/10 bg-white/5" />
              );
            }
          })}
        </div>

        {extraCount > 0 && (
          <div className="text-xs font-bold text-white/50 bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
            +{extraCount}
          </div>
        )}

        {participants[0] && (
          <div className="ml-auto flex items-center gap-1.5 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20">
            <Heart className="w-3.5 h-3.5 text-blue-500" fill="currentColor" />
            <span className="text-blue-500 text-xs font-bold">{participants[0].followersCount || 0}</span>
          </div>
        )}
      </div>

      {/* Action Button */}
      <button
        onClick={(e) => { e.stopPropagation(); handleCardClick(); }}
        disabled={participants.length >= 25 || anyRoomJoining}
        className={`mt-4 w-full py-3.5 rounded-[16px] font-bold text-sm transition-all flex items-center justify-center gap-2 relative z-10 ${
          participants.length >= 25 
            ? 'bg-white/5 text-white/40 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.2)]'
        }`}
      >
        {participants.length >= 25 ? 'Room Full' : 'Join Room'}
      </button>
    </div>
  );
}
