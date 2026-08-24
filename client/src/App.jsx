import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import RoomCard from './components/RoomCard';
import Guidelines from './components/Guidelines';
import AdminPanel from './components/AdminPanel';
import ReportModal from './components/ReportModal';
import FollowListModal from './components/FollowListModal';
import MessagesView from './components/MessagesView';
import DirectMessage from './components/DirectMessage';
import Leaderboard from './components/Leaderboard';
import Sidebar from './components/Sidebar';

import StaticModals from './components/StaticModals';
import { 
  Mic, MicOff, LogOut, Flame, Award, Plus, Sparkles, MessageSquare, 
  Send, Users, Globe, Settings, AlertTriangle, ShieldCheck, Search, ChevronRight, X, Volume2, ArrowLeft, ArrowRight, Shield, UserMinus, Flag, AlertCircle, Hand, Coffee, Info, Facebook, Lock, Inbox, MoreVertical, Trophy
} from 'lucide-react';
import { LiveKitService } from './livekit';
import { auth, googleProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, db, doc, setDoc, getDoc, updateDoc, collection, addDoc, getDocs, query, orderBy, where, serverTimestamp, arrayUnion, arrayRemove, setPersistence, inMemoryPersistence, getCountFromServer, onSnapshot } from './firebase';
import socket from './socket';

