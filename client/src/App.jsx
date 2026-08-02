import React, { useState, useEffect, useRef } from 'react';
import RoomCard from './components/RoomCard';
import { 
  Mic, MicOff, LogOut, Flame, Award, Plus, Sparkles, MessageSquare, 
  Send, Users, Globe, Settings, AlertTriangle, ShieldCheck, Search, ChevronRight, X, Volume2, ArrowLeft
} from 'lucide-react';
import { DailyService } from './daily';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const socket = io(API_URL);

const EMOJIS = ['😊', '🦊', '🐼', '🦁', '🚀', '🎮', '🎧', '☕', '🎨', '🍕', '🌍', '🐱', '🥑', '👾', '🦄', '🧙‍♂️'];
const AVATAR_COLORS = ['#ff4d4d', '#ff944d', '#ffd11a', '#4da6ff', '#a64dff', '#ff4da6', '#33cc33', '#33cccc', '#f43f5e', '#8b5cf6'];
const LANGUAGES = ['All Languages', 'English', 'Spanish', 'French', 'German', 'Japanese', 'Chinese', 'Portuguese', 'Korean'];

// XP / Fluency level bands
const getLevelInfo = (xp) => {
  if (xp < 100) return { title: 'A1 Beginner', min: 0, max: 100, level: 1, next: 'A2' };
  if (xp < 300) return { title: 'A2 Elementary', min: 100, max: 300, level: 2, next: 'B1' };
  if (xp < 600) return { title: 'B1 Intermediate', min: 300, max: 600, level: 3, next: 'B2' };
  if (xp < 1000) return { title: 'B2 Upper Intermediate', min: 600, max: 1000, level: 4, next: 'C1' };
  if (xp < 1500) return { title: 'C1 Advanced', min: 1000, max: 1500, level: 5, next: 'C2' };
  return { title: 'C2 Fluent Master 👑', min: 1500, max: 99999, level: 6, next: 'MAX' };
};

