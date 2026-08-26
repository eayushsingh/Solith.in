import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';

export default function UnoGame({ activeGame, socket, roomId, currentUser, myPlayerId, currentTurnId }) {
  const [myHand, setMyHand] = useState([]);
  const [showColorSelector, setShowColorSelector] = useState(false);
  const [pendingPlayIndex, setPendingPlayIndex] = useState(null);

  // Sync hand privately from socket
  useEffect(() => {
    const handleUnoHand = (hand) => {
      setMyHand(hand || []);
    };
    
    socket.on('uno-hand', handleUnoHand);
    
    // Proactively request hand in case of join/reconnect
    socket.emit('uno-request-hand', { roomId });

    return () => {
      socket.off('uno-hand', handleUnoHand);
    };
  }, [socket, roomId]);

  // Handle confetti when winner is detected
  useEffect(() => {
    if (activeGame.state && activeGame.state.winner) {
      confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
    }
  }, [activeGame.state?.winner]);

  if (!activeGame.state || typeof activeGame.state !== 'object') {
    return <div className="p-8 text-white text-center">Loading game state...</div>;
  }

  const { discardPile, currentColor, winner, players } = activeGame.state;
  const topCard = discardPile[discardPile.length - 1];

  const isPlayer = activeGame.players?.some(p => p.id === currentUser.id);
  const isMyTurn = currentTurnId === myPlayerId;
  const activePlayerName = activeGame.players?.find(p => p.id === currentTurnId)?.name || 'Player';

  const canPlay = (card) => {
    if (!isMyTurn || winner) return false;
    if (card.color === 'black') return true;
    return card.color === currentColor || card.value === topCard.value;
  };

  const drawCard = () => {
    if (!isMyTurn || winner) return;
    socket.emit('game-action', {
      roomId,
      action: { type: 'draw' },
      playerId: currentUser.id
    });
  };

  const playCard = (card, cardIndex) => {
    if (!isMyTurn || winner) return;
    if (!canPlay(card)) return;

    if (card.color === 'black') {
      setPendingPlayIndex(cardIndex);
      setShowColorSelector(true);
    } else {
      socket.emit('game-action', {
        roomId,
        action: { type: 'play', cardIndex },
        playerId: currentUser.id
      });
    }
  };

  const selectColorAndPlay = (color) => {
    if (pendingPlayIndex === null) return;
    socket.emit('game-action', {
      roomId,
      action: { type: 'play', cardIndex: pendingPlayIndex, chosenColor: color },
      playerId: currentUser.id
    });
    setShowColorSelector(false);
    setPendingPlayIndex(null);
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-between p-4 bg-gradient-to-b from-green-900 to-green-950 relative">
      
      {/* Wild Card Color Selector Modal */}
      {showColorSelector && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50 rounded-2xl backdrop-blur-sm animate-fade-in">
          <div className="bg-bg-surface border border-border-color p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 max-w-xs w-full">
            <h3 className="text-white font-bold text-lg">Select Wild Color</h3>
            <div className="grid grid-cols-2 gap-3 w-full">
              {['red', 'blue', 'green', 'yellow'].map(color => (
                <button
                  key={color}
                  onClick={() => selectColorAndPlay(color)}
                  className="py-3 px-4 rounded-xl text-white font-black uppercase tracking-wider text-sm transition-all hover:scale-105 active:scale-95 shadow-md shadow-black/40"
                  style={{ backgroundColor: getHexColor(color) }}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Turn Enforcement Banner / Game Status */}
      {winner ? (
        <div className="w-full max-w-md bg-accent-primary/20 border border-accent-primary/30 text-[var(--accent-primary)] py-2 px-4 rounded-xl text-center font-black text-sm uppercase tracking-wider animate-bounce">
          🎉 {winner} Wins!
        </div>
      ) : isMyTurn ? (
        <div className="w-full max-w-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 py-2 px-4 rounded-xl text-center font-bold text-sm animate-pulse">
          🟢 Your turn
        </div>
      ) : (
        <div className="w-full max-w-md bg-white/5 border border-white/10 text-text-secondary py-2 px-4 rounded-xl text-center font-medium text-sm">
          ⏳ Waiting for {activePlayerName}...
        </div>
      )}

      {/* Opponents Status (Hand sizes only) */}
      <div className="flex gap-4 my-4 flex-wrap justify-center">
        {players.map((p) => p.id !== myPlayerId && (
          <div key={p.id} className={`p-2 rounded-xl bg-black/40 border-2 ${currentTurnId === p.id ? 'border-yellow-400' : 'border-transparent'} flex flex-col items-center min-w-[70px]`}>
            <div className="text-xs text-white font-bold max-w-[80px] truncate">{p.name}</div>
            <div className="text-[10px] text-gray-300 font-bold mt-0.5">{p.handSize} cards</div>
          </div>
        ))}
      </div>

      {/* Center Table */}
      <div className="flex-1 flex items-center justify-center gap-8 w-full relative">
        {winner ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10 rounded-2xl backdrop-blur-xs">
            <h1 className="text-4xl font-black text-white uppercase drop-shadow-[0_0_20px_#fff]">
              {winner} Wins!
            </h1>
          </div>
        ) : (
          <>
            {/* Draw Pile Button */}
            <button 
              onClick={drawCard}
              disabled={!isMyTurn}
              className={`w-24 h-36 rounded-xl bg-gray-900 border-4 border-white/20 flex items-center justify-center text-white font-black transition-all shadow-2xl ${isMyTurn ? 'hover:scale-105 active:scale-95 cursor-pointer hover:border-emerald-400/50' : 'opacity-40 cursor-not-allowed'}`}
            >
              DRAW
            </button>
            
            {/* Discard Pile */}
            <div className="relative">
              <div 
                className="w-24 h-36 rounded-xl flex items-center justify-center text-white font-black text-2xl shadow-2xl border-4 border-white/20 uppercase transition-all"
                style={{ 
                  backgroundColor: getHexColor(currentColor),
                  boxShadow: `0 10px 25px ${getHexColor(currentColor)}80` 
                }}
              >
                {topCard?.value}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Player's Own Hand */}
      {isPlayer && (
        <div className="w-full max-w-3xl mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-white font-bold text-sm">Your Hand ({myHand.length} cards)</h3>
          </div>
          <div className="flex flex-wrap gap-2 justify-center max-h-48 overflow-y-auto custom-scrollbar p-2 bg-black/20 rounded-2xl border border-white/5">
            {myHand.map((card, idx) => {
              const playable = canPlay(card);
              return (
                <button
                  key={card.id}
                  onClick={() => playCard(card, idx)}
                  disabled={!playable}
                  className={`w-16 h-24 rounded-lg flex flex-col items-center justify-between p-2 text-white font-black text-lg shadow-lg transition-all ${playable ? 'hover:-translate-y-4 hover:shadow-2xl cursor-pointer ring-2 ring-white/50 active:scale-95' : 'opacity-35 cursor-not-allowed'}`}
                  style={{ backgroundColor: getHexColor(card.color) }}
                >
                  <span className="text-xs self-start">{card.value}</span>
                  <span className="text-xl self-center">{card.value}</span>
                  <span className="text-xs self-end rotate-180">{card.value}</span>
                </button>
              );
            })}
            {myHand.length === 0 && (
              <span className="text-xs text-gray-400 italic">No cards in hand</span>
            )}
          </div>
        </div>
      )}

      {/* Spectator Mode Indicator */}
      {!isPlayer && (
        <div className="mt-4 px-4 py-2 bg-black/30 border border-white/10 text-text-secondary text-xs rounded-full uppercase tracking-wider font-semibold">
          👀 Spectating Mode
        </div>
      )}
    </div>
  );
}

function getHexColor(color) {
  switch(color) {
    case 'red': return '#ef4444';
    case 'blue': return '#3b82f6';
    case 'green': return '#22c55e';
    case 'yellow': return '#eab308';
    case 'black': return '#1f2937';
    default: return '#1f2937';
  }
}
