import React, { useState } from 'react';
import { Globe, Heart } from 'lucide-react';

export default function RoomCard({ room, onJoin, inThisRoom, isJoining, anyRoomJoining }) {
  const [copied, setCopied] = useState(false);
  const participants = (room.participants || []).filter(p => p != null && p.id != null);
  const MAX_SLOTS = 4;
  const displaySlots = Array.from({ length: MAX_SLOTS }, (_, i) => participants[i] || null);
  const extraCount = participants.length > MAX_SLOTS ? participants.length - MAX_SLOTS : 0;
  const hostParticipant = participants[0];
  const handleCardClick = () => {
    if (participants.length >= 25) return;
    if (anyRoomJoining) return;
    onJoin(room);
  };

  return (
    <div 
      onClick={handleCardClick}
      style={{
        background: '#161b27',
        minHeight: 240,
        position: 'relative',
        overflow: 'hidden',
        border: isJoining ? '1px solid #1877f2' : '1px solid rgba(255,255,255,0.06)',
        borderRadius: 16,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        transition: 'border-color 0.2s, transform 0.2s',
        cursor: (participants.length >= 25 || anyRoomJoining) ? 'not-allowed' : 'pointer',
        transform: isJoining ? 'scale(0.98)' : 'none',
        opacity: (anyRoomJoining && !isJoining) ? 0.6 : 1
      }}
      onMouseEnter={e => { 
        if (participants.length < 25 && !anyRoomJoining) {
          e.currentTarget.style.borderColor = 'rgba(24,119,242,0.4)'; 
          e.currentTarget.style.transform = 'translateY(-2px)'; 
        }
      }}
      onMouseLeave={e => { 
        e.currentTarget.style.borderColor = isJoining ? '#1877f2' : 'rgba(255,255,255,0.07)'; 
        e.currentTarget.style.transform = 'none'; 
      }}
    >
      {/* You're here badge */}
      {inThisRoom && (
        <div style={{
          position: 'absolute', top: -8, right: -8,
          background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: 20, padding: '3px 10px',
          display: 'flex', alignItems: 'center', gap: 5
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'block' }}/>
          <span style={{ color: '#22c55e', fontSize: 10, fontWeight: 700 }}>You're here</span>
        </div>
      )}

      {/* Share button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          const url = `${window.location.origin}/?room=${room.id}`;
          navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        style={{
          position: 'absolute', top: 12, right: 44,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8, padding: '4px 8px',
          color: 'rgba(255,255,255,0.5)', fontSize: 11,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
        }}
        title="Copy room link"
      >
        {copied ? '✓ Copied' : '🔗 Share'}
      </button>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(24,119,242,0.12)',
          border: '1px solid rgba(24,119,242,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0
        }}>
          <Globe size={16} color="#1877f2" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>{room.language}</span>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, fontStyle: 'italic' }}>
              {room.tags?.[0] || 'Casual'}
            </span>
          </div>
          {room.name && (
            <div style={{ color: '#1877f2', fontSize: 12, marginTop: 2, fontWeight: 600 }}>{room.name}</div>
          )}
        </div>
      </div>

      {/* Countdown for empty rooms */}
      {participants.length === 0 && room.emptySince && (
        <div style={{
          fontSize: 11, color: 'rgba(255,165,0,0.7)',
          marginBottom: 8, fontWeight: 600
        }}>
          ⏱ Room closes in {Math.max(0, 30 - Math.round((Date.now() - room.emptySince) / 60000))} min
        </div>
      )}

      {/* Avatar row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minHeight: 64 }}>
        {displaySlots.map((participant, idx) => {
          if (participant) {
            const seed = participant.id || participant.name || `slot-${idx}`;
            const avatarSrc = (participant.photoUrl && participant.photoUrl.trim() !== '')
              ? participant.photoUrl
              : `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(seed)}`;

            return (
              <div key={participant.id || idx} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4
              }}>
                <div style={{
                  width: idx === 0 ? 90 : 64, height: idx === 0 ? 90 : 64, borderRadius: '50%',
                  overflow: 'hidden', flexShrink: 0,
                  border: idx === 0 ? '3px solid rgba(255,255,255,0.3)' : '2px solid rgba(255,255,255,0.15)',
                  boxShadow: idx === 0 ? '0 0 30px rgba(255,255,255,0.2), 0 0 60px rgba(24,119,242,0.3)' : '0 0 0 1px rgba(255,255,255,0.1)',
                  background: participant.color || '#1877f2'
                }}>
                  <img
                    src={avatarSrc}
                    alt={participant.name || ''}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      // If image fails, show initials
                      e.target.style.display = 'none';
                      e.target.parentNode.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:white">${(participant.name || '?').slice(0,2).toUpperCase()}</div>`;
                    }}
                  />
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 3,
                  color: '#60a5fa', fontSize: 10, fontWeight: 600
                }}>
                  ❤️ {participant.followersCount || 0}
                </div>
              </div>
            );
          } else {
            return (
              <div key={`empty-${idx}`} style={{
                width: 64, height: 64, borderRadius: '50%',
                border: '2px dashed rgba(255,255,255,0.1)',
                flexShrink: 0
              }} />
            );
          }
        })}
        {extraCount > 0 && (
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
            border: '2px dashed rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 700
          }}>
            +{extraCount}
          </div>
        )}
      </div>

      {/* Host follower count row (Premium Look) */}
      {participants[0] && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#1877f2', fontSize: 11, fontWeight: 700, marginTop: -4 }}>
          <Heart size={10} fill="#1877f2" color="#1877f2" />
          <span>{participants[0].followersCount || 0}</span>
        </div>
      )}

      {/* Join button */}
      <button
        onClick={(e) => { e.stopPropagation(); handleCardClick(); }}
        disabled={participants.length >= 25 || anyRoomJoining}
        style={{
          width: '100%', padding: '12px 0',
          background: 'transparent',
          border: '1.5px dashed rgba(24,119,242,0.5)',
          borderRadius: 10, cursor: (participants.length >= 25 || anyRoomJoining) ? 'not-allowed' : 'pointer',
          color: '#1877f2', fontSize: 13, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'all 0.2s',
          marginTop: 'auto'
        }}
        onMouseEnter={e => { if (participants.length < 25 && !anyRoomJoining) e.currentTarget.style.background = 'rgba(24,119,242,0.08)'; }}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        {participants.length >= 25 
          ? '🔒 Room Full' 
          : '🔗 Join and talk now!'
        }
      </button>
    </div>
  );
}
