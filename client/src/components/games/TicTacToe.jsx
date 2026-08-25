import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';

export default function TicTacToe({ activeGame, socket, roomId, currentUser }) {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [xIsNext, setXIsNext] = useState(true);
  const [playerSymbol, setPlayerSymbol] = useState('spectator');

  useEffect(() => {
    // Determine player symbol based on join order
    const pIndex = activeGame.players.findIndex(p => p.id === currentUser.id);
    if (pIndex === 0) setPlayerSymbol('X');
    else if (pIndex === 1) setPlayerSymbol('O');

    if (activeGame.state && typeof activeGame.state === 'object') {
      setBoard(activeGame.state.board || Array(9).fill(null));
      setXIsNext(activeGame.state.xIsNext ?? true);
    }
  }, []);

  useEffect(() => {
    const handleGameAction = (data) => {
      if (data.state) {
        setBoard(data.state.board);
        setXIsNext(data.state.xIsNext);
        
        const winner = calculateWinner(data.state.board);
        if (winner) {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
          });
        }
      }
    };
    
    socket.on('game-action', handleGameAction);
    return () => socket.off('game-action', handleGameAction);
  }, [socket]);

  const handleClick = (i) => {
    if (playerSymbol === 'spectator') return;
    if (calculateWinner(board) || board[i]) return;
    if ((xIsNext && playerSymbol !== 'X') || (!xIsNext && playerSymbol !== 'O')) return;

    const nextBoard = board.slice();
    nextBoard[i] = xIsNext ? 'X' : 'O';
    
    setBoard(nextBoard);
    setXIsNext(!xIsNext);

    socket.emit('game-action', {
      roomId,
      state: { board: nextBoard, xIsNext: !xIsNext },
      player: currentUser
    });
  };

  const winner = calculateWinner(board);
  const isDraw = !winner && board.every(square => square !== null);
  
  let status;
  if (winner) {
    status = `Winner: ${winner}`;
  } else if (isDraw) {
    status = "Draw!";
  } else {
    status = `Next player: ${xIsNext ? 'X' : 'O'}`;
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4">
      <div className="mb-8 px-6 py-2 bg-bg-surface-elevated rounded-full border border-border-color shadow-[0_0_15px_var(--accent-primary-glow)]">
        <h2 className="text-xl font-black tracking-wider text-text-primary uppercase">{status}</h2>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-sm w-full aspect-square">
        {board.map((square, i) => (
          <button
            key={i}
            className={`bg-bg-surface-elevated border-2 ${square ? 'border-[var(--accent-primary)]' : 'border-border-color'} rounded-2xl flex items-center justify-center text-5xl sm:text-7xl font-black transition-all hover:bg-bg-base hover:scale-[1.02] active:scale-95 shadow-lg ${square === 'X' ? 'text-blue-500 shadow-blue-500/20' : square === 'O' ? 'text-pink-500 shadow-pink-500/20' : ''}`}
            onClick={() => handleClick(i)}
          >
            {square}
          </button>
        ))}
      </div>

      <div className="mt-8 text-xs text-text-secondary font-mono tracking-widest uppercase">
        You are: <span className="font-bold text-text-primary">{playerSymbol}</span>
      </div>
    </div>
  );
}

function calculateWinner(squares) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
    [0, 4, 8], [2, 4, 6]             // diagonals
  ];
  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return squares[a];
    }
  }
  return null;
}
