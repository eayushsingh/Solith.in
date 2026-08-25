import React, { useState, useEffect, useMemo } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';

export default function ChessGame({ activeGame, socket, roomId, currentUser }) {
  const [game, setGame] = useState(new Chess());
  const [playerColor, setPlayerColor] = useState('spectator');
  
  // Initialize game state from the server
  useEffect(() => {
    const newGame = new Chess();
    if (activeGame.state && activeGame.state !== 'start') {
      try {
        newGame.load(activeGame.state);
      } catch (e) {
        console.error("Invalid FEN:", activeGame.state);
      }
    }
    setGame(newGame);
  }, []);

  useEffect(() => {
    // Determine player color based on join order (first = white, second = black)
    const pIndex = activeGame.players?.findIndex(p => p.id === currentUser.id) ?? -1;
    if (pIndex === 0) setPlayerColor('white');
    else if (pIndex === 1) setPlayerColor('black');
    else setPlayerColor('spectator');
  }, [activeGame.players, currentUser.id]);

  // Listen for moves from other players
  useEffect(() => {
    const handleGameAction = (data) => {
      if (data.state) {
        const newGame = new Chess();
        try {
          newGame.load(data.state);
          setGame(newGame);
        } catch (e) {
          console.error("Invalid FEN from socket:", data.state);
        }
      }
    };
    
    socket.on('game-action', handleGameAction);
    return () => {
      socket.off('game-action', handleGameAction);
    };
  }, [socket]);

  function onDrop(sourceSquare, targetSquare) {
    if (playerColor === 'spectator') return false;
    
    // Prevent moving if it's not our turn
    if (game.turn() === 'w' && playerColor !== 'white') return false;
    if (game.turn() === 'b' && playerColor !== 'black') return false;

    const gameCopy = new Chess(game.fen());
    
    try {
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q', // always promote to queen for simplicity
      });

      if (move === null) return false;
      
      setGame(gameCopy);
      
      // Sync with server
      socket.emit('game-action', {
        roomId,
        state: gameCopy.fen(),
        lastAction: move,
        player: currentUser
      });
      
      return true;
    } catch (e) {
      return false; // Illegal move throws in newer chess.js
    }
  }

  const joinGame = () => {
    if (activeGame.players?.length < 2) {
      socket.emit('game-join', { roomId, player: currentUser });
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md aspect-square bg-bg-surface-elevated rounded-xl p-4 shadow-xl">
        <Chessboard 
          id="ChessGame" 
          position={game.fen()} 
          onPieceDrop={onDrop}
          boardOrientation={playerColor === 'black' ? 'black' : 'white'}
          customDarkSquareStyle={{ backgroundColor: '#779556' }}
          customLightSquareStyle={{ backgroundColor: '#ebecd0' }}
        />
      </div>
      
      <div className="mt-6 flex flex-col items-center gap-2">
        <div className="px-4 py-2 bg-bg-surface rounded-full border border-border-color text-sm font-bold shadow-lg">
          {game.isGameOver() ? (
            <span className="text-red-400">Game Over! {game.isCheckmate() ? 'Checkmate' : 'Draw'}</span>
          ) : (
            <span>Turn: <span className={game.turn() === 'w' ? 'text-white' : 'text-gray-400'}>{game.turn() === 'w' ? 'White' : 'Black'}</span></span>
          )}
        </div>
        
        <div className="text-xs text-text-secondary flex flex-col items-center gap-3">
          <span>You are: {playerColor.toUpperCase()}</span>
          {playerColor === 'spectator' && activeGame.players?.length < 2 && (
            <button 
              onClick={joinGame}
              className="px-6 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white font-bold rounded-lg transition-colors shadow-lg"
            >
              Join Game as Black
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
