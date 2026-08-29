import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, db, updateDoc, doc, serverTimestamp } from '../firebase';
import { ArrowLeft, Send, Shield, Flag, MoreVertical, Loader2, Image as ImageIcon, X } from 'lucide-react';
import ReportModal from './ReportModal';
import { playSound } from '../utils/sounds';

export default function DirectMessage({ conversationId, currentUser, targetProfile, onBack, openUserProfile }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  
  const fileInputRef = useRef(null);
  
  const endOfMessagesRef = useRef(null);
  const previousMessagesLength = useRef(0);

  useEffect(() => {
    if (!conversationId) return;

    const q = query(
      collection(db, 'conversations', conversationId, 'messages'),
      orderBy('sentAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      setLoading(false);
      
      // Play sound on new message
      if (previousMessagesLength.current > 0 && msgs.length > previousMessagesLength.current) {
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg && lastMsg.senderId !== currentUser.id) {
          playSound('message');
        }
      }
      previousMessagesLength.current = msgs.length;
      
      // Update read status for messages sent by the other user
      msgs.forEach(msg => {
        if (msg.senderId !== currentUser.id && !msg.readAt) {
          updateDoc(doc(db, 'conversations', conversationId, 'messages', msg.id), {
            readAt: serverTimestamp()
          }).catch(console.error);
        }
      });
    });

    return () => unsubscribe();
  }, [conversationId, currentUser.id]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_SIZE = 800;
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const text = newMessage.trim();
    if (!text && !selectedImage) return;
    if (text.length > 2000) return;

    setSending(true);
    let imageUrl = null;
    if (selectedImage) {
      imageUrl = await compressImage(selectedImage);
    }
    
    playSound('message');
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    
    try {
      const res = await fetch(`${API_URL}/api/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.token}`
        },
        body: JSON.stringify({
          conversationId,
          receiverId: targetProfile.id,
          text,
          imageUrl
        })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to send message');
      } else {
        setNewMessage('');
        setSelectedImage(null);
      }
    } catch (err) {
      console.error(err);
      alert('Error sending message');
    } finally {
      setSending(false);
    }
  };

  const handleBlock = async () => {
    if (!window.confirm(`Are you sure you want to block ${targetProfile.name}? They will no longer be able to message you.`)) return;

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    try {
      const res = await fetch(`${API_URL}/api/users/${targetProfile.id}/block`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${currentUser.token}` }
      });

      if (res.ok) {
        alert(`You have blocked ${targetProfile.name}.`);
        onBack(); // Go back to inbox, inbox will filter out blocked convos
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to block user');
      }
    } catch (err) {
      console.error(err);
      alert('Error blocking user');
    }
  };

  return (
    <div className="w-full h-full min-h-[100dvh] flex flex-col bg-[var(--bg)] relative animate-fade-in overflow-hidden">
      {/* Header */}
      <div className="min-h-16 px-4 py-3 border-b border-[var(--line-subtle)] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0 bg-[var(--bg)]/80 backdrop-blur-md z-10 sticky top-0">
        <div className="flex items-center gap-3 min-w-0">
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[var(--bg-secondary)] transition-colors text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div 
            onClick={() => openUserProfile && openUserProfile(targetProfile.id)}
            className="flex items-center gap-3 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
          >
            {targetProfile.photoUrl ? (
              <img src={targetProfile.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-[var(--line-subtle)]" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[var(--bg-secondary)] border border-[var(--line-subtle)] flex items-center justify-center">
                <span className="text-text-secondary font-bold">{targetProfile.name?.charAt(0)}</span>
              </div>
            )}
            <div>
              <h3 className="text-base font-bold text-text-primary">{targetProfile.name}</h3>
              <p className="text-xs text-text-secondary">Level {Math.max(1, Math.floor((targetProfile.xp || 0)/100))}</p>
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="relative">
          <button 
            onClick={() => setShowOptions(!showOptions)}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[var(--bg-secondary)] transition-colors text-text-secondary hover:text-text-primary"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {showOptions && (
            <div className="absolute top-12 right-0 w-[min(18rem,calc(100vw-2rem))] bg-[var(--bg-elevated)] border border-[var(--line-subtle)] shadow-2xl rounded-xl overflow-hidden py-1 z-50">
              <button 
                onClick={() => { setShowOptions(false); handleBlock(); }}
                className="w-full px-4 py-2.5 text-left text-sm font-medium hover:bg-[var(--bg-hover)] text-red-500 flex items-center gap-2 transition-colors"
              >
                <Shield className="w-4 h-4" /> Block User
              </button>
              <button 
                onClick={() => { setShowOptions(false); setShowReportModal(true); }}
                className="w-full px-4 py-2.5 text-left text-sm font-medium hover:bg-[var(--bg-hover)] text-text-secondary flex items-center gap-2 transition-colors"
              >
                <Flag className="w-4 h-4" /> Report User
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-4 custom-scrollbar flex flex-col gap-4 min-h-0">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-text-secondary animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-text-secondary" />
            </div>
            <p className="text-text-secondary max-w-sm">This is the beginning of your direct message history with {targetProfile.name}. Be respectful and follow community guidelines.</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.senderId === currentUser.id;
            const showTime = index === 0 || (msg.sentAt && messages[index-1]?.sentAt && (msg.sentAt.seconds - messages[index-1].sentAt.seconds > 300));
            
            return (
              <React.Fragment key={msg.id}>
                {showTime && msg.sentAt && (
                  <div className="text-center text-[10px] uppercase font-bold tracking-widest text-text-secondary my-2">
                    {msg.sentAt.toDate().toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
                <div className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div 
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed break-words shadow-sm flex flex-col gap-2 ${
                      isMe 
                        ? 'bg-blue-600 text-text-primary rounded-br-sm' 
                        : 'bg-[var(--bg-secondary)] border border-[var(--line-subtle)] text-text-primary rounded-bl-sm'
                    }`}
                  >
                    {msg.imageUrl && (
                      <img src={msg.imageUrl} alt="attachment" className="max-w-full rounded-xl object-contain max-h-[300px]" />
                    )}
                    {msg.text && <span>{msg.text}</span>}
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={endOfMessagesRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-[var(--line-subtle)] bg-[var(--bg)] shrink-0 flex flex-col gap-2 relative">
        {selectedImage && (
          <div className="max-w-4xl mx-auto w-full relative">
            <div className="relative inline-block rounded-xl overflow-hidden border border-[var(--line-subtle)] w-24 h-24 bg-black/20">
              <img src={URL.createObjectURL(selectedImage)} className="w-full h-full object-cover" alt="Preview" />
              <button 
                type="button" 
                onClick={() => setSelectedImage(null)}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-black transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        <form onSubmit={handleSendMessage} className="relative flex items-center max-w-4xl mx-auto w-full gap-2">
          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setSelectedImage(e.target.files[0]);
              }
            }}
          />
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-text-secondary hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 transition-colors"
          >
            <ImageIcon className="w-5 h-5" />
          </button>
          
          <div className="relative flex-1">
            <input 
              type="text" 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value.slice(0, 2000))} // Client side limit
              placeholder="Type a message..." 
              className="w-full bg-[var(--bg-secondary)] border border-[var(--line-subtle)] rounded-full pl-5 pr-12 py-3.5 text-[15px] text-text-primary placeholder-[var(--ink-tertiary)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all min-w-0"
              autoFocus={!selectedImage}
            />
            <button 
              type="submit"
              disabled={sending || (!newMessage.trim() && !selectedImage)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-blue-500 hover:bg-blue-500/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </form>
      </div>

      {showReportModal && (
        <ReportModal 
          isOpen={true} 
          onClose={() => setShowReportModal(false)} 
          targetUser={targetProfile} 
          currentUser={currentUser}
          roomId={`dm_${conversationId}`} // context indicator
        />
      )}
    </div>
  );
}
