import React, { useState, useEffect, useRef } from 'react';
import { db, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from '../firebase';
import { Volume2, Smile, Send, Search, Users, Inbox, Lock, Sparkles, Loader2, MessageSquare } from 'lucide-react';
import { Meteors } from './Meteors';
import { playSound } from '../utils/sounds';

const GLOBAL_CHAT_CACHE_KEY = 'Talk34-global-chat-cache';

export default function GlobalChatView({ user, onSignIn }) {
  const [messages, setMessages] = useState(() => {
    try {
      const cached = localStorage.getItem(GLOBAL_CHAT_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [onlineMembers, setOnlineMembers] = useState([]);
  const [offlineMembers, setOfflineMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadError, setLoadError] = useState('');
  const [showMembersPanel, setShowMembersPanel] = useState(false);

  const messagesEndRef = useRef(null);

  const persistMessages = (nextMessages) => {
    setMessages(nextMessages);
    try {
      localStorage.setItem(GLOBAL_CHAT_CACHE_KEY, JSON.stringify(nextMessages.slice(-100)));
    } catch {
      // Ignore storage failures and keep the live UI working.
    }
  };

  const previousMessagesLength = useRef(0);

  // Subscribe to global chat messages
  useEffect(() => {
    let unsubscribe = () => {};
    
    if (!db) {
      setLoadError('Firebase database is not initialized. Please configure Firebase to enable live chat.');
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'global_chat'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = [];
      const uniqueUsers = new Map();

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        fetchedMessages.push({ id: docSnap.id, ...data });
        
        if (data.uid) {
          if (!uniqueUsers.has(data.uid)) {
            uniqueUsers.set(data.uid, {
              uid: data.uid,
              displayName: data.displayName || 'Anonymous',
              photoUrl: data.photoUrl,
              lastSeen: data.createdAt?.toDate() || new Date()
            });
          } else {
            const existing = uniqueUsers.get(data.uid);
            const currentMsgDate = data.createdAt?.toDate() || new Date();
            if (currentMsgDate > existing.lastSeen) {
              uniqueUsers.set(data.uid, { ...existing, lastSeen: currentMsgDate });
            }
          }
        }
      });

      const reversedMsgs = fetchedMessages.reverse();
      persistMessages(reversedMsgs);
      setLoadError('');
      setIsLoading(false);

      // Play sound on new incoming message
      if (previousMessagesLength.current > 0 && reversedMsgs.length > previousMessagesLength.current) {
        const lastMsg = reversedMsgs[reversedMsgs.length - 1];
        if (lastMsg && (!user || lastMsg.uid !== user.id)) {
          playSound('message');
        }
      }
      previousMessagesLength.current = reversedMsgs.length;

      // Sort members: online (last seen < 10min) vs offline
      const now = new Date();
      const online = [];
      const offline = [];
      Array.from(uniqueUsers.values()).forEach(u => {
        const diffMinutes = (now - u.lastSeen) / 1000 / 60;
        if (diffMinutes < 10) online.push(u);
        else offline.push(u);
      });
      setOnlineMembers(online);
      setOfflineMembers(offline);

    }, (error) => {
      console.error("Error fetching global chat:", error);
      setLoadError('Live feed is temporarily unavailable. Showing cached messages.');
      setIsLoading(false);
    });

    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 5000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, [user]);

  // Scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    
    if (!user) {
      alert("Please sign in to participate in the global chat.");
      return;
    }

    const messageToSend = inputText.trim();
    setInputText('');

    const optimisticMessage = {
      id: `local-${Date.now()}`,
      text: messageToSend,
      uid: user.id,
      displayName: user.name,
      photoUrl: user.photoUrl,
      createdAt: new Date(),
    };

    persistMessages([...messages, optimisticMessage]);

    try {
      await addDoc(collection(db, 'global_chat'), {
        text: messageToSend,
        uid: user.id,
        displayName: user.name,
        photoUrl: user.photoUrl,
        createdAt: serverTimestamp(),
      });
      playSound('message');
    } catch (err) {
      console.error('Error sending message:', err);
      setLoadError('Message saved locally, but live sync is unavailable right now.');
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMembers = (list, title) => {
    const filtered = list.filter(u => u.displayName.toLowerCase().includes(searchQuery.toLowerCase()));
    if (filtered.length === 0) return null;

    return (
      <div className="mb-6">
        <h3 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-3 px-2">
          {title} — {filtered.length}
        </h3>
        <div className="flex flex-col gap-1">
          {filtered.map(member => (
            <div key={member.uid} className="flex items-center gap-3 px-2 py-1.5 hover:bg-[rgba(255,255,255,0.02)] rounded cursor-pointer group">
              <div className="relative">
                <img 
                  src={member.photoUrl || `https://ui-avatars.com/api/?name=${member.displayName}`} 
                  alt={member.displayName} 
                  className="w-8 h-8 rounded-full object-cover" 
                />
                {title === 'ONLINE' && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-success border-2 border-bg-base rounded-full"></div>
                )}
              </div>
              <span className={`text-sm font-medium truncate ${title === 'ONLINE' ? 'text-text-primary' : 'text-text-secondary'} group-hover:text-text-primary transition-colors`}>
                {member.displayName}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-[#0B0D12] text-text-primary overflow-hidden relative">
      <Meteors number={20} />
      
      {/* Global Header */}
      <header className="w-full flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6 lg:px-8 py-4 border-b border-white/10 flex-shrink-0 bg-black/40 backdrop-blur-xl sticky top-0 z-30">
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] text-[var(--accent-primary)] font-bold tracking-[0.28em] uppercase flex items-center gap-2">
            <Sparkles className="w-3 h-3" /> Live Feed
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-white mt-1">Global Chat</h1>
        </div>
        
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap justify-start sm:justify-end">
          {/* Level / XP */}
          <div className="flex items-center gap-2 text-[15px] font-mono text-text-secondary bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] shadow-[0_0_8px_var(--accent-primary)]"></div>
            <span className="text-white font-bold">11</span>
            <span className="text-white/30">/</span>
            <span>6,470</span>
          </div>
          
          {/* Inbox Icon */}
          <button className="relative text-text-secondary hover:text-white transition-colors ml-2 bg-white/5 p-2 rounded-xl border border-white/10 hover:bg-white/10">
            <Inbox className="w-5 h-5" />
            <span className="absolute -top-2 -right-2 w-5 h-5 bg-[var(--accent-primary)] rounded-md text-[11px] font-bold text-white flex items-center justify-center shadow-lg">5</span>
          </button>

          {/* Earn Button */}
          <button className="flex items-center gap-2 text-white bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl transition-colors ml-2 font-bold text-[13px] border border-white/10">
            <Lock className="w-4 h-4 text-[var(--accent-primary)]" />
            Earn
          </button>

          {/* Avatar */}
          <img 
            src={user?.photoUrl || "https://ui-avatars.com/api/?name=User"} 
            alt="Profile" 
            className="w-10 h-10 rounded-full cursor-pointer border-2 border-[var(--accent-primary)] hover:scale-105 transition-transform ml-2 object-cover shadow-[0_0_15px_rgba(24,119,242,0.3)]" 
          />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row overflow-hidden relative z-10">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0 border-r-0 lg:border-r border-white/10 min-h-0 bg-gradient-to-b from-transparent to-black/40">
        
        {/* Chat Header */}
        <div className="min-h-14 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6 py-3 border-b border-white/5 flex-shrink-0 bg-white/[0.02] backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center border border-[var(--accent-primary)]/20">
              <MessageSquare className="w-4 h-4 text-[var(--accent-primary)]" />
            </div>
            <span className="font-bold tracking-wide text-white">Lobby Community</span>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
              <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e] animate-pulse"></div>
              <span className="text-[11px] font-bold text-white tracking-widest">{onlineMembers.length} ONLINE</span>
            </div>
            <button
              type="button"
              onClick={() => setShowMembersPanel((value) => !value)}
              className="lg:hidden px-3 py-1.5 rounded-lg border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] text-[11px] font-bold tracking-widest uppercase"
            >
              Members
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-white/5 text-white rounded-lg border border-white/10 text-[11px] font-bold tracking-widest hover:bg-white/10 transition-colors">
              <Volume2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              SOUND
              <div className="w-6 h-3.5 bg-[var(--accent-primary)] rounded-full relative ml-1 shadow-[0_0_8px_var(--accent-primary)]">
                <div className="absolute right-0.5 top-0.5 w-2.5 h-2.5 bg-white rounded-full"></div>
              </div>
            </button>
          </div>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 scroll-smooth min-h-0 custom-scrollbar">
          {loadError && (
            <div className="mb-6 rounded-2xl border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 px-4 py-3 text-sm text-[var(--accent-primary)] backdrop-blur-md shadow-lg flex items-center gap-3">
               <Sparkles className="w-5 h-5" /> {loadError}
            </div>
          )}
          {isLoading ? (
            <div className="h-full min-h-[320px] flex items-center justify-center">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-12 h-12 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center backdrop-blur-md">
                   <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-primary)]" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/50">Connecting to live feed...</span>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full min-h-[240px] flex items-center justify-center">
              <div className="max-w-md w-full rounded-[2rem] border border-white/10 bg-white/5 px-8 py-10 text-center shadow-2xl backdrop-blur-xl">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 text-[var(--accent-primary)] shadow-[0_0_30px_rgba(24,119,242,0.2)]">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-black text-white mb-2 tracking-tight">The room is quiet</h2>
                <p className="text-sm leading-relaxed text-white/60">
                  Start the conversation. Messages are cached so the live feed stays visible even if the connection drops.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-w-5xl mx-auto w-full">
              {messages.map((msg, index) => {
                const prevMsg = index > 0 ? messages[index - 1] : null;
                const isSameUser = prevMsg && prevMsg.uid === msg.uid;
                
                // Add top margin if it's a new sender
                const marginClass = isSameUser ? 'mt-0' : 'mt-6';

                return (
                  <div key={msg.id} className={`flex items-start gap-4 ${marginClass} group hover:bg-white/[0.02] -mx-4 px-4 py-1.5 rounded-2xl transition-all`}>
                    
                    {/* Avatar Gutter */}
                    <div className="w-10 flex-shrink-0 flex justify-center pt-0.5">
                      {!isSameUser ? (
                        <img 
                          src={msg.photoUrl || `https://ui-avatars.com/api/?name=${msg.displayName || 'User'}`} 
                          alt="Avatar" 
                          className="w-10 h-10 rounded-full object-cover shadow-lg border border-white/10 cursor-pointer hover:border-[var(--accent-primary)] transition-colors"
                        />
                      ) : (
                        <span className="text-[10px] text-white/30 opacity-0 group-hover:opacity-100 font-mono mt-1 w-full text-center transition-opacity">
                          {formatTime(msg.createdAt).split(' ')[0]}
                        </span>
                      )}
                    </div>

                    {/* Message Content */}
                    <div className="flex-1 min-w-0">
                      {!isSameUser && (
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="font-bold text-white cursor-pointer hover:underline text-[15px] tracking-wide">{msg.displayName || 'Anonymous'}</span>
                          <span className="text-[11px] text-white/40 font-medium tracking-wide">{formatTime(msg.createdAt)}</span>
                        </div>
                      )}
                      
                      <div className="text-[15px] text-white/90 leading-relaxed break-words whitespace-pre-wrap">
                        {msg.text}
                      </div>
                    </div>

                  </div>
                );
              })}
              <div ref={messagesEndRef} className="h-6" />
            </div>
          )}
        </div>

        {/* Chat Input */}
        <div className="p-4 sm:p-6 pt-2 sticky bottom-0 bg-black/40 backdrop-blur-xl border-t border-white/5">
          <form onSubmit={handleSendMessage} className="max-w-5xl mx-auto w-full relative flex items-end bg-white/[0.03] border border-white/10 rounded-2xl shadow-2xl overflow-hidden focus-within:border-[var(--accent-primary)] focus-within:bg-white/[0.05] transition-all">
            
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={user ? "Type a message..." : "Sign in to chat"}
              className="flex-1 bg-transparent py-4 pl-5 pr-16 text-[15px] text-white focus:outline-none placeholder:text-white/30 cursor-text font-medium"
              readOnly={!user}
              onClick={() => {
                if (!user && onSignIn) onSignIn();
              }}
            />
            
            <div className="absolute right-2 bottom-2.5 flex items-center gap-1">
              <button type="button" className="p-2 text-white/40 hover:text-white transition-colors disabled:opacity-50 hover:bg-white/5 rounded-xl">
                <Smile className="w-5 h-5" />
              </button>
              <button 
                type="submit" 
                className="p-2 bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] transition-colors disabled:opacity-30 disabled:bg-white/10 disabled:text-white/30 rounded-xl shadow-[0_0_15px_rgba(24,119,242,0.3)] disabled:shadow-none"
                disabled={!inputText.trim()}
              >
                <Send className="w-5 h-5 ml-0.5" />
              </button>
            </div>
          </form>
        </div>

      </div>

      {/* Members Sidebar */}
      <aside className={`w-full lg:w-[320px] flex-shrink-0 flex-col bg-black/80 lg:bg-black/40 backdrop-blur-3xl lg:backdrop-blur-xl border-t lg:border-t-0 lg:border-l border-white/10 min-h-0 relative z-50 lg:z-20 ${showMembersPanel ? 'flex fixed inset-0 lg:static' : 'hidden lg:flex'}`}>
        
        {/* Members Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 flex-shrink-0 bg-white/[0.02]">
          <div className="flex items-center gap-2 text-white/60">
            <Users className="w-4 h-4 text-[var(--accent-primary)]" />
            <span className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-white">Members — {onlineMembers.length + offlineMembers.length}</span>
          </div>
          <button 
            onClick={() => setShowMembersPanel(false)}
            className="lg:hidden text-white/50 hover:text-white transition-colors p-2 -mr-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-white/5">
          <div className="relative group flex items-center gap-2 bg-white/5 focus-within:bg-white/10 border border-white/10 focus-within:border-[var(--accent-primary)] rounded-xl overflow-hidden transition-all shadow-inner">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-[var(--accent-primary)] transition-colors" />
            <input 
              type="text"
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent py-3 pl-10 pr-10 text-sm text-white focus:outline-none placeholder:text-white/30 font-medium"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            )}
          </div>
        </div>

        {/* Members List */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar min-h-0">
          {renderMembers(onlineMembers, 'ONLINE')}
          {renderMembers(offlineMembers, 'OFFLINE')}
        </div>
      </aside>
      </div>
    </div>
  );
}
