import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';

// Deck generation
const COLORS = ['red', 'yellow', 'green', 'blue'];
const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', '+2'];
const WILDS = ['wild', 'wild+4'];

function generateDeck() {
  const deck = [];
  COLORS.forEach(color => {
    deck.push({ color, value: '0', id: Math.random().toString() });
    for (let i = 0; i < 2; i++) {
      VALUES.slice(1).forEach(value => {
        deck.push({ color, value, id: Math.random().toString() });
      });
    }
  });
  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'black', value: 'wild', id: Math.random().toString() });
    deck.push({ color: 'black', value: 'wild+4', id: Math.random().toString() });
  }
  return deck.sort(() => Math.random() - 0.5);
}

export default function UnoGame({ activeGame, socket, roomId, currentUser }) {
  const [gameState, setGameState] = useState(null);
  const [playerIndex, setPlayerIndex] = useState(-1);

  // Initialize
  useEffect(() => {
    let pIndex = activeGame.players?.findIndex(p => p.id === currentUser.id) ?? -1;
    setPlayerIndex(pIndex);

    if (activeGame.state === 'start' && pIndex === 0) {
      // Host initializes game
      const deck = generateDeck();
      const players = activeGame.players.map(p => ({
        id: p.id,
        name: p.name,
        hand: deck.splice(0, 7)
      }));
      
      // First card can't be wild for simplicity
      let discard = deck.pop();
      while (discard.color === 'black') {
        deck.unshift(discard);
        discard = deck.pop();
      }

      const initialState = {
        deck,
        discardPile: [discard],
        players,
        turnIndex: 0,
        direction: 1,
        currentColor: discard.color,
        winner: null
      };
      
      setGameState(initialState);
      
      socket.emit('game-action', {
        roomId,
        state: initialState,
        player: currentUser
      });
    } else if (activeGame.state && activeGame.state !== 'start') {
      setGameState(activeGame.state);
    }
  }, [activeGame.players, currentUser.id, activeGame.state]);

  useEffect(() => {
    const handleGameAction = (data) => {
      if (data.state) {
        setGameState(data.state);
        if (data.state.winner && (!gameState || !gameState.winner)) {
          confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
        }
      }
    };
    socket.on('game-action', handleGameAction);
    return () => socket.off('game-action', handleGameAction);
  }, [socket, gameState]);

  if (!gameState) return <div className="p-8 text-white text-center">Loading game...</div>;

  const myTurn = gameState.turnIndex === playerIndex;
  const me = gameState.players[playerIndex];

  const canPlay = (card) => {
    if (!myTurn || gameState.winner) return false;
    if (card.color === 'black') return true;
    const topCard = gameState.discardPile[gameState.discardPile.length - 1];
    return card.color === gameState.currentColor || card.value === topCard.value;
  };

  const drawCard = () => {
    if (!myTurn || gameState.winner) return;
    const newState = { ...gameState };
    if (newState.deck.length === 0) {
      // Reshuffle
      const top = newState.discardPile.pop();
      newState.deck = newState.discardPile.sort(() => Math.random() - 0.5);
      newState.discardPile = [top];
    }
    const card = newState.deck.pop();
    newState.players[playerIndex].hand.push(card);
    newState.turnIndex = (newState.turnIndex + newState.direction + newState.players.length) % newState.players.length;
    
    setGameState(newState);
    socket.emit('game-action', { roomId, state: newState, player: currentUser });
  };

  const playCard = (card, cardIndex) => {
    if (!canPlay(card)) return;
    
    const newState = JSON.parse(JSON.stringify(gameState)); // Deep copy
    
    // Remove from hand
    newState.players[playerIndex].hand.splice(cardIndex, 1);
    newState.discardPile.push(card);
    
    // Handle effects
    let nextTurnOffset = newState.direction;
    let newColor = card.color;
    
    if (card.color === 'black') {
      // Auto pick color for simplicity, ideally would prompt
      newColor = ['red', 'blue', 'green', 'yellow'][Math.floor(Math.random() * 4)];
    }
    
    if (card.value === 'reverse') {
      newState.direction *= -1;
      if (newState.players.length === 2) nextTurnOffset = newState.direction * 2; // Reverse in 2 player is a skip
      else nextTurnOffset = newState.direction;
    } else if (card.value === 'skip') {
      nextTurnOffset = newState.direction * 2;
    } else if (card.value === '+2') {
      nextTurnOffset = newState.direction * 2;
      const target = (newState.turnIndex + newState.direction + newState.players.length) % newState.players.length;
      for(let i=0; i<2; i++) {
        if(newState.deck.length > 0) newState.players[target].hand.push(newState.deck.pop());
      }
    } else if (card.value === 'wild+4') {
      nextTurnOffset = newState.direction * 2;
      const target = (newState.turnIndex + newState.direction + newState.players.length) % newState.players.length;
      for(let i=0; i<4; i++) {
        if(newState.deck.length > 0) newState.players[target].hand.push(newState.deck.pop());
      }
    }
    
    newState.currentColor = newColor;
    newState.turnIndex = (newState.turnIndex + nextTurnOffset + newState.players.length) % newState.players.length;
    
    if (newState.players[playerIndex].hand.length === 0) {
      newState.winner = newState.players[playerIndex].name;
    }

    setGameState(newState);
    socket.emit('game-action', { roomId, state: newState, player: currentUser });
  };

  const topCard = gameState.discardPile[gameState.discardPile.length - 1];

  return (
    <div className="w-full h-full flex flex-col items-center justify-between p-4 bg-gradient-to-b from-green-900 to-green-950">
      
      {/* Opponents Status */}
      <div className="flex gap-4 mb-4">
        {gameState.players.map((p, i) => i !== playerIndex && (
          <div key={p.id} className={`p-2 rounded-lg bg-black/40 border-2 ${gameState.turnIndex === i ? 'border-yellow-400' : 'border-transparent'}`}>
            <div className="text-sm text-white font-bold">{p.name}</div>
            <div className="text-xs text-gray-300">{p.hand.length} cards</div>
          </div>
        ))}
      </div>

      {/* Center Table */}
      <div className="flex-1 flex items-center justify-center gap-8 w-full relative">
        {gameState.winner ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50 rounded-2xl backdrop-blur-sm">
            <h1 className="text-5xl font-black text-white uppercase drop-shadow-[0_0_20px_#fff] animate-bounce">
              {gameState.winner} Wins!
            </h1>
          </div>
        ) : (
          <>
            <button 
              onClick={drawCard}
              className="w-24 h-36 rounded-xl bg-gray-900 border-4 border-white/20 flex items-center justify-center text-white font-black hover:scale-105 transition-transform cursor-pointer shadow-2xl"
            >
              DRAW
            </button>
            
            <div className="relative">
              <div className={`w-24 h-36 rounded-xl flex items-center justify-center text-white font-black text-3xl shadow-2xl shadow-${gameState.currentColor}-500/50 border-4 border-white/20`} style={{ backgroundColor: getHexColor(gameState.currentColor) }}>
                {topCard.value}
              </div>
            </div>
          </>
        )}
      </div>

      {/* My Hand */}
      {me && (
        <div className="w-full max-w-3xl mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-white font-bold">Your Hand</h3>
            {myTurn && <span className="text-yellow-400 font-bold animate-pulse">Your Turn!</span>}
          </div>
          <div className="flex flex-wrap gap-2 justify-center max-h-48 overflow-y-auto custom-scrollbar p-2">
            {me.hand.map((card, idx) => (
              <button
                key={card.id}
                onClick={() => playCard(card, idx)}
                disabled={!canPlay(card)}
                className={`w-16 h-24 rounded-lg flex items-center justify-center text-white font-black text-xl shadow-lg transition-transform ${canPlay(card) ? 'hover:-translate-y-4 cursor-pointer ring-2 ring-white/50' : 'opacity-50 cursor-not-allowed'}`}
                style={{ backgroundColor: getHexColor(card.color) }}
              >
                {card.value}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Join Game Button */}
      {!me && activeGame.players?.length < 4 && (
        <div className="mt-8 text-center">
          <button 
            onClick={() => {
              socket.emit('game-join', { roomId, player: currentUser });
            }}
            className="px-6 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white font-bold rounded-lg transition-colors shadow-lg"
          >
            Join Game
          </button>
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