export default function App() {
  // Navigation / Landing Page states
  const [view, setView] = useState('landing'); // 'landing' or 'lobby'
  const [isConnected, setIsConnected] = useState(false);

  // Landing Page Interactive Eye Tracking & Node Lines States
  const heroRef = useRef(null);
  const charSvgRef = useRef(null);

  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 });
  const [nodeLines, setNodeLines] = useState({
    x1: 0, y1: 0,
    cx1: 0, cy1: 0,
    cx2: 0, cy2: 0,
    cx3: 0, cy3: 0,
    visible: false
  });

  // Identity & Local States
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('speakfree_user');
    if (saved) return JSON.parse(saved);
    
    // Default initial user
    const randomEmoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    return {
      id: 'user-' + Math.random().toString(36).substring(2, 9),
      name: 'Learner_' + Math.floor(Math.random() * 900 + 100),
      emoji: randomEmoji,
      color: randomColor,
      streak: 1,
      lastActiveDay: new Date().toDateString(),
      xp: 25 // start with a small amount of XP
    };
  });

  // Config States
  const [config, setConfig] = useState({ hasApiKey: false, dailyDomain: '' });
  const [rooms, setRooms] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('All Languages');

  // Modals & Panels
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDevModal, setShowDevModal] = useState(false);
  
  // Create Room fields
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomLanguage, setNewRoomLanguage] = useState('English');
  const [newRoomTopic, setNewRoomTopic] = useState('');
  const [newRoomTags, setNewRoomTags] = useState('Casual');

  // Dev Settings fields
  const [devApiKey, setDevApiKey] = useState('');
  const [devDomain, setDevDomain] = useState('');

  // Active Voice Call States
  const [activeRoom, setActiveRoom] = useState(null);
  const [callState, setCallState] = useState('left'); // left, joining, joined, error
  const [isMuted, setIsMuted] = useState(true);
  const [participants, setParticipants] = useState([]);
  const [audioLevels, setAudioLevels] = useState({});
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isRealCall, setIsRealCall] = useState(false);
  const [xpFloater, setXpFloater] = useState(null); // { amount: number, key: number }

  const chatEndRef = useRef(null);
  const cursorDotRef = useRef(null);
  const cursorFollowerRef = useRef(null);

  // Global custom cursor — bound to window, not a container.
  // This ensures cursor is visible over call bar, modals, portals, everything.
  useEffect(() => {
    const dot = cursorDotRef.current;
    const follower = cursorFollowerRef.current;
    if (!dot || !follower) return;

    let mouseX = 0, mouseY = 0;
    let followerX = 0, followerY = 0;
    let rafId = null;

    const onMouseMove = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      // Dot follows instantly
      dot.style.left = `${mouseX}px`;
      dot.style.top = `${mouseY}px`;
      dot.style.opacity = '1';
      follower.style.opacity = '1';
    };

    // Smooth follower lag via requestAnimationFrame
    const animate = () => {
      followerX += (mouseX - followerX) * 0.15;
      followerY += (mouseY - followerY) * 0.15;
      follower.style.left = `${followerX}px`;
      follower.style.top = `${followerY}px`;
      rafId = requestAnimationFrame(animate);
    };

    const onMouseLeave = () => {
      dot.style.opacity = '0';
      follower.style.opacity = '0';
    };

    const onMouseEnter = () => {
      dot.style.opacity = '1';
      follower.style.opacity = '1';
    };

    window.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseleave', onMouseLeave);
    document.addEventListener('mouseenter', onMouseEnter);
    rafId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('mouseenter', onMouseEnter);
      cancelAnimationFrame(rafId);
    };
  }, []);

  // Sync profile details to localStorage on change
  useEffect(() => {
    localStorage.setItem('speakfree_user', JSON.stringify(user));
  }, [user]);

  // Load configuration and room list on mount
  useEffect(() => {
    fetchConfig();
    fetchRooms();

    // Poll room list every 5 seconds to keep participant stacks fresh
    const roomPoll = setInterval(fetchRooms, 5000);
    return () => clearInterval(roomPoll);
  }, []);

  // Socket.IO event listeners
  useEffect(() => {
    const handleChatHistory = (history) => {
      setChatMessages(history);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };

    const handleChatMessage = (message) => {
      setChatMessages(prev => [...prev, message]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };

    socket.on('chat-history', handleChatHistory);
    socket.on('chat-message', handleChatMessage);

    return () => {
      socket.off('chat-history', handleChatHistory);
      socket.off('chat-message', handleChatMessage);
    };
  }, []);

  // Sync Call Status and Ping Server
  useEffect(() => {
    if (callState !== 'joined' || !activeRoom) return;

    // Send keep-alive ping to backend every 4 seconds
    const pingInterval = setInterval(() => {
      fetch(`${API_URL}/api/rooms/${activeRoom.id}/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      }).catch(err => console.warn('Ping error:', err));
    }, 4000);

    // Gamification: Earn XP while inside the call room
    const xpInterval = setInterval(() => {
      // Accumulate XP: +5 XP for active listening, +10 XP if speaking (simulated/real unmute)
      const isSpeaking = !isMuted && (audioLevels[user.id] > 0.05 || Math.random() > 0.4);
      const xpEarned = isSpeaking ? 10 : 5;
      
      setUser(prev => {
        const nextXp = prev.xp + xpEarned;
        const prevLevel = getLevelInfo(prev.xp).level;
        const nextLevel = getLevelInfo(nextXp).level;

        // Show live floating points feed
        setXpFloater({ amount: xpEarned, key: Date.now() });

        if (nextLevel > prevLevel) {
          // Sparkle visual Level up alert!
          setTimeout(() => {
            alert(`🎉 Level Up! You reached Level ${nextLevel} (${getLevelInfo(nextXp).title})! Keep speaking!`);
          }, 100);
        }

        return { ...prev, xp: nextXp };
      });
    }, 10000); // every 10 seconds

    // Mock Chat Simulator for Demo Mode
    let mockChatInterval = null;
    if (!isRealCall) {
      const mockPhrases = [
        "Hey everyone! How is it going?",
        "My native language is French, happy to help!",
        "Let's talk about our favorite hobbies today ☕",
        "Could someone explain the difference between 'make' and 'do'?",
        "Awesome room topic!",
        "Pratiquons le français !",
        "Can we try a quick language challenge?"
      ];

      mockChatInterval = setInterval(() => {
        const speakers = participants.filter(p => !p.isLocal);
        if (speakers.length === 0) return;
        const randomSpeaker = speakers[Math.floor(Math.random() * speakers.length)];
        const randomPhrase = mockPhrases[Math.floor(Math.random() * mockPhrases.length)];

        setChatMessages(prev => [
          ...prev,
          {
            id: 'mock-msg-' + Math.random(),
            senderId: randomSpeaker.id,
            senderName: randomSpeaker.name,
            senderEmoji: randomSpeaker.id === 'mock-user-1' ? '👩‍🦰' : randomSpeaker.id === 'mock-user-2' ? '👦' : '👩',
            senderColor: randomSpeaker.id === 'mock-user-1' ? '#ff4d4d' : randomSpeaker.id === 'mock-user-2' ? '#4da6ff' : '#33cc33',
            text: randomPhrase,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }, 15000); // message every 15 seconds
    }

    return () => {
      clearInterval(pingInterval);
      clearInterval(xpInterval);
      if (mockChatInterval) clearInterval(mockChatInterval);
    };
  }, [callState, activeRoom, isMuted, participants, isRealCall]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_URL}/api/config`);
      const data = await res.json();
      setConfig(data);
      if (data.dailyDomain) {
        setDevDomain(data.dailyDomain);
      }
    } catch (err) {
      console.error('Failed to load server config:', err);
    }
  };

  const fetchRooms = async () => {
    try {
      const res = await fetch(`${API_URL}/api/rooms`);
      const data = await res.json();
      setRooms(data);
      setIsConnected(true);
      
      // Update active room details in real-time
      if (activeRoom) {
        const updated = data.find(r => r.id === activeRoom.id);
        if (updated) {
          // Sync changes if needed
        }
      }
    } catch (err) {
      console.error('Failed to load rooms list:', err);
    }
  };



  const saveDevSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: devApiKey, domain: devDomain })
      });
      const data = await res.json();
      setConfig(data);
      setShowDevModal(false);
      alert('Daily.co configuration saved successfully!');
    } catch (err) {
      alert('Error updating configuration on backend.');
    }
  };

  // Streak verification logic
  const checkAndUpdateStreak = () => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    setUser(prev => {
      if (prev.lastActiveDay === today) {
        return prev; // already active today
      } else if (prev.lastActiveDay === yesterday) {
        return { ...prev, streak: prev.streak + 1, lastActiveDay: today };
      } else {
        return { ...prev, streak: 1, lastActiveDay: today };
      }
    });
  };

  // Room creation handling
  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!newRoomName || newRoomName.trim().length < 3) {
      alert("Room name must be at least 3 characters.");
      return;
    }
    
    if (newRoomTopic && newRoomTopic.trim().length < 5) {
      alert("Topic should be a bit more descriptive, or left blank.");
      return;
    }

    const tagsArray = newRoomTags.split(',').map(t => t.trim()).filter(t => t.length >= 3).slice(0, 5);

    try {
      const res = await fetch(`${API_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRoomName,
          language: newRoomLanguage,
          topic: newRoomTopic,
          tags: tagsArray
        })
      });
      const newRoom = await res.json();
      setRooms(prev => [...prev, newRoom]);
      setShowCreateModal(false);
      
      // Auto-join newly created room
      joinVoiceRoom(newRoom);

      // Reset form
      setNewRoomName('');
      setNewRoomTopic('');
      setNewRoomTags('Casual');
    } catch (err) {
      console.error('Error creating room:', err);
      alert('Failed to create new practice room.');
    }
  };

  // Join Voice Room trigger
  const joinVoiceRoom = async (room) => {
    if (activeRoom) {
      await leaveVoiceRoom();
    }

    checkAndUpdateStreak();
    setIsMuted(true);
    setChatMessages([]);

    try {
      const res = await fetch(`${API_URL}/api/rooms/${room.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          name: user.name,
          color: user.color,
          emoji: user.emoji
        })
      });
      const data = await res.json();

      setActiveRoom(room);
      setIsRealCall(data.isRealConnection);

      // Join Socket.IO room for chat
      socket.emit('join-room', room.id);

      // Setup Daily WebRTC
      DailyService.setCallbacks({
        onAudioLevels: (levels) => {
          setAudioLevels(levels);
        },
        onParticipantsChange: (pList) => {
          setParticipants(pList);
        },
        onConnectionChange: ({ state, isMock, error }) => {
          setCallState(state);
          if (state === 'error') {
            alert(`Call connection error: ${error || 'Unknown issue'}`);
            setActiveRoom(null);
          }
        }
      });

      // Connect via Daily.js helper
      await DailyService.join(data.dailyUrl, data.token, data.isRealConnection, user);

      fetchRooms(); // refresh listing UI
    } catch (err) {
      console.error('Error joining call room:', err);
      alert('Could not join voice session.');
      setActiveRoom(null);
      setCallState('left');
    }
  };

  // Leave Voice Room trigger
  const leaveVoiceRoom = async () => {
    if (!activeRoom) return;

    try {
      await DailyService.leave(isRealCall);
      
      // Leave Socket.IO room
      socket.emit('leave-room', activeRoom.id);

      await fetch(`${API_URL}/api/rooms/${activeRoom.id}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
    } catch (err) {
      console.warn('Error while cleanly leaving backend room:', err);
    } finally {
      setActiveRoom(null);
      setCallState('left');
      setParticipants([]);
      setAudioLevels({});
      setChatMessages([]);
      fetchRooms();
    }
  };

  // Local Microphone Mute controller
  const toggleMute = () => {
    const nextMute = !isMuted;
    const resolved = DailyService.setLocalAudio(nextMute, isRealCall);
    setIsMuted(resolved);
    
    setParticipants(prev => 
      prev.map(p => p.isLocal ? { ...p, muted: resolved } : p)
    );
  };

  // Text Chat Sender
  const sendChatMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeRoom) return;

    const newMessage = {
      id: 'msg-' + Date.now(),
      senderId: user.id,
      senderName: user.name,
      senderEmoji: user.emoji,
      senderColor: user.color,
      text: chatInput,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Broadcast to others via Socket.IO
    socket.emit('chat-message', { roomId: activeRoom.id, message: newMessage });

    setChatMessages(prev => [...prev, newMessage]);
    setChatInput('');
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  // Theme switching removed - we are using global dark mode

  // Eye and Node Tracking mouse event handlers
  const handleMouseMove = (e) => {
    if (!heroRef.current || !charSvgRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;



    const svgRect = charSvgRef.current.getBoundingClientRect();
    const svgCx = svgRect.left + svgRect.width/2 - rect.left;
    const svgCy = svgRect.top + svgRect.height*0.5 - rect.top;

    const dx = x - svgCx;
    const dy = y - svgCy;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const maxOffset = 5;
    const ox = (dx/Math.max(dist, 1)) * Math.min(dist/30, 1) * maxOffset;
    const oy = (dy/Math.max(dist, 1)) * Math.min(dist/30, 1) * maxOffset;

    setPupilOffset({ x: ox, y: oy });

    // Connect node lines to eyes and body segments of the SVG character in hero-space coordinates
    const cx1 = svgRect.left + 78 - rect.left; 
    const cy1 = svgRect.top + 108 - rect.top;
    
    const cx2 = svgRect.left + 122 - rect.left;
    const cy2 = svgRect.top + 108 - rect.top;
    
    const cx3 = svgRect.left + 100 - rect.left;
    const cy3 = svgRect.top + 180 - rect.top;

    setNodeLines({
      x1: x, y1: y,
      cx1, cy1,
      cx2, cy2,
      cx3, cy3,
      visible: true
    });
  };

  const handleMouseLeave = () => {
    setPupilOffset({ x: 0, y: 0 });
    setNodeLines(prev => ({ ...prev, visible: false }));
  };

  const handleMouseEnter = () => {
    // no-op — global cursor effect handles tracking
  };

  // Calculations
  const filteredRooms = rooms.filter(room => {
    const matchLang = selectedLanguage === 'All Languages' || room.language === selectedLanguage;
    const matchSearch = room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        room.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        room.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchLang && matchSearch;
  });

  const totalListeners = rooms.reduce((sum, r) => sum + r.participants.length, 0);

  const levelInfo = getLevelInfo(user.xp);
  const xpPercentage = Math.min(100, Math.floor(((user.xp - levelInfo.min) / (levelInfo.max - levelInfo.min)) * 100));

  // RENDER INTERACTIVE LANDING PAGE
  if (view === 'landing') {
    return (
      <>
        {/* Global Custom Cursor — rendered at root, above everything */}
        <div ref={cursorDotRef} className="custom-cursor" style={{ opacity: 0 }} />
        <div ref={cursorFollowerRef} className="custom-cursor-follower" style={{ opacity: 0 }}>
          <span className="cursor-text">join</span>
        </div>

        <div 
          id="hero" 
          className="landing-hero"
          ref={heroRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onMouseEnter={handleMouseEnter}
        >
          <div className="grain" />
          <div className="glitch-line" />
          <div className="glitch-badge">SPEAK FREE v1.0</div>

          <div className="tag" style={{ top: '12px', left: '16px' }}>// voice_platform</div>
          <div className="tag" style={{ bottom: '12px', left: '16px' }}>
            {isConnected ? '[ connected ]' : '[ connecting ]'}
          </div>
          <div className="tag" style={{ bottom: '12px', right: '16px' }}>
            {totalListeners} listeners online
          </div>

        {/* Dynamic constellation canvas */}
        <svg 
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} 
          xmlns="http://www.w3.org/2000/svg"
        >
          {nodeLines.visible && (
            <>
              <line x1={nodeLines.x1} y1={nodeLines.y1} x2={nodeLines.cx1} y2={nodeLines.cy1} stroke="rgba(255,255,255,0.08)" strokeWidth="0.5"/>
              <line x1={nodeLines.x1} y1={nodeLines.y1} x2={nodeLines.cx2} y2={nodeLines.cy2} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5"/>
              <line x1={nodeLines.x1} y1={nodeLines.y1} x2={nodeLines.cx3} y2={nodeLines.cy3} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5"/>
              <circle cx={nodeLines.cx1} cy={nodeLines.cy1} r="3" fill="rgba(255,255,255,0.2)"/>
              <circle cx={nodeLines.cx2} cy={nodeLines.cy2} r="2" fill="rgba(255,255,255,0.15)"/>
            </>
          )}
        </svg>

        <div id="char-wrap">
          {/* Eyeglass character SVG */}
          <svg 
            id="char-svg" 
            ref={charSvgRef}
            viewBox="0 0 200 220" 
            width="200"
            height="220"
            style={{ 
              maxWidth: '200px', 
              maxHeight: '220px',
              filter: 'drop-shadow(0 0 30px rgba(255,255,255,0.1))',
              transition: 'transform 0.1s ease-out'
            }}
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <clipPath id="faceClip"><ellipse cx="100" cy="105" rx="62" ry="72"/></clipPath>
            </defs>
            <ellipse cx="100" cy="105" rx="62" ry="72" fill="#fff" stroke="#fff" strokeWidth="0"/>
            <path d="M38,105 Q38,140 60,160 Q80,178 100,180 Q120,178 140,160 Q162,140 162,105" fill="#f0f0f0"/>
            <ellipse cx="100" cy="185" rx="16" ry="4" fill="#e0e0e0"/>
            <path d="M84,185 Q100,200 116,185" fill="none" stroke="#ccc" strokeWidth="6" strokeLinecap="round"/>
            <path d="M62,80 Q80,65 100,70 Q120,65 138,80" fill="none" stroke="#111" strokeWidth="14" strokeLinecap="round"/>
            <path d="M55,68 Q70,40 100,35 Q130,40 145,68" fill="#111" stroke="#111" strokeWidth="2"/>
            <path d="M50,72 Q65,42 100,37 Q135,42 150,72 Q145,85 100,82 Q55,85 50,72Z" fill="#111"/>
            <circle id="leye" cx="78" cy="108" r="18" fill="#fff" stroke="#111" strokeWidth="3"/>
            <circle id="reye" cx="122" cy="108" r="18" fill="#fff" stroke="#111" strokeWidth="3"/>
            <circle id="lpupil" cx={78 + pupilOffset.x} cy={108 + pupilOffset.y} r="7" fill="#111"/>
            <circle id="rpupil" cx={122 + pupilOffset.x} cy={108 + pupilOffset.y} r="7" fill="#111"/>
            <circle cx="80" cy="105" r="2.5" fill="#fff"/>
            <circle cx="124" cy="105" r="2.5" fill="#fff"/>
            <rect x="56" y="95" width="44" height="26" rx="14" fill="none" stroke="#111" strokeWidth="3"/>
            <rect x="100" y="95" width="44" height="26" rx="14" fill="none" stroke="#111" strokeWidth="3"/>
            <path d="M100,95 L100,121" stroke="#111" stroke-width="2"/>
            <path d="M56,108 L44,108" stroke="#111" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M144,108 L156,108" stroke="#111" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M88,135 Q100,145 112,135" fill="none" stroke="#111" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M100,180 L94,205 M100,180 L106,205" stroke="#ccc" strokeWidth="6" strokeLinecap="round"/>
            <rect x="60" y="200" width="80" height="20" rx="10" fill="#ddd"/>
          </svg>

          <div className="headline font-serif text-[#fff]">talk to anyone.</div>
          <div className="sub tracking-[3px] text-xs font-mono opacity-50">free · live · voice</div>
          
          <button 
            className="cta" 
            onClick={() => setView('lobby')}
          >
            enter a room ↗
          </button>
        </div>
      </div>
      </>
    );
  }

  // RENDER MAIN LOBBY DASHBOARD
  return (
    <>
      {/* Global Custom Cursor — rendered at root, above everything */}
      <div ref={cursorDotRef} className="custom-cursor" style={{ opacity: 0 }} />
      <div ref={cursorFollowerRef} className="custom-cursor-follower" style={{ opacity: 0 }}>
        <span className="cursor-text">join</span>
      </div>

      <div className="min-h-screen relative font-mono pb-28 flex flex-col items-center" style={{ backgroundColor: 'var(--bg)' }}>
        {/* Premium Background Layers */}
        <div className="particles-bg" />
        <div className="noise-overlay" />
        <div className="vignette-overlay" />

      {/* Main Header */}
      <header className="sticky top-0 z-30 w-full backdrop-blur-xl border-b pt-8 pb-6 flex justify-center" style={{ backgroundColor: 'var(--bg-trans-85)', borderColor: 'var(--line)' }}>
        <div className="w-full max-w-[1400px] px-8 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div 
              onClick={() => setView('landing')}
              className="cursor-pointer group"
              title="Return to home page"
            >
              <h1 className="text-xl font-mono tracking-tighter text-[var(--ink)] group-hover:text-[var(--accent)] transition-colors uppercase">
                SpeakFree_
              </h1>
            </div>

            {/* Mobile Create Room */}
            <div className="flex items-center gap-4 md:hidden">
              <button 
                onClick={() => setShowCreateModal(true)} 
                className="create-room-btn text-[10px] uppercase tracking-widest"
              >
                + Room
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-start md:items-end gap-8 w-full md:w-auto">
            {/* Search bar - Animated underline */}
            <div className="relative w-full md:w-72 group/search">
              <input 
                type="text" 
                placeholder="Search topic or user..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full py-2 text-[11px] uppercase tracking-widest bg-transparent border-b border-[var(--line)] focus:outline-none focus:border-transparent transition-all text-[var(--ink)] placeholder-[var(--ink-dim)]"
              />
              <div className="absolute bottom-0 left-0 h-[1.5px] bg-[var(--accent)] w-0 group-focus-within/search:w-full transition-all duration-500 ease-out" />
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-6">
              <button 
                onClick={() => setShowSettingsModal(true)}
                className="text-[10px] border border-[var(--line-bright)] px-4 py-2 hover:bg-[var(--bg-hover)] text-[var(--ink)] transition-all uppercase flex items-center gap-2 tracking-widest"
              >
                <span className="w-3.5 h-3.5 flex items-center justify-center rounded-full text-[7px] text-white" style={{backgroundColor: user.color}}>{user.emoji}</span>
                {user.name}
              </button>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="create-room-btn text-[10px] uppercase tracking-widest"
              >
                + Room
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="w-full flex justify-center border-b backdrop-blur-md z-20 sticky top-[88px]" style={{ backgroundColor: 'var(--bg-trans-60)', borderColor: 'var(--line)' }}>
        {/* Filters */}
        <div className="w-full max-w-[1400px] px-8 py-4 flex gap-3 overflow-x-auto scrollbar-none">
          {LANGUAGES.map(lang => (
            <button
              key={lang}
              onClick={() => setSelectedLanguage(lang)}
              className={`filter-pill text-[10px] uppercase tracking-[0.15em] whitespace-nowrap font-bold ${
                selectedLanguage === lang ? 'active' : ''
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>

      <main className="w-full flex justify-center animate-fade-in relative z-10">
        {/* Rooms list */}
        <div className="w-full max-w-[1400px] px-8 mt-12 pb-16">
          {filteredRooms.length === 0 ? (
            <div className="py-32 flex flex-col items-center justify-center text-center border border-[var(--line)] bg-[var(--bg-hover)] rounded-xl">
              <h3 className="text-3xl font-serif text-[var(--ink)] mb-3">No active rooms found</h3>
              <p className="text-[11px] text-[var(--ink-tertiary)] mb-8 font-mono uppercase tracking-[0.2em]">
                Initiate a new connection.
              </p>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="create-room-btn"
              >
                <span>Start a Room</span>
                <span className="inline-block">↗</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {filteredRooms.map(room => (
                <RoomCard 
                  key={room.id} 
                  room={room} 
                  inThisRoom={activeRoom?.id === room.id} 
                  onJoin={joinVoiceRoom} 
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Clubhouse / Discord-style Active Room Bottom Drawer */}
      {activeRoom && (
        <div className="fixed bottom-0 left-0 right-0 z-40 animate-slide-up" style={{ backgroundColor: 'var(--bg-elevated-2)', borderTop: '1px solid var(--line-bright)', boxShadow: '0 -8px 32px rgba(0,0,0,0.4)' }}>
          <div className="max-w-4xl mx-auto px-6 py-4">
            
            {/* Header: Title and controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-glass">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded bg-[var(--accent-bg)] text-[var(--accent)] text-[10px] font-bold uppercase tracking-wider">
                    Listening Room
                  </span>
                  <span className="text-xs text-[var(--ink-tertiary)]">•</span>
                  <span className="text-xs font-semibold text-[var(--accent)]">{activeRoom.language}</span>
                  <span className="text-xs text-[var(--ink-tertiary)]">•</span>
                  <span className="text-xs text-[var(--ink-tertiary)] flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> {participants.length} active
                  </span>
                </div>
                <h2 className="text-lg font-bold text-[var(--ink)] leading-snug">{activeRoom.name}</h2>
              </div>

              {/* Call Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  className={`p-3 rounded-xl flex items-center gap-2 text-sm font-semibold transition ${
                    isMuted 
                      ? 'bg-[var(--danger-bg)] border border-[var(--danger)] text-[var(--danger)] hover:bg-red-50' 
                      : 'bg-[var(--success-bg)] border border-[var(--success)] text-[var(--success)] hover:bg-green-50'
                  }`}
                >
                  {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  <span>{isMuted ? 'Muted' : 'Speaking'}</span>
                </button>

                <button
                  onClick={leaveVoiceRoom}
                  className="btn-danger p-3 rounded-xl flex items-center gap-2 text-sm font-semibold"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Leave</span>
                </button>
              </div>
            </div>

            {/* Content: Participant icons & Real-time Text chat */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4 max-h-[300px] overflow-y-auto">
              
              {/* Speaker Avatars */}
              <div className="md:col-span-7 flex flex-wrap gap-4 content-start">
                {participants.map(p => {
                  const level = audioLevels[p.id] || 0;
                  const isSpeaking = level > 0.05;

                  return (
                    <div 
                      key={p.id} 
                      className="flex flex-col items-center gap-1.5 w-16"
                    >
                      <div 
                        className="relative cursor-pointer"
                        onClick={() => !p.isLocal && setSelectedParticipant(selectedParticipant === p.id ? null : p.id)}
                      >
                        <div 
                          className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold shadow-md select-none border-2 transition-all ${
                            isSpeaking ? 'avatar-speaking' : 'border-transparent'
                          } ${selectedParticipant === p.id ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-elevated-2)]' : ''}`}
                          style={{ backgroundColor: p.isLocal ? user.color : (p.color || '#ff4d4d'), color: '#fff' }}
                        >
                          {p.isLocal ? (user.name ? user.name.charAt(0).toUpperCase() : '👤') : (p.name ? p.name.charAt(0).toUpperCase() : '👤')}
                        </div>
                        {p.muted && (
                          <div className="absolute -bottom-1 -right-1 border p-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-elevated-2)', borderColor: 'var(--line)' }}>
                            <MicOff className="w-3 h-3 text-rose-400" />
                          </div>
                        )}
                        {isSpeaking && (
                          <div className="absolute -top-1 -right-1 bg-[var(--success)] border-2 border-[var(--bg-elevated-2)] p-0.5 rounded-full animate-bounce">
                            <Volume2 className="w-3 h-3 text-white" />
                          </div>
                        )}
                        
                        {/* Moderation Popover Menu */}
                        {selectedParticipant === p.id && !p.isLocal && (
                          <div className="absolute top-14 left-1/2 -translate-x-1/2 w-32 bg-[var(--bg-elevated)] border border-[var(--line-bright)] rounded-lg shadow-xl z-50 overflow-hidden text-xs">
                            <div className="px-3 py-2 border-b border-[var(--line)] font-semibold text-[var(--ink)] truncate bg-[var(--bg-secondary)]">
                              {p.name}
                            </div>
                            <button 
                              className="w-full text-left px-3 py-2 hover:bg-[var(--bg-hover)] text-[var(--ink)] transition-colors"
                              onClick={(e) => { e.stopPropagation(); alert(`Muted ${p.name}`); setSelectedParticipant(null); }}
                            >
                              Mute user
                            </button>
                            <button 
                              className="w-full text-left px-3 py-2 hover:bg-[var(--danger-bg)] text-[var(--danger)] transition-colors"
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                alert(`Kicked ${p.name}`); 
                                setParticipants(prev => prev.filter(user => user.id !== p.id));
                                setSelectedParticipant(null); 
                              }}
                            >
                              Kick user
                            </button>
                            <button 
                              className="w-full text-left px-3 py-2 hover:bg-[var(--bg-hover)] text-[var(--ink-secondary)] transition-colors"
                              onClick={(e) => { e.stopPropagation(); alert(`Reported ${p.name}`); setSelectedParticipant(null); }}
                            >
                              Report
                            </button>
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] font-medium text-[var(--ink-secondary)] text-center w-full truncate">
                        {p.isLocal ? 'Me' : p.name}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Text Chat Feed */}
              <div className="md:col-span-5 flex flex-col justify-between border-l border-glass pl-6 min-h-[180px] max-h-[220px]">
                <div className="flex items-center gap-1.5 pb-2 text-xs font-semibold text-[var(--ink-secondary)] border-b border-glass">
                  <MessageSquare className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Room Text Chat</span>
                </div>

                <div className="flex-1 overflow-y-auto py-2 space-y-2.5 text-xs">
                  {chatMessages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-[var(--ink-tertiary)] italic">
                      No chat messages yet. Type below!
                    </div>
                  ) : (
                    chatMessages.map(msg => (
                      <div key={msg.id} className="flex gap-2">
                        <div 
                          className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px]"
                          style={{ backgroundColor: msg.senderColor }}
                        >
                          {msg.senderEmoji || '👤'}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-baseline justify-between mb-0.5">
                            <span className="font-bold text-[var(--ink)] text-[10px]">{msg.senderName}</span>
                            <span className="text-[9px] text-[var(--ink-tertiary)]">{msg.timestamp}</span>
                          </div>
                          <p className="text-[var(--ink)] bg-[var(--bg-secondary)] p-1.5 rounded border border-[var(--line)] leading-normal">
                            {msg.text}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>

                <form onSubmit={sendChatMessage} className="flex gap-2 pt-2 border-t border-[var(--line)]">
                  <input
                    type="text"
                    placeholder="Type practice tips, words..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs bg-[var(--bg-secondary)] border-[var(--line)] rounded-lg text-[var(--ink)]"
                  />
                  <button
                    type="submit"
                    className="btn-primary px-3 py-1.5 rounded-lg flex items-center justify-center"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* CREATE ROOM MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="w-full max-w-md glass rounded-2xl p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-[var(--ink)] flex items-center gap-2">
                <Plus className="w-5 h-5 text-[var(--accent)]" /> Start Practice Lounge
              </h3>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition text-[var(--ink-tertiary)] hover:text-[var(--ink)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--ink-secondary)] mb-1.5">Room Title</label>
                <input 
                  type="text" 
                  placeholder="e.g. Intermediate Spanish Chat & Tacos 🌮" 
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink-secondary)] mb-1.5">Language Focus</label>
                  <select 
                    value={newRoomLanguage}
                    onChange={(e) => setNewRoomLanguage(e.target.value)}
                    className="w-full text-sm"
                  >
                    {LANGUAGES.slice(1).map(lang => (
                      <option key={lang} value={lang}>{lang}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--ink-secondary)] mb-1.5">Tags (comma separated)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Casual, Debate" 
                    value={newRoomTags}
                    onChange={(e) => setNewRoomTags(e.target.value)}
                    className="w-full text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink-secondary)] mb-1.5">Lounge Description / Topic</label>
                <textarea 
                  placeholder="Give speakers details about what you want to talk about..." 
                  value={newRoomTopic}
                  onChange={(e) => setNewRoomTopic(e.target.value)}
                  className="w-full text-sm h-20 resize-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary px-4 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary px-5 py-2 text-sm"
                >
                  Create and Launch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* USER PROFILE MODAL */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm glass rounded-2xl p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-[var(--ink)] flex items-center gap-1.5">
                <Settings className="w-5 h-5 text-[var(--accent)]" /> Customize Identity
              </h3>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition text-[var(--ink-tertiary)] hover:text-[var(--ink)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Preview Avatar Card */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--line)]">
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center text-4xl shadow-md"
                  style={{ backgroundColor: user.color }}
                >
                  {user.emoji}
                </div>
                <div>
                  <span className="text-xs text-[var(--ink-tertiary)]">Live Preview</span>
                  <h4 className="text-lg font-bold text-[var(--ink)] leading-tight">{user.name || 'Anonymous Learner'}</h4>
                  <span className="text-xs text-[var(--accent)] font-semibold">Native Speaker</span>
                </div>
              </div>

              {/* Name Edit Input */}
              <div>
                <label className="block text-xs font-semibold text-[var(--ink-secondary)] mb-1.5">Nickname</label>
                <input 
                  type="text" 
                  value={user.name}
                  onChange={(e) => setUser(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full text-sm"
                  maxLength={16}
                />
              </div>

              {/* Emoji Selector grid */}
              <div>
                <label className="block text-xs font-semibold text-[var(--ink-secondary)] mb-1.5">Avatar Icon</label>
                <div className="grid grid-cols-8 gap-2">
                  {EMOJIS.map(em => (
                    <button
                      key={em}
                      onClick={() => setUser(prev => ({ ...prev, emoji: em }))}
                      className={`text-xl p-1 rounded-md hover:bg-[var(--bg-hover)] transition ${
                        user.emoji === em ? 'bg-[var(--accent-bg)] border border-[var(--accent)]' : 'border border-transparent'
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Selector pills */}
              <div>
                <label className="block text-xs font-semibold text-[var(--ink-secondary)] mb-1.5">Background Style</label>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setUser(prev => ({ ...prev, color }))}
                      className="w-6 h-6 rounded-full border border-glass relative transition"
                      style={{ backgroundColor: color }}
                    >
                      {user.color === color && (
                        <div className="absolute inset-0 m-auto w-2 h-2 bg-white rounded-full" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowSettingsModal(false)}
              className="btn-primary w-full mt-6 py-2.5 text-sm"
            >
              Save Details
            </button>
          </div>
        </div>
      )}

      {/* DEVELOPER DAILY.CO API CREDENTIALS MODAL */}
      {showDevModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="w-full max-w-md glass rounded-2xl p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[var(--ink)] flex items-center gap-2">
                <Settings className="w-5 h-5 text-[var(--accent)]" /> Daily.co Credentials
              </h3>
              <button 
                onClick={() => setShowDevModal(false)}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition text-[var(--ink-tertiary)] hover:text-[var(--ink)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-[var(--accent-bg)] border border-[var(--accent-glow)] rounded-xl text-xs text-[var(--accent)] leading-normal mb-5">
              Inputting credentials here lets the server call the real Daily.co WebRTC service to generate active meeting rooms and voice channels. 
              <br />
              If you leave these fields empty, SpeakFree works in <strong>Demo Simulator Mode</strong> with simulated speech visualisers and mock partners.
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--ink-secondary)] mb-1.5">Daily.co Developer Domain</label>
                <input 
                  type="text" 
                  placeholder="e.g. my-developer-subdomain" 
                  value={devDomain}
                  onChange={(e) => setDevDomain(e.target.value)}
                  className="w-full text-sm"
                />
                <span className="text-[10px] text-[var(--ink-tertiary)] mt-1 block">Your subdomain (the word before .daily.co)</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink-secondary)] mb-1.5">Daily.co Secret API Key</label>
                <input 
                  type="password" 
                  placeholder="e.g. 5ca7...da8b" 
                  value={devApiKey}
                  onChange={(e) => setDevApiKey(e.target.value)}
                  className="w-full text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-5">
              <button
                type="button"
                onClick={() => setShowDevModal(false)}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={saveDevSettings}
                className="btn-primary px-5 py-2 text-sm"
              >
                Save Configurations
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
