import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';

const ROWS = 6;
const COLS = 7;

export default function Connect4({ activeGame, socket, roomId, currentUser }) {
  // Board is an array of columns, where each column is an array of up to ROWS tokens (0 = red, 1 = yellow)
  const [board, setBoard] = useState(Array.from({ length: COLS }, () => []));
  const [redIsNext, setRedIsNext] = useState(true);
  const [playerColor, setPlayerColor] = useState('spectator');

  useEffect(() => {
    // Determine player color based on join order
    const pIndex = activeGame.players.findIndex(p => p.id === currentUser.id);
    if (pIndex === 0) setPlayerColor('red');
    else if (pIndex === 1) setPlayerColor('yellow');

    if (activeGame.state && typeof activeGame.state === 'object') {
      setBoard(activeGame.state.board || Array.from({ length: COLS }, () => []));
      setRedIsNext(activeGame.state.redIsNext ?? true);
    }
  }, []);

  useEffect(() => {
    const handleGameAction = (data) => {
      if (data.state) {
        setBoard(data.state.board);
        setRedIsNext(data.state.redIsNext);
        
        const winner = checkWinner(data.state.board);
        if (winner) {
          confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
        }
      }
    };
    
    socket.on('game-action', handleGameAction);
    return () => socket.off('game-action', handleGameAction);
  }, [socket]);

  const handleColumnClick = (colIndex) => {
    if (playerColor === 'spectator') return;
    if (checkWinner(board)) return;
    if ((redIsNext && playerColor !== 'red') || (!redIsNext && playerColor !== 'yellow')) return;
    
    const column = board[colIndex];
    if (column.length >= ROWS) return; // Column is full

    const newBoard = board.map((c, i) => i === colIndex ? [...c, redIsNext ? 'red' : 'yellow'] : c);
    
    setBoard(newBoard);
    setRedIsNext(!redIsNext);

    socket.emit('game-action', {
      roomId,
      state: { board: newBoard, redIsNext: !redIsNext },
      player: currentUser
    });
  };

  const winner = checkWinner(board);
  const isDraw = !winner && board.every(col => col.length === ROWS);
  
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

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4">
      <div className="mb-6 px-6 py-2 bg-bg-surface-elevated rounded-full border border-border-color shadow-[0_0_15px_var(--accent-primary-glow)]">
        <h2 className="text-xl font-black tracking-wider text-text-primary uppercase flex items-center gap-3">
          {status}
          {!winner && !isDraw && (
            <div className={`w-4 h-4 rounded-full ${redIsNext ? 'bg-red-500' : 'bg-yellow-400'}`}></div>
          )}
        </h2>
      </div>

      <div className="bg-blue-600 p-2 sm:p-4 rounded-xl shadow-[0_10px_30px_rgba(37,99,235,0.3)] border-b-8 border-blue-800">
        <div className="grid grid-cols-7 gap-1 sm:gap-2 bg-blue-700 p-2 rounded-lg cursor-pointer" onClick={(e) => {
          // Calculate column clicked based on click position
          const rect = e.currentTarget.getBoundingClientRect();
          const colWidth = rect.width / COLS;
          const colIndex = Math.floor((e.clientX - rect.left) / colWidth);
          if (colIndex >= 0 && colIndex < COLS) {
            handleColumnClick(colIndex);
          }
        }}>
          {renderCells()}
        </div>
      </div>

      <div className="mt-8 text-xs text-text-secondary font-mono tracking-widest uppercase">
        You are: <span className={`font-bold ${playerColor === 'red' ? 'text-red-500' : playerColor === 'yellow' ? 'text-yellow-400' : 'text-text-primary'}`}>{playerColor}</span>
      </div>
    </div>
  );
}

function checkWinner(board) {
  // Check vertical
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r <= ROWS - 4; r++) {
      if (board[c][r] && board[c][r] === board[c][r+1] && board[c][r] === board[c][r+2] && board[c][r] === board[c][r+3]) return board[c][r];
    }
  }
  // Check horizontal
  for (let c = 0; c <= COLS - 4; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (board[c][r] && board[c][r] === board[c+1][r] && board[c][r] === board[c+2][r] && board[c][r] === board[c+3][r]) return board[c][r];
    }
  }
  // Check diagonal right
  for (let c = 0; c <= COLS - 4; c++) {
    for (let r = 0; r <= ROWS - 4; r++) {
      if (board[c][r] && board[c][r] === board[c+1][r+1] && board[c][r] === board[c+2][r+2] && board[c][r] === board[c+3][r+3]) return board[c][r];
    }
  }
  // Check diagonal left
  for (let c = 3; c < COLS; c++) {
    for (let r = 0; r <= ROWS - 4; r++) {
      if (board[c][r] && board[c][r] === board[c-1][r+1] && board[c][r] === board[c-2][r+2] && board[c][r] === board[c-3][r+3]) return board[c][r];
    }
  }
  return null;
}
