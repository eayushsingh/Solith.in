import React, { useState, useEffect } from 'react';

const COLOR_MAP = { red: '#ef4444', green: '#22c55e', blue: '#3b82f6', yellow: '#eab308', wild: '#8b5cf6' };

export default function UnoGame({ activeGame, currentUser, socket, roomId }) {
  const [myHand, setMyHand] = useState([]);
  const [topCard, setTopCard] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pendingWild, setPendingWild] = useState(null);

  const isMyTurn = activeGame?.currentTurnId === currentUser?.id;
  const myPlayerIndex = activeGame?.players.findIndex(p => p?.id === currentUser?.id);

  useEffect(() => {
    socket.on('uno-hand', ({ hand, topCard: tc }) => {
      setMyHand(hand);
      if (tc) setTopCard(tc);
    });
    socket.on('uno-draw', ({ cards }) => {
      setMyHand(prev => [...prev, ...cards]);
    });
    return () => {
      socket.off('uno-hand');
      socket.off('uno-draw');
    };
  }, [socket]);

  useEffect(() => {
    if (activeGame?.state?.topCard) {
      setTopCard(activeGame.state.topCard);
    }
  }, [activeGame?.state?.topCard]);

  const canPlay = (card) => {
    if (!isMyTurn || !topCard) return false;
    if (card.color === 'wild') return true;
    if (card.color === topCard.color) return true;
    if (card.value === topCard.value) return true;
    return false;
  };

  const playCard = (card) => {
    if (!canPlay(card)) return;

    if (card.color === 'wild') {
      setPendingWild(card);
      setShowColorPicker(true);
      return;
    }

    emitPlay(card, null);
  };

  const emitPlay = (card, chosenColor) => {
    const newHand = myHand.filter(c => c.id !== card.id);
    let skipCount = 1;
    let newTopCard = { ...card };

    if (chosenColor) newTopCard.color = chosenColor;

    if (card.value === 'skip') skipCount = 2;
    if (card.value === 'reverse') skipCount = -1;

    socket.emit('game-action', {
      roomId,
      playerId: currentUser.id,
      gameType: 'uno',
      action: { type: 'play', card, chosenColor },
      newState: {
        ...activeGame.state,
        topCard: newTopCard,
        handCounts: {
          ...activeGame.state.handCounts,
          [currentUser.id]: newHand.length
        },
        winner: newHand.length === 0 ? currentUser.id : null,
        skipCount: Math.abs(skipCount),
        direction: card.value === 'reverse'
          ? -(activeGame.state.direction || 1)
          : (activeGame.state.direction || 1),
        lastAction: { playerId: currentUser.id, card, chosenColor }
      }
    });

    setMyHand(newHand);
    setShowColorPicker(false);
    setPendingWild(null);
  };

  const drawCard = () => {
    if (!isMyTurn) return;
    socket.emit('game-action', {
      roomId,
      playerId: currentUser.id,
      gameType: 'uno',
      action: { type: 'draw' },
      newState: {
        ...activeGame.state,
        lastAction: { playerId: currentUser.id, action: 'draw' }
      }
    });
  };

  if (myPlayerIndex === -1) {
    // Spectator view
    return (
      <div style={{ padding: 20, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>👀</div>
        Spectating UNO
        {topCard && (
          <div style={{ marginTop: 16 }}>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginBottom: 8 }}>Top Card</div>
            <UnoCard card={topCard} />
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          {activeGame.players.map(p => (
            <div key={p.id} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '6px 12px', color: activeGame.currentTurnId === p.id ? '#60a5fa' : 'rgba(255,255,255,0.5)',
              fontWeight: activeGame.currentTurnId === p.id ? 700 : 400, fontSize: 13
            }}>
              <span>{p.name}</span>
              <span>{activeGame.state.handCounts?.[p.id] || 0} cards</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 16, gap: 12 }}>
      {/* Turn indicator */}
      <div style={{
        textAlign: 'center', padding: '8px 16px', borderRadius: 20,
        background: isMyTurn ? 'rgba(24,119,242,0.2)' : 'rgba(255,255,255,0.05)',
        color: isMyTurn ? '#60a5fa' : 'rgba(255,255,255,0.4)',
        fontWeight: 700, fontSize: 13
      }}>
        {isMyTurn ? '🟢 Your Turn!' : `⏳ ${activeGame.players.find(p => p?.id === activeGame.currentTurnId)?.name}'s turn`}
      </div>

      {/* Other players hand counts */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        {activeGame.players.filter(p => p?.id !== currentUser.id).map(p => (
          <div key={p.id} style={{
            padding: '4px 10px', borderRadius: 20, fontSize: 12,
            background: activeGame.currentTurnId === p.id ? 'rgba(24,119,242,0.15)' : 'rgba(255,255,255,0.06)',
            color: activeGame.currentTurnId === p.id ? '#60a5fa' : 'rgba(255,255,255,0.5)',
            border: `1px solid ${activeGame.currentTurnId === p.id ? 'rgba(24,119,242,0.3)' : 'transparent'}`
          }}>
            {p.name}: {activeGame.state.handCounts?.[p.id] || 0} cards
          </div>
        ))}
      </div>

      {/* Top card + Draw pile */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        <button onClick={drawCard} disabled={!isMyTurn} style={{
          width: 70, height: 100, borderRadius: 10,
          background: 'rgba(255,255,255,0.08)', border: '2px dashed rgba(255,255,255,0.2)',
          color: 'white', fontWeight: 700, fontSize: 12, cursor: isMyTurn ? 'pointer' : 'not-allowed',
          opacity: isMyTurn ? 1 : 0.5
        }}>
          Draw
        </button>
        {topCard && <UnoCard card={topCard} size="large" />}
      </div>

      {/* Color picker for wild */}
      {showColorPicker && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {['red', 'green', 'blue', 'yellow'].map(color => (
            <button key={color} onClick={() => emitPlay(pendingWild, color)} style={{
              width: 44, height: 44, borderRadius: '50%',
              background: COLOR_MAP[color], border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
            }} />
          ))}
        </div>
      )}

      {/* My hand */}
      <div style={{ flex: 1, overflowX: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0' }}>
        {myHand.map(card => (
          <div key={card.id} onClick={() => playCard(card)} style={{
            cursor: canPlay(card) ? 'pointer' : 'not-allowed',
            transform: canPlay(card) ? 'translateY(-8px)' : 'none',
            transition: 'transform 0.15s',
            opacity: !isMyTurn ? 0.5 : canPlay(card) ? 1 : 0.6,
            flexShrink: 0
          }}>
            <UnoCard card={card} />
          </div>
        ))}
      </div>
    </div>
  );
}

function UnoCard({ card, size = 'normal' }) {
  const w = size === 'large' ? 80 : 60;
  const h = size === 'large' ? 110 : 85;
  return (
    <div style={{
      width: w, height: h, borderRadius: 8,
      background: COLOR_MAP[card.color] || '#8b5cf6',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: '3px solid rgba(255,255,255,0.3)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      color: 'white', fontWeight: 900,
      fontSize: size === 'large' ? 22 : 16,
      flexShrink: 0
    }}>
      {card.value === 'wild' ? '🌈' : card.value === 'wild4' ? '+4' :
       card.value === 'skip' ? '⊘' : card.value === 'reverse' ? '↺' :
       card.value === 'draw2' ? '+2' : card.value}
    </div>
  );
}
