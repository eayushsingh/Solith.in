import React, { useState, useEffect } from 'react';
import { db, doc, getDoc } from '../firebase';

export default function SocialUserRow({ userId, currentUser, onDM, openUserProfile, onlineUserIds }) {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!userId) return;
    getDoc(doc(db, 'users', userId)).then(snap => {
      if (snap.exists()) setProfile({ id: snap.id, ...snap.data() });
    });
  }, [userId]);

  if (!profile || !currentUser || !currentUser.id) return null;

  const convoId = currentUser.id < userId
    ? `${currentUser.id}_${userId}`
    : `${userId}_${currentUser.id}`;

  const isOnline = onlineUserIds && onlineUserIds.has(userId);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 16px', cursor: 'pointer', transition: 'background 0.15s'
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
    onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ position: 'relative' }}>
          <img
            src={profile.photoUrl || `https://api.dicebear.com/7.x/lorelei/svg?seed=${userId}`}
            style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
            alt=""
          />
          {/* Online indicator */}
          <span style={{
            position: 'absolute', bottom: 1, right: 1,
            width: 9, height: 9, borderRadius: '50%',
            background: isOnline ? '#22c55e' : 'rgba(255,255,255,0.2)', 
            border: '2px solid #111827'
          }} />
        </div>
        <div>
          <div style={{ color: 'white', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{profile.name}</span>
            {(profile.role === 'admin' || profile.email === 'ayushsinghe07@gmail.com') ? (
              <span style={{ background: 'linear-gradient(to right, #9333ea, #4f46e5)', color: '#fff', fontSize: 9, fontWeight: 900, padding: '1px 6px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.05em' }}>FOUNDER</span>
            ) : profile.isPremium ? (
              <span style={{ background: 'linear-gradient(to right, #fbbf24, #f59e0b)', color: '#000', fontSize: 9, fontWeight: 900, padding: '1px 6px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.05em' }}>VIP</span>
            ) : null}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
            {profile.xp || 0} XP
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => onDM(convoId, profile)}
          style={{
            background: 'rgba(24,119,242,0.15)', border: '1px solid rgba(24,119,242,0.3)',
            borderRadius: 8, padding: '5px 10px', color: '#60a5fa',
            fontSize: 11, fontWeight: 700, cursor: 'pointer'
          }}
        >
          DM
        </button>
        <button
          onClick={() => openUserProfile(userId)}
          style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '5px 10px', color: 'rgba(255,255,255,0.5)',
            fontSize: 11, fontWeight: 700, cursor: 'pointer'
          }}
        >
          Profile
        </button>
      </div>
    </div>
  );
}
