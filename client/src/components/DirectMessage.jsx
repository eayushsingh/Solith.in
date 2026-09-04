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
    <div className="w-full h-full min-h-[100dvh] flex flex-col bg-[#07080C] relative animate-fade-in overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#1877f2]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#8b5cf6]/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <div className="h-16 px-6 border-b border-white/[0.08] flex items-center justify-between shrink-0 bg-[#0B0D14]/70 backdrop-blur-2xl z-20 sticky top-0 shadow-[0_4px_30px_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-4 min-w-0">
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-2xl flex items-center justify-center bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] transition-all text-[#888A92] hover:text-white shadow-inner"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div 
            onClick={() => openUserProfile && openUserProfile(targetProfile.id)}
            className="flex items-center gap-3.5 min-w-0 cursor-pointer group"
          >
            <div className="relative">
              {targetProfile.photoUrl ? (
                <img src={targetProfile.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-white/10 shadow-md group-hover:border-[#1877f2]/50 transition-colors" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1E212B] to-[#12141C] border border-white/10 flex items-center justify-center shadow-md group-hover:border-[#1877f2]/50 transition-colors" style={{ backgroundColor: targetProfile.color || '#1E212B' }}>
                  <span className="text-white font-bold text-sm">{targetProfile.name?.charAt(0)}</span>
                </div>
              )}
              <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0B0D14] shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-bold text-white tracking-tight group-hover:text-[#60A5FA] transition-colors">{targetProfile.name}</h3>
              </div>
              <p className="text-[11px] font-medium text-[#888A92] flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active • Level {Math.max(1, Math.floor((targetProfile.xp || 0)/100))}
              </p>
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="relative">
          <button 
            onClick={() => setShowOptions(!showOptions)}
            className="w-10 h-10 rounded-2xl flex items-center justify-center bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] transition-all text-[#888A92] hover:text-white"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {showOptions && (
            <div className="absolute top-12 right-0 w-52 bg-[#12141C]/95 backdrop-blur-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] rounded-2xl overflow-hidden p-1.5 z-50 animate-in fade-in zoom-in-95">
              <button 
                onClick={() => { setShowOptions(false); handleBlock(); }}
                className="w-full px-3.5 py-2.5 rounded-xl text-left text-xs font-semibold hover:bg-red-500/10 text-red-400 flex items-center gap-2.5 transition-all"
              >
                <Shield className="w-4 h-4 text-red-400" /> Block User
              </button>
              <button 
                onClick={() => { setShowOptions(false); setShowReportModal(true); }}
                className="w-full px-3.5 py-2.5 rounded-xl text-left text-xs font-semibold hover:bg-white/[0.06] text-[#888A92] hover:text-white flex items-center gap-2.5 transition-all"
              >
                <Flag className="w-4 h-4 text-[#888A92]" /> Report User
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar flex flex-col gap-4 min-h-0 bg-[#07080C] relative">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#3B82F6]/20 via-[#8b5cf6]/10 to-transparent flex items-center justify-center mb-5 shadow-[0_0_50px_rgba(59,130,246,0.15)] border border-white/10">
              <Shield className="w-8 h-8 text-[#60A5FA]" />
            </div>
            <h2 className="text-xl font-bold text-white mb-1.5 tracking-tight">Direct Conversation with {targetProfile.name.split(' ')[0]}</h2>
            <p className="text-[#888A92] max-w-sm text-xs leading-relaxed font-medium">Send a message to start practicing together in private.</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.senderId === currentUser.id;
            const showTime = index === 0 || (msg.sentAt && messages[index-1]?.sentAt && (msg.sentAt.seconds - messages[index-1].sentAt.seconds > 300));
            
            return (
              <React.Fragment key={msg.id}>
                {showTime && msg.sentAt && (
                  <div className="text-center text-[10px] uppercase font-bold tracking-widest text-[#555861] my-3">
                    {msg.sentAt.toDate().toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
                <div className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div 
                    className={`max-w-[85%] md:max-w-[65%] px-5 py-3.5 text-[14.5px] leading-relaxed break-words flex flex-col gap-2 border transition-all ${
                      isMe 
                        ? 'bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] border-blue-400/30 text-white shadow-[0_8px_25px_rgba(37,99,235,0.35)] rounded-[22px] rounded-br-[6px]' 
                        : 'bg-[#12141C]/90 backdrop-blur-xl border-white/[0.08] text-[#E2E8F0] shadow-[0_8px_25px_rgba(0,0,0,0.4)] rounded-[22px] rounded-bl-[6px]'
                    }`}
                  >
                    {msg.imageUrl && (
                      <img src={msg.imageUrl} alt="attachment" className="max-w-full rounded-xl object-contain max-h-[320px] shadow-md border border-black/20" />
                    )}
                    {msg.text && <span className="font-medium tracking-normal">{msg.text}</span>}
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={endOfMessagesRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 sm:p-6 shrink-0 flex flex-col gap-2 relative bg-gradient-to-t from-[#07080C] via-[#07080C]/90 to-transparent">
        <div className="max-w-4xl mx-auto w-full flex flex-col gap-3">
          {selectedImage && (
            <div className="relative inline-block rounded-2xl overflow-hidden border border-white/10 w-24 h-24 bg-black/40 shadow-2xl backdrop-blur-md">
              <img src={URL.createObjectURL(selectedImage)} className="w-full h-full object-cover" alt="Preview" />
              <button 
                type="button" 
                onClick={() => setSelectedImage(null)}
                className="absolute top-1.5 right-1.5 bg-black/80 text-white rounded-full p-1 hover:bg-black transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <form onSubmit={handleSendMessage} className="relative flex items-center w-full gap-2 bg-[#12141C]/95 backdrop-blur-2xl border border-white/10 rounded-[24px] p-2 shadow-[0_10px_40px_rgba(0,0,0,0.6)] group focus-within:border-[#3B82F6]/60 transition-all">
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
              className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-[#888A92] hover:text-[#60A5FA] hover:bg-white/[0.05] transition-all ml-1"
            >
              <ImageIcon className="w-5 h-5" />
            </button>
            
            <div className="relative flex-1 flex items-center">
              <input 
                type="text" 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value.slice(0, 2000))} 
                placeholder="Write a message..." 
                className="w-full bg-transparent border-none py-2.5 pr-12 text-[14.5px] text-white placeholder-[#555861] focus:outline-none focus:ring-0 transition-all min-w-0 font-medium"
                autoFocus={!selectedImage}
              />
              <button 
                type="submit"
                disabled={sending || (!newMessage.trim() && !selectedImage)}
                className="absolute right-1 w-9 h-9 rounded-xl flex items-center justify-center bg-[#2563EB] text-white hover:bg-[#1D4ED8] disabled:opacity-30 disabled:bg-[#1E212B] disabled:text-[#555861] transition-all shadow-md"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </form>
        </div>
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
