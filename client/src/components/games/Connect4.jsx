import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';

const ROWS = 6;
const COLS = 7;

export default function Connect4({ activeGame, socket, roomId, currentUser, myPlayerId, currentTurnId }) {
  // Board is an array of columns, where each column is an array of up to ROWS tokens (red or yellow)
  const [board, setBoard] = useState(Array.from({ length: COLS }, () => []));
  const [redIsNext, setRedIsNext] = useState(true);
  const [playerColor, setPlayerColor] = useState('spectator');

  // Sync state from activeGame
  useEffect(() => {
    if (activeGame.state && typeof activeGame.state === 'object') {
      setBoard(activeGame.state.board || Array.from({ length: COLS }, () => []));
      setRedIsNext(activeGame.state.redIsNext ?? true);
    } else {
      setBoard(Array.from({ length: COLS }, () => []));
      setRedIsNext(true);
    }
  }, [activeGame.state]);

  // Determine player color based on join order
  useEffect(() => {
    const pIndex = activeGame.players?.findIndex(p => p.id === currentUser.id) ?? -1;
    if (pIndex === 0) setPlayerColor('red');
    else if (pIndex === 1) setPlayerColor('yellow');
    else setPlayerColor('spectator');
  }, [activeGame.players, currentUser.id]);

  // Confetti when winner detected
  useEffect(() => {
    if (activeGame.winner && activeGame.winner !== 'draw') {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    }
  }, [activeGame.winner]);

  const handleColumnClick = (colIndex) => {
    if (currentTurnId !== myPlayerId) return;
    if (playerColor === 'spectator') return;
    if (activeGame.winner) return;
    
    const column = board[colIndex];
    if (column.length >= ROWS) return; // Column is full

    const newBoard = board.map((c, i) => i === colIndex ? [...c, redIsNext ? 'red' : 'yellow'] : c);
    
    setBoard(newBoard);
    setRedIsNext(!redIsNext);

    socket.emit('game-action', {
      roomId,
      action: 'move',
      newState: { board: newBoard, redIsNext: !redIsNext },
      playerId: currentUser.id
    });
  };

  const isDraw = activeGame.winner === 'draw';
  const winner = activeGame.winner && activeGame.winner !== 'draw' ? activeGame.winner : null;
  
  let status;
  if (winner) {
    status = `Winner: ${winner.toUpperCase()}`;
  } else if (isDraw) {
    status = "Draw!";
  } else {
    status = `Next turn: ${redIsNext ? 'RED' : 'YELLOW'}`;
  }

  // Generate grid for rendering
  const renderCells = () => {
    const cells = [];
    for (let r = ROWS - 1; r >= 0; r--) {
      for (let c = 0; c < COLS; c++) {
        const token = board[c][r];
        cells.push(
          <div key={`${r}-${c}`} className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-black/40 flex items-center justify-center inner-shadow">
            {token && (
              <div className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full shadow-inner animate-drop ${token === 'red' ? 'bg-red-500 shadow-red-700/50' : 'bg-yellow-400 shadow-yellow-600/50'}`}></div>
            )}
          </div>
        );
      }
    }
    return cells;
  };

  const activePlayerName = activeGame.players.find(p => p.id === currentTurnId)?.name || 'Player';
  const isMyTurn = currentTurnId === myPlayerId;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4">
      {/* Turn Enforcement Banner */}
      {activeGame.winner ? (
        <div className="w-full max-w-sm bg-accent-primary/20 border border-accent-primary/30 text-[var(--accent-primary)] py-2.5 px-4 rounded-xl text-center font-black text-sm mb-4 uppercase tracking-wider">
          🎉 {activeGame.winner === 'draw' ? 'Draw!' : `Winner: ${activeGame.winner.toUpperCase()}!`}
        </div>
      ) : isMyTurn ? (
        <div className="w-full max-w-sm bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 py-2.5 px-4 rounded-xl text-center font-bold text-sm animate-pulse mb-4">
          🟢 Your turn ({playerColor})
        </div>
      ) : (
        <div className="w-full max-w-sm bg-white/5 border border-white/10 text-text-secondary py-2.5 px-4 rounded-xl text-center font-medium text-sm mb-4">
          ⏳ Waiting for {activePlayerName}...
        </div>
      )}

      <div className="mb-6 px-6 py-2 bg-bg-surface-elevated rounded-full border border-border-color shadow-[0_0_15px_var(--accent-primary-glow)]">
        <h2 className="text-xl font-black tracking-wider text-text-primary uppercase flex items-center gap-3">
          {status}
          {!winner && !isDraw && (
            <div className={`w-4 h-4 rounded-full ${redIsNext ? 'bg-red-500' : 'bg-yellow-400'}`}></div>
          )}
        </h2>
      </div>

      <div className="bg-blue-600 p-2 sm:p-4 rounded-xl shadow-[0_10px_30px_rgba(37,99,235,0.3)] border-b-8 border-blue-800">
        <div 
          className={`grid grid-cols-7 gap-1 sm:gap-2 bg-blue-700 p-2 rounded-lg ${currentTurnId === myPlayerId && playerColor !== 'spectator' && !activeGame.winner ? 'cursor-pointer' : 'cursor-not-allowed opacity-90'}`}
          onClick={(e) => {
            if (currentTurnId !== myPlayerId || playerColor === 'spectator' || activeGame.winner) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const colWidth = rect.width / COLS;
            const colIndex = Math.floor((e.clientX - rect.left) / colWidth);
            if (colIndex >= 0 && colIndex < COLS) {
              handleColumnClick(colIndex);
            }
          }}
        >
          {renderCells()}
        </div>
      </div>

      <div className="mt-8 text-xs text-text-secondary font-mono tracking-widest uppercase flex flex-col items-center gap-3">
        <span>You are: <span className={`font-bold ${playerColor === 'red' ? 'text-red-500' : playerColor === 'yellow' ? 'text-yellow-400' : 'text-text-primary'}`}>{playerColor.toUpperCase()}</span></span>
      </div>
    </div>
  );
}
