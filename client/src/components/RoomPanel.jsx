import React, { useState, useEffect, useRef } from 'react';
import SocialUserRow from './SocialUserRow';
import { 
  MessageSquare, Users, LayoutGrid, Settings, Maximize2, Minimize2, ChevronDown, 
  Send, CornerUpLeft, Image, X, Mic, MicOff, Camera, Shield, Youtube, 
  Briefcase, FileText, Tv, Megaphone, Video, Play, RefreshCw, Sparkles, Check, Trash2, Copy, Download, Eraser
} from 'lucide-react';

const EMOJIS = ['😊', '🦊', '🐼', '🦁', '🚀', '🎮', '🎧', '☕', '🎨', '🍕', '🌍', '🐱', '🥑', '👾', '🦄', '🧙‍♂️'];
const AVATAR_COLORS = ['#ff4d4d', '#ff944d', '#ffd11a', '#4da6ff', '#a64dff', '#ff4da6', '#33cc33', '#33cccc', '#f43f5e', '#8b5cf6'];

export default function RoomPanel({
  isChatOpen,
  setIsChatOpen,
  chatMessages,
  sendChatMessage,
  chatInput,
  setChatInput,
  chatEndRef,
  participants,
  joinEvents,
  activeRoom,
  user,
  setUser,
  socket,
  ytVideoId,
  getRole,
  API_URL,
  getAvatarUrl,
  rooms,
  onlineUserIds,
  setActiveDm,
  setMsgTab,
  setView,
  joinVoiceRoom,
  openUserProfile
}) {
  const [activeTab, setActiveTab] = useState('chat'); // chat, users, tools, settings, social
  const [socialTab, setSocialTab] = useState('Following');
  const [isExpanded, setIsExpanded] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [activeTool, setActiveTool] = useState(null); // mock-interview, notetaker, whiteboard, magic-mic, magic-camera, ip-shield, youtube
  const [lightboxImage, setLightboxImage] = useState(null);
  const fileInputRef = useRef(null);

  // Tools specific states
  // 1. AI Mock Interview
  const [mockInterviewMsgs, setMockInterviewMsgs] = useState([
    { id: 1, sender: 'ai', text: "Hi! I'm your AI Interviewer. I can help you practice coding or behavioral questions. What topic or job role are we practicing today?" }
  ]);
  const [mockInterviewInput, setMockInterviewInput] = useState('');
  const [aiTyping, setAiTyping] = useState(false);

  // 2. AI Notetaker
  const [meetingNotes, setMeetingNotes] = useState('');
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);

  // 3. Collaborative Whiteboard
  const canvasRef = useRef(null);
  const [drawColor, setDrawColor] = useState('#ff4d4d');
  const [drawSize, setDrawSize] = useState(4);
  const [isEraser, setIsEraser] = useState(false);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  // 4. Magic Mic
  const [activeMicFilter, setActiveMicFilter] = useState(null);

  // 5. Magic Camera
  const [activeCamFilter, setActiveCamFilter] = useState(null);

  // 6. IP Shield
  const [isIpShieldActive, setIsIpShieldActive] = useState(false);
  const [ipShieldState, setIpShieldState] = useState('unprotected'); // unprotected, securing, secure
  const [ipShieldLogs, setIpShieldLogs] = useState([]);

  // 7. YouTube Share
  const [ytUrlInput, setYtUrlInput] = useState('');

  // Scroll active tool or chat when tab changes
  useEffect(() => {
    if (activeTab === 'chat') {
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [activeTab, chatMessages]);

  // Whiteboard Socket Draw Listener
  useEffect(() => {
    if (!socket || !activeRoom) return;

    const handleDrawStroke = (data) => {
      if (activeTool !== 'whiteboard') return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      ctx.beginPath();
      ctx.strokeStyle = data.color;
      ctx.lineWidth = data.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(data.from.x * scaleX, data.from.y * scaleY);
      ctx.lineTo(data.to.x * scaleX, data.to.y * scaleY);
      ctx.stroke();
    };

    const handleClearCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    socket.on('draw-stroke', handleDrawStroke);
    socket.on('clear-canvas', handleClearCanvas);

    return () => {
      socket.off('draw-stroke', handleDrawStroke);
      socket.off('clear-canvas', handleClearCanvas);
    };
  }, [socket, activeRoom, activeTool]);

  if (!isChatOpen) return null;

  // File Upload Handling
  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  
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

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const base64data = await compressImage(file);
    // Send message with photo
    sendChatMessageWithPayload({ text: '', fileUrl: base64data });
    e.target.value = ''; // Reset input
  };

  // Wrapper for sending messages (handling replies and files)
  const sendChatMessageWithPayload = (payload) => {
    if (!activeRoom) return;

    const newMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      senderId: user?.id,
      senderName: user?.name || 'Anonymous',
      senderEmoji: user?.emoji || '👤',
      senderColor: user?.color || '#ff4d4d',
      timestamp: new Date().toISOString(),
      ...payload
    };

    if (replyingTo) {
      newMessage.replyTo = {
        id: replyingTo.id,
        text: replyingTo.text,
        senderName: replyingTo.senderName,
        fileUrl: replyingTo.fileUrl
      };
      setReplyingTo(null);
    }

    socket.emit('chat-message', { roomId: activeRoom.id, message: newMessage });
    // Update local state by appending new message
    sendChatMessage({ preventDefault: () => {} }, newMessage);
  };

  const handleTextSubmit = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChatMessageWithPayload({ text: chatInput });
    setChatInput('');
  };

  // Scroll to a specific message ID in the list
  const scrollToMessage = (msgId) => {
    const el = document.getElementById(`chat-msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-white/20');
      setTimeout(() => {
        el.classList.remove('bg-white/20');
      }, 1500);
    }
  };

  // Mock Interview Sim Functionality
  const sendMockInterviewMsg = (e) => {
    e.preventDefault();
    if (!mockInterviewInput.trim()) return;

    const userText = mockInterviewInput;
    setMockInterviewMsgs(prev => [...prev, { id: Date.now(), sender: 'user', text: userText }]);
    setMockInterviewInput('');
    setAiTyping(true);

    setTimeout(() => {
      setAiTyping(false);
      let aiResponse = "Interesting! Could you elaborate on how you would design or explain that concept in a real interview context?";
      const lowerText = userText.toLowerCase();

      if (lowerText.includes('frontend') || lowerText.includes('react')) {
        aiResponse = "Excellent. In React, what is the difference between useMemo and useCallback, and when should you avoid using them?";
      } else if (lowerText.includes('backend') || lowerText.includes('database')) {
        aiResponse = "Great. How would you handle database replication lag in a high-traffic social media application?";
      } else if (lowerText.includes('behavioral') || lowerText.includes('star')) {
        aiResponse = "Let's do a behavioral question: Tell me about a time you had a conflict with a teammate. How did you resolve it?";
      } else if (lowerText.includes('usememo')) {
        aiResponse = "Perfect. That is correct. Let's move on to coding. How would you find the longest palindromic substring in a string?";
      }

      setMockInterviewMsgs(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: aiResponse }]);
    }, 1500);
  };

  // Meeting Notes Generator
  const generateMeetingNotes = () => {
    setIsGeneratingNotes(true);
    setTimeout(() => {
      const attendees = participants.map(p => p.name).join(', ') || user?.name || 'Anonymous';
      const messagesText = chatMessages
        .map(m => `- **${m.senderName}**: ${m.text || '[Sent a Photo]'}`)
        .join('\n');

      const generated = `# Talk34 Session Summary - Room: ${activeRoom?.name || 'Live Chat'}
**Date:** ${new Date().toLocaleDateString()}
**Attendees:** ${attendees}

## 📊 Summary of Discussion
This language exchange and collaboration session brought together participants for live conversation. Text correspondence was active.

## 💬 Chat Transcript Log
${messagesText || '*No text messages were exchanged during this session.*'}

## 🎯 Key Action Items
1. Follow up with team members on discussed topics.
2. Review language vocabulary and grammar shared during session.
3. Schedule the next interactive session.

*Notes automatically generated by AI Notetaker on TalkFree.*`;

      setMeetingNotes(generated);
      setIsGeneratingNotes(false);
    }, 1200);
  };

  // Collaborative Whiteboard Drawing Logic
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    
    // Support mouse and touch
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    isDrawingRef.current = true;
    lastPosRef.current = {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const draw = (e) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const currentPos = {
      x: clientX - rect.left,
      y: clientY - rect.top
    };

    // Calculate actual coordinate inside high-res canvas scale
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    ctx.beginPath();
    ctx.strokeStyle = isEraser ? '#0f1115' : drawColor;
    ctx.lineWidth = drawSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(lastPosRef.current.x * scaleX, lastPosRef.current.y * scaleY);
    ctx.lineTo(currentPos.x * scaleX, currentPos.y * scaleY);
    ctx.stroke();

    // Broadcast stroke details to everyone else
    if (socket && activeRoom) {
      socket.emit('draw-stroke', {
        roomId: activeRoom.id,
        color: isEraser ? '#0f1115' : drawColor,
        size: drawSize,
        from: lastPosRef.current,
        to: currentPos
      });
    }

    lastPosRef.current = currentPos;
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (socket && activeRoom) {
        socket.emit('clear-canvas', { roomId: activeRoom.id });
      }
    }
  };

  // IP Shield Securing Simulation
  const toggleIpShield = () => {
    if (isIpShieldActive) {
      setIsIpShieldActive(false);
      setIpShieldState('unprotected');
      setIpShieldLogs([]);
    } else {
      setIsIpShieldActive(true);
      setIpShieldState('securing');
      setIpShieldLogs(['Initiating secure VPN tunnel handshake...']);
      
      setTimeout(() => {
        setIpShieldLogs(prev => [...prev, 'Routing traffic through wireguard proxy...']);
      }, 600);

      setTimeout(() => {
        setIpShieldLogs(prev => [...prev, 'Enabling AES-256 chat packet encryption...']);
      }, 1200);

      setTimeout(() => {
        setIpShieldLogs(prev => [...prev, 'Shield Active. Status: Fully Secured.']);
        setIpShieldState('secure');
      }, 1800);
    }
  };

  // YouTube Share
  const handleYoutubePlay = (e) => {
    e.preventDefault();
    if (!ytUrlInput) return;
    
    // Extract video ID helper
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = ytUrlInput.match(regExp);
    const videoId = (match && match[2].length === 11) ? match[2] : ytUrlInput;

    if (socket && activeRoom) {
      socket.emit('yt-share', { roomId: activeRoom.id, videoId, sharingUser: user.name });
      setYtUrlInput('');
      setActiveTool(null);
    }
  };

  return (
    <div className={`absolute bottom-[90px] right-4 md:right-8 z-40 bg-[#0f1115]/95 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col transition-all duration-300 animate-fade-in ${
      isExpanded ? 'left-4 md:left-auto md:w-[680px] h-[580px] max-h-[80vh]' : 'left-4 md:left-auto md:w-[380px] h-[480px] max-h-[70vh]'
    }`}>
      
      {/* Top Navigation Tabs Header */}
      <div className="px-4 py-3 border-b border-white/10 bg-white/5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1">
          {/* Tab 1: Chat */}
          <button 
            type="button"
            onClick={() => { setActiveTab('chat'); setActiveTool(null); }}
            className={`p-2 rounded-xl transition-all relative ${activeTab === 'chat' ? 'bg-white/10 text-white shadow-md' : 'text-white/40 hover:text-white/80'}`}
            title="Room Chat"
          >
            <MessageSquare className="w-4 h-4" />
            {chatMessages.length > 0 && activeTab !== 'chat' && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-accent-secondary rounded-full"></span>
            )}
          </button>

          {/* Tab 2: Participants */}
          <button 
            type="button"
            onClick={() => { setActiveTab('users'); setActiveTool(null); }}
            className={`p-2 rounded-xl transition-all relative ${activeTab === 'users' ? 'bg-white/10 text-white shadow-md' : 'text-white/40 hover:text-white/80'}`}
            title="Participants"
          >
            <Users className="w-4 h-4" />
            <span className="absolute -top-0.5 -right-0.5 bg-[var(--accent-primary)] text-white text-[8px] font-bold px-1 rounded-full border border-[#0f1115]">
              {participants.length}
            </span>
          </button>

          {/* Tab 3: Tools */}
          <button 
            type="button"
            onClick={() => { setActiveTab('tools'); }}
            className={`p-2 rounded-xl transition-all ${activeTab === 'tools' ? 'bg-white/10 text-white shadow-md' : 'text-white/40 hover:text-white/80'}`}
            title="Tools"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>

          {/* Tab 4: Settings */}
          <button 
            type="button"
            onClick={() => { setActiveTab('settings'); setActiveTool(null); }}
            className={`p-2 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-white/10 text-white shadow-md' : 'text-white/40 hover:text-white/80'}`}
            title="Identity Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Tab 5: Social */}
          <button 
            type="button"
            onClick={() => { setActiveTab('social'); setActiveTool(null); }}
            className={`p-2 rounded-xl transition-all ${activeTab === 'social' ? 'bg-white/10 text-white shadow-md' : 'text-white/40 hover:text-white/80'}`}
            title="Social"
          >
            <Users className="w-4 h-4" />
          </button>
        </div>

        {/* Header Right Window Controls */}
        <div className="flex items-center gap-1">
          {/* Toggle Expand / Shrink */}
          <button 
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-white/40 hover:text-white/80 rounded-xl transition-colors hidden md:block"
            title={isExpanded ? "Collapse Panel" : "Expand Panel"}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Collapse Panel Button */}
          <button 
            type="button"
            onClick={() => setIsChatOpen(false)}
            className="p-2 text-white/40 hover:text-white/80 rounded-xl transition-colors"
            title="Close Panel"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Panel Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col relative">
        
        {/* TABS CONTAINER */}
        
        {/* 1. CHAT TAB */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Room Info */}
            <div style={{
              background:'#111827', padding:'10px 16px',
              borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0
            }}>
              <div style={{color:'rgba(255,255,255,0.9)',fontSize:12,fontWeight:700,marginBottom:4}}>Room Info</div>
              <div style={{color:'rgba(255,255,255,0.4)',fontSize:11}}>Language: {activeRoom?.language}</div>
              {activeRoom?.topic && <div style={{color:'rgba(255,255,255,0.4)',fontSize:11,marginTop:2}}>Topic: {activeRoom.topic}</div>}
            </div>

            {/* Join/Leave Feed */}
            {joinEvents && joinEvents.length > 0 && (
              <div style={{borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0}}>
                {joinEvents.map((ev, i) => (
                  <div key={i} style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'6px 16px', fontSize:11, color:'rgba(255,255,255,0.3)'
                  }}>
                    <span>{ev.text}</span>
                    <div style={{
                      width:20, height:20, borderRadius:'50%',
                      background: ev.color || '#333',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:8, fontWeight:700, color:'white', flexShrink:0
                    }}>{ev.initials}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Messages Scroll View */}
            <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3" id="chat-container">
              {chatMessages.length === 0 && (
                <div className="text-center text-white/20 text-xs italic my-auto">
                  Messages are ephemeral and disappear when you leave the room.
                </div>
              )}
              
              {chatMessages.map(msg => (
                <div 
                  key={msg.id} 
                  id={`chat-msg-${msg.id}`}
                  className={`flex gap-2.5 w-full items-end group transition-all duration-300 rounded-lg p-0.5 ${msg.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
                >
                  {/* Left Avatar for other users */}
                  {msg.senderId !== user?.id && (
                    <div 
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-md flex-shrink-0 text-white" 
                      style={{ backgroundColor: msg.senderColor }}
                    >
                      {msg.senderEmoji || '👤'}
                    </div>
                  )}

                  {/* Bubble Content Wrapper */}
                  <div className={`flex flex-col ${msg.senderId === user?.id ? 'items-end' : 'items-start'}`} style={{ maxWidth: '80%' }}>
                    <div className={`relative flex flex-col rounded-2xl px-3 py-2 text-xs transition-all duration-300 ${
                      msg.senderId === user?.id 
                        ? 'bg-[var(--accent-primary-bg)] text-[var(--accent-primary)] rounded-br-sm' 
                        : 'bg-white/5 text-white rounded-bl-sm border border-white/5'
                    }`}>
                      {/* Reply Quoted block */}
                      {msg.replyTo && (
                        <div 
                          onClick={() => scrollToMessage(msg.replyTo.id)}
                          className="bg-black/25 border-l-4 border-[var(--accent-primary)] px-2 py-1 rounded text-[10px] mb-1.5 cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
                        >
                          <span className="font-bold block opacity-60 text-[8px]">{msg.replyTo.senderName}</span>
                          <span className="truncate block max-w-full">
                            {msg.replyTo.text || (msg.replyTo.fileUrl ? '📷 Photo' : '')}
                          </span>
                        </div>
                      )}

                      {/* Image Attachment inside Bubble */}
                      {msg.fileUrl && (
                        <div className="mb-1 overflow-hidden rounded-xl border border-white/10">
                          <img 
                            src={msg.fileUrl} 
                            className="max-h-[160px] w-full object-cover cursor-zoom-in hover:scale-102 transition-transform duration-300"
                            onClick={() => setLightboxImage(msg.fileUrl)}
                            alt="Attachment" 
                          />
                        </div>
                      )}

                      {/* Sender Name for other users */}
                      {msg.senderId !== user?.id && (
                        <span className="font-bold block text-[9px] opacity-40 mb-0.5">{msg.senderName}</span>
                      )}

                      {/* Message text */}
                      {msg.text && <span className="break-words leading-relaxed">{msg.text}</span>}

                      {/* Hover Reply trigger */}
                      <button 
                        type="button"
                        onClick={() => setReplyingTo(msg)}
                        className="absolute top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-black/60 backdrop-blur-md text-white/60 hover:text-white hover:bg-black/90 transition-all opacity-0 group-hover:opacity-100 shadow-lg z-10 scale-90"
                        style={msg.senderId === user?.id ? { left: '-38px' } : { right: '-38px' }}
                        title="Reply"
                      >
                        <CornerUpLeft className="w-3 h-3" />
                      </button>
                    </div>
                    
                    {/* Reaction Row */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-3 mt-1" style={{fontSize: 12}}>
                      <div style={{display:'flex', gap:4}}>
                        {['❤️','😂','😮','😢','😡','👍'].map(emoji => (
                          <button key={emoji} style={{
                            background:'none', border:'none', cursor:'pointer',
                            fontSize:14, padding:'2px 4px', borderRadius:6,
                            transition:'background 0.1s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.1)'}
                          onMouseLeave={e => e.currentTarget.style.background='none'}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => alert('Direct messages coming soon!')} style={{color:'#60a5fa',fontSize:11,fontWeight:600,background:'none',border:'none',cursor:'pointer'}}>PM</button>
                      <button onClick={() => alert('Reactions coming soon!')} style={{color:'rgba(255,255,255,0.4)',fontSize:11,background:'none',border:'none',cursor:'pointer'}}>React</button>
                      <button onClick={() => setReplyingTo(msg)} style={{color:'rgba(255,255,255,0.4)',fontSize:11,background:'none',border:'none',cursor:'pointer'}}>Reply</button>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Quote Reply Header Indicator */}
            {replyingTo && (
              <div className="mx-4 p-2 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between animate-fade-in">
                <div className="flex flex-col text-xs truncate max-w-[85%] border-l-2 border-[var(--accent-primary)] pl-2">
                  <span className="font-bold text-[10px] text-[var(--accent-primary)]">Replying to {replyingTo.senderName}</span>
                  <span className="text-white/65 truncate">{replyingTo.text || '📷 Photo'}</span>
                </div>
                <button type="button" onClick={() => setReplyingTo(null)} className="p-1 rounded-full hover:bg-white/10 text-white/40 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Input Action Bar */}
            <form onSubmit={handleTextSubmit} className="p-4 flex items-center gap-2 flex-shrink-0">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
              />
              {/* Photo Upload Trigger */}
              <button 
                type="button"
                onClick={triggerFileSelect}
                className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors border border-white/5"
                title="Attach Photo"
              >
                <Image className="w-4 h-4" />
              </button>

              {/* Chat Input Text */}
              <div className="flex-1 flex flex-col">
                <input 
                  type="text" 
                  placeholder="Type a message..." 
                  value={chatInput} 
                  onChange={e => setChatInput(e.target.value)}
                  className="w-full bg-white/5 text-white rounded-full border border-white/5 px-4 py-2.5 text-xs outline-none focus:border-[var(--accent-primary)] focus:bg-white/10 transition-all placeholder:text-white/20"
                />
                <div style={{color:'rgba(255,255,255,0.2)', fontSize:10, marginTop:2, marginLeft:12}}>
                  Type @ to mention someone.
                </div>
              </div>

              {/* Submit Button */}
              <button 
                type="submit"
                disabled={!chatInput.trim()}
                className="p-2.5 rounded-full bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 text-white transition-colors shadow-md disabled:opacity-40"
              >
                <Send className="w-4 h-4 ml-0.5 animate-pulse-subtle" />
              </button>
            </form>
          </div>
        )}

        {/* 2. PARTICIPANTS TAB */}
        {activeTab === 'users' && (
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-2">Connected Speakers</span>
            
            {participants.map(p => {
              const role = getRole(p.id);
              const isMe = p.isLocal;
              return (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-9 h-9 rounded-full flex items-center justify-center text-base shadow-inner border border-white/10 text-white"
                      style={{ backgroundColor: p.color || '#ff4d4d' }}
                    >
                      {p.photoUrl ? (
                        <img src={p.photoUrl} className="w-full h-full object-cover rounded-full" alt="" />
                      ) : (
                        p.emoji || '👤'
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        {p.name} {isMe && <span className="opacity-40 font-normal text-[10px]">(You)</span>}
                      </span>
                      <span className="text-[9px] font-bold uppercase text-[var(--accent-primary)] tracking-wide">
                        {role === 'owner' ? 'Room Host' : role === 'co-host' ? 'Co-Host' : 'Speaker'}
                      </span>
                    </div>
                  </div>

                  {/* Mic Status */}
                  <div className="flex items-center gap-2">
                    {p.muted ? (
                      <span className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                        <MicOff className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        <Mic className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 3. TOOLS TAB */}
        {activeTab === 'tools' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* If no tool is active, display the tools grid list */}
            {!activeTool ? (
              <div className="flex-1 p-5 overflow-y-auto">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-white/30 block mb-5">Tools</span>
                
                <div className="grid grid-cols-3 gap-3">
                  {/* Tool 1: AI Mock Interview */}
                  <button 
                    type="button"
                    onClick={() => setActiveTool('mock-interview')}
                    className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-white/20 hover:bg-white/10 transition-all group gap-2 aspect-square"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/70 group-hover:text-white transition-colors">
                      <Briefcase className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold text-white/60 group-hover:text-white text-center leading-tight truncate w-full">AI Mock Int...</span>
                  </button>

                  {/* Tool 2: AI Notetaker */}
                  <button 
                    type="button"
                    onClick={() => setActiveTool('notetaker')}
                    className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-white/20 hover:bg-white/10 transition-all group gap-2 aspect-square"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/70 group-hover:text-white transition-colors">
                      <FileText className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold text-white/60 group-hover:text-white text-center leading-tight truncate w-full">AI Notetaker</span>
                  </button>

                  {/* Tool 3: Design Whiteboard */}
                  <button 
                    type="button"
                    onClick={() => setActiveTool('whiteboard')}
                    className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-white/20 hover:bg-white/10 transition-all group gap-2 aspect-square"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/70 group-hover:text-white transition-colors">
                      <Tv className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold text-white/60 group-hover:text-white text-center leading-tight truncate w-full">Design Whit...</span>
                  </button>

                  {/* Tool 4: Magic Mic */}
                  <button 
                    type="button"
                    onClick={() => setActiveTool('magic-mic')}
                    className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-white/20 hover:bg-white/10 transition-all group gap-2 aspect-square"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/70 group-hover:text-white transition-colors">
                      <Megaphone className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold text-white/60 group-hover:text-white text-center leading-tight truncate w-full">Magic Mic</span>
                  </button>

                  {/* Tool 5: Magic Camera */}
                  <button 
                    type="button"
                    onClick={() => setActiveTool('magic-camera')}
                    className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-white/20 hover:bg-white/10 transition-all group gap-2 aspect-square"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/70 group-hover:text-white transition-colors">
                      <Video className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold text-white/60 group-hover:text-white text-center leading-tight truncate w-full">Magic Cam...</span>
                  </button>

                  {/* Tool 6: IP Shield */}
                  <button 
                    type="button"
                    onClick={() => setActiveTool('ip-shield')}
                    className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-white/20 hover:bg-white/10 transition-all group gap-2 aspect-square"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/70 group-hover:text-white transition-colors">
                      <Shield className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold text-white/60 group-hover:text-white text-center leading-tight truncate w-full">IP Shield</span>
                  </button>

                  {/* Tool 7: YouTube Sync */}
                  <button 
                    type="button"
                    onClick={() => setActiveTool('youtube')}
                    className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-white/20 hover:bg-white/10 transition-all group gap-2 aspect-square col-span-3 h-20"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/70 group-hover:text-white transition-colors">
                      <Youtube className="w-5 h-5 text-red-500" />
                    </div>
                    <span className="text-[10px] font-bold text-white/60 group-hover:text-white text-center leading-tight truncate w-full">YouTube Share Player</span>
                  </button>
                </div>
              </div>
            ) : (
              /* ACTIVE TOOL WORKSPACE VIEW */
              <div className="flex-1 flex flex-col overflow-hidden bg-[#0f1115]/30">
                {/* Active Tool Sub-Header */}
                <div className="px-4 py-2 bg-white/5 border-b border-white/5 flex items-center justify-between flex-shrink-0">
                  <button 
                    type="button"
                    onClick={() => setActiveTool(null)}
                    className="text-xs font-bold text-white/60 hover:text-white flex items-center gap-1.5"
                  >
                    <ChevronDown className="w-3.5 h-3.5 rotate-90" /> Tools
                  </button>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent-primary)]">
                    {activeTool.replace('-', ' ')}
                  </span>
                  <div className="w-10"></div> {/* Balanced spacer */}
                </div>

                {/* ACTIVE TOOL SUB-VIEWS */}
                
                {/* TOOL: AI MOCK INTERVIEW */}
                {activeTool === 'mock-interview' && (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
                      {mockInterviewMsgs.map(m => (
                        <div key={m.id} className={`flex w-full ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`p-2.5 rounded-2xl text-xs max-w-[85%] ${
                            m.sender === 'user' ? 'bg-[var(--accent-primary-bg)] text-[var(--accent-primary)]' : 'bg-white/5 text-white/95 border border-white/5'
                          }`}>
                            <span className="font-bold block text-[9px] opacity-40 mb-0.5">
                              {m.sender === 'user' ? 'You' : 'Google AI Interviewer'}
                            </span>
                            {m.text}
                          </div>
                        </div>
                      ))}
                      {aiTyping && (
                        <div className="flex justify-start">
                          <div className="p-2.5 rounded-2xl text-xs bg-white/5 text-white/40 italic">
                            AI is formulating a question...
                          </div>
                        </div>
                      )}
                    </div>
                    <form onSubmit={sendMockInterviewMsg} className="p-3 border-t border-white/5 flex gap-2 flex-shrink-0">
                      <input 
                        type="text" 
                        placeholder="Type response..." 
                        value={mockInterviewInput}
                        onChange={e => setMockInterviewInput(e.target.value)}
                        className="flex-1 bg-white/5 text-white rounded-full border border-white/5 px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)] placeholder:text-white/20"
                      />
                      <button type="submit" className="p-2 bg-[var(--accent-primary)] rounded-full text-white"><Send className="w-3.5 h-3.5" /></button>
                    </form>
                  </div>
                )}

                {/* TOOL: AI NOTETAKER */}
                {activeTool === 'notetaker' && (
                  <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
                    {!meetingNotes ? (
                      <div className="my-auto flex flex-col items-center justify-center text-center gap-4">
                        <FileText className="w-12 h-12 text-white/20 animate-pulse" />
                        <div className="max-w-[240px]">
                          <h4 className="text-xs font-bold text-white mb-1">AI Notetaker Assistant</h4>
                          <p className="text-[10px] text-white/50 leading-relaxed font-sans">
                            Generate structured Summary, attendees, and action items from the room's chat.
                          </p>
                        </div>
                        <button 
                          type="button"
                          onClick={generateMeetingNotes}
                          disabled={isGeneratingNotes}
                          className="px-4 py-2 rounded-xl bg-[var(--accent-primary)] text-white text-xs font-bold hover:bg-[var(--accent-primary)]/80 transition-colors flex items-center gap-1.5"
                        >
                          {isGeneratingNotes ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          {isGeneratingNotes ? 'Synthesizing...' : 'Generate Notes'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3 h-full">
                        <div className="flex-1 bg-white/5 rounded-2xl border border-white/5 p-4 font-mono text-[10px] text-white/70 overflow-y-auto whitespace-pre-wrap">
                          {meetingNotes}
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button 
                            type="button"
                            onClick={() => { navigator.clipboard.writeText(meetingNotes); alert('Notes copied to clipboard!'); }}
                            className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1"
                          >
                            <Copy className="w-3.5 h-3.5" /> Copy
                          </button>
                          <button 
                            type="button"
                            onClick={() => setMeetingNotes('')}
                            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TOOL: DESIGN WHITEBOARD */}
                {activeTool === 'whiteboard' && (
                  <div className="fixed inset-0 z-[100] flex flex-col p-4 bg-[#0a0a0a]/95 backdrop-blur-md">
                    {/* Full Screen Header */}
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-white font-bold text-lg">Design Whiteboard</h2>
                      <button 
                        type="button" 
                        onClick={() => setActiveTool(null)}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-bold transition-colors"
                      >
                        Exit Fullscreen
                      </button>
                    </div>
                    {/* Whiteboard High-Res Canvas */}
                    <div className="flex-1 rounded-2xl border border-white/10 overflow-hidden relative bg-[#0f1115] shadow-inner">
                      <canvas 
                        ref={canvasRef}
                        width={1920}
                        height={1080}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        className="w-full h-full cursor-crosshair object-contain"
                      />
                    </div>
                    {/* Drawing Controls toolbar */}
                    <div className="flex flex-wrap items-center justify-between mt-3 gap-2 bg-white/5 p-2 rounded-xl border border-white/5 flex-shrink-0">
                      {/* Color Palette */}
                      <div className="flex items-center gap-1">
                        {['#ff4d4d', '#4da6ff', '#33cc33', '#ffd11a', '#ffffff'].map(c => (
                          <button 
                            type="button"
                            key={c}
                            onClick={() => { setDrawColor(c); setIsEraser(false); }}
                            className={`w-5 h-5 rounded-full border transition-all ${drawColor === c && !isEraser ? 'scale-115 border-white' : 'border-transparent'}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>

                      {/* Eraser */}
                      <button 
                        type="button"
                        onClick={() => setIsEraser(!isEraser)}
                        className={`p-1.5 rounded-lg border transition ${isEraser ? 'bg-white/15 border-white text-white' : 'border-transparent text-white/50'}`}
                        title="Eraser"
                      >
                        <Eraser className="w-3.5 h-3.5" />
                      </button>

                      {/* Brush Size */}
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] font-bold text-white/40">Size</span>
                        <input 
                          type="range" 
                          min={2} 
                          max={15} 
                          value={drawSize}
                          onChange={e => setDrawSize(parseInt(e.target.value))}
                          className="w-16 accent-[var(--accent-primary)]" 
                        />
                      </div>

                      {/* Clear Canvas */}
                      <button 
                        type="button"
                        onClick={clearCanvas}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition"
                        title="Clear whiteboard"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* TOOL: MAGIC MIC */}
                {activeTool === 'magic-mic' && (
                  <div className="flex-1 p-4 overflow-y-auto flex flex-col items-center justify-center text-center gap-5">
                    {/* Visualizer mic anim */}
                    <div className="relative w-20 h-20 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group">
                      <Megaphone className={`w-8 h-8 text-[var(--accent-primary)] ${activeMicFilter ? 'animate-bounce' : ''}`} />
                      {activeMicFilter && (
                        <div className="absolute inset-0 rounded-full border-2 border-[var(--accent-primary)] animate-ping opacity-60"></div>
                      )}
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-white">Magic Mic Synthesizer</h4>
                      <p className="text-[9px] text-white/45 max-w-[200px] mx-auto mt-1 font-sans">Apply voice filter effects to your audio channel. (Simulator Mode)</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 w-full max-w-[260px]">
                      {['Helium Pitch', 'Robot Core', 'Deep Reverb', 'Radio Static'].map(filter => (
                        <button 
                          type="button"
                          key={filter}
                          onClick={() => setActiveMicFilter(activeMicFilter === filter ? null : filter)}
                          className={`p-2 rounded-xl text-[10px] font-bold border transition ${
                            activeMicFilter === filter 
                              ? 'bg-[var(--accent-primary-bg)] border-[var(--accent-primary)] text-[var(--accent-primary)]' 
                              : 'bg-white/5 border-white/5 text-white hover:border-white/15'
                          }`}
                        >
                          {filter}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* TOOL: MAGIC CAMERA */}
                {activeTool === 'magic-camera' && (
                  <div className="flex-1 p-4 overflow-y-auto flex flex-col items-center justify-center text-center gap-5">
                    {/* Retro cam frame */}
                    <div className={`w-36 h-24 rounded-2xl bg-black border border-white/10 relative overflow-hidden flex items-center justify-center ${activeCamFilter ? `ring-2 ring-[var(--accent-primary)]` : ''}`}>
                      <Video className="w-6 h-6 text-white/20" />
                      {activeCamFilter && (
                        <div className="absolute top-1 left-2 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          <span className="text-[8px] font-bold text-white/50 tracking-widest font-mono">REC</span>
                        </div>
                      )}
                      {activeCamFilter === 'Noir Mode' && <div className="absolute inset-0 bg-white/20 backdrop-grayscale pointer-events-none" />}
                      {activeCamFilter === 'VHS Glitch' && <div className="absolute inset-0 bg-green-500/10 pointer-events-none animate-pulse" />}
                      {activeCamFilter === 'Neon Filter' && <div className="absolute inset-0 border border-blue-500 animate-ping pointer-events-none" />}
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-white">Magic Cam Filters</h4>
                      <p className="text-[9px] text-white/45 max-w-[200px] mx-auto mt-1 font-sans">Apply visual overlay styling to your live webcam. (Simulator Mode)</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 w-full max-w-[260px]">
                      {['Noir Mode', 'VHS Glitch', 'Neon Filter', 'BG Blur'].map(filter => (
                        <button 
                          type="button"
                          key={filter}
                          onClick={() => setActiveCamFilter(activeCamFilter === filter ? null : filter)}
                          className={`p-2 rounded-xl text-[10px] font-bold border transition ${
                            activeCamFilter === filter 
                              ? 'bg-[var(--accent-primary-bg)] border-[var(--accent-primary)] text-[var(--accent-primary)]' 
                              : 'bg-white/5 border-white/5 text-white hover:border-white/15'
                          }`}
                        >
                          {filter}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* TOOL: IP SHIELD */}
                {activeTool === 'ip-shield' && (
                  <div className="flex-1 p-4 overflow-y-auto flex flex-col items-center justify-center text-center gap-5">
                    {/* Glowing shield */}
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center border transition-all duration-300 relative ${
                      ipShieldState === 'secure' 
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.2)] animate-pulse' 
                        : ipShieldState === 'securing' 
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-spin'
                          : 'bg-white/5 border-white/10 text-white/30'
                    }`}>
                      <Shield className="w-7 h-7" />
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-white">IP Shield & Encrypter</h4>
                      <span className={`text-[10px] font-extrabold uppercase tracking-widest ${
                        ipShieldState === 'secure' 
                          ? 'text-emerald-400' 
                          : ipShieldState === 'securing' 
                            ? 'text-amber-400' 
                            : 'text-red-400'
                      }`}>
                        Status: {ipShieldState.replace('-', ' ')}
                      </span>
                    </div>

                    {/* Shield details / logs */}
                    {ipShieldLogs.length > 0 && (
                      <div className="w-full max-w-[260px] bg-black/40 border border-white/5 rounded-xl p-3 text-left font-mono text-[9px] text-white/55 space-y-1">
                        {ipShieldLogs.map((log, idx) => (
                          <div key={idx} className="flex items-center gap-1">
                            <span className="text-[var(--accent-primary)]">&gt;</span>
                            <span>{log}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <button 
                      type="button"
                      onClick={toggleIpShield}
                      disabled={ipShieldState === 'securing'}
                      className={`px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                        ipShieldState === 'secure' 
                          ? 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300' 
                          : 'bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 text-white'
                      }`}
                    >
                      {ipShieldState === 'secure' ? 'Disable Shield' : 'Activate Secure Tunnel'}
                    </button>
                  </div>
                )}

                {/* TOOL: YOUTUBE SYNC */}
                {activeTool === 'youtube' && (
                  <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
                    <div className="my-auto flex flex-col gap-4 font-sans">
                      <div className="flex flex-col items-center justify-center text-center gap-3">
                        <Youtube className="w-12 h-12 text-red-500 animate-pulse" />
                        <h4 className="text-xs font-bold text-white">Share YouTube Video</h4>
                        <p className="text-[10px] text-white/50 max-w-[200px] leading-relaxed">
                          Enter YouTube Link/ID to play synchronized for everyone.
                        </p>
                      </div>

                      <form onSubmit={handleYoutubePlay} className="flex flex-col gap-2">
                        <input 
                          type="text" 
                          placeholder="Paste YouTube Link or Video ID..." 
                          value={ytUrlInput}
                          onChange={e => setYtUrlInput(e.target.value)}
                          className="bg-white/5 text-white rounded-xl border border-white/5 px-3 py-2 text-xs outline-none focus:border-[var(--accent-primary)] placeholder:text-white/20"
                        />
                        <button 
                          type="submit" 
                          className="py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" /> Play for Everyone
                        </button>
                      </form>
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        )}

        {/* 4. SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-2">Customize Profile</span>
            
            {/* Identity Preview Card */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
              <div 
                className="w-14 h-14 rounded-full flex items-center justify-center text-3xl shadow-inner border border-white/10 text-white"
                style={{ backgroundColor: user.color || '#ff4d4d' }}
              >
                {user.photoUrl ? (
                  <img src={user.photoUrl} className="w-full h-full object-cover rounded-full" alt="" />
                ) : (
                  user.emoji || '👤'
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-white/40">Avatar Preview</span>
                <span className="text-sm font-bold text-white leading-tight">{user.name || 'Anonymous User'}</span>
              </div>
            </div>

            {/* Name Input */}
            <div className="flex flex-col gap-1.5 font-sans">
              <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Nickname</label>
              <input 
                type="text" 
                value={user.name || ''}
                onChange={e => setUser(prev => ({ ...prev, name: e.target.value }))}
                className="bg-white/5 text-white rounded-xl border border-white/5 px-3 py-2.5 text-xs outline-none focus:border-[var(--accent-primary)] placeholder:text-white/20"
                maxLength={16}
              />
            </div>

            {/* Emoji Selection Grid */}
            <div className="flex flex-col gap-1.5 font-sans">
              <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Avatar Icon</label>
              <div className="grid grid-cols-8 gap-1.5 p-2 bg-white/5 rounded-xl border border-white/5">
                {EMOJIS.map(emoji => (
                  <button 
                    type="button"
                    key={emoji}
                    onClick={() => {
                      setUser(prev => ({ ...prev, emoji }));
                      if (socket && activeRoom) {
                        socket.emit('update-user', { emoji });
                      }
                    }}
                    className={`text-lg p-1 rounded-lg transition-all hover:bg-white/10 ${user.emoji === emoji ? 'bg-white/10 scale-110 shadow-md ring-1 ring-[var(--accent-primary)]' : ''}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Color selection pills */}
            <div className="flex flex-col gap-1.5 font-sans">
              <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Background Style</label>
              <div className="flex flex-wrap gap-2 p-2 bg-white/5 rounded-xl border border-white/5">
                {AVATAR_COLORS.map(color => (
                  <button 
                    type="button"
                    key={color}
                    onClick={() => {
                      setUser(prev => ({ ...prev, color }));
                      if (socket && activeRoom) {
                        socket.emit('update-user', { color });
                      }
                    }}
                    className="w-5 h-5 rounded-full border border-white/10 relative transition flex items-center justify-center"
                    style={{ backgroundColor: color }}
                  >
                    {user.color === color && (
                      <span className="w-1.5 h-1.5 bg-white rounded-full" />
                    )}
                  </button>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* SOCIAL TAB CONTENT */}
        {activeTab === 'social' && (
          <div style={{flex:1, overflowY:'auto'}}>
            {/* Tabs: Following / In Room */}
            <div style={{display:'flex', borderBottom:'1px solid rgba(255,255,255,0.07)', padding:'0 12px'}}>
              {['Following','In Room'].map(tab => (
                <button key={tab} onClick={() => setSocialTab(tab)} style={{
                  padding:'8px 10px', background:'none', border:'none', cursor:'pointer',
                  color: socialTab===tab ? '#1877f2' : 'rgba(255,255,255,0.4)',
                  fontWeight: socialTab===tab ? 700 : 500, fontSize:12,
                  borderBottom: socialTab===tab ? '2px solid #1877f2' : '2px solid transparent',
                  marginBottom:-1
                }}>{tab}</button>
              ))}
            </div>

            {/* Following list */}
            {socialTab === 'Following' && (user?.following || []).length === 0 && (
              <div style={{ padding: '20px 12px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
                You are not following anyone yet.
              </div>
            )}
            {socialTab === 'Following' && (user?.following || []).map(followedId => (
              <SocialUserRow
                key={followedId}
                userId={followedId}
                currentUser={user}
                onlineUserIds={onlineUserIds}
                openUserProfile={openUserProfile}
                onDM={(id, profile) => {
                  setActiveDm({id, profile});
                  setMsgTab('direct');
                  setView('messages');
                }}
              />
            ))}

            {/* In Room list */}
            {socialTab === 'In Room' && rooms && rooms.flatMap(r => 
                (r.participants || []).map(p => ({ ...p, roomName: r.name, roomId: r.id }))
              )
              .filter(p => p.id !== user?.id)
              .map(p => (
                <div key={p.id} style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'10px 12px'
                }}>
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <img src={p.photoUrl || `https://api.dicebear.com/7.x/lorelei/svg?seed=${p.id}`}
                      style={{width:32,height:32,borderRadius:'50%',objectFit:'cover'}} alt="" />
                    <div>
                      <div style={{color:'white',fontSize:12,fontWeight:600}}>{p.name}</div>
                      <div style={{color:'rgba(255,255,255,0.3)',fontSize:10}}>{p.roomName}</div>
                    </div>
                  </div>
                  <button onClick={() => {
                    const room = rooms.find(r => r.id === p.roomId);
                    if (room) joinVoiceRoom(room);
                  }} style={{
                    background:'rgba(24,119,242,0.15)',border:'1px solid rgba(24,119,242,0.3)',
                    borderRadius:6,padding:'4px 8px',color:'#60a5fa',
                    fontSize:10,fontWeight:700,cursor:'pointer'
                  }}>Join</button>
                </div>
              ))
            }
          </div>
        )}

      </div>

      {/* LIGHTBOX MODAL FOR ATTACHED IMAGES */}
      {lightboxImage && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="relative max-w-4xl w-full h-full max-h-[85vh] flex items-center justify-center">
            {/* Close Lightbox */}
            <button 
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute -top-10 right-0 p-2 text-white/60 hover:text-white rounded-full bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={lightboxImage} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" alt="Lightbox Large view" />
          </div>
        </div>
      )}

    </div>
  );
}
