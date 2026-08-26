import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';

export default function TicTacToe({ activeGame, socket, roomId, currentUser, myPlayerId, currentTurnId }) {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [xIsNext, setXIsNext] = useState(true);
  const [playerSymbol, setPlayerSymbol] = useState('spectator');

  // Sync state from activeGame.state
  useEffect(() => {
    if (activeGame.state && typeof activeGame.state === 'object') {
      setBoard(activeGame.state.board || Array(9).fill(null));
      setXIsNext(activeGame.state.xIsNext ?? true);
    } else {
      setBoard(Array(9).fill(null));
      setXIsNext(true);
    }
  }, [activeGame.state]);

  // Determine player symbol based on join order
  useEffect(() => {
    const pIndex = activeGame.players?.findIndex(p => p.id === currentUser.id) ?? -1;
    if (pIndex === 0) setPlayerSymbol('X');
    else if (pIndex === 1) setPlayerSymbol('O');
    else setPlayerSymbol('spectator');
  }, [activeGame.players, currentUser.id]);

  // Handle victory confetti reactively
  useEffect(() => {
    if (activeGame.winner && activeGame.winner !== 'draw') {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [activeGame.winner]);

  const handleClick = (i) => {
    if (currentTurnId !== myPlayerId) return;
    if (playerSymbol === 'spectator') return;
    if (board[i] || activeGame.winner) return;

    const nextBoard = board.slice();
    nextBoard[i] = playerSymbol; // Using our playerSymbol 'X' or 'O'
    
    setBoard(nextBoard);
    setXIsNext(!xIsNext);

    socket.emit('game-action', {
      roomId,
      action: 'move',
      newState: { board: nextBoard, xIsNext: !xIsNext },
      playerId: currentUser.id
    });
  };

  const isDraw = activeGame.winner === 'draw';
  const winner = activeGame.winner && activeGame.winner !== 'draw' ? activeGame.winner : null;

  let status;
  if (winner) {
    status = `Winner: ${winner}`;
  } else if (isDraw) {
    status = "Draw!";
  } else {
    status = `Next player: ${xIsNext ? 'X' : 'O'}`;
  }

  const activePlayerName = activeGame.players.find(p => p.id === currentTurnId)?.name || 'Player';
  const isMyTurn = currentTurnId === myPlayerId;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4">
      {/* Turn Enforcement Banner */}
      {activeGame.winner ? (
        <div className="w-full max-w-sm bg-accent-primary/20 border border-accent-primary/30 text-[var(--accent-primary)] py-2.5 px-4 rounded-xl text-center font-black text-sm mb-4 uppercase tracking-wider">
          🎉 {activeGame.winner === 'draw' ? 'Draw!' : `Winner: ${activeGame.winner}!`}
        </div>
      ) : isMyTurn ? (
        <div className="w-full max-w-sm bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 py-2.5 px-4 rounded-xl text-center font-bold text-sm animate-pulse mb-4">
          🟢 Your turn ({playerSymbol})
        </div>
      ) : (
        <div className="w-full max-w-sm bg-white/5 border border-white/10 text-text-secondary py-2.5 px-4 rounded-xl text-center font-medium text-sm mb-4">
          ⏳ Waiting for {activePlayerName}...
        </div>
      )}

      <div className="mb-6 px-6 py-2 bg-bg-surface-elevated rounded-full border border-border-color shadow-[0_0_15px_var(--accent-primary-glow)]">
        <h2 className="text-lg font-black tracking-wider text-text-primary uppercase">{status}</h2>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-sm w-full aspect-square">
        {board.map((square, i) => (
          <button
            key={i}
            disabled={currentTurnId !== myPlayerId || square !== null || !!activeGame.winner}
            className={`bg-bg-surface-elevated border-2 ${square ? 'border-[var(--accent-primary)]' : 'border-border-color'} rounded-2xl flex items-center justify-center text-5xl sm:text-7xl font-black transition-all hover:bg-bg-base hover:scale-[1.02] active:scale-95 shadow-lg disabled:opacity-90 disabled:hover:scale-100 disabled:hover:bg-bg-surface-elevated ${square === 'X' ? 'text-blue-500 shadow-blue-500/20' : square === 'O' ? 'text-pink-500 shadow-pink-500/20' : ''}`}
            onClick={() => handleClick(i)}
          >
            {square}
          </button>
        ))}
      </div>

      <div className="mt-8 text-xs text-text-secondary font-mono tracking-widest uppercase flex flex-col items-center gap-3">
        <span>You are: <span className="font-bold text-text-primary">{playerSymbol}</span></span>
      </div>
    </div>
  );
}
