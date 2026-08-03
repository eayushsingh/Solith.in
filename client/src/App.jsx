import React, { useState, useEffect, useRef } from 'react';
import RoomCard from './components/RoomCard';
import { 
  Mic, MicOff, LogOut, Flame, Award, Plus, Sparkles, MessageSquare, 
  Send, Users, Globe, Settings, AlertTriangle, ShieldCheck, Search, ChevronRight, X, Volume2, ArrowLeft, Shield, UserMinus, Flag
} from 'lucide-react';
import { LiveKitService } from './livekit';
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, db, doc, setDoc, getDoc, serverTimestamp, arrayUnion, arrayRemove, setPersistence, inMemoryPersistence } from './firebase';
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
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [targetProfile, setTargetProfile] = useState(null);
  const [showTargetProfileModal, setShowTargetProfileModal] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  // Config States
  const [config, setConfig] = useState({ hasApiKey: false, livekitUrl: '' });
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
  const [devApiSecret, setDevApiSecret] = useState('');
  const [livekitUrl, setLivekitUrl] = useState('');

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


  // Load configuration and room list on mount
  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (currentUser && !currentUser.isAnonymous) {
          console.log("onAuthStateChanged: Authenticated as", currentUser.email);
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          let userData;
          const today = new Date().toDateString();
          const yesterday = new Date(Date.now() - 86400000).toDateString();

          if (userSnap.exists()) {
            userData = userSnap.data();
            let updates = {};

            if (userData.lastActiveDay === yesterday) {
              updates.streak = (userData.streak || 0) + 1;
              updates.lastActiveDay = today;
              userData.streak = updates.streak;
              userData.lastActiveDay = updates.lastActiveDay;
            } else if (userData.lastActiveDay !== today) {
              updates.streak = 1;
              updates.lastActiveDay = today;
              userData.streak = 1;
              userData.lastActiveDay = today;
            }

            // Sync Google profile info to replace any old anonymous 'learner_' data
            if (currentUser.displayName && (!userData.name || userData.name.startsWith('learner_') || userData.name !== currentUser.displayName)) {
              updates.name = currentUser.displayName;
              userData.name = currentUser.displayName;
            }
            
            if (currentUser.photoURL && userData.photoUrl !== currentUser.photoURL) {
              updates.photoUrl = currentUser.photoURL;
              userData.photoUrl = currentUser.photoURL;
            }

            if (Object.keys(updates).length > 0) {
              await setDoc(userRef, updates, { merge: true });
            }
          } else {
            userData = {
              id: currentUser.uid,
              name: currentUser.displayName,
              photoUrl: currentUser.photoURL,
              email: currentUser.email,
              xp: 25,
              streak: 1,
              lastActiveDay: today,
              createdAt: serverTimestamp()
            };
            await setDoc(userRef, userData);
          }
          
          const token = await currentUser.getIdToken();
          setUser({
            ...userData,
            token
          });
        } else {
          if (currentUser && currentUser.isAnonymous) {
            console.warn("Detected old anonymous session. Clearing it out.");
            signOut(auth).catch(e => console.error("Error clearing anonymous session:", e));
          }
          setUser(null);
        }
      } catch (err) {
        console.error("Error in onAuthStateChanged:", err);
        alert("Failed to load user profile: " + err.message);
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    if (!auth) return alert("Firebase config missing!");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      console.log("signInWithPopup SUCCESS: Logged in as", result.user.email);
      setShowAuthModal(false);
      setShowProfileModal(true);
    } catch (error) {
      console.error("signInWithPopup ERROR:", error.code, error.message);
      
      if (error.message.includes("Database is closing") || error.message.includes("hidden") || error.code.includes("internal-error")) {
        console.warn("IndexedDB issue detected. Falling back to in-memory persistence...");
        try {
          await setPersistence(auth, inMemoryPersistence);
          const fallbackResult = await signInWithPopup(auth, googleProvider);
          console.log("signInWithPopup (Fallback) SUCCESS:", fallbackResult.user.email);
          setShowAuthModal(false);
          setShowProfileModal(true);
          return;
        } catch (fallbackError) {
          console.error("Fallback login failed:", fallbackError);
          if (auth.currentUser) {
            console.log("signInWithPopup SUCCESS (Despite Persistence Failure):", auth.currentUser.email);
            alert("Sign-in succeeded but couldn't save your session — you may need to sign in again next visit.");
            setShowAuthModal(false);
            setShowProfileModal(true);
          } else {
            alert("Login completely failed: " + fallbackError.message);
          }
        }
      } else {
        alert("Login failed: " + error.message);
      }
    }
  };

  // Follow System Logic
  const openUserProfile = async (userId) => {
    if (userId === user?.id) {
      setShowProfileModal(true);
      return;
    }
    setProfileLoading(true);
    setShowTargetProfileModal(true);
    try {
      const snap = await getDoc(doc(db, 'users', userId));
      if (snap.exists()) {
        setTargetProfile(snap.data());
      } else {
        alert("User not found.");
        setShowTargetProfileModal(false);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to load profile.");
      setShowTargetProfileModal(false);
    }
    setProfileLoading(false);
  };

  const toggleFollow = async () => {
    if (!user || !targetProfile) return;
    const isFollowing = user.following?.includes(targetProfile.id);
    
    // Optimistic UI update
    const newFollowing = isFollowing 
      ? (user.following || []).filter(id => id !== targetProfile.id)
      : [...(user.following || []), targetProfile.id];
      
    const newTargetFollowers = isFollowing
      ? (targetProfile.followers || []).filter(id => id !== user.id)
      : [...(targetProfile.followers || []), user.id];
      
    setUser(prev => ({ ...prev, following: newFollowing }));
    setTargetProfile(prev => ({ ...prev, followers: newTargetFollowers }));

    try {
      if (isFollowing) {
        await setDoc(doc(db, 'users', user.id), { following: arrayRemove(targetProfile.id) }, { merge: true });
        await setDoc(doc(db, 'users', targetProfile.id), { followers: arrayRemove(user.id) }, { merge: true });
      } else {
        await setDoc(doc(db, 'users', user.id), { following: arrayUnion(targetProfile.id) }, { merge: true });
        await setDoc(doc(db, 'users', targetProfile.id), { followers: arrayUnion(user.id) }, { merge: true });
      }
    } catch (e) {
      console.error("Failed to toggle follow", e);
      setUser(prev => ({ ...prev, following: isFollowing ? [...(prev.following||[]), targetProfile.id] : prev.following.filter(id => id !== targetProfile.id) }));
      alert("Action failed, please try again.");
    }
  };


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
      if (data.livekitUrl) {
        setLivekitUrl(data.livekitUrl);
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
        body: JSON.stringify({ apiKey: devApiKey, apiSecret: devApiSecret, livekitUrl: livekitUrl })
      });
      const data = await res.json();
      setConfig(data);
      setShowDevModal(false);
      alert('LiveKit configuration saved successfully!');
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
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          name: newRoomName,
          language: newRoomLanguage,
          topic: newRoomTopic,
          tags: tagsArray
        })
      });
      const newRoom = await res.json();
      
      if (!res.ok) {
        throw new Error(newRoom.error || 'Failed to create room');
      }

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
      alert(err.message || 'Failed to create new practice room.');
    }
  };

  // Join a room logic
  const joinVoiceRoom = async (room) => {
    if (!user || !user.id) {
      setShowAuthModal(true);
      return;
    }

    if (activeRoom) {
      // Prompt user or automatically leave old room?
      alert('You are already in a room. Leave it first.');
      return;
    }
    setIsMuted(true);
    setChatMessages([]);

    try {
      const res = await fetch(`${API_URL}/api/rooms/${room.id}/join`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
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

      // Setup LiveKit WebRTC
      LiveKitService.setCallbacks({
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

      // Connect via LiveKit helper
      await LiveKitService.join(data.livekitUrl, data.token, data.isRealConnection, user);

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
      await LiveKitService.leave(isRealCall);
      
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
    const resolved = LiveKitService.setLocalAudio(nextMute, isRealCall);
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

  // Moderation API Calls
  const promoteUser = async (targetId) => {
    try {
      await fetch(`${API_URL}/api/rooms/${activeRoom.id}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
        body: JSON.stringify({ targetUserId: targetId })
      });
    } catch (e) { console.error('Promote failed', e); }
  };

  const kickUser = async (targetId) => {
    try {
      await fetch(`${API_URL}/api/rooms/${activeRoom.id}/kick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
        body: JSON.stringify({ targetUserId: targetId })
      });
    } catch (e) { console.error('Kick failed', e); }
  };

  const muteUser = async (targetId) => {
    try {
      await fetch(`${API_URL}/api/rooms/${activeRoom.id}/mute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
        body: JSON.stringify({ targetUserId: targetId })
      });
    } catch (e) { console.error('Mute failed', e); }
  };

  const endRoom = async () => {
    try {
      await fetch(`${API_URL}/api/rooms/${activeRoom.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
    } catch (e) { console.error('End room failed', e); }
  };

  // Moderation Socket Listeners
  useEffect(() => {
    if (!activeRoom || !user) return;

    const handleKicked = (data) => {
      if (data.userId === user.id) {
        alert("You have been kicked from the room by a moderator.");
        leaveVoiceRoom();
      } else {
        setParticipants(prev => prev.filter(p => p.id !== data.userId));
      }
    };

    const handleMuted = (data) => {
      if (data.userId === user.id) {
        alert("You have been muted by a moderator.");
        setIsMuted(true);
        LiveKitService.setLocalAudio(true, isRealCall);
      }
    };

    const handleDeleted = () => {
      alert("This room has been ended by the owner.");
      leaveVoiceRoom();
    };

    const handleRoleChanged = () => {
      fetchRooms(); // refresh to get new roles
    };

    socket.on('participant-kicked', handleKicked);
    socket.on('participant-muted', handleMuted);
    socket.on('room-deleted', handleDeleted);
    socket.on('role-changed', handleRoleChanged);

    return () => {
      socket.off('participant-kicked', handleKicked);
      socket.off('participant-muted', handleMuted);
      socket.off('room-deleted', handleDeleted);
      socket.off('role-changed', handleRoleChanged);
    };
  }, [activeRoom, user, isRealCall]);

  const getRole = (userId) => {
    if (!activeRoom) return 'guest';
    const currentRoomData = rooms.find(r => r.id === activeRoom.id);
    return currentRoomData?.roles?.[userId] || 'guest';
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

  const levelInfo = user ? getLevelInfo(user.xp || 0) : null;
  const xpPercentage = user && levelInfo ? Math.min(100, Math.floor(((user.xp - levelInfo.min) / (levelInfo.max - levelInfo.min)) * 100)) : 0;

  // RENDER INTERACTIVE LANDING PAGE
  if (view === 'landing') {
    return (
      <>


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
                Solith_
              </h1>
            </div>

            {/* Mobile Actions */}
            <div className="flex items-center gap-4 md:hidden">
              {user ? (
                <>
                  <img src={user.photoUrl} alt="Profile" className="w-6 h-6 rounded-full cursor-pointer" onClick={() => setShowProfileModal(true)} />
                  <button 
                    onClick={() => setShowCreateModal(true)} 
                    className="create-room-btn text-[10px] uppercase tracking-widest"
                  >
                    + Room
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => setShowAuthModal(true)}
                  className="px-3 py-1.5 text-[10px] uppercase tracking-widest bg-[var(--accent)] text-[var(--bg)] font-bold hover:opacity-90 transition-opacity"
                >
                  Sign In
                </button>
              )}
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
              {user ? (
                <>
                  <button 
                    onClick={() => setShowProfileModal(true)}
                    className="text-[10px] border border-[var(--line-bright)] px-4 py-2 hover:bg-[var(--bg-hover)] text-[var(--ink)] transition-all uppercase flex items-center gap-2 tracking-widest"
                  >
                    <img src={user.photoUrl} alt="Profile" className="w-4 h-4 rounded-full" />
                    {user.name.split(' ')[0]}
                  </button>
                  <button 
                    onClick={() => setShowCreateModal(true)}
                    className="create-room-btn text-[10px] uppercase tracking-widest"
                  >
                    + Room
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => setShowAuthModal(true)}
                  className="px-5 py-2.5 text-xs uppercase tracking-widest bg-[var(--accent)] text-[var(--bg)] font-bold hover:shadow-[0_0_15px_rgba(var(--accent-rgb),0.4)] transition-all"
                >
                  Sign in with Google
                </button>
              )}
              <button onClick={() => setShowSettingsModal(true)} className="text-[var(--ink-secondary)] hover:text-[var(--ink)] transition-colors">
                <Settings className="w-4 h-4" />
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
                onClick={() => user ? setShowCreateModal(true) : setShowAuthModal(true)}
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
                  userFollowing={user?.following || []}
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
                {getRole(user?.id) === 'owner' && (
                  <button
                    onClick={() => {
                      if (window.confirm("Are you sure you want to end this room for everyone?")) {
                        endRoom();
                      }
                    }}
                    className="p-3 rounded-xl flex items-center gap-2 text-sm font-semibold bg-[var(--danger-bg)] border border-[var(--danger)] text-[var(--danger)] hover:bg-red-900/30 transition"
                  >
                    <X className="w-4 h-4" />
                    <span>End Room</span>
                  </button>
                )}
              </div>
            </div>

            {/* Content: Participant icons & Real-time Text chat */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4 max-h-[300px] overflow-y-auto">
              
              {/* Speaker Avatars */}
              <div className="md:col-span-7 flex flex-wrap gap-4 content-start">
                {participants.map(p => {
                  const level = audioLevels[p.id] || 0;
                  const isSpeaking = level > 0.05;
                  const role = getRole(p.id);
                  const myRole = getRole(user?.id);
                  const isLocalUserOwner = myRole === 'owner';
                  const isLocalUserMod = myRole === 'owner' || myRole === 'co-host';

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
                        {role === 'owner' && (
                          <div className="absolute -top-2 -left-2 text-lg drop-shadow-md z-10" title="Room Owner">👑</div>
                        )}
                        {role === 'co-host' && (
                          <div className="absolute -top-1 -left-1 text-sm drop-shadow-md z-10" title="Co-host">🛡️</div>
                        )}
                        {p.muted && (
                          <div className="absolute -bottom-1 -right-1 border p-0.5 rounded-full z-10" style={{ backgroundColor: 'var(--bg-elevated-2)', borderColor: 'var(--line)' }}>
                            <MicOff className="w-3 h-3 text-rose-400" />
                          </div>
                        )}
                        {isSpeaking && (
                          <div className="absolute -bottom-1 -right-1 bg-[var(--success)] border-2 border-[var(--bg-elevated-2)] p-0.5 rounded-full animate-bounce z-10">
                            <Volume2 className="w-3 h-3 text-white" />
                          </div>
                        )}
                        
                        {/* Moderation Popover Menu */}
                        {selectedParticipant === p.id && !p.isLocal && (
                          <div className="absolute top-14 left-1/2 -translate-x-1/2 w-36 bg-[var(--bg-elevated)] border border-[var(--line-bright)] rounded-lg shadow-xl z-50 overflow-hidden text-xs">
                            <div className="px-3 py-2 border-b border-[var(--line)] font-semibold text-[var(--ink)] truncate bg-[var(--bg-secondary)] text-center">
                              {p.name}
                            </div>
                            <button 
                              className="w-full text-left px-3 py-2 hover:bg-[var(--bg-hover)] text-[var(--ink)] transition-colors flex items-center gap-2"
                              onClick={(e) => { e.stopPropagation(); openUserProfile(p.id); setSelectedParticipant(null); }}
                            >
                              <Users className="w-3.5 h-3.5"/> View Profile
                            </button>
                            
                            {isLocalUserMod && role !== 'owner' && (
                              <button 
                                className="w-full text-left px-3 py-2 hover:bg-[var(--bg-hover)] text-[var(--ink)] transition-colors flex items-center gap-2"
                                onClick={(e) => { e.stopPropagation(); muteUser(p.id); setSelectedParticipant(null); }}
                              >
                                <MicOff className="w-3.5 h-3.5"/> Mute user
                              </button>
                            )}
                            
                            {isLocalUserOwner && role === 'guest' && (
                              <button 
                                className="w-full text-left px-3 py-2 hover:bg-[var(--bg-hover)] text-[var(--ink)] transition-colors flex items-center gap-2"
                                onClick={(e) => { e.stopPropagation(); promoteUser(p.id); setSelectedParticipant(null); }}
                              >
                                <Shield className="w-3.5 h-3.5 text-blue-400"/> Make Co-host
                              </button>
                            )}

                            {isLocalUserMod && role !== 'owner' && (
                              <button 
                                className="w-full text-left px-3 py-2 hover:bg-[var(--danger-bg)] text-[var(--danger)] transition-colors flex items-center gap-2"
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  if (window.confirm(`Kick ${p.name}?`)) kickUser(p.id); 
                                  setSelectedParticipant(null); 
                                }}
                              >
                                <UserMinus className="w-3.5 h-3.5"/> Kick user
                              </button>
                            )}
                            
                            <button 
                              className="w-full text-left px-3 py-2 hover:bg-[var(--bg-hover)] text-[var(--ink-secondary)] transition-colors flex items-center gap-2"
                              onClick={(e) => { e.stopPropagation(); alert(`Reported ${p.name}`); setSelectedParticipant(null); }}
                            >
                              <Flag className="w-3.5 h-3.5"/> Report
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

      {/* DEVELOPER LIVEKIT CREDENTIALS MODAL */}
      {showDevModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="w-full max-w-md glass rounded-2xl p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[var(--ink)] flex items-center gap-2">
                <Settings className="w-5 h-5 text-[var(--accent)]" /> LiveKit Credentials
              </h3>
              <button 
                onClick={() => setShowDevModal(false)}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition text-[var(--ink-tertiary)] hover:text-[var(--ink)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-[var(--accent-bg)] border border-[var(--accent-glow)] rounded-xl text-xs text-[var(--accent)] leading-normal mb-5">
              Inputting credentials here lets the server call the real LiveKit WebRTC service to generate active meeting rooms and voice channels. 
              <br />
              If you leave these fields empty, Solith works in <strong>Demo Simulator Mode</strong> with simulated speech visualisers and mock partners.
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--ink-secondary)] mb-1.5">LiveKit WebSocket URL</label>
                <input 
                  type="text" 
                  placeholder="wss://your-project.livekit.cloud" 
                  value={livekitUrl}
                  onChange={(e) => setLivekitUrl(e.target.value)}
                  className="w-full text-sm"
                />
                <span className="text-[10px] text-[var(--ink-tertiary)] mt-1 block">Your project's WSS URL</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink-secondary)] mb-1.5">LiveKit API Key</label>
                <input 
                  type="text" 
                  placeholder="e.g. API..." 
                  value={devApiKey}
                  onChange={(e) => setDevApiKey(e.target.value)}
                  className="w-full text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink-secondary)] mb-1.5">LiveKit API Secret</label>
                <input 
                  type="password" 
                  placeholder="e.g. 5ca7...da8b" 
                  value={devApiSecret}
                  onChange={(e) => setDevApiSecret(e.target.value)}
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
      {/* AUTH MODAL */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm glass rounded-2xl p-8 animate-fade-in text-center">
            <h3 className="text-2xl font-serif text-[var(--ink)] mb-2">Join Solith</h3>
            <p className="text-sm text-[var(--ink-secondary)] mb-8">Sign in with Google to create rooms, track your language learning streak, and earn XP.</p>
            <button 
              onClick={handleLogin}
              className="w-full btn-primary py-3 px-6 text-sm flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5 bg-white rounded-full p-1" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </button>
            <button 
              onClick={() => setShowAuthModal(false)}
              className="mt-4 text-[var(--ink-tertiary)] hover:text-[var(--ink)] text-xs uppercase tracking-widest font-bold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* PROFILE MODAL */}
      {showProfileModal && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm glass rounded-2xl p-8 animate-fade-in relative">
            <button 
              onClick={() => setShowProfileModal(false)}
              className="absolute top-4 right-4 text-[var(--ink-secondary)] hover:text-[var(--ink)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex flex-col items-center mt-4">
              <img src={user.photoUrl} alt="Profile" className="w-20 h-20 rounded-full border-4 border-[var(--bg-hover)] shadow-xl mb-4" />
              <h3 className="text-xl font-bold text-[var(--ink)]">{user.name}</h3>
              <p className="text-sm text-[var(--ink-secondary)] mb-6">{user.email}</p>
              
              <div className="w-full grid grid-cols-2 gap-4 mb-8">
                <div className="bg-[var(--bg-hover)] rounded-xl p-4 text-center border border-[var(--line)]">
                  <div className="flex justify-center mb-1"><Flame className="w-5 h-5 text-orange-500" /></div>
                  <div className="text-2xl font-bold text-[var(--ink)]">{user.streak || 0}</div>
                  <div className="text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)]">Day Streak</div>
                </div>
                <div className="bg-[var(--bg-hover)] rounded-xl p-4 text-center border border-[var(--line)]">
                  <div className="flex justify-center mb-1"><Award className="w-5 h-5 text-[var(--accent)]" /></div>
                  <div className="text-2xl font-bold text-[var(--ink)]">{user.xp || 0}</div>
                  <div className="text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)]">Total XP</div>
                </div>
              </div>
              <div className="w-full flex justify-around border-t border-b border-[var(--line)] py-3 mb-6">
                <div className="text-center">
                  <div className="font-bold text-[var(--ink)]">{user.followers?.length || 0}</div>
                  <div className="text-[10px] text-[var(--ink-secondary)] uppercase">Followers</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-[var(--ink)]">{user.following?.length || 0}</div>
                  <div className="text-[10px] text-[var(--ink-secondary)] uppercase">Following</div>
                </div>
              </div>
              
              <button 
                onClick={() => {
                  signOut(auth);
                  setShowProfileModal(false);
                }}
                className="w-full btn-secondary py-2.5 text-sm flex items-center justify-center gap-2 text-red-500 hover:text-red-600 hover:bg-red-500/10 hover:border-red-500/30"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PUBLIC PROFILE MODAL */}
      {showTargetProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm glass rounded-2xl p-8 animate-fade-in relative">
            <button 
              onClick={() => setShowTargetProfileModal(false)}
              className="absolute top-4 right-4 text-[var(--ink-secondary)] hover:text-[var(--ink)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            {profileLoading || !targetProfile ? (
              <div className="flex flex-col items-center justify-center h-48 text-[var(--ink-secondary)] text-sm">
                Loading profile...
              </div>
            ) : (
              <div className="flex flex-col items-center mt-4">
                <img src={targetProfile.photoUrl || ''} alt="Profile" className="w-20 h-20 rounded-full border-4 border-[var(--bg-hover)] shadow-xl mb-4 bg-gray-500" />
                <h3 className="text-xl font-bold text-[var(--ink)] mb-1">{targetProfile.name}</h3>
                <p className="text-xs text-[var(--ink-tertiary)] mb-6">Joined {new Date(targetProfile.createdAt?.seconds * 1000 || Date.now()).toLocaleDateString()}</p>
                
                <div className="w-full grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-[var(--bg-hover)] rounded-xl p-3 text-center border border-[var(--line)]">
                    <div className="flex justify-center mb-1"><Flame className="w-4 h-4 text-orange-500" /></div>
                    <div className="text-lg font-bold text-[var(--ink)]">{targetProfile.streak || 0}</div>
                  </div>
                  <div className="bg-[var(--bg-hover)] rounded-xl p-3 text-center border border-[var(--line)]">
                    <div className="flex justify-center mb-1"><Award className="w-4 h-4 text-[var(--accent)]" /></div>
                    <div className="text-lg font-bold text-[var(--ink)]">{targetProfile.xp || 0}</div>
                  </div>
                </div>

                <div className="w-full flex justify-around border-t border-b border-[var(--line)] py-3 mb-6">
                  <div className="text-center">
                    <div className="font-bold text-[var(--ink)]">{targetProfile.followers?.length || 0}</div>
                    <div className="text-[10px] text-[var(--ink-secondary)] uppercase">Followers</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-[var(--ink)]">{targetProfile.following?.length || 0}</div>
                    <div className="text-[10px] text-[var(--ink-secondary)] uppercase">Following</div>
                  </div>
                </div>
                
                {user && (
                  <button 
                    onClick={toggleFollow}
                    className={`w-full py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition ${
                      user.following?.includes(targetProfile.id) 
                        ? 'btn-secondary text-[var(--ink)]' 
                        : 'btn-primary'
                    }`}
                  >
                    {user.following?.includes(targetProfile.id) ? (
                      <>
                        <UserMinus className="w-4 h-4" /> Unfollow
                      </>
                    ) : (
                      <>
                        <Users className="w-4 h-4" /> Follow
                      </>
                    )}
                  </button>
                )}
                {!user && (
                  <button 
                    onClick={() => { setShowTargetProfileModal(false); setShowAuthModal(true); }}
                    className="w-full btn-primary py-2.5 text-sm font-bold"
                  >
                    Sign in to follow
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </>
  );
}