const getAvatarUrl = (photoUrl, uid) => {
  if (photoUrl && photoUrl.trim() !== '') return photoUrl;
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(uid || 'default')}`;
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const EMOJIS = ['😊', '🦊', '🐼', '🦁', '🚀', '🎮', '🎧', '☕', '🎨', '🍕', '🌍', '🐱', '🥑', '👾', '🦄', '🧙‍♂️'];
const AVATAR_COLORS = ['#ff4d4d', '#ff944d', '#ffd11a', '#4da6ff', '#a64dff', '#ff4da6', '#33cc33', '#33cccc', '#f43f5e', '#8b5cf6'];
const LANGUAGES = ['All Languages', 'English', 'Spanish', 'French', 'German', 'Japanese', 'Chinese', 'Portuguese', 'Korean'];
const GlobalChatView = lazy(() => import('./components/GlobalChatView'));

// XP / Fluency level bands
const getLevelInfo = (xp) => {
  if (xp < 100) return { title: 'A1 Beginner', min: 0, max: 100, level: 1, next: 'A2' };
  if (xp < 300) return { title: 'A2 Elementary', min: 100, max: 300, level: 2, next: 'B1' };
  if (xp < 600) return { title: 'B1 Intermediate', min: 300, max: 600, level: 3, next: 'B2' };
  if (xp < 1000) return { title: 'B2 Upper Intermediate', min: 600, max: 1000, level: 4, next: 'C1' };
  if (xp < 1500) return { title: 'C1 Advanced', min: 1000, max: 1500, level: 5, next: 'C2' };
  return { title: 'C2 Fluent Master 👑', min: 1500, max: 99999, level: 6, next: 'MAX' };
};

const ADMIN_EMAILS = ['ayushfun01@gmail.com', 'hacksejeet@gmail.com', 'ayush.singh.something@klh.edu.in'];



export default function App() {
  // Navigation / Layout state
  const [activeModal, setActiveModal] = useState(null);
  const [user, setUser] = useState(null);
  const isAdmin = user && (user.role === 'admin' || ADMIN_EMAILS.includes(user.email));
  const [view, setView] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    const path = window.location.pathname.replace('/', '');
    const hasSeenLanding = localStorage.getItem('seenLanding');
    
    if (hash && ['admin', 'guidelines', 'messages', 'leaderboard', 'lobby', 'landing'].includes(hash)) return hash;
    if (path && ['admin', 'guidelines', 'messages', 'leaderboard', 'lobby', 'landing'].includes(path)) return path;
    return hasSeenLanding ? 'lobby' : 'landing';
  }); 
  const [activeDm, setActiveDm] = useState(null); // { id: string, profile: object }
  const [msgTab, setMsgTab] = useState('global'); // 'global' or 'direct'
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

  const [authLoading, setAuthLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [targetProfile, setTargetProfile] = useState(null);
  const [showTargetProfileModal, setShowTargetProfileModal] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  
  // Reports
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);

  // Config States
  const [config, setConfig] = useState({ hasApiKey: false, livekitUrl: '' });
  const [rooms, setRooms] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('All Languages');

  // Modals & Panels
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [followListState, setFollowListState] = useState({ isOpen: false, type: 'followers', ids: [], title: '' });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDevModal, setShowDevModal] = useState(false);
  
  // Create Room fields
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomLanguage, setNewRoomLanguage] = useState('English');
  const [newRoomTopic, setNewRoomTopic] = useState('');
  const [newRoomTags, setNewRoomTags] = useState('Casual');
  const [newRoomIsOpenMic, setNewRoomIsOpenMic] = useState(false);
  const [newRoomAccessType, setNewRoomAccessType] = useState('public');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

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
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isRealCall, setIsRealCall] = useState(false);
  const [xpFloater, setXpFloater] = useState(null); // { amount: number, key: number }

  const chatEndRef = useRef(null);

  useEffect(() => {
    const syncViewFromHash = () => {
      const hash = window.location.hash.replace('#', '');
      const path = window.location.pathname.replace('/', '');
      
      if (hash && ['admin', 'guidelines', 'messages', 'leaderboard', 'lobby', 'landing'].includes(hash)) {
        setView(hash);
      } else if (path && ['admin', 'guidelines', 'messages', 'leaderboard', 'lobby', 'landing'].includes(path)) {
        setView(path);
      }
    };

    window.addEventListener('hashchange', syncViewFromHash);
    syncViewFromHash(); // Check on mount
    return () => window.removeEventListener('hashchange', syncViewFromHash);
  }, []);


  // Load configuration and room list on mount
  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return;
    }

    // Catch any errors that happen when returning from a signInWithRedirect
    getRedirectResult(auth).catch((error) => {
      console.error("Redirect login error:", error);
      alert("Redirect login failed: " + error.message);
    });

    let unsubscribeUserSnap = null;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (unsubscribeUserSnap) {
          unsubscribeUserSnap();
          unsubscribeUserSnap = null;
        }

        if (currentUser && !currentUser.isAnonymous) {
          console.log("onAuthStateChanged: Authenticated as", currentUser.email);
          
          // 1. Instantly get the token (cached by Firebase, very fast)
          const token = await currentUser.getIdToken();
          
          const defaultAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentUser.uid)}`;

          // 2. OPTIMISTIC UI UPDATE for lightning-fast perceived performance
          setUser(prev => {
            if (prev && prev.id === currentUser.uid) return prev; // Avoid unnecessary re-renders if already set
            return {
              id: currentUser.uid,
              name: currentUser.displayName || 'Anonymous Learner',
              photoUrl: currentUser.photoURL || defaultAvatar,
              email: currentUser.email,
              xp: 25,
              streak: 1,
              token: token
            };
          });

          // 3. BACKGROUND DATABASE SYNC (Does not block the UI!)
          (async () => {
            try {
              const userRef = doc(db, 'users', currentUser.uid);
              const today = new Date().toDateString();
              const yesterday = new Date(Date.now() - 86400000).toDateString();
              
              const userSnap = await getDoc(userRef);
              let dbData;

              if (userSnap.exists()) {
                dbData = userSnap.data();
                
                // --- Ban check ---
                if (dbData.isBanned) {
                  alert('This account has been banned due to severe community guideline violations.');
                  signOut(auth);
                  return;
                }

                let updates = {};

                if (dbData.lastActiveDay === yesterday) {
                  updates.streak = (dbData.streak || 0) + 1;
                  updates.lastActiveDay = today;
                  dbData.streak = updates.streak;
                  dbData.lastActiveDay = updates.lastActiveDay;
                } else if (dbData.lastActiveDay !== today) {
                  updates.streak = 1;
                  updates.lastActiveDay = today;
                  dbData.streak = 1;
                  dbData.lastActiveDay = today;
                }

                if (currentUser.displayName && (!dbData.name || dbData.name.startsWith('learner_') || dbData.name !== currentUser.displayName)) {
                  updates.name = currentUser.displayName;
                  dbData.name = currentUser.displayName;
                }
                
                if (currentUser.photoURL && dbData.photoUrl !== currentUser.photoURL) {
                  updates.photoUrl = currentUser.photoURL;
                  dbData.photoUrl = currentUser.photoURL;
                } else if (!dbData.photoUrl) {
                  updates.photoUrl = defaultAvatar;
                  dbData.photoUrl = defaultAvatar;
                }
                
                if (currentUser.email === 'ayushsinghe07@gmail.com' && dbData.role !== 'admin') {
                  updates.role = 'admin';
                  dbData.role = 'admin';
                }

                if (Object.keys(updates).length > 0) {
                  await setDoc(userRef, updates, { merge: true });
                }
              } else {
                dbData = {
                  id: currentUser.uid,
                  name: currentUser.displayName || 'Anonymous Learner',
                  photoUrl: currentUser.photoURL || defaultAvatar,
                  email: currentUser.email,
                  role: currentUser.email === 'ayushsinghe07@gmail.com' ? 'admin' : 'user',
                  isPremium: currentUser.email === 'ayushsinghe07@gmail.com',
                  xp: 25,
                  streak: 1,
                  lastActiveDay: today,
                  createdAt: serverTimestamp(),
                  following: [],
                  followers: []
                };
                await setDoc(userRef, dbData);
              }

              // Update the UI with real stats
              setUser(prev => {
                if (!prev || prev.id !== currentUser.uid) return prev;
                return { ...prev, ...dbData, token };
              });

              // Set up realtime listener on current user doc to update following/followers in real-time
              unsubscribeUserSnap = onSnapshot(userRef, (snapshot) => {
                if (snapshot.exists()) {
                  const latestData = snapshot.data();
                  setUser(prev => {
                    if (!prev || prev.id !== currentUser.uid) return prev;
                    return { ...prev, ...latestData, token };
                  });
                }
              });

            } catch (dbError) {
              console.warn("Background DB sync failed! Client is offline or DB is blocked. Using local profile.", dbError.message);
            }
          })(); // IIFE to run in background

        } else {
          if (currentUser && currentUser.isAnonymous) {
            console.warn("Detected old anonymous session. Clearing it out.");
            signOut(auth).catch(e => console.error("Error clearing anonymous session:", e));
          } else {
            setUser(null);
          }
        }
      } catch (err) {
        console.error("Error in onAuthStateChanged:", err);
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubscribeUserSnap) unsubscribeUserSnap();
    };
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
      
      if (error.code === 'auth/popup-blocked') {
        console.warn("Popup blocked by browser. Falling back to signInWithRedirect...");
        // Close the modal to show something is happening before the page redirects
        setShowAuthModal(false);
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectErr) {
          alert("Redirect login failed: " + redirectErr.message);
        }
        return;
      }

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
          
          if (fallbackError.code === 'auth/popup-blocked') {
            console.warn("Popup blocked by browser on fallback. Falling back to signInWithRedirect...");
            setShowAuthModal(false);
            await signInWithRedirect(auth, googleProvider);
            return;
          }

          if (auth.currentUser) {
            console.log("signInWithPopup SUCCESS (Despite Persistence Failure):", auth.currentUser.email);
            // Session saving failed (likely due to strict browser privacy settings), but login succeeded in-memory.
            // Silently proceed without alarming the user.
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
      const res = await fetch(`${API_URL}/api/users/${targetProfile.id}/toggle-follow`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      if (!res.ok) throw new Error('Failed to toggle follow on server');
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
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
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



    return () => {
      clearInterval(pingInterval);
      clearInterval(xpInterval);
    };
  }, [callState, activeRoom, isMuted, participants, isRealCall]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Auto-join room from URL parameter if present
  useEffect(() => {
    if (rooms.length > 0 && user && user.id && callState === 'left' && !activeRoom) {
      const urlParams = new URLSearchParams(window.location.search);
      const roomId = urlParams.get('room');
      
      if (roomId) {
        const roomToJoin = rooms.find(r => r.id === roomId);
        if (roomToJoin) {
          // Join the room
          joinVoiceRoom(roomToJoin);
          
          // Clean up URL to avoid infinite joins on refresh
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    }
  }, [rooms, user, callState, activeRoom]);

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
    if (user?.isRestricted) {
      alert("Your account is temporarily restricted from creating or joining rooms due to community guidelines violations. Pending manual review.");
      return;
    }
    if (!newRoomName || newRoomName.trim().length < 3) {
      alert("Room name must be at least 3 characters.");
      return;
    }
    
    setIsCreatingRoom(true);

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
          tags: tagsArray,
          accessType: newRoomAccessType,
          isOpenMic: newRoomIsOpenMic
        }),
      });

      if (res.status === 429) {
        throw new Error("Too many requests. Please wait a moment and try again.");
      }

      const newRoom = await res.json();
      
      if (!res.ok) {
        throw new Error(newRoom.error || 'Failed to create room');
      }

      setRooms(prev => [...prev, newRoom]);
      setShowCreateModal(false);
      
      // Auto-join newly created room in a new tab
      window.open(`${window.location.origin}/?room=${newRoom.id}`, '_blank', 'noopener,noreferrer');

      // Reset form
      setNewRoomName('');
      setNewRoomTopic('');
      setNewRoomTags('Casual');
    } catch (err) {
      console.error('Error creating room:', err);
      alert(err.message || 'Failed to create new practice room.');
    } finally {
      setIsCreatingRoom(false);
    }
  };

  // Join a room logic
  const joinVoiceRoom = async (room) => {
    if (!user || !user.id) {
      setShowAuthModal(true);
      return;
    }

    if (user?.isRestricted) {
      alert("Your account is temporarily restricted from creating or joining rooms due to community guidelines violations. Pending manual review.");
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
          emoji: user.emoji,
          photoUrl: user.photoUrl
        })
      });

      if (res.status === 429) {
        throw new Error("Too many requests. Please wait a moment and try again.");
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to join room.");
      }

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
      alert(err.message || 'Could not join voice session.');
      setIsMuted(true);
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

  const raiseHand = async () => {
    if (!activeRoom || !user) return;
    try {
      await fetch(`${API_URL}/api/rooms/${activeRoom.id}/raise-hand`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
    } catch (e) { console.error('Raise hand failed', e); }
  };

  const lowerHand = async () => {
    if (!activeRoom || !user) return;
    try {
      await fetch(`${API_URL}/api/rooms/${activeRoom.id}/lower-hand`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
    } catch (e) { console.error('Lower hand failed', e); }
  };

  const allowToSpeak = async (targetUserId) => {
    if (!activeRoom || !user) return;
    try {
      await fetch(`${API_URL}/api/rooms/${activeRoom.id}/allow-speak`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ targetUserId })
      });
    } catch (e) { console.error('Allow speak failed', e); }
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
  const promoteUser = async (targetId, role) => {
    try {
      await fetch(`${API_URL}/api/rooms/${activeRoom.id}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
        body: JSON.stringify({ targetUserId: targetId, role })
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

    const handleQueueUpdated = () => {
      fetchRooms();
    };

    const handleSpeakerAllowed = (data) => {
      fetchRooms();
      if (data.userId === user.id) {
        // Automatically unmute them or just let them know
        alert("The host has allowed you to speak!");
        setIsMuted(false);
        LiveKitService.setLocalAudio(false, isRealCall);
      }
    };

    socket.on('participant-kicked', handleKicked);
    socket.on('participant-muted', handleMuted);
    socket.on('room-deleted', handleDeleted);
    socket.on('role-changed', handleRoleChanged);
    socket.on('queue-updated', handleQueueUpdated);
    socket.on('speaker-allowed', handleSpeakerAllowed);

    return () => {
      socket.off('participant-kicked', handleKicked);
      socket.off('participant-muted', handleMuted);
      socket.off('room-deleted', handleDeleted);
      socket.off('role-changed', handleRoleChanged);
      socket.off('queue-updated', handleQueueUpdated);
      socket.off('speaker-allowed', handleSpeakerAllowed);
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

  const layoutProps = {
    currentView: view,
    setView: (v) => { setView(v); window.location.hash = v; },
    user,
    onAuthClick: () => setShowAuthModal(true),
    onSettingsClick: () => setShowProfileModal(true),
    onLogoutClick: () => signOut(auth),
    isAdmin
  };

    const renderAppLayout = (children) => (
    <div className="layout-container relative min-h-[100dvh] overflow-x-hidden">

      {!activeRoom && <Sidebar {...layoutProps} />}
      <div className="main-content hide-scrollbar z-10 relative">
        {children}
      </div>
      
      {/* MODALS MOVED HERE FOR GLOBAL ACCESS */}
      {/* CREATE ROOM MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/60 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-3xl p-8 animate-fade-in relative bg-bg-base border border-border-color shadow-xl">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl md:text-2xl font-bold text-text-primary flex items-center gap-3">
                <div className="p-2 bg-[var(--accent-primary-bg)] rounded-xl border border-[var(--accent-primary-glow)]">
                  <Plus className="w-5 h-5 text-[var(--accent-primary)]" /> 
                </div>
                Start Practice Lounge
              </h3>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-text-primary/40 hover:text-text-primary transition-colors bg-white/5 hover:bg-white/10 rounded-full p-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-[var(--accent-primary-hover)] mb-2 drop-shadow-sm">Room Title</label>
                <input 
                  type="text" 
                  placeholder="e.g. Intermediate Spanish Chat & Tacos 🌮" 
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full text-sm bg-bg-base/40 border border-white/10 rounded-xl px-4 py-3 text-text-primary placeholder-white/30 focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all shadow-inner"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-[var(--accent-primary-hover)] mb-2 drop-shadow-sm">Language Focus</label>
                  <select 
                    value={newRoomLanguage}
                    onChange={(e) => setNewRoomLanguage(e.target.value)}
                    className="w-full text-sm bg-bg-base/40 border border-white/10 rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-[var(--accent-primary)] transition-all shadow-inner"
                  >
                    {LANGUAGES.slice(1).map(lang => (
                      <option key={lang} value={lang} className="bg-[#1a1c23]">{lang}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-[var(--accent-primary-hover)] mb-2 drop-shadow-sm">Tags (comma separated)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Casual, Debate" 
                    value={newRoomTags}
                    onChange={(e) => setNewRoomTags(e.target.value)}
                    className="w-full text-sm bg-bg-base/40 border border-white/10 rounded-xl px-4 py-3 text-text-primary placeholder-white/30 focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all shadow-inner"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-[var(--accent-primary-hover)] mb-2 drop-shadow-sm">Lounge Description / Topic</label>
                <textarea 
                  placeholder="Give speakers details about what you want to talk about..." 
                  value={newRoomTopic}
                  onChange={(e) => setNewRoomTopic(e.target.value)}
                  className="w-full text-sm h-24 resize-none bg-bg-base/40 border border-white/10 rounded-xl px-4 py-3 text-text-primary placeholder-white/30 focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all shadow-inner"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-[var(--accent-primary-hover)] mb-2 drop-shadow-sm">Privacy</label>
                  <select 
                    value={newRoomAccessType}
                    onChange={(e) => setNewRoomAccessType(e.target.value)}
                    className="w-full text-sm bg-bg-base/40 border border-white/10 rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-[var(--accent-primary)] transition-all shadow-inner"
                  >
                    <option value="public" className="bg-[#1a1c23]">Public (Anyone can join)</option>
                    <option value="friends" className="bg-[#1a1c23]">Friends Only (Followers)</option>
                    <option value="invite" className="bg-[#1a1c23]">Invite Only (Hidden)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-[var(--accent-primary-hover)] mb-2 drop-shadow-sm">Speaking Mode</label>
                  <label className="flex items-center gap-3 w-full bg-bg-base/40 border border-white/10 rounded-xl px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={newRoomIsOpenMic}
                      onChange={(e) => setNewRoomIsOpenMic(e.target.checked)}
                      className="w-4 h-4 accent-[var(--accent-primary)] cursor-pointer"
                    />
                    <span className="text-sm text-text-primary font-medium select-none">Open Mic Mode</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-6 py-3 rounded-xl text-sm font-bold bg-[#121212] border border-white/10 text-text-primary/70 hover:bg-white/10 hover:text-text-primary transition-all shadow-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingRoom}
                  className={`px-6 py-3 rounded-xl text-sm font-bold bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] transition-all flex items-center justify-center min-w-[150px] ${isCreatingRoom ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isCreatingRoom ? 'Launching...' : 'Create & Launch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* USER PROFILE MODAL */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/30 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm glass rounded-2xl p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-1.5">
                <Settings className="w-5 h-5 text-[var(--accent-primary)]" /> Customize Identity
              </h3>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition text-text-secondary hover:text-text-primary"
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
                  <span className="text-xs text-text-secondary">Live Preview</span>
                  <h4 className="text-lg font-bold text-text-primary leading-tight">{user.name || 'Anonymous Learner'}</h4>
                  <span className="text-xs text-[var(--accent-primary)] font-semibold">Native Speaker</span>
                </div>
              </div>

              {/* Name Edit Input */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Nickname</label>
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
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Avatar Icon</label>
                <div className="grid grid-cols-8 gap-2">
                  {EMOJIS.map(em => (
                    <button
                      key={em}
                      onClick={() => setUser(prev => ({ ...prev, emoji: em }))}
                      className={`text-xl p-1 rounded-md hover:bg-[var(--bg-hover)] transition ${
                        user.emoji === em ? 'bg-[var(--accent-primary-bg)] border border-[var(--accent-primary)]' : 'border border-transparent'
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Selector pills */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Background Style</label>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/30 backdrop-blur-sm p-4">
          <div className="w-full max-w-md glass rounded-2xl p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <Settings className="w-5 h-5 text-[var(--accent-primary)]" /> LiveKit Credentials
              </h3>
              <button 
                onClick={() => setShowDevModal(false)}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition text-text-secondary hover:text-text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-[var(--accent-primary-bg)] border border-[var(--accent-primary-glow)] rounded-xl text-xs text-[var(--accent-primary)] leading-normal mb-5">
              Inputting credentials here lets the server call the real LiveKit WebRTC service to generate active meeting rooms and voice channels. 
              <br />
              If you leave these fields empty, Talk34 works in <strong>Demo Simulator Mode</strong> with simulated speech visualisers and mock partners.
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">LiveKit WebSocket URL</label>
                <input 
                  type="text" 
                  placeholder="wss://your-project.livekit.cloud" 
                  value={livekitUrl}
                  onChange={(e) => setLivekitUrl(e.target.value)}
                  className="w-full text-sm"
                />
                <span className="text-[10px] text-text-secondary mt-1 block">Your project's WSS URL</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">LiveKit API Key</label>
                <input 
                  type="text" 
                  placeholder="e.g. API..." 
                  value={devApiKey}
                  onChange={(e) => setDevApiKey(e.target.value)}
                  className="w-full text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">LiveKit API Secret</label>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/30 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm glass rounded-2xl p-8 animate-fade-in text-center">
            <h3 className="text-2xl font-serif text-text-primary mb-2">Join Talk34</h3>
            <p className="text-sm text-text-secondary mb-8">Sign in with Google to create rooms, track your language learning streak, and earn XP.</p>
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
            <p className="mt-6 mb-4 text-[10px] text-text-secondary uppercase tracking-wide">
              By signing in, you agree to our{' '}
              <button onClick={() => { setShowAuthModal(false); setView('guidelines'); }} className="underline hover:text-[var(--accent-primary)]">
                Community Guidelines
              </button>
            </p>
            <button 
              onClick={() => setShowAuthModal(false)}
              className="text-text-secondary hover:text-text-primary text-xs uppercase tracking-widest font-bold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* PROFILE MODAL */}
      {showProfileModal && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/60 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-3xl p-8 animate-fade-in relative bg-bg-base border border-border-color shadow-xl">
            <button 
              onClick={() => setShowProfileModal(false)}
              className="absolute top-4 right-4 text-text-primary/40 hover:text-text-primary transition-colors bg-white/5 hover:bg-white/10 rounded-full p-1.5 z-20"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex flex-col items-center mt-2 relative z-10">
              <div className="relative mb-6">
                
                <img src={getAvatarUrl(user.photoUrl, user.id)} alt="Profile" className="w-24 h-24 rounded-full border-[3px] border-[#221f18] relative z-10 shadow-2xl object-cover" />
                {user.isPremium && (
                  <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-yellow-400 to-yellow-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full border-2 border-[#1a1814] z-20 uppercase tracking-widest shadow-lg">PRO</div>
                )}
              </div>

              <h3 className="text-2xl font-black text-text-primary mb-1">{user.name}</h3>
              <p className="text-xs text-yellow-500/60 mb-8 font-mono">{user.email}</p>
              
              <div className="w-full grid grid-cols-2 gap-4 mb-8">
                <div className="bg-[#1a1c23] rounded-2xl p-4 text-center border border-border-color shadow-inner">
                  <div className="flex justify-center mb-2"><Flame className="w-6 h-6 text-orange-500 fill-orange-500 drop-shadow-[0_0_12px_rgba(249,115,22,0.8)] animate-pulse" /></div>
                  <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">{user.streak || 0}</div>
                  <div className="text-[10px] mt-1 font-bold uppercase tracking-[0.2em] text-orange-500/90 drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]">Day Streak</div>
                </div>
                <div className="bg-[#1a1c23] rounded-2xl p-4 text-center border border-border-color shadow-inner">
                  <div className="flex justify-center mb-2"><Award className="w-5 h-5 text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]" /></div>
                  <div className="text-3xl font-black text-[var(--accent-primary)]">{user.xp || 0}</div>
                  <div className="text-[10px] mt-1 font-bold uppercase tracking-[0.2em] text-yellow-500/60">Total XP</div>
                </div>
              </div>

              <div className="w-full flex justify-around py-4 mb-8 bg-yellow-500/5 rounded-2xl border border-yellow-500/10 shadow-inner">
                <div 
                  className="text-center cursor-pointer hover:scale-110 transition-transform"
                  onClick={() => setFollowListState({ isOpen: true, type: 'followers', ids: user.followers || [], title: 'Followers' })}
                >
                  <div className="font-extrabold text-xl text-yellow-100">{user.followers?.length || 0}</div>
                  <div className="text-[9px] font-bold text-yellow-500/50 uppercase tracking-widest mt-1">Followers</div>
                </div>
                <div className="w-px bg-yellow-500/20"></div>
                <div 
                  className="text-center cursor-pointer hover:scale-110 transition-transform"
                  onClick={() => setFollowListState({ isOpen: true, type: 'following', ids: user.following || [], title: 'Following' })}
                >
                  <div className="font-extrabold text-xl text-yellow-100">{user.following?.length || 0}</div>
                  <div className="text-[9px] font-bold text-yellow-500/50 uppercase tracking-widest mt-1">Following</div>
                </div>
              </div>
              
              <button 
                onClick={() => {
                  signOut(auth);
                  setShowProfileModal(false);
                }}
                className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-[#121212] border border-accent-secondary/20 text-accent-secondary hover:bg-accent-secondary hover:text-text-primary transition-all shadow-lg hover:shadow-accent-secondary/20"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PUBLIC PROFILE MODAL */}
      {showTargetProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/60 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-3xl p-8 animate-fade-in relative bg-bg-base border border-border-color shadow-xl">
            <button 
              onClick={() => setShowTargetProfileModal(false)}
              className="absolute top-4 right-4 text-text-primary/40 hover:text-text-primary transition-colors bg-white/5 hover:bg-white/10 rounded-full p-1.5 z-20"
            >
              <X className="w-5 h-5" />
            </button>
            
            {profileLoading || !targetProfile ? (
              <div className="flex flex-col items-center justify-center h-48 text-yellow-500/50 text-sm font-bold uppercase tracking-widest animate-pulse">
                Loading...
              </div>
            ) : (
              <div className="flex flex-col items-center mt-2 relative z-10">
                <div className="relative mb-6">
                  
                  <img src={getAvatarUrl(targetProfile.photoUrl, targetProfile.id)} alt="Profile" className="w-24 h-24 rounded-full border-[3px] border-[#221f18] relative z-10 shadow-2xl object-cover bg-gray-900" />
                  {targetProfile.isPremium && (
                    <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-yellow-400 to-yellow-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full border-2 border-[#1a1814] z-20 uppercase tracking-widest shadow-lg">PRO</div>
                  )}
                </div>
                
                <h3 className="text-2xl font-black text-text-primary mb-1">{targetProfile.name}</h3>
                <p className="text-xs text-yellow-500/60 mb-8 font-mono">Joined {new Date(targetProfile.createdAt?.seconds * 1000 || Date.now()).toLocaleDateString()}</p>
                
                <div className="w-full grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-[#1a1c23] rounded-2xl p-4 text-center border border-border-color shadow-inner">
                    <div className="flex justify-center mb-2"><Flame className="w-6 h-6 text-orange-500 fill-orange-500 drop-shadow-[0_0_12px_rgba(249,115,22,0.8)] animate-pulse" /></div>
                    <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">{targetProfile.streak || 0}</div>
                    <div className="text-[10px] mt-1 font-bold uppercase tracking-[0.2em] text-orange-500/90 drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]">Day Streak</div>
                  </div>
                  <div className="bg-[#1a1c23] rounded-2xl p-4 text-center border border-border-color shadow-inner">
                    <div className="flex justify-center mb-2"><Award className="w-5 h-5 text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]" /></div>
                    <div className="text-3xl font-black text-[var(--accent-primary)]">{targetProfile.xp || 0}</div>
                    <div className="text-[10px] mt-1 font-bold uppercase tracking-[0.2em] text-yellow-500/60">Total XP</div>
                  </div>
                </div>

                <div className="w-full flex justify-around py-4 mb-8 bg-yellow-500/5 rounded-2xl border border-yellow-500/10 shadow-inner">
                  <div 
                    className="text-center cursor-pointer hover:scale-110 transition-transform"
                    onClick={() => setFollowListState({ isOpen: true, type: 'followers', ids: targetProfile.followers || [], title: `${targetProfile.name.split(' ')[0]}'s Followers` })}
                  >
                    <div className="font-extrabold text-xl text-yellow-100">{targetProfile.followers?.length || 0}</div>
                    <div className="text-[9px] font-bold text-yellow-500/50 uppercase tracking-widest mt-1">Followers</div>
                  </div>
                  <div className="w-px bg-yellow-500/20"></div>
                  <div 
                    className="text-center cursor-pointer hover:scale-110 transition-transform"
                    onClick={() => setFollowListState({ isOpen: true, type: 'following', ids: targetProfile.following || [], title: `${targetProfile.name.split(' ')[0]} is Following` })}
                  >
                    <div className="font-extrabold text-xl text-yellow-100">{targetProfile.following?.length || 0}</div>
                    <div className="text-[9px] font-bold text-yellow-500/50 uppercase tracking-widest mt-1">Following</div>
                  </div>
                </div>
                
                {user && (
                  <button 
                    onClick={toggleFollow}
                    className={`w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
                      user.following?.includes(targetProfile.id) 
                        ? 'bg-[#121212] border border-yellow-500/20 text-yellow-500/80 hover:text-yellow-500 hover:bg-yellow-500/10' 
                        : 'bg-[var(--accent-primary)] text-white hover:scale-[1.02] hover:shadow-[0_0_15px_var(--accent-primary-glow)]'
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
                {user && user.id !== targetProfile.id && (
                  <button 
                    onClick={() => {
                      setShowTargetProfileModal(false);
                      const convoId = user.id < targetProfile.id ? `${user.id}_${targetProfile.id}` : `${targetProfile.id}_${user.id}`;
                      setActiveDm({ id: convoId, profile: targetProfile });
                      setMsgTab('direct');
                      setView('messages');
                      window.location.hash = 'messages';
                    }}
                    className="w-full py-3.5 rounded-xl text-sm font-bold border border-[var(--line-bright)] text-text-primary bg-[var(--bg-elevated)] hover:bg-[var(--bg-secondary)] hover:border-[var(--ink-tertiary)] flex items-center justify-center gap-2 transition-all shadow-sm mt-3"
                  >
                    <MessageSquare className="w-4 h-4" /> Message
                  </button>
                )}
                {!user && (
                  <button 
                    onClick={() => { setShowTargetProfileModal(false); setShowAuthModal(true); }}
                    className="w-full py-3.5 rounded-xl text-sm font-bold bg-[var(--accent-primary)] text-white shadow-lg hover:scale-[1.02]"
                  >
                    Sign in to follow
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* REPORT MODAL */}
      <ReportModal 
        isOpen={showReportModal} 
        onClose={() => { setShowReportModal(false); setReportTarget(null); }} 
        targetUser={reportTarget} 
        currentUser={user}
        roomId={activeRoom ? activeRoom.name : null}
      />

      {/* FOLLOW LIST MODAL */}
      <FollowListModal
        isOpen={followListState.isOpen}
        onClose={() => setFollowListState({ ...followListState, isOpen: false })}
        title={followListState.title}
        ids={followListState.ids}
      />

      <StaticModals 
        activeModal={activeModal} 
        closeModal={() => setActiveModal(null)} 
      />
    </div>
  );

  // RENDER INTERACTIVE LANDING PAGE
  if (view === 'guidelines') {
    return renderAppLayout(<Guidelines onBack={() => { setView('lobby'); window.history.pushState({}, '', '/'); }} />);
  }

  if (view === 'messages') {
    return (
      renderAppLayout(
        <div className="flex flex-col h-[calc(100vh-73px)] bg-bg-base overflow-hidden">
          {/* Header tabs */}
          <div className="flex border-b border-border-color bg-bg-surface px-4 py-2 gap-4 flex-shrink-0">
            <button 
              onClick={() => {
                setActiveDm(null);
                setMsgTab('global');
              }}
              className={`px-4 py-2 font-bold text-sm rounded-xl transition-all ${!activeDm && msgTab === 'global' ? 'bg-[var(--accent-primary)] text-white shadow-[0_0_15px_var(--accent-primary-glow)]' : 'text-text-secondary hover:text-text-primary hover:bg-white/5'}`}
            >
              Global Chat
            </button>
            <button 
              onClick={() => {
                setActiveDm(null);
                setMsgTab('direct');
              }}
              className={`px-4 py-2 font-bold text-sm rounded-xl transition-all ${(activeDm || msgTab === 'direct') ? 'bg-[var(--accent-primary)] text-white shadow-[0_0_15px_var(--accent-primary-glow)]' : 'text-text-secondary hover:text-text-primary hover:bg-white/5'}`}
            >
              Direct Messages
            </button>
          </div>

          <div className="flex-1 min-h-0 relative overflow-hidden">
            {activeDm ? (
              <DirectMessage 
                conversationId={activeDm.id} 
                currentUser={user} 
                targetProfile={activeDm.profile} 
                onBack={() => setActiveDm(null)} 
                openUserProfile={openUserProfile}
              />
            ) : msgTab === 'global' ? (
              <Suspense
                fallback={(
                  <div className="flex min-h-[100dvh] w-full items-center justify-center bg-bg-base text-text-primary">
                    <div className="w-full max-w-2xl rounded-[2rem] border border-border-color bg-bg-base px-6 py-8 shadow-2xl mx-4">
                      <div className="flex items-center gap-3 mb-5">
                        <div className="h-3 w-3 rounded-full bg-[var(--accent-primary)] animate-pulse" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--accent-primary)]">Talk34 Live Chat</span>
                      </div>
                      <div className="h-8 w-48 rounded-full bg-white/5 mb-4" />
                      <div className="space-y-3">
                        <div className="h-28 rounded-3xl border border-border-color bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))]" />
                        <div className="h-16 rounded-3xl border border-border-color bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))]" />
                      </div>
                      <div className="mt-6 h-12 rounded-2xl border border-border-color bg-bg-surface" />
                    </div>
                  </div>
                )}
              >
                <GlobalChatView user={user} onSignIn={() => setShowAuthModal(true)} />
              </Suspense>
            ) : (
              <MessagesView 
                currentUser={user} 
                onOpenConversation={(convoId, profile) => setActiveDm({ id: convoId, profile })} 
              />
            )}
          </div>
        </div>
      )
    );
  }

  if (view === 'leaderboard') {
    return (
      renderAppLayout(
<Leaderboard 
          user={user} 
          onBack={() => { setView('lobby'); window.history.pushState({}, '', '/'); }} 
          openUserProfile={openUserProfile}
        />
)
    );
  }

  if (view === 'admin') {
    if (authLoading) {
      return (
        <div className="min-h-screen bg-bg-base flex items-center justify-center">
          <div className="text-text-primary text-xl animate-pulse">Loading Admin Portal...</div>
        </div>
      );
    }
    if (!user) {
      return (
        <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center p-4">
          <div className="bg-bg-surface border border-red-900/30 p-8 rounded-2xl w-full max-w-md text-center">
            <Shield className="w-12 h-12 text-accent-secondary mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-text-primary mb-2">Admin Portal</h1>
            <p className="text-text-secondary text-sm mb-8">Sign in with an administrator account to continue.</p>
            <button 
              onClick={() => signInWithPopup(auth, googleProvider)}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-text-primary rounded-xl font-bold transition-colors"
            >
              Sign In with Google
            </button>
            <button 
              onClick={() => {
                window.history.pushState({}, '', '/');
                setView('landing');
              }}
              className="w-full py-3 mt-3 text-gray-500 hover:text-text-primary transition-colors text-sm"
            >
              Return to App
            </button>
          </div>
        </div>
      );
    }
    if (!isAdmin) {
      return (
        <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center p-4">
          <div className="bg-bg-surface border border-red-900/30 p-8 rounded-2xl w-full max-w-md text-center">
            <AlertCircle className="w-12 h-12 text-accent-secondary mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-text-primary mb-2">Access Denied</h1>
            <p className="text-text-secondary text-sm mb-6">Your account ({user.email}) does not have administrative privileges.</p>
            <div className="flex gap-4 justify-center">
              <button onClick={() => signOut(auth)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-text-primary rounded-lg text-sm">Sign Out</button>
              <button 
                onClick={() => {
                  window.history.pushState({}, '', '/');
                  setView('landing');
                }} 
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-text-primary rounded-lg text-sm"
              >
                Return to App
              </button>
            </div>
          </div>
        </div>
      );
    }
    return <AdminPanel onBack={() => { window.history.pushState({}, '', '/'); setView('landing'); }} user={user} />;
  }

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
            <path d="M100,95 L100,121" stroke="#111" strokeWidth="2"/>
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

        <div className="absolute bottom-6 left-0 right-0 text-center z-10">
          <button 
            onClick={() => setView('guidelines')}
            className="text-xs text-text-secondary hover:text-text-primary transition-colors opacity-70 hover:opacity-100"
          >
            Community Guidelines
          </button>
        </div>
      </div>
      </>
    );
  }
  // RENDER MAIN LOBBY DASHBOARD
  return (
    renderAppLayout(
      <>
<div className={activeRoom ? 'hidden' : "w-full pb-28 flex flex-col items-center min-h-screen"}>
        {/* Global Header */}
        <header className="w-full flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3.5 bg-bg-base/95 backdrop-blur-md sticky top-0 z-30 border-b border-border-color">
          
          {/* Left: Actions */}
          <div className="flex-1 flex items-center justify-start gap-3">
            <button 
              onClick={() => { if(user) setShowCreateModal(true); else setShowAuthModal(true); }}
              className="px-4 py-2 bg-[var(--accent-primary)] text-white font-bold rounded-xl text-xs sm:text-[13px] flex items-center gap-2 hover:bg-[var(--accent-primary-hover)] transition-all shadow-[0_4px_20px_var(--accent-primary-glow)] hover:scale-105 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Start a Room</span><span className="sm:hidden">Start</span>
            </button>
            <button 
              onClick={() => window.open('https://buymeacoffee.com', '_blank')}
              className="hidden lg:flex px-3.5 py-2 bg-[#FFDD00]/10 border border-[#FFDD00]/30 text-[#FFDD00] font-bold rounded-xl text-[13px] items-center gap-2 hover:bg-[#FFDD00]/20 transition-all hover:scale-105 whitespace-nowrap"
              title="Buy me a coffee"
            >
              <Coffee className="w-4 h-4 text-[#FFDD00]" />
              Buy Coffee
            </button>
          </div>

          {/* Center: Brand Identity */}
          <div className="flex-shrink-0 flex items-center justify-center">
            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setView('lobby')}>
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center select-none">
                solith
                <span className="text-[var(--accent-primary)] font-bold flex items-center">
                  .
                  <span className="relative inline-block mx-[1px]">
                    <span className="opacity-0">i</span>
                    <span className="absolute inset-0 flex justify-center">
                      <span className="absolute bottom-0 leading-none">ı</span>
                      <span className="absolute bottom-[60%] sm:bottom-[65%] w-[12px] h-[12px] sm:w-[15px] sm:h-[15px] rounded-full overflow-hidden bg-white shadow-sm pointer-events-none z-10 border border-[var(--accent-primary)]/20">
                        <video src="/freevideo2.mp4" autoPlay loop muted playsInline className="w-full h-full object-cover scale-[1.1]" />
                      </span>
                    </span>
                  </span>
                  n
                </span>
              </span>
            </div>
          </div>

          {/* Right: Controls & User */}
          <div className="flex-1 flex items-center justify-end gap-3 sm:gap-6">
            
            {/* More Dropdown */}
            <div className="relative group">
              <button className="text-text-secondary hover:text-text-primary p-2 rounded-xl transition-colors hidden sm:block">
                <MoreVertical className="w-5 h-5" />
              </button>
              <div className="absolute right-0 top-full mt-2 w-48 bg-bg-surface-elevated border border-border-color rounded-xl shadow-xl opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-all flex flex-col p-2 z-50">
                <button className="text-left px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg flex items-center gap-2" onClick={() => setActiveModal('privacy')}><Shield className="w-4 h-4"/> Privacy Policy</button>
                <button className="text-left px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg flex items-center gap-2" onClick={() => setActiveModal('contact')}><MessageSquare className="w-4 h-4"/> Contact Us</button>
                <button className="text-left px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg flex items-center gap-2" onClick={() => setActiveModal('about')}><Info className="w-4 h-4"/> About Us</button>
                <button className="text-left px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg flex items-center gap-2" onClick={() => window.open('https://facebook.com', '_blank')}><Facebook className="w-4 h-4"/> Facebook Group</button>
              </div>
            </div>

            {user ? (
              <>
                {/* Level / XP */}
                <div className="hidden lg:flex items-center gap-2 text-[15px] font-mono text-text-secondary">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]"></div>
                  <span className="text-text-primary font-bold">{levelInfo ? levelInfo.level : 11}</span>
                  <span>/</span>
                  <span>{user.xp ? user.xp.toLocaleString() : '6,470'}</span>
                </div>
                
                {/* Inbox Icon */}
                <button 
                  onClick={() => {
                    setView('messages');
                    setMsgTab('direct');
                    setActiveDm(null);
                    window.location.hash = 'messages';
                  }}
                  className="relative text-text-secondary hover:text-text-primary transition-colors hidden sm:block"
                >
                  <Inbox className="w-6 h-6" />
                  <span className="absolute -top-2 -right-2 w-5 h-5 bg-accent-secondary rounded-md text-[11px] font-bold text-text-primary flex items-center justify-center">5</span>
                </button>

                {/* Avatar */}
                <img 
                  src={getAvatarUrl(user.photoUrl, user.id)} 
                  alt="Profile" 
                  className="w-10 h-10 rounded-full cursor-pointer border-2 border-border-color hover:border-[var(--accent-primary)] transition-all object-cover" 
                  onClick={() => setShowProfileModal(true)} 
                />
              </>
            ) : (
              <button 
                onClick={() => setShowAuthModal(true)}
                className="px-5 py-2.5 text-xs font-bold bg-[var(--accent-primary)] text-white rounded-xl hover:bg-[var(--accent-primary-hover)] transition-colors shadow-[0_0_15px_var(--accent-primary-glow)] z-40 relative"
              >
                Sign In
              </button>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <div className="w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 py-16 flex flex-col items-center gap-8 relative">
          
          {/* Main Hero Video Banner */}
          <div className="w-full relative rounded-2xl border border-border-color overflow-hidden shadow-2xl flex flex-col items-center justify-center bg-black group">
            <video 
              src="/freevideo.mp4" 
              autoPlay 
              loop 
              muted 
              playsInline 
              className="w-full h-[220px] sm:h-[320px] lg:h-[400px] object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-base)] via-[var(--bg-base)]/10 to-transparent pointer-events-none"></div>
            <div className="absolute bottom-6 left-0 right-0 text-center z-10 px-4 pointer-events-none">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight mb-2 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">Practice languages live on solith.in</h2>
              <p className="text-sm sm:text-base text-white/90 max-w-lg mx-auto leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] font-medium">
                Join live voice rooms, talk with native speakers, and improve your pronunciation in real-time.
              </p>
            </div>
          </div>

          {/* Full Width Search Row */}
          <div className="w-full flex flex-row items-center gap-2 md:gap-4 bg-bg-base/60 backdrop-blur-md p-2 rounded-2xl border border-white/10 shadow-2xl overflow-hidden focus-within:border-[var(--accent-primary)] focus-within:bg-bg-base transition-all">
            <div className="relative flex-1 min-w-0 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary group-focus-within:text-[var(--accent-primary)] transition-colors" />
              <input 
                type="text" 
                placeholder="Search rooms or languages..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full py-3 md:py-4 pl-12 pr-4 text-[14px] md:text-[15px] bg-transparent focus:outline-none text-text-primary placeholder:text-text-secondary border-none shadow-none font-medium"
              />
            </div>
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="p-2 text-text-secondary hover:text-white transition-colors"
              >
                Clear
              </button>
            )}
            <button className="px-4 md:px-6 py-3 bg-[var(--accent-primary)] text-white text-[13px] md:text-sm font-bold rounded-xl hover:bg-[var(--accent-primary-hover)] transition-colors flex items-center gap-2 flex-shrink-0 shadow-[0_0_15px_rgba(24,119,242,0.3)]">
              <Search className="w-4 h-4" /> <span className="hidden md:inline">Search</span>
            </button>
            <div className="hidden lg:flex items-center gap-2 border-l border-white/10 pl-4 text-text-secondary text-xs font-semibold px-2">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e] animate-pulse"></span> 
                {rooms.length} Active Rooms
              </span>
            </div>
            <div className="hidden md:flex items-center gap-2 border-l border-white/10 pl-4">
              <button 
                onClick={() => setView('leaderboard')}
                className="p-2 md:p-2.5 text-text-secondary hover:text-[var(--accent-primary)] bg-transparent hover:bg-white/5 rounded-lg transition-all"
                title="Leaderboard"
              >
                <Trophy className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6 flex items-center gap-3 overflow-x-auto hide-scrollbar animate-slide-up-delayed-2">
          {LANGUAGES.map(lang => (
            <button
              key={lang}
              onClick={() => setSelectedLanguage(lang)}
              className={`filter-pill text-[11px] uppercase tracking-wider font-bold whitespace-nowrap ${
                selectedLanguage === lang ? 'active' : ''
              }`}
            >
              {lang}
            </button>
          ))}
        </div>

        {/* Rooms Grid */}
        <div className="w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 pb-16 animate-slide-up-delayed-2">
          {filteredRooms.length === 0 ? (
            <div className="py-16 mt-4 flex flex-col items-center justify-center text-center rounded-2xl border border-border-color bg-bg-surface/60 backdrop-blur-md relative overflow-hidden max-w-2xl mx-auto w-full p-8 shadow-2xl">
              {/* Radial glow background */}
              <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-[var(--accent-primary)]/15 rounded-full blur-3xl pointer-events-none"></div>
              
              <h3 className="text-2xl md:text-3xl font-extrabold text-text-primary mb-2 tracking-tight">No active rooms right now</h3>
              <p className="text-sm text-text-secondary mb-8 max-w-md leading-relaxed">
                Be the first to initiate a room on <span className="text-[var(--accent-primary)] font-bold">solith.in</span> and connect live with language learners worldwide!
              </p>
              
              <button 
                onClick={() => user ? setShowCreateModal(true) : setShowAuthModal(true)}
                className="px-8 py-3.5 bg-[var(--accent-primary)] text-white font-bold rounded-xl text-sm flex items-center gap-2.5 hover:bg-[var(--accent-primary-hover)] transition-all shadow-[0_0_25px_var(--accent-primary-glow)] hover:scale-105"
              >
                <Plus className="w-5 h-5" /> Start a Room Now
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
      </div>

      {/* Full-Screen Active Room Redesign */}
      {(() => {
        if (!activeRoom) return null;
        
        const currentRoomData = rooms.find(r => r.id === activeRoom.id) || activeRoom;
        const speakingQueue = currentRoomData.speakingQueue || [];
        const allowedSpeakers = currentRoomData.allowedSpeakers || [];
        const isOpenMic = currentRoomData.isOpenMic;
        const myRole = getRole(user?.id);
        const isHostOrCoHost = myRole === 'owner' || myRole === 'co-host';
        const isAllowedSpeaker = allowedSpeakers.includes(user?.id);
        const isListener = !isHostOrCoHost && !isAllowedSpeaker && !isOpenMic;
        const hasRaisedHand = speakingQueue.includes(user?.id);

        return (
        <div className="call-room-bg font-sans animate-fade-in fixed inset-0 bg-bg-base flex flex-col z-50 overflow-hidden">
          
          {/* Top Floating Control Bar */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex max-w-[calc(100vw-1rem)] flex-wrap items-center justify-center gap-2 bg-bg-surface/90 backdrop-blur-md rounded-2xl p-2 border border-white/5 shadow-2xl">
             <div className="px-3 border-r border-white/10 flex items-center gap-2 text-text-primary/50 text-xs font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-secondary animate-pulse"></span>
                12:47
             </div>
             {/* Left - Raise Hand Button (Optional for everyone) */}
             <button onClick={hasRaisedHand ? lowerHand : raiseHand} className="p-2 bg-[var(--accent-primary)]/10 hover:bg-[var(--accent-primary)]/20 rounded-xl flex items-center gap-2 text-xs font-bold text-[var(--accent-primary)] transition-colors">
               <Hand className="w-4 h-4"/> {hasRaisedHand ? 'Lower' : 'Raise'}
             </button>

             {/* Center - Mute Button (Always available in Free4Talk) */}
             <button onClick={toggleMute} className={`p-2 rounded-xl transition-colors ${isMuted ? 'bg-accent-secondary text-text-primary' : 'bg-[#2a2d36] text-text-primary hover:bg-white/20'}`} title={isMuted ? "Unmute Mic" : "Mute Mic"}>
                 {isMuted ? <MicOff className="w-4 h-4"/> : <Mic className="w-4 h-4"/>}
             </button>
             <button onClick={toggleScreenShare} className={`p-2 rounded-xl transition-colors ${isScreenSharing ? 'bg-accent-secondary text-text-primary' : 'bg-[#2a2d36] text-text-primary hover:bg-white/20'}`} title={isScreenSharing ? "Stop Screen Share" : "Share Screen"}>
                 <Monitor className="w-4 h-4"/>
             </button>
             <button onClick={() => setShowSettingsModal(true)} className="p-2 rounded-xl bg-[#2a2d36] text-text-primary hover:bg-white/20 transition-colors" title="Settings"><Settings className="w-4 h-4"/></button>
             <button onClick={leaveVoiceRoom} className="p-2 rounded-xl bg-accent-secondary text-text-primary hover:bg-accent-secondary-hover transition-colors ml-2" title="Leave Room"><LogOut className="w-4 h-4"/></button>
          </div>

          {/* Participant Grid / Presenter View */}
          {(() => {
            const screenSharingParticipant = participants.find(p => p.isScreenSharing);
            
            if (screenSharingParticipant) {
              return (
                <div className="flex flex-col lg:flex-row flex-1 w-full h-full p-4 md:p-8 pt-24 pb-32 gap-6 overflow-hidden">
                  {/* Large Screen Share Viewer */}
                  <div className="flex-1 flex flex-col bg-bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-2xl relative min-h-[300px]">
                    <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 text-xs text-text-primary">
                      <Monitor className="w-3.5 h-3.5 text-[var(--accent-primary)] animate-pulse" />
                      <span>{screenSharingParticipant.isLocal ? 'Your Screen' : `${screenSharingParticipant.name}'s Screen`}</span>
                    </div>
                    <div className="flex-1 w-full h-full flex items-center justify-center p-2 bg-black">
                      {isRealCall ? (
                        screenSharingParticipant.screenShareTrack ? (
                          <VideoTrack track={screenSharingParticipant.screenShareTrack} />
                        ) : (
                          <div className="text-text-primary/40 text-sm flex flex-col items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-accent-secondary animate-ping"></span>
                            Connecting screen share stream...
                          </div>
                        )
                      ) : (
                        <video src="/freevideo.mp4" autoPlay loop muted className="w-full h-full object-contain rounded-2xl bg-black" />
                      )}
                    </div>
                  </div>
                  {/* Side Participant Grid */}
                  <div className="w-full lg:w-[240px] flex lg:flex-col gap-4 overflow-x-auto lg:overflow-y-auto lg:overflow-x-hidden hide-scrollbar py-2 justify-start items-center">
                    {participants.map(p => {
                        const isSpeaking = (audioLevels[p.id] || 0) > 0.05;
                        const backendP = currentRoomData.participants?.find(bp => bp.id === p.id);
                        const pPhotoUrl = getAvatarUrl(p.isLocal ? user?.photoUrl : (backendP?.photoUrl || p.photoUrl), p.id);
                        const pEmoji = p.isLocal ? (user?.emoji || '👤') : (backendP?.emoji || p.emoji || '👤');
                        const pColor = p.isLocal ? (user?.color || '#0d94a8') : (backendP?.color || p.color || '#ff4d4d');
                        const pName = p.isLocal ? 'You' : (backendP?.name || p.name);
                        const targetRole = getRole(p.id);
                        
                        return (
                            <div key={p.id} onClick={() => !p.isLocal && setSelectedParticipant(selectedParticipant === p.id ? null : p.id)} className={`relative flex flex-col items-center justify-center aspect-square w-[100px] h-[100px] lg:w-[160px] lg:h-[160px] rounded-2xl overflow-hidden bg-bg-surface border-2 transition-all duration-300 ${isSpeaking ? 'border-[var(--accent-primary)] shadow-[0_0_15px_var(--accent-primary-glow)]' : 'border-transparent'} cursor-pointer hover:scale-[1.02] flex-shrink-0`} style={{ backgroundColor: pColor }}>
                               {pPhotoUrl ? <img src={pPhotoUrl} className="w-full h-full object-cover" alt="" /> : <span className="text-3xl lg:text-5xl">{pEmoji}</span>}
                               
                               <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent pt-4 pb-1 px-2 text-center">
                                  <span className="text-text-primary text-[10px] lg:text-xs font-bold drop-shadow-md truncate block">{pName}</span>
                               </div>

                               {p.muted && (
                                  <div className="absolute top-2 right-2 w-5 h-5 lg:w-7 lg:h-7 bg-bg-base/60 backdrop-blur-md rounded-full flex items-center justify-center">
                                    <MicOff className="w-2.5 h-2.5 lg:w-3.5 lg:h-3.5 text-red-400" />
                                  </div>
                                )}

                               {selectedParticipant === p.id && !p.isLocal && (
                                    <div className="absolute inset-0 bg-bg-base/80 backdrop-blur-md z-50 flex flex-col items-center justify-center p-2 lg:p-4 text-[10px] lg:text-xs animate-fade-in gap-1 lg:gap-2">
                                      <button onClick={(e) => { e.stopPropagation(); openUserProfile(p.id); setSelectedParticipant(null); }} className="w-full text-center py-1 lg:py-2 bg-white/10 hover:bg-white/20 text-text-primary rounded-xl transition-colors">Profile</button>
                                      {canPromote && targetRole !== 'owner' && (
                                        <button onClick={(e) => { e.stopPropagation(); promoteUser(p.id, 'co-owner'); setSelectedParticipant(null); }} className="w-full text-center py-1 lg:py-2 bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 rounded-xl transition-colors">Make Co-Owner</button>
                                      )}
                                      {canModTarget && (
                                        <button onClick={(e) => { e.stopPropagation(); muteUser(p.id); setSelectedParticipant(null); }} className="w-full text-center py-1 lg:py-2 bg-red-500/20 hover:bg-red-500/40 text-red-300 rounded-xl transition-colors">Mute</button>
                                      )}
                                    </div>
                               )}
                            </div>
                        );
                    })}
                  </div>
                </div>
              );
            }

            return (
              <div className="flex-1 w-full h-full p-4 md:p-8 pt-24 pb-32 overflow-y-auto overflow-x-hidden hide-scrollbar flex items-center justify-center">
                 <div className="flex flex-wrap gap-4 md:gap-6 w-full max-w-6xl mx-auto items-center justify-center">
                    {participants.map(p => {
                        const isSpeaking = (audioLevels[p.id] || 0) > 0.05;
                        const backendP = currentRoomData.participants?.find(bp => bp.id === p.id);
                        const pPhotoUrl = getAvatarUrl(p.isLocal ? user?.photoUrl : (backendP?.photoUrl || p.photoUrl), p.id);
                        const pEmoji = p.isLocal ? (user?.emoji || '👤') : (backendP?.emoji || p.emoji || '👤');
                        const pColor = p.isLocal ? (user?.color || '#0d94a8') : (backendP?.color || p.color || '#ff4d4d');
                        const pName = p.isLocal ? 'You' : (backendP?.name || p.name);
                        const targetRole = getRole(p.id);
                        
                        let canModTarget = false;
                        if (myRole === 'owner' && targetRole !== 'owner') canModTarget = true;
                        if (myRole === 'co-owner' && (targetRole === 'elder' || targetRole === 'member' || targetRole === 'guest')) canModTarget = true;
                        const canPromote = myRole === 'owner';

                        return (
                            <div key={p.id} onClick={() => !p.isLocal && setSelectedParticipant(selectedParticipant === p.id ? null : p.id)} className={`relative flex flex-col items-center justify-center aspect-square w-[160px] h-[160px] md:w-[220px] md:h-[220px] rounded-3xl overflow-hidden bg-bg-surface border-4 transition-all duration-300 ${isSpeaking ? 'border-[var(--accent-primary)] shadow-[0_0_25px_var(--accent-primary-glow)]' : 'border-transparent'} cursor-pointer hover:scale-[1.02] flex-shrink-0`} style={{ backgroundColor: pColor }}>
                               {pPhotoUrl ? <img src={pPhotoUrl} className="w-full h-full object-cover" alt="" /> : <span className="text-6xl">{pEmoji}</span>}
                               
                               <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent pt-6 pb-2 px-3 text-center">
                                  <span className="text-text-primary text-xs font-bold drop-shadow-md truncate block">{pName}</span>
                                  {targetRole === 'owner' && <span className="text-[9px] text-[var(--accent-primary)] font-black uppercase tracking-wider block mt-0.5">Owner</span>}
                               </div>

                               {p.muted && (
                                  <div className="absolute top-3 right-3 w-7 h-7 bg-bg-base/60 backdrop-blur-md rounded-full flex items-center justify-center">
                                    <MicOff className="w-3.5 h-3.5 text-red-400" />
                                  </div>
                               )}

                               {selectedParticipant === p.id && !p.isLocal && (
                                    <div className="absolute inset-0 bg-bg-base/80 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4 text-xs animate-fade-in gap-2">
                                      <button onClick={(e) => { e.stopPropagation(); openUserProfile(p.id); setSelectedParticipant(null); }} className="w-full text-center py-2 bg-white/10 hover:bg-white/20 text-text-primary rounded-xl transition-colors">Profile</button>
                                      {canPromote && targetRole !== 'owner' && (
                                        <button onClick={(e) => { e.stopPropagation(); promoteUser(p.id, 'co-owner'); setSelectedParticipant(null); }} className="w-full text-center py-2 bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 rounded-xl transition-colors">Make Co-Owner</button>
                                      )}
                                      {canModTarget && (
                                        <button onClick={(e) => { e.stopPropagation(); muteUser(p.id); setSelectedParticipant(null); }} className="w-full text-center py-2 bg-red-500/20 hover:bg-red-500/40 text-red-300 rounded-xl transition-colors">Mute</button>
                                      )}
                                    </div>
                               )}
                            </div>
                        );
                    })}
                 </div>
              </div>
            );
          })()}

          {/* Chat Overlay (Hidden by Default) */}
          {isChatOpen && (
             <div className="absolute bottom-[90px] left-4 right-4 md:left-auto md:right-8 md:w-[380px] h-[400px] max-h-[50vh] bg-bg-base/95 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl z-40 flex flex-col animate-fade-in">
                <div className="px-5 py-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
                  <span className="font-bold text-sm tracking-widest text-text-primary uppercase">Room Chat</span>
                  <button onClick={() => setIsChatOpen(false)} className="text-text-primary/50 hover:text-text-primary p-1 rounded-full"><X className="w-4 h-4"/></button>
                </div>
                <div className="flex-1 flex flex-col gap-3 p-4 overflow-y-auto" id="chat-container">
                  {chatMessages.length === 0 && (
                    <div className="text-center text-text-primary/30 text-xs italic mb-4">Messages are ephemeral and disappear when you leave.</div>
                  )}
                  {chatMessages.map(msg => (
                    <div key={msg.id} className={`flex gap-3 w-full items-end ${msg.senderId === user?.id ? 'justify-end' : 'justify-start'}`}>
                      {msg.senderId !== user?.id && (
                         <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] shadow-md flex-shrink-0" style={{ backgroundColor: msg.senderColor }}>
                           {msg.senderEmoji || '👤'}
                         </div>
                      )}
                      <div className={msg.senderId === user?.id ? 'chat-bubble-right bg-[var(--accent-primary-bg)] text-[var(--accent-primary)] rounded-2xl rounded-br-sm px-3 py-2 text-sm max-w-[80%]' : 'chat-bubble-left bg-white/10 text-text-primary rounded-2xl rounded-bl-sm px-3 py-2 text-sm max-w-[80%]'}>
                        <span className="font-bold block text-[10px] opacity-50 mb-0.5">{msg.senderName}</span>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
             </div>
          )}

          {/* Bottom Floating App Bar */}
          <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 bg-bg-surface/90 backdrop-blur-md rounded-3xl px-2 py-2 border border-white/5 shadow-2xl flex items-center gap-2 z-50 w-[calc(100%-1rem)] md:w-auto md:min-w-[400px] justify-between md:justify-center">
             
             {/* Left - Room Info */}
             <div className="flex items-center gap-2 px-3 flex-shrink-0">
               <div className="w-8 h-8 rounded-full bg-[var(--accent-primary)]/20 flex items-center justify-center text-[var(--accent-primary)]">
                 <Users className="w-4 h-4"/>
               </div>
               <div className="flex flex-col hidden md:flex">
                 <span className="text-xs font-bold text-text-primary tracking-wide truncate max-w-[120px]">{activeRoom.name}</span>
                 <span className="text-[9px] text-[var(--accent-primary)] font-mono uppercase">{participants.length} connected</span>
               </div>
             </div>

             <div className="w-px h-8 bg-white/10 mx-1 hidden md:block"></div>

             {/* Center - Action Buttons */}
             <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => setIsChatOpen(!isChatOpen)} className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isChatOpen ? 'bg-white/20 text-text-primary' : 'bg-transparent text-text-primary/50 hover:bg-white/10 hover:text-text-primary'}`}>
                  <MessageSquare className="w-5 h-5"/>
                  {chatMessages.length > 0 && !isChatOpen && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-accent-secondary rounded-full border border-bg-surface"></span>}
                </button>
             </div>

             <div className="w-px h-8 bg-white/10 mx-1"></div>

             {/* Right - Chat Input */}
             <form onSubmit={(e) => { e.preventDefault(); setIsChatOpen(true); sendChatMessage(e); }} className="flex-1 min-w-[120px] max-w-[200px] flex bg-white/5 rounded-full p-1 items-center border border-white/5 focus-within:border-[var(--accent-primary)] transition-colors">
                <input type="text" placeholder="Send message..." value={chatInput} onChange={e => setChatInput(e.target.value)} onClick={() => setIsChatOpen(true)} className="flex-1 bg-transparent border-none text-text-primary text-xs outline-none shadow-none px-3 w-full placeholder:text-text-primary/30" />
                <button type="submit" className="w-8 h-8 rounded-full bg-[var(--accent-primary)]/80 hover:bg-[var(--accent-primary)] transition-colors flex items-center justify-center text-white shadow-md flex-shrink-0"><Send className="w-3.5 h-3.5 ml-0.5"/></button>
             </form>
          </div>

        </div>
        );      })()}
      </>
)
  );
}
