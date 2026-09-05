import React, { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';

export default function ChessGame({ activeGame, socket, roomId, currentUser, myPlayerId, currentTurnId }) {
  const [game, setGame] = useState(new Chess());
  const [playerColor, setPlayerColor] = useState('spectator');
  
  // Safely extract FEN string from activeGame.state
  const getFen = (state) => {
    if (!state) return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    if (typeof state === 'string') return state;
    if (state.fen && typeof state.fen === 'string') return state.fen;
    return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  };

  // Sync local game state with activeGame.state from server
  useEffect(() => {
    const fenStr = getFen(activeGame?.state);
    try {
      const newGame = new Chess(fenStr);
      setGame(newGame);
    } catch (e) {
      console.error("Invalid FEN state:", fenStr, e);
    }
  }, [activeGame?.state]);

  // Determine player color based on join order
  useEffect(() => {
    const currentUserId = currentUser?.id || myPlayerId;
    const pIndex = activeGame?.players?.findIndex(p => (p?.id || p) === currentUserId) ?? -1;
    if (pIndex === 0) setPlayerColor('white');
    else if (pIndex === 1) setPlayerColor('black');
    else setPlayerColor('spectator');
  }, [activeGame?.players, currentUser?.id, myPlayerId]);

  function onDrop(sourceSquare, targetSquare) {
    const activeTurnId = currentTurnId || activeGame?.currentTurnId;
    const currentUserId = currentUser?.id || myPlayerId;

    if (activeTurnId !== currentUserId) return false;
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
      const newFen = gameCopy.fen();
      const isGameOver = gameCopy.isGameOver();
      const winner = isGameOver ? (gameCopy.isCheckmate() ? (currentTurnColor === 'w' ? 'White' : 'Black') : 'draw') : null;
      
      // Sync move to server
      socket.emit('game-action', {
        roomId,
        action: 'move',
        newState: {
          fen: newFen,
          ...(winner ? { winner } : {})
        },
        playerId: currentUserId
      });
      
      if (isGameOver) {
        setTimeout(() => {
          socket.emit('game-end', { roomId, userId: currentUserId });
        }, 5000);
      }

      return true;
    } catch (e) {
      console.error("Chess move error:", e);
      return false;
    }
  }

  const activeTurnId = currentTurnId || activeGame?.currentTurnId;
  const currentUserId = currentUser?.id || myPlayerId;
  const activePlayerName = activeGame?.players?.find(p => (p?.id || p) === activeTurnId)?.name || 'Player';
  const isMyTurn = activeTurnId === currentUserId;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Turn Enforcement Banner */}
      {isMyTurn ? (
        <div className="w-full max-w-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 py-2 px-4 rounded-xl text-center font-bold text-xs sm:text-sm animate-pulse mb-3">
          🟢 Your Turn ({playerColor.toUpperCase()})
        </div>
      ) : (
        <div className="w-full max-w-md bg-white/5 border border-white/10 text-text-secondary py-2 px-4 rounded-xl text-center font-medium text-xs sm:text-sm mb-3">
          ⏳ Waiting for {activePlayerName}'s move...
        </div>
      )}

      <div className="w-full max-w-[340px] sm:max-w-md aspect-square bg-bg-surface-elevated rounded-2xl p-2 sm:p-4 shadow-2xl border border-white/10">
        <Chessboard 
          id="ChessGame" 
          position={game.fen()} 
          onPieceDrop={onDrop}
          boardOrientation={playerColor === 'black' ? 'black' : 'white'}
          arePiecesDraggable={isMyTurn && playerColor !== 'spectator'}
          customDarkSquareStyle={{ backgroundColor: '#779556' }}
          customLightSquareStyle={{ backgroundColor: '#ebecd0' }}
        />
      </div>
      
      <div className="mt-4 flex flex-col items-center gap-2">
        <div className="px-4 py-1.5 bg-bg-surface rounded-full border border-border-color text-xs font-bold shadow-lg">
          {game.isGameOver() ? (
            <span className="text-red-400 font-extrabold">
              Game Over! {game.isCheckmate() ? 'Checkmate' : game.isDraw() ? 'Draw' : 'Stalemate'}
            </span>
          ) : (
            <span>Turn: <span className={game.turn() === 'w' ? 'text-white font-bold' : 'text-gray-400 font-bold'}>{game.turn() === 'w' ? 'White' : 'Black'}</span></span>
          )}
        </div>
        
        <div className="text-[11px] text-text-secondary flex items-center gap-2">
          <span>Role: <strong className="text-white">{playerColor.toUpperCase()}</strong></span>
        </div>
      </div>
    </div>
  );
}
