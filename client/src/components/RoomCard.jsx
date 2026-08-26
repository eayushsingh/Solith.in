import React from 'react';
import { Globe, Heart } from 'lucide-react';

export default function RoomCard({ room, onJoin, inThisRoom, isJoining, anyRoomJoining }) {
  const participants = room.participants || [];
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
      style={{
        background: '#13171f',
        border: isJoining ? '1px solid #1877f2' : '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        transition: 'border-color 0.2s, transform 0.2s',
        cursor: (participants.length >= 25 || anyRoomJoining) ? 'not-allowed' : 'pointer',
        position: 'relative',
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
          position: 'absolute', top: 12, right: 12,
          background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: 20, padding: '3px 10px',
          display: 'flex', alignItems: 'center', gap: 5
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'block' }}/>
          <span style={{ color: '#22c55e', fontSize: 10, fontWeight: 700 }}>You're here</span>
        </div>
      )}

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

      {/* Avatar row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 52 }}>
        {displaySlots.map((participant, idx) =>
          participant ? (
            <div key={participant.id || idx} style={{
              width: 52, height: 52, borderRadius: '50%',
              overflow: 'hidden', background: participant.color || '#1877f2',
              border: '2px solid #13171f',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 700, color: 'white', flexShrink: 0
            }}>
              {participant.photoUrl
                ? <img src={participant.photoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                : participant.name?.slice(0, 2).toUpperCase()
              }
            </div>
          ) : (
            <div key={`empty-${idx}`} style={{
              width: 52, height: 52, borderRadius: '50%',
              border: '2px dashed rgba(255,255,255,0.1)',
              flexShrink: 0
            }} />
          )
        )}
        {extraCount > 0 && (
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
            border: '2px dashed rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifycontent: 'center',
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
          background: isJoining ? 'rgba(24,119,242,0.12)' : 'transparent',
          border: isJoining ? '1.5px solid #1877f2' : '1.5px dashed rgba(24,119,242,0.5)',
          borderRadius: 10, cursor: (participants.length >= 25 || anyRoomJoining) ? 'not-allowed' : 'pointer',
          color: '#1877f2', fontSize: 13, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifycontent: 'center', gap: 8,
          transition: 'all 0.2s',
          justifyContent: 'center'
        }}
        onMouseEnter={e => { if (participants.length < 25 && !anyRoomJoining) e.currentTarget.style.background = 'rgba(24,119,242,0.08)'; }}
        onMouseLeave={e => e.currentTarget.style.background = isJoining ? 'rgba(24,119,242,0.12)' : 'transparent'}
      >
        {participants.length >= 25 
          ? '🔒 Room Full' 
          : isJoining 
            ? '⏳ Connecting...' 
            : '🔗 Join and talk now!'
        }
      </button>
    </div>
  );
}
