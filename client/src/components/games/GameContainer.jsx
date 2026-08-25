import React from 'react';
import { X, Trophy } from 'lucide-react';
import ChessGame from './ChessGame';
import TicTacToe from './TicTacToe';
import Connect4 from './Connect4';
import UnoGame from './UnoGame';

export default function GameContainer({ activeGame, socket, roomId, currentUser }) {
  if (!activeGame) return null;

  const handleClose = () => {
    socket.emit('game-end', { roomId });
  };

  const renderGame = () => {
    switch (activeGame.type) {
      case 'chess':
        return <ChessGame activeGame={activeGame} socket={socket} roomId={roomId} currentUser={currentUser} />;
      case 'tictactoe':
        return <TicTacToe activeGame={activeGame} socket={socket} roomId={roomId} currentUser={currentUser} />;
      case 'connect4':
        return <Connect4 activeGame={activeGame} socket={socket} roomId={roomId} currentUser={currentUser} />;
      case 'uno':
        return <UnoGame activeGame={activeGame} socket={socket} roomId={roomId} currentUser={currentUser} />;
      default:
        return <div className="text-white text-center p-8">Unknown game type: {activeGame.type}</div>;
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-bg-surface border border-border-color rounded-2xl overflow-hidden relative shadow-2xl animate-fade-in">
      {/* Header */}
      <div className="h-12 border-b border-border-color bg-bg-surface-elevated flex items-center justify-between px-4 shrink-0 z-10">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-accent-primary" />
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
