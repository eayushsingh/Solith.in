import React, { useState, useEffect, useRef } from 'react';
import { db, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from '../firebase';
import { Volume2, Smile, Send, Search, Users, Inbox, Lock } from 'lucide-react';

export default function GlobalChatView({ user, onSignIn }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [onlineMembers, setOnlineMembers] = useState([]);
  const [offlineMembers, setOfflineMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const messagesEndRef = useRef(null);

  // Subscribe to global chat messages
  useEffect(() => {
    let unsubscribe = () => {};
    
    try {
      if (!db) {
        throw new Error("Firebase database is not initialized.");
      }

      const q = query(
        collection(db, 'global_chat'),
        orderBy('createdAt', 'desc'),
        limit(100)
      );

      unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedMessages = [];
        const uniqueUsers = new Map();

        snapshot.forEach((doc) => {
          const data = doc.data();
          fetchedMessages.push({ id: doc.id, ...data });
          
          // Track unique users for the right sidebar
          if (data.uid) {
            if (!uniqueUsers.has(data.uid)) {
              uniqueUsers.set(data.uid, {
                uid: data.uid,
                displayName: data.displayName || 'Anonymous',
                photoUrl: data.photoUrl,
                lastSeen: data.createdAt?.toDate() || new Date()
              });
            } else {
              // Update last seen if newer
              const existing = uniqueUsers.get(data.uid);
              const currentMsgDate = data.createdAt?.toDate() || new Date();
              if (currentMsgDate > existing.lastSeen) {
                uniqueUsers.set(data.uid, { ...existing, lastSeen: currentMsgDate });
              }
            }
          }
        });

        setMessages(fetchedMessages.reverse());
        setIsLoading(false);

        // Simple heuristic for online/offline based on recent messages (last 10 mins)
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
        console.error("Error fetching global chat: ", error);
        setIsLoading(false);
      });
    } catch (err) {
      console.error("Failed to setup chat listener:", err);
      setIsLoading(false);
    }

    // Safety timeout just in case it hangs forever
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 5000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

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

    try {
      await addDoc(collection(db, 'global_chat'), {
        text: messageToSend,
        uid: user.id,
        displayName: user.name,
        photoUrl: user.photoUrl,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error sending message:', err);
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
        <h3 className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest mb-3 px-2">
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
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#ef4444] border-2 border-[#121418] rounded-full"></div>
                )}
              </div>
              <span className={`text-sm font-medium truncate ${title === 'ONLINE' ? 'text-gray-200' : 'text-[#86868b]'} group-hover:text-white transition-colors`}>
                {member.displayName}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#0f1115] text-white">
      
      {/* Global Header */}
      <header className="w-full flex items-center justify-between px-8 py-4 border-b border-[#24272e] flex-shrink-0">
        <div className="flex flex-col">
          <span className="text-[10px] text-[#86868b] font-bold tracking-widest uppercase">SOLITH</span>
          <h1 className="text-xl font-semibold">Global Chat</h1>
        </div>
        
        <div className="flex items-center gap-6">
          {/* Level / XP */}
          <div className="flex items-center gap-2 text-[15px] font-mono text-gray-400">
            <div className="w-1.5 h-1.5 rounded-full bg-[#ef4444]"></div>
            <span className="text-white font-bold">11</span>
            <span>/</span>
            <span>6,470</span>
          </div>
          
          {/* Inbox Icon */}
          <button className="relative text-gray-400 hover:text-white transition-colors ml-4">
            <Inbox className="w-6 h-6" />
            <span className="absolute -top-2 -right-2 w-5 h-5 bg-[#e57373] rounded-md text-[11px] font-bold text-white flex items-center justify-center">5</span>
          </button>

          {/* Earn Button */}
          <button className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors ml-4 font-semibold text-[15px]">
            <Lock className="w-5 h-5" />
            Earn
          </button>

          {/* Avatar */}
          <img 
            src={user?.photoUrl || "https://ui-avatars.com/api/?name=User"} 
            alt="Profile" 
            className="w-10 h-10 rounded-full cursor-pointer border-2 border-[#ef4444] hover:opacity-80 transition-opacity ml-4 object-cover" 
          />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-[#24272e]">
        
        {/* Chat Header */}
        <div className="h-14 flex items-center justify-between px-6 border-b border-[#24272e] flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[#86868b] text-lg font-light">#</span>
            <span className="font-semibold">Lobby</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#ef4444]"></div>
              <span className="text-xs font-bold text-[#86868b]">{onlineMembers.length} ONLINE</span>
            </div>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-[rgba(239,68,68,0.1)] text-[#ef4444] rounded border border-[rgba(239,68,68,0.2)] text-xs font-bold">
              <Volume2 className="w-3.5 h-3.5" />
              SOUND
              <div className="w-6 h-3.5 bg-[#ef4444] rounded-full relative ml-1">
                <div className="absolute right-0.5 top-0.5 w-2.5 h-2.5 bg-white rounded-full"></div>
              </div>
            </button>
          </div>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-[#86868b]">
              Connecting to global chat...
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-[#86868b]">
              No messages yet. Be the first to say hi!
            </div>
          ) : (
            <div className="flex flex-col gap-1 max-w-4xl mx-auto w-full">
              {messages.map((msg, index) => {
                const prevMsg = index > 0 ? messages[index - 1] : null;
                const isSameUser = prevMsg && prevMsg.uid === msg.uid;
                
                // Add top margin if it's a new sender
                const marginClass = isSameUser ? 'mt-0.5' : 'mt-5';

                return (
                  <div key={msg.id} className={`flex items-start gap-4 ${marginClass} group hover:bg-[rgba(255,255,255,0.02)] -mx-4 px-4 py-1 rounded transition-colors`}>
                    
                    {/* Avatar Gutter */}
                    <div className="w-10 flex-shrink-0 flex justify-center pt-0.5">
                      {!isSameUser ? (
                        <img 
                          src={msg.photoUrl || `https://ui-avatars.com/api/?name=${msg.displayName || 'User'}`} 
                          alt="Avatar" 
                          className="w-10 h-10 rounded-full object-cover shadow-sm cursor-pointer"
                        />
                      ) : (
                        <span className="text-[10px] text-[#86868b] opacity-0 group-hover:opacity-100 font-mono mt-1 w-full text-center">
                          {formatTime(msg.createdAt).split(' ')[0]}
                        </span>
                      )}
                    </div>

                    {/* Message Content */}
                    <div className="flex-1 min-w-0">
                      {!isSameUser && (
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className="font-semibold text-gray-200 cursor-pointer hover:underline text-[15px]">{msg.displayName || 'Anonymous'}</span>
                          <span className="text-xs text-[#86868b] font-medium">{formatTime(msg.createdAt)}</span>
                        </div>
                      )}
                      
                      <div className="text-[15px] text-[#d1d5db] leading-relaxed break-words whitespace-pre-wrap">
                        {msg.text}
                      </div>
                    </div>

                  </div>
                );
              })}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Chat Input */}
        <div className="p-6 pt-2">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto w-full relative flex items-end bg-[#1c1f26] border border-[#32363e] rounded-lg shadow-inner overflow-hidden focus-within:border-[#ef4444] transition-colors">
            
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={user ? "@ mention, # private" : "Sign in to chat"}
              className="flex-1 bg-transparent py-4 pl-4 pr-12 text-sm text-white focus:outline-none placeholder:text-[#86868b] cursor-text"
              readOnly={!user}
              onClick={() => {
                if (!user && onSignIn) onSignIn();
              }}
            />
            
            <div className="absolute right-2 bottom-3 flex items-center gap-1">
              <button type="button" className="p-1.5 text-[#86868b] hover:text-white transition-colors disabled:opacity-50">
                <Smile className="w-5 h-5" />
              </button>
              <button 
                type="submit" 
                className="p-1.5 text-[#86868b] hover:text-[#ef4444] transition-colors disabled:opacity-30"
                disabled={!inputText.trim()}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>

      </div>

      {/* Members Sidebar */}
      <div className="w-[280px] flex-shrink-0 flex flex-col bg-[#121418]">
        
        {/* Members Header */}
        <div className="h-14 flex items-center px-4 border-b border-[#24272e] flex-shrink-0">
          <div className="flex items-center gap-2 text-[#86868b]">
            <Users className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Members — {onlineMembers.length + offlineMembers.length + 489}</span>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-[#24272e]">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#86868b]" />
            <input 
              type="text"
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1c1f26] border border-[#32363e] rounded py-1.5 pl-8 pr-3 text-xs text-white focus:outline-none focus:border-[#ef4444]"
            />
          </div>
        </div>

        {/* Members List */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {renderMembers(onlineMembers, 'ONLINE')}
          {renderMembers(offlineMembers, 'OFFLINE')}

          {/* Dummy offline members to match UI "OFFLINE - 489" */}
          {searchQuery === '' && (
            <div className="mb-6">
              <h3 className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest mb-3 px-2">
                OFFLINE — 489
              </h3>
              <div className="flex flex-col gap-1">
                {[
                  { name: 'Khan', pic: 'https://ui-avatars.com/api/?name=Khan' },
                  { name: ';chatdisabled', pic: 'https://ui-avatars.com/api/?name=chatdisabled' },
                  { name: '........', pic: 'https://ui-avatars.com/api/?name=anon' },
                  { name: 'O Mr ~ - Wajid ♥', pic: 'https://ui-avatars.com/api/?name=Wajid' },
                  { name: '666', pic: 'https://ui-avatars.com/api/?name=666' }
                ].map((dummy, i) => (
                  <div key={`dummy-${i}`} className="flex items-center gap-3 px-2 py-1.5 hover:bg-[rgba(255,255,255,0.02)] rounded cursor-pointer group opacity-60">
                    <img 
                      src={dummy.pic} 
                      alt={dummy.name} 
                      className="w-8 h-8 rounded-full object-cover grayscale opacity-70" 
                    />
                    <span className="text-sm font-medium text-[#86868b] truncate group-hover:text-gray-300 transition-colors">
                      {dummy.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
    </div>
  );
}
