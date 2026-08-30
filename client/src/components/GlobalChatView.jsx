import React, { useState, useEffect, useRef } from 'react';
import { db, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from '../firebase';
import { Volume2, Smile, Send, Search, Users, Inbox, Lock, Sparkles, Loader2, MessageSquare } from 'lucide-react';
import { Meteors } from './Meteors';
import { playSound } from '../utils/sounds';

const GLOBAL_CHAT_CACHE_KEY = 'Talk34-global-chat-cache';

export default function GlobalChatView({ user, onSignIn }) {
  const [messages, setMessages] = useState([]);
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
    <div className="flex flex-col h-[100dvh] w-full bg-[#090A0F] text-white overflow-hidden relative">
      <Meteors number={15} />
      
      {/* Global Header */}
      <header className="w-full flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6 lg:px-8 py-4 border-b border-[#1E212B] flex-shrink-0 bg-[#0C0E14]/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] text-[#3B82F6] font-bold tracking-[0.2em] uppercase flex items-center gap-2">
            <Sparkles className="w-3 h-3" /> Live Feed
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">Global Chat</h1>
        </div>
        
        <div className="flex items-center gap-4 sm:gap-5 flex-wrap justify-start sm:justify-end">
          {/* Level / XP */}
          <div className="flex items-center gap-2 text-[14px] font-mono text-[#888A92] bg-[#12141C] px-3 py-1.5 rounded-full border border-[#1E212B] shadow-sm">
            <div className="w-2 h-2 rounded-full bg-[#3B82F6] shadow-[0_0_8px_#3B82F6]"></div>
            <span className="text-white font-bold">11</span>
            <span className="text-[#555861]">/</span>
            <span>6,470</span>
          </div>
          
          {/* Inbox Icon */}
          <button className="relative text-[#555861] hover:text-white transition-colors bg-[#12141C] p-2 rounded-full border border-[#1E212B] hover:bg-[#1A1D27]">
            <Inbox className="w-[18px] h-[18px]" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#3B82F6] rounded-full text-[9px] font-bold text-white flex items-center justify-center shadow-md border border-[#090A0F]">5</span>
          </button>

          {/* Earn Button */}
          <button className="flex items-center gap-2 text-white bg-[#12141C] hover:bg-[#1A1D27] px-4 py-2 rounded-full transition-colors font-semibold text-[13px] border border-[#1E212B]">
            <Lock className="w-[14px] h-[14px] text-[#555861]" />
            Earn
          </button>

          {/* Avatar */}
          <img 
            src={user?.photoUrl || "https://ui-avatars.com/api/?name=User"} 
            alt="Profile" 
            className="w-10 h-10 rounded-full cursor-pointer border border-[#1E212B] hover:border-[#3B82F6] transition-colors object-cover" 
          />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row overflow-hidden relative z-10">
        
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0 border-r-0 lg:border-r border-[#1E212B] min-h-0 bg-[#090A0F]">
        
        {/* Chat Header */}
        <div className="min-h-14 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6 py-3 border-b border-[#1E212B] flex-shrink-0 bg-[#0C0E14]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-[10px] bg-[#1E212B] flex items-center justify-center border border-[#2A2E3B]">
              <MessageSquare className="w-4 h-4 text-[#888A92]" />
            </div>
            <span className="font-semibold tracking-wide text-white text-[15px]">Lobby Community</span>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 bg-[#12141C] px-3 py-1.5 rounded-full border border-[#1E212B]">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]"></div>
              <span className="text-[10px] font-bold text-white tracking-[0.1em]">{onlineMembers.length} ONLINE</span>
            </div>
            <button
              type="button"
              onClick={() => setShowMembersPanel((value) => !value)}
              className="lg:hidden px-3 py-1.5 rounded-full border border-[#1E212B] bg-[#12141C] text-white text-[10px] font-bold tracking-[0.1em] uppercase"
            >
              Members
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-[#12141C] text-white rounded-full border border-[#1E212B] text-[10px] font-bold tracking-[0.1em] hover:bg-[#1A1D27] transition-colors">
              <Volume2 className="w-3 h-3 text-[#555861]" />
              SOUND
              <div className="w-6 h-3.5 bg-[#3B82F6] rounded-full relative ml-1">
                <div className="absolute right-0.5 top-0.5 w-2.5 h-2.5 bg-white rounded-full"></div>
              </div>
            </button>
          </div>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 scroll-smooth min-h-0 custom-scrollbar">
          {loadError && (
            <div className="mb-6 rounded-2xl border border-[#3B82F6]/30 bg-[#3B82F6]/10 px-4 py-3 text-sm text-[#60A5FA] flex items-center gap-3">
               <Sparkles className="w-5 h-5" /> {loadError}
            </div>
          )}
          {isLoading ? (
            <div className="h-full min-h-[320px] flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-[#1E212B] border-t-[#3B82F6] rounded-full animate-spin"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full min-h-[240px] flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-10 h-10 text-[#555861] mx-auto mb-4" />
                <h2 className="text-xl font-bold text-white mb-2 tracking-tight">The room is quiet</h2>
                <p className="text-sm text-[#888A92]">Start the conversation.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 max-w-5xl mx-auto w-full">
              {messages.map((msg, index) => {
                const prevMsg = index > 0 ? messages[index - 1] : null;
                const isSameUser = prevMsg && prevMsg.uid === msg.uid;
                
                const marginClass = isSameUser ? 'mt-0' : 'mt-5';

                return (
                  <div key={msg.id} className={`flex items-start gap-4 ${marginClass} group -mx-4 px-4 py-1.5 rounded-2xl transition-all`}>
                    
                    {/* Avatar Gutter */}
                    <div className="w-10 flex-shrink-0 flex justify-center pt-0.5">
                      {!isSameUser ? (
                        <img 
                          src={msg.photoUrl || `https://ui-avatars.com/api/?name=${msg.displayName || 'User'}`} 
                          alt="Avatar" 
                          className="w-10 h-10 rounded-full object-cover cursor-pointer"
                        />
                      ) : (
                        <span className="text-[10px] text-[#555861] opacity-0 group-hover:opacity-100 font-medium mt-1 w-full text-center transition-opacity">
                          {formatTime(msg.createdAt).split(' ')[0]}
                        </span>
                      )}
                    </div>

                    {/* Message Content */}
                    <div className="flex-1 min-w-0">
                      {!isSameUser && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-white cursor-pointer hover:text-[#3B82F6] transition-colors text-[14px] tracking-wide">{msg.displayName || 'Anonymous'}</span>
                          <span className="text-[11px] text-[#555861] font-semibold">{formatTime(msg.createdAt)}</span>
                        </div>
                      )}
                      
                      <div className="text-[14px] text-[#D1D3D8] leading-relaxed break-words whitespace-pre-wrap font-medium">
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
        <div className="p-4 sm:px-6 sm:pb-6 sm:pt-0 sticky bottom-0 bg-gradient-to-t from-[#090A0F] via-[#090A0F] to-transparent">
          <form onSubmit={handleSendMessage} className="max-w-5xl mx-auto w-full relative flex items-center bg-[#12141C] border border-[#1E212B] rounded-[18px] focus-within:border-[#2A2E3B] transition-all shadow-xl">
            
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={user ? "Type a message..." : "Sign in to chat"}
              className="flex-1 bg-transparent py-4 pl-5 pr-16 text-[14px] text-white focus:outline-none placeholder:text-[#555861] font-medium"
              readOnly={!user}
              onClick={() => {
                if (!user && onSignIn) onSignIn();
              }}
            />
            
            <div className="absolute right-2 flex items-center gap-1">
              <button type="button" className="p-2 text-[#555861] hover:text-white transition-colors disabled:opacity-50 hover:bg-[#1A1D27] rounded-xl">
                <Smile className="w-[18px] h-[18px]" strokeWidth={2} />
              </button>
              <button 
                type="submit" 
                className="p-2 bg-[#212C45] text-[#60A5FA] hover:bg-[#2A3B5C] hover:text-white transition-colors disabled:opacity-30 disabled:bg-[#12141C] disabled:text-[#555861] rounded-xl border border-[#2A3B5C] disabled:border-transparent"
                disabled={!inputText.trim()}
              >
                <Send className="w-[16px] h-[16px] ml-0.5" strokeWidth={2} />
              </button>
            </div>
          </form>
        </div>

      </div>

      {/* Members Sidebar */}
      <aside className={`w-full lg:w-[280px] flex-shrink-0 flex-col bg-[#0C0E14] border-t lg:border-t-0 lg:border-l border-[#1E212B] min-h-0 relative z-50 lg:z-20 ${showMembersPanel ? 'flex fixed inset-0 lg:static' : 'hidden lg:flex'}`}>
        
        {/* Members Header */}
        <div className="h-[76px] flex items-center justify-between px-5 border-b border-[#1E212B] flex-shrink-0">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#3B82F6]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-white">Members — {onlineMembers.length + offlineMembers.length}</span>
          </div>
          <button 
            onClick={() => setShowMembersPanel(false)}
            className="lg:hidden text-[#555861] hover:text-white transition-colors p-2 -mr-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        {/* Search */}
        <div className="p-4">
          <div className="relative group flex items-center gap-2 bg-[#12141C] border border-[#1E212B] focus-within:border-[#2A2E3B] rounded-[14px] overflow-hidden transition-all">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#555861] group-focus-within:text-white transition-colors" />
            <input 
              type="text"
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent py-2.5 pl-9 pr-9 text-[13px] text-white focus:outline-none placeholder:text-[#555861] font-medium"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555861] hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            )}
          </div>
        </div>

        {/* Members List */}
        <div className="flex-1 overflow-y-auto px-2 pb-4 custom-scrollbar min-h-0">
          {renderMembers(onlineMembers, 'ONLINE')}
          {renderMembers(offlineMembers, 'OFFLINE')}
        </div>
      </aside>
      </div>
    </div>
  );
}
