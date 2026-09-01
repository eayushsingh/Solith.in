import React from 'react';
import { X, Trophy } from 'lucide-react';
import ChessGame from './ChessGame';
import TicTacToe from './TicTacToe';
import Connect4 from './Connect4';
import UnoGame from './UnoGame';
import ScrabbleGame from './ScrabbleGame';

const playerRules = {
  chess: { min: 2, max: 2, name: 'Chess', emoji: '♟️' },
  tictactoe: { min: 2, max: 2, name: 'Tic-Tac-Toe', emoji: '❌' },
  connect4: { min: 2, max: 2, name: 'Connect 4', emoji: '🔴' },
  uno: { min: 2, max: 6, name: 'UNO', emoji: '🃏' },
  scrabble: { min: 2, max: 4, name: 'Scrabble', emoji: '🔤' }
};

export default function GameContainer({ activeGame, socket, roomId, currentUser }) {
  if (!activeGame) return null;

  const handleClose = () => {
    socket.emit('game-end', { roomId, userId: currentUser.id });
  };

  const gameType = activeGame.type;
  const rules = playerRules[gameType] || { min: 2, max: 2, name: gameType, emoji: '🎮' };
  const players = activeGame.players || [];
  const initiator = activeGame.initiator || {};
  const isInitiator = initiator.id === currentUser.id;
  const hasJoined = players.some(p => p?.id === currentUser.id);
  const isFull = players.length >= rules.max;
  const canStart = players.length >= rules.min;

  const handleJoin = () => {
    if (hasJoined || isFull) return;
    socket.emit('game-join-lobby', {
      roomId,
      gameType,
      player: { id: currentUser.id, name: currentUser.name, photoUrl: currentUser.photoUrl }
    });
  };

  const handleStart = () => {
    if (!isInitiator || !canStart) return;
    socket.emit('game-start', {
      roomId,
      gameType,
      players
    });
  };

  const handleCancel = () => {
    if (!isInitiator) return;
    socket.emit('game-cancel', { roomId });
  };

  // Render Lobby Invitation screen
  if (activeGame.status === 'lobby') {
    return (
      <div className="w-full h-full flex flex-col bg-bg-surface border border-border-color rounded-2xl overflow-hidden relative shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="h-12 border-b border-border-color bg-bg-surface-elevated flex items-center justify-between px-4 shrink-0 z-10">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[var(--accent-primary)]" />
            <span className="text-sm font-bold text-text-primary uppercase tracking-wider">Game Invitation</span>
          </div>
          {isInitiator && (
            <button 
              onClick={handleCancel}
              className="w-8 h-8 rounded-full hover:bg-bg-base flex items-center justify-center text-text-secondary hover:text-red-400 transition-colors"
              title="Cancel Invitation"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center bg-black/20">
          <div className="max-w-md w-full bg-bg-surface-elevated border border-border-color rounded-2xl p-6 shadow-xl flex flex-col items-center gap-6">
            
            {/* Game Info */}
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="text-6xl animate-bounce mb-2" role="img" aria-label={rules.name}>
                {rules.emoji}
              </span>
              <h2 className="text-2xl font-black text-text-primary uppercase tracking-wider">{rules.name} Lobby</h2>
              <p className="text-sm text-text-secondary">
                Invited by <span className="font-bold text-text-primary">{initiator.name}</span>
              </p>
            </div>

            {/* Players Status / Slots */}
            <div className="w-full">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-text-secondary uppercase tracking-widest">Joined Players</span>
                <span className="text-xs font-mono font-bold bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[var(--accent-primary)]">
                  {players.length} / {rules.max} Slots
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 w-full max-h-40 overflow-y-auto p-1">
                {players.map(player => (
                  <div key={player.id} className="flex items-center gap-2.5 p-2 bg-black/25 border border-white/5 rounded-xl">
                    <img 
                      src={player.photoUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${player.name}`} 
                      alt={player.name}
                      className="w-7 h-7 rounded-full border border-white/10"
                    />
                    <span className="text-sm font-semibold text-text-primary truncate">{player.name}</span>
                  </div>
                ))}
                {Array.from({ length: rules.max - players.length }).map((_, idx) => (
                  <div key={`empty-${idx}`} className="flex items-center gap-2.5 p-2 bg-transparent border border-dashed border-white/10 rounded-xl opacity-40">
                    <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-xs font-bold text-text-secondary">?</div>
                    <span className="text-xs text-text-secondary italic font-medium">Open Slot</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 w-full mt-4">
              {!hasJoined && !isFull && (
                <button
                  onClick={handleJoin}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
                >
                  Join Game
                </button>
              )}
              
              {hasJoined && !isInitiator && (
                <div className="w-full py-2.5 bg-white/5 border border-white/10 text-emerald-400 font-semibold rounded-xl text-center text-sm">
                  ✓ Joined (Waiting for host)
                </div>
              )}
              
              {isFull && !hasJoined && (
                <div className="w-full py-2.5 bg-white/5 border border-white/10 text-text-secondary font-semibold rounded-xl text-center text-sm">
                  Lobby is Full
                </div>
              )}

              {isInitiator && (
                <div className="flex gap-2 w-full">
                  <button
                    onClick={handleCancel}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-text-secondary hover:text-white font-bold rounded-xl transition-all border border-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStart}
                    disabled={!canStart}
                    className="flex-1 py-3 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-accent-primary/20 active:scale-[0.98]"
                  >
                    Start Game
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    );
  }

  const renderGame = () => {
    const gameProps = {
      activeGame,
      socket,
      roomId,
      currentUser,
      myPlayerId: currentUser.id,
      currentTurnId: activeGame.currentTurnId
    };

    switch (activeGame.type) {
      case 'chess':
        return <ChessGame {...gameProps} />;
      case 'tictactoe':
        return <TicTacToe {...gameProps} />;
      case 'connect4':
        return <Connect4 {...gameProps} />;
      case 'uno':
        return <UnoGame {...gameProps} />;
      case 'scrabble':
        return <ScrabbleGame {...gameProps} />;
      default:
        return <div className="text-white text-center p-8">Unknown game type: {activeGame.type}</div>;
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-bg-surface border border-border-color rounded-2xl overflow-hidden relative shadow-2xl animate-fade-in">
      {/* Header */}
      <div className="h-12 border-b border-border-color bg-bg-surface-elevated flex items-center justify-between px-4 shrink-0 z-10">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-[var(--accent-primary)]" />
          <span className="text-sm font-bold text-text-primary uppercase tracking-wider">{activeGame.type}</span>
        </div>
        <button 
          onClick={handleClose}
          className="w-8 h-8 rounded-full hover:bg-bg-base flex items-center justify-center text-text-secondary hover:text-red-400 transition-colors"
          title="End Game"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      {/* Game Content */}
      <div className="flex-1 overflow-hidden relative bg-black/20">
        {renderGame()}
      </div>
    </div>
  );
}
