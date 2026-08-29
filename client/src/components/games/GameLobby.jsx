import React from 'react';
import { X, Users, Play } from 'lucide-react';

const GAME_INFO = {
  chess: { name: 'Chess', emoji: '♟️', min: 2, max: 2, desc: '2 players' },
  tictactoe: { name: 'Tic-Tac-Toe', emoji: '❌', min: 2, max: 2, desc: '2 players' },
  connect4: { name: 'Connect 4', emoji: '🔴', min: 2, max: 2, desc: '2 players' },
  uno: { name: 'UNO', emoji: '🃏', min: 2, max: 6, desc: '2-6 players' },
  scrabble: { name: 'Scrabble', emoji: '🔤', min: 2, max: 4, desc: '2-4 players' },
};

export default function GameLobby({ gameLobby, currentUser, onAccept, onCancel, onStart }) {
  if (!gameLobby) return null;

  const info = GAME_INFO[gameLobby.gameType];
  const isInitiator = gameLobby.initiator.id === currentUser.id;
  const hasJoined = gameLobby.players.find(p => p.id === currentUser.id);
  const canStart = isInitiator && gameLobby.players.length >= info.min;
  const isFull = gameLobby.players.length >= info.max;

  return (
    <div style={{
      position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20,
      padding: 28, zIndex: 200, width: 360, boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
      animation: 'fadeIn 0.2s ease'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 32 }}>{info.emoji}</span>
          <div>
            <div style={{ color: 'white', fontWeight: 800, fontSize: 18 }}>{info.name}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{info.desc}</div>
          </div>
        </div>
        {isInitiator && (
          <button onClick={onCancel} style={{
            background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)',
            borderRadius: 8, padding: '6px 10px', color: '#f87171', cursor: 'pointer'
          }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Invited by */}
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 16 }}>
        {isInitiator ? 'You started this game invite' : `${gameLobby.initiator.name} invited everyone to play`}
      </div>

      {/* Player slots */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
          Players ({gameLobby.players.length}/{info.max})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: info.max }).map((_, i) => {
            const player = gameLobby.players[i];
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                borderRadius: 10, background: player ? 'rgba(24,119,242,0.1)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${player ? 'rgba(24,119,242,0.3)' : 'rgba(255,255,255,0.06)'}`
              }}>
                {player ? (
                  <>
                    <img src={player.photoUrl || `https://api.dicebear.com/7.x/lorelei/svg?seed=${player.id}`}
                      style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                    <span style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>{player.name}</span>
                    {i === 0 && <span style={{ marginLeft: 'auto', color: '#60a5fa', fontSize: 10, fontWeight: 700 }}>HOST</span>}
                    {gameLobby.gameType === 'chess' && (
                      <span style={{ marginLeft: 'auto', fontSize: 16 }}>{i === 0 ? '♔' : '♚'}</span>
                    )}
                    {gameLobby.gameType === 'tictactoe' && (
                      <span style={{ marginLeft: 'auto', color: i === 0 ? '#60a5fa' : '#f87171', fontWeight: 800 }}>{i === 0 ? 'X' : 'O'}</span>
                    )}
                    {gameLobby.gameType === 'connect4' && (
                      <span style={{ marginLeft: 'auto' }}>{i === 0 ? '🔴' : '🟡'}</span>
                    )}
                  </>
                ) : (
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Waiting for player...</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10 }}>
        {!hasJoined && !isFull && !isInitiator && (
          <button onClick={onAccept} style={{
            flex: 1, padding: '12px 0', borderRadius: 12, border: 'none',
            background: '#1877f2', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer'
          }}>
            Accept & Join
          </button>
        )}
        {isInitiator && (
          <button onClick={onStart} disabled={!canStart} style={{
            flex: 1, padding: '12px 0', borderRadius: 12, border: 'none',
            background: canStart ? '#1877f2' : 'rgba(255,255,255,0.08)',
            color: canStart ? 'white' : 'rgba(255,255,255,0.3)',
            fontWeight: 700, fontSize: 14, cursor: canStart ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
          }}>
            <Play size={16} /> Start Game
          </button>
        )}
        {hasJoined && !isInitiator && (
          <div style={{ flex: 1, textAlign: 'center', color: '#22c55e', fontWeight: 700, fontSize: 14, padding: '12px 0' }}>
            ✓ You're in! Waiting for host to start...
          </div>
        )}
        {isFull && !hasJoined && (
          <div style={{ flex: 1, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: '12px 0' }}>
            Game is full
          </div>
        )}
      </div>
    </div>
  );
}
