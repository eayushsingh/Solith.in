import React, { useState, useEffect } from 'react';

const PREMIUM = {
  tripleWord:   { bg: '#dc2626', label: 'TW' },
  doubleWord:   { bg: '#f97316', label: 'DW' },
  tripleLetter: { bg: '#2563eb', label: 'TL' },
  doubleLetter: { bg: '#0ea5e9', label: 'DL' },
};

function getPremiumType(row, col, premiumSquares) {
  for (const [type, squares] of Object.entries(premiumSquares || {})) {
    if (squares.some(([r, c]) => r === row && c === col)) return type;
  }
  return null;
}

export default function ScrabbleGame({ activeGame, currentUser, socket, roomId }) {
  const [myRack, setMyRack] = useState([]);
  const [selected, setSelected] = useState(null);
  const [placed, setPlaced] = useState({}); // {`r-c`: tile}
  const [direction, setDirection] = useState('horizontal');

  const isMyTurn = activeGame?.currentTurnId === currentUser?.id;
  const isPlayer = activeGame?.players.some(p => p.id === currentUser?.id);

  useEffect(() => {
    socket.on('scrabble-rack', ({ rack }) => setMyRack(rack));
    return () => socket.off('scrabble-rack');
  }, [socket]);

  const placeOnBoard = (row, col) => {
    if (!isMyTurn || !selected) return;
    if (activeGame.state.board[row][col]) return;
    const key = `${row}-${col}`;
    setPlaced(prev => ({ ...prev, [key]: selected }));
    setMyRack(prev => prev.filter(t => t.id !== selected.id));
    setSelected(null);
  };

  const recall = () => {
    const recalled = Object.values(placed);
    setMyRack(prev => [...prev, ...recalled]);
    setPlaced({});
    setSelected(null);
  };

  const submitMove = () => {
    if (Object.keys(placed).length === 0) return;
    const placedTiles = Object.entries(placed).map(([key, tile]) => {
      const [row, col] = key.split('-').map(Number);
      return { row, col, tile };
    });

    socket.emit('game-action', {
      roomId,
      playerId: currentUser.id,
      gameType: 'scrabble',
      action: { type: 'place', tiles: placedTiles },
      newState: {
        ...activeGame.state,
        board: activeGame.state.board.map((row, ri) =>
          row.map((cell, ci) => {
            const key = `${ri}-${ci}`;
            return placed[key] ? placed[key] : cell;
          })
        ),
        lastMove: { playerId: currentUser.id, tiles: placedTiles },
        rackCounts: {
          ...activeGame.state.rackCounts,
          [currentUser.id]: myRack.length
        }
      }
    });
    setPlaced({});
  };

  const pass = () => {
    socket.emit('game-action', {
      roomId,
      playerId: currentUser.id,
      gameType: 'scrabble',
      action: { type: 'pass' },
      newState: {
        ...activeGame.state,
        passCount: (activeGame.state.passCount || 0) + 1,
        winner: (activeGame.state.passCount || 0) + 1 >= activeGame.players.length * 2
          ? Object.entries(activeGame.state.scores).sort((a,b) => b[1]-a[1])[0][0]
          : null
      }
    });
  };

  const board = activeGame?.state?.board || Array(15).fill(null).map(() => Array(15).fill(null));
  const premiumSquares = activeGame?.state?.premiumSquares || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 12, gap: 8, overflow: 'auto' }}>
      {/* Turn indicator */}
      <div style={{
        textAlign: 'center', padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
        background: isMyTurn ? 'rgba(24,119,242,0.2)' : 'rgba(255,255,255,0.05)',
        color: isMyTurn ? '#60a5fa' : 'rgba(255,255,255,0.4)'
      }}>
        {isMyTurn ? '🟢 Your Turn — Place tiles on board' : `⏳ ${activeGame?.players.find(p => p.id === activeGame?.currentTurnId)?.name}'s turn`}
      </div>

      {/* Scores */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {activeGame?.players.map(p => (
          <div key={p.id} style={{
            padding: '4px 10px', borderRadius: 20, fontSize: 11,
            background: 'rgba(255,255,255,0.06)', color: 'white'
          }}>
            {p.name}: {activeGame.state.scores?.[p.id] || 0}pts
          </div>
        ))}
      </div>

      {/* Board */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(15, 1fr)', gap: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 4, overflow: 'auto' }}>
        {board.map((row, ri) =>
          row.map((cell, ci) => {
            const key = `${ri}-${ci}`;
            const placedTile = placed[key];
            const premType = getPremiumType(ri, ci, premiumSquares);
            const premium = premType ? PREMIUM[premType] : null;
            const isCenter = ri === 7 && ci === 7;

            return (
              <div key={key} onClick={() => placeOnBoard(ri, ci)} style={{
                width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: placedTile || cell ? 9 : 7, fontWeight: 700, borderRadius: 2,
                background: placedTile ? '#fbbf24' : cell ? '#d4a96a' : premium ? premium.bg : isCenter ? '#f97316' : 'rgba(255,255,255,0.06)',
                color: placedTile || cell ? '#1a1a1a' : 'rgba(255,255,255,0.6)',
                cursor: isMyTurn && selected && !cell ? 'pointer' : 'default',
                border: placedTile ? '1px solid #f59e0b' : '1px solid transparent',
                transition: 'background 0.1s'
              }}>
                {placedTile ? placedTile.letter : cell ? cell.letter : premium ? premium.label : isCenter ? '★' : ''}
              </div>
            );
          })
        )}
      </div>

      {/* My rack */}
      {isPlayer && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
          {myRack.map(tile => (
            <div key={tile.id} onClick={() => setSelected(tile)} style={{
              width: 36, height: 36, background: selected?.id === tile.id ? '#fbbf24' : '#d4a96a',
              borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', cursor: 'pointer', border: `2px solid ${selected?.id === tile.id ? '#f59e0b' : 'transparent'}`,
              transition: 'all 0.1s'
            }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#1a1a1a' }}>{tile.letter}</span>
              <span style={{ fontSize: 7, color: '#444' }}>{tile.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      {isMyTurn && isPlayer && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={recall} style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: 12, fontWeight: 600
          }}>Recall</button>
          <button onClick={pass} style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', fontSize: 12
          }}>Pass</button>
          <button onClick={submitMove} disabled={Object.keys(placed).length === 0} style={{
            padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: Object.keys(placed).length > 0 ? '#1877f2' : 'rgba(255,255,255,0.08)',
            color: 'white', fontSize: 12, fontWeight: 700
          }}>Submit Word</button>
        </div>
      )}
    </div>
  );
}
