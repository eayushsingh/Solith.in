import React from 'react';
import { X } from 'lucide-react';

const GAMES = [
  { id: 'chess', name: 'Chess', emoji: '♟️', desc: '2 players • Strategy' },
  { id: 'tictactoe', name: 'Tic-Tac-Toe', emoji: '❌', desc: '2 players • Quick' },
  { id: 'connect4', name: 'Connect 4', emoji: '🔴', desc: '2 players • Classic' },
  { id: 'uno', name: 'UNO', emoji: '🃏', desc: '2-6 players • Cards' },
  { id: 'scrabble', name: 'Scrabble', emoji: '🔤', desc: '2-4 players • Words' },
];

export default function GameSelector({ onSelect, onClose }) {
  return (
    <div style={{
      position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16,
      padding: 16, zIndex: 100, width: 280, boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ color: 'white', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Choose Game
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
          <X size={14} />
        </button>
      </div>

      {GAMES.map(game => (
        <button key={game.id} onClick={() => onSelect(game.id)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
            borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer',
            textAlign: 'left', transition: 'background 0.15s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ fontSize: 24, flexShrink: 0 }}>{game.emoji}</span>
          <div>
            <div style={{ color: 'white', fontWeight: 600, fontSize: 13 }}>{game.name}</div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{game.desc}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
