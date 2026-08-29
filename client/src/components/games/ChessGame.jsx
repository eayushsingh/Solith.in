import React, { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';

export default function ChessGame({ activeGame, socket, roomId, currentUser, myPlayerId, currentTurnId }) {
  const [game, setGame] = useState(new Chess());
  const [playerColor, setPlayerColor] = useState('spectator');
  
  // Sync local game state with activeGame.state from server
  useEffect(() => {
    if (activeGame.state && activeGame.state !== 'start') {
      try {
        const newGame = new Chess();
        newGame.load(activeGame.state);
        setGame(newGame);
      } catch (e) {
        console.error("Invalid FEN:", activeGame.state);
      }
    } else {
      setGame(new Chess());
    }
  }, [activeGame.state]);

  // Determine player color based on join order
  useEffect(() => {
    const pIndex = activeGame.players?.findIndex(p => p.id === currentUser.id) ?? -1;
    if (pIndex === 0) setPlayerColor('white');
    else if (pIndex === 1) setPlayerColor('black');
    else setPlayerColor('spectator');
  }, [activeGame.players, currentUser.id]);

  function onDrop(sourceSquare, targetSquare) {
    if (currentTurnId !== myPlayerId) return false;
    if (playerColor === 'spectator') return false;
    
    // Prevent moving if it is not our color's turn
    const currentTurnColor = game.turn(); // 'w' or 'b'
    if (currentTurnColor === 'w' && playerColor !== 'white') return false;
    if (currentTurnColor === 'b' && playerColor !== 'black') return false;

    const gameCopy = new Chess(game.fen());
    
    try {
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q', // auto-promote to queen
      });

      if (move === null) return false;
      
      setGame(gameCopy);
      
      // Sync move to server
      socket.emit('game-action', {
        roomId,
        action: 'move',
        newState: gameCopy.fen(),
        playerId: currentUser.id
      });
      
      // Detect game over and emit game-end after 5 seconds delay
      if (gameCopy.isGameOver()) {
        setTimeout(() => {
          socket.emit('game-end', { roomId, userId: currentUser.id });
        }, 5000);
      }
      
      return true;
    } catch (e) {
      return false;
    }
  }

  const activePlayerName = activeGame.players.find(p => p.id === currentTurnId)?.name || 'Player';
  const isMyTurn = currentTurnId === myPlayerId;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4">
      {/* Turn Enforcement Banner */}
      {isMyTurn ? (
        <div className="w-full max-w-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 py-2.5 px-4 rounded-xl text-center font-bold text-sm animate-pulse mb-4">
          🟢 Your turn ({playerColor.toUpperCase()})
        </div>
      ) : (
        <div className="w-full max-w-md bg-white/5 border border-white/10 text-text-secondary py-2.5 px-4 rounded-xl text-center font-medium text-sm mb-4">
          ⏳ Waiting for {activePlayerName}...
        </div>
      )}

      <div className="w-full max-w-md aspect-square bg-bg-surface-elevated rounded-xl p-4 shadow-xl">
        <Chessboard 
          id="ChessGame" 
          position={game.fen()} 
          onPieceDrop={onDrop}
          boardOrientation={playerColor === 'black' ? 'black' : 'white'}
          arePiecesDraggable={currentTurnId === myPlayerId && playerColor !== 'spectator'}
          customDarkSquareStyle={{ backgroundColor: '#779556' }}
          customLightSquareStyle={{ backgroundColor: '#ebecd0' }}
        />
      </div>
      
      <div className="mt-6 flex flex-col items-center gap-2">
        <div className="px-4 py-2 bg-bg-surface rounded-full border border-border-color text-sm font-bold shadow-lg">
          {game.isGameOver() ? (
            <span className="text-red-400">
              Game Over! {game.isCheckmate() ? 'Checkmate' : game.isDraw() ? 'Draw' : 'Stalemate'}
            </span>
          ) : (
            <span>Turn: <span className={game.turn() === 'w' ? 'text-white' : 'text-gray-400'}>{game.turn() === 'w' ? 'White' : 'Black'}</span></span>
          )}
        </div>
        
        <div className="text-xs text-text-secondary flex flex-col items-center gap-3">
          <span>You are: {playerColor.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}
