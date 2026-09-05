import React from 'react';
import { X, Trophy } from 'lucide-react';

const GAMES = [
  { id: 'chess', name: 'Chess', emoji: '♟️', desc: '2 players • Strategy', color: 'from-amber-600/20 to-orange-600/10' },
  { id: 'tictactoe', name: 'Tic-Tac-Toe', emoji: '❌', desc: '2 players • Quick match', color: 'from-rose-600/20 to-red-600/10' },
  { id: 'connect4', name: 'Connect 4', emoji: '🔴', desc: '2 players • Classic grid', color: 'from-blue-600/20 to-indigo-600/10' },
  { id: 'uno', name: 'UNO', emoji: '🃏', desc: '2-6 players • Party cards', color: 'from-emerald-600/20 to-teal-600/10' },
  { id: 'scrabble', name: 'Scrabble', emoji: '🔤', desc: '2-4 players • Word master', color: 'from-purple-600/20 to-violet-600/10' },
];

export default function GameSelector({ onSelect, onClose }) {
  return (
    <div className="fixed inset-0 z-[9995] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div 
        className="w-full max-w-sm bg-[#0f131f]/95 border border-white/15 rounded-3xl p-5 shadow-2xl backdrop-blur-2xl flex flex-col gap-4 relative animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Choose Game</h3>
              <p className="text-[11px] text-white/50">Play live with room members</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {GAMES.map(game => (
            <button
              key={game.id}
              onClick={() => {
                onSelect(game.id);
                onClose();
              }}
              className="w-full flex items-center gap-3.5 p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-blue-500/40 transition-all text-left group hover:scale-[1.02]"
            >
              <div className="w-11 h-11 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center text-2xl flex-shrink-0 group-hover:scale-110 transition-transform shadow-inner">
                {game.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
                  {game.name}
                </div>
                <div className="text-xs text-white/50">{game.desc}</div>
              </div>
              <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity">
                Play
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
