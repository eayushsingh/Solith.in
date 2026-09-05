import React, { useState } from 'react';
import { Heart, Settings, Phone, Ban } from 'lucide-react';

const BG_COLORS = [
  'bg-[#a855f7]', // purple
  'bg-[#0284c7]', // cyan / sky blue
  'bg-[#4f46e5]', // indigo
  'bg-[#c026d3]', // fuchsia
  'bg-[#059669]', // emerald
  'bg-[#d97706]', // amber
];

function getAvatarColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return BG_COLORS[Math.abs(hash) % BG_COLORS.length];
}

export default function RoomCard({ room, onJoin, inThisRoom, isJoining, anyRoomJoining }) {
  const participants = (room.participants || []).filter(p => p != null && p.id != null);
  
  // Calculate slots to show (based on room limit, default 2-4 slots)
  const maxSlots = Math.min(room.maxParticipants || Math.max(participants.length + (participants.length >= 25 ? 0 : 1), 2), 4);
  const displaySlots = Array.from({ length: maxSlots }, (_, i) => participants[i] || null);
  const isFull = participants.length >= (room.maxParticipants || 25);

  const handleCardClick = (e) => {
    if (isFull) return;
    if (anyRoomJoining) return;
    onJoin(room);
  };

  // Language & Level formatting
  const language = room.language || 'English';
  const level = room.level || 'Any Level';
  const topicSubtitle = room.topic || room.name || (room.tags && room.tags.length > 0 ? room.tags[0] : '');

  const groupAnimClass = room.groupAnimation && room.groupAnimation !== 'none'
    ? `pro-group-card-${room.groupAnimation}`
    : '';

  return (
    <div 
      onClick={handleCardClick}
      className={`group relative flex flex-col justify-between p-4 sm:p-5 rounded-xl border border-[#263748] bg-[#18232e] hover:border-[#3b536b] transition-all duration-200 min-h-[250px] select-none ${groupAnimClass} ${
        isJoining 
          ? 'scale-[0.99] border-sky-500 bg-sky-950/20' 
          : ''
      } ${
        isFull ? 'cursor-default' : 'cursor-pointer'
      }`}
    >
      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Swirl Free4Talk Icon */}
            <svg 
              className="w-5 h-5 sm:w-6 sm:h-6 text-sky-400 flex-shrink-0" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.2" strokeDasharray="38 18" />
              <circle cx="12" cy="12" r="4.5" fill="currentColor" />
            </svg>

            {/* Language + Level Title */}
            <div className="flex items-baseline flex-wrap gap-x-1.5 min-w-0">
              <span className="font-bold text-white text-sm sm:text-[15px] leading-tight">
                {language}
              </span>
              <span className="italic font-normal text-slate-300 text-xs sm:text-[13px] leading-tight">
                {level}
              </span>
              {!room.isOpenMic && (
                <span className="text-xs text-rose-400/90 ml-0.5" title="Mic Restricted">🔇</span>
              )}
            </div>
          </div>

          {/* Settings / Gear Icon */}
          <button
            onClick={(e) => {
              e.stopPropagation();
            }}
            className="text-sky-400/80 hover:text-sky-300 transition-colors p-0.5 flex-shrink-0"
            title="Room Options"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Subtitle / Topic line */}
        {topicSubtitle && (
          <div className="text-xs text-[#38bdf8] font-normal mt-1 pl-[26px] sm:pl-[30px] truncate max-w-full">
            {topicSubtitle}
          </div>
        )}
      </div>

      {/* Avatars Section */}
      <div className="flex items-center justify-start gap-3 sm:gap-4 my-auto py-3">
        {displaySlots.map((participant, idx) => {
          if (participant) {
            const name = participant.name || 'User';
            const initials = name
              .split(' ')
              .map(n => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase() || 'U';

            const hasPhoto = participant.photoUrl && participant.photoUrl.trim() !== '';
            const likesCount = participant.followersCount || participant.likes || 0;
            const isVerified = participant.isVerified;

            const pAnim = participant.profileAnimation && participant.profileAnimation !== 'none'
              ? `pro-anim-${participant.profileAnimation}`
              : '';

            return (
              <div key={participant.id || idx} className="flex flex-col items-center">
                <div 
                  className={`w-16 h-16 sm:w-[72px] sm:h-[72px] md:w-[76px] md:h-[76px] rounded-full overflow-hidden flex flex-col items-center justify-center flex-shrink-0 shadow-md relative ${
                    hasPhoto ? 'bg-slate-800' : getAvatarColor(name)
                  } ${pAnim}`}
                >
                  {hasPhoto ? (
                    <img
                      src={participant.photoUrl}
                      alt={name}
                      className="w-full h-full object-cover rounded-full"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        if (e.target.parentNode) {
                          e.target.parentNode.className = `w-16 h-16 sm:w-[72px] sm:h-[72px] md:w-[76px] md:h-[76px] rounded-full overflow-hidden flex flex-col items-center justify-center flex-shrink-0 shadow-md ${getAvatarColor(name)}`;
                          e.target.parentNode.innerHTML = `<span class="text-xl sm:text-2xl font-bold text-white uppercase leading-none">${initials}</span><span class="text-[7px] sm:text-[8px] font-bold tracking-wider text-white/80 uppercase mt-0.5">${isVerified ? 'VERIFIED' : 'UNVERIFIED'}</span>`;
                        }
                      }}
                    />
                  ) : (
                    <>
                      <span className="text-xl sm:text-2xl font-bold text-white uppercase leading-none">
                        {initials}
                      </span>
                      <span className="text-[7px] sm:text-[8px] font-bold tracking-wider text-white/80 uppercase mt-0.5">
                        {isVerified ? 'VERIFIED' : 'UNVERIFIED'}
                      </span>
                    </>
                  )}
                </div>

                {/* Heart & Likes Count below Avatar */}
                <div className="flex items-center justify-center gap-1 text-[11px] sm:text-xs text-sky-400 font-semibold mt-1">
                  <Heart className="w-3 h-3 fill-sky-400 text-sky-400" />
                  <span>{likesCount}</span>
                </div>
              </div>
            );
          } else {
            return (
              <div key={`empty-${idx}`} className="flex flex-col items-center">
                <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] md:w-[76px] md:h-[76px] rounded-full border border-dashed border-slate-600/80 bg-transparent flex items-center justify-center flex-shrink-0" />
                <div className="h-4 mt-1" />
              </div>
            );
          }
        })}
      </div>

      {/* Bottom Button / Status Bar */}
      <div>
        {isFull ? (
          <div className="w-full py-2.5 px-3 rounded-lg border border-dashed border-slate-700 bg-transparent text-slate-400 text-xs font-medium flex items-center justify-center gap-1.5 cursor-not-allowed">
            <Ban className="w-3.5 h-3.5 text-slate-400" />
            <span>This group is full.</span>
          </div>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCardClick();
            }}
            disabled={anyRoomJoining}
            className="w-full py-2.5 px-3 rounded-lg border border-dashed border-sky-500/40 hover:border-sky-400 hover:bg-sky-500/5 text-sky-400 text-xs sm:text-[13px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer group-hover:border-sky-400"
          >
            <Phone className="w-3.5 h-3.5 text-sky-400" />
            <span>Join and talk now!</span>
          </button>
        )}
      </div>
    </div>
  );
}

