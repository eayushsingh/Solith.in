// Solith.in - Premium Language Learning Platform
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
import CommunityFeed from './components/CommunityFeed';
import PremiumSubscription from './components/PremiumSubscription';
import RoomPanel from './components/RoomPanel';
import SocialUserRow from './components/SocialUserRow';

import StaticModals from './components/StaticModals';
import {
  Mic, MicOff, LogOut, Flame, Award, Plus, Sparkles, MessageSquare, Camera,
  Send, Users, Globe, Settings, AlertTriangle, ShieldCheck, Search, ChevronRight, X, Volume2, ArrowLeft, ArrowRight, Shield, UserMinus, Flag, AlertCircle, Hand, Coffee, Info, Facebook, Lock, Inbox, MoreVertical, Trophy,
  Monitor, Youtube, Gamepad2, Crown, BarChart2, PhoneCall
} from 'lucide-react';
import GameContainer from './components/games/GameContainer';
import GameLobby from './components/games/GameLobby';
import GameSelector from './components/games/GameSelector';
import ScrabbleGame from './components/games/ScrabbleGame';
import { LiveKitService } from './livekit';
import { auth, googleProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, db, doc, setDoc, getDoc, updateDoc, collection, addDoc, getDocs, query, orderBy, where, serverTimestamp, arrayUnion, arrayRemove, setPersistence, inMemoryPersistence, getCountFromServer, onSnapshot } from './firebase';
import socket from './socket';

const getAvatarUrl = (photoUrl, uid) => {
  if (photoUrl && photoUrl.trim() !== '') return photoUrl;
  return `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(uid || 'default')}`;
};

const getYoutubeId = (url) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const EMOJIS = ['😊', '🦊', '🐼', '🦁', '🚀', '🎮', '🎧', '☕', '🎨', '🍕', '🌍', '🐱', '🥑', '👾', '🦄', '🧙‍♂️'];
const AVATAR_COLORS = ['#ff4d4d', '#ff944d', '#ffd11a', '#4da6ff', '#a64dff', '#ff4da6', '#33cc33', '#33cccc', '#f43f5e', '#8b5cf6'];
const LANGUAGES = [
  'All Languages', 'English', 'Spanish', 'French', 'German', 'Japanese',
  'Chinese', 'Portuguese', 'Korean', 'Hindi', 'Arabic', 'Russian',
  'Bengali', 'Indonesian', 'Vietnamese', 'Urdu', 'Tamil',
  'Telugu', 'Marathi', 'Uzbek', 'Turkish'
];
// A smart lazy loader that refreshes the page if a chunk fails to load (e.g. after a new deployment)
const lazyWithRetry = (componentImport) =>
  lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem('page-has-been-force-refreshed') || 'false'
    );
    try {
      const component = await componentImport();
      window.sessionStorage.setItem('page-has-been-force-refreshed', 'false');
      return component;
    } catch (error) {
      if (!pageHasAlreadyBeenForceRefreshed) {
        window.sessionStorage.setItem('page-has-been-force-refreshed', 'true');
        window.location.reload();
        return new Promise(() => { }); // Wait for reload
      }
      throw error;
    }
  });

const GlobalChatView = React.lazy(() =>
  import('./components/GlobalChatView').catch(() => ({
    default: () => <div style={{color:'white',padding:20}}>Chat unavailable</div>
  }))
);
// XP / Fluency level bands
const getLevelInfo = (xp) => {
  if (xp < 100) return { title: 'A1 Beginner', min: 0, max: 100, level: 1, next: 'A2' };
  if (xp < 300) return { title: 'A2 Elementary', min: 100, max: 300, level: 2, next: 'B1' };
  if (xp < 600) return { title: 'B1 Intermediate', min: 300, max: 600, level: 3, next: 'B2' };
  if (xp < 1000) return { title: 'B2 Upper Intermediate', min: 600, max: 1000, level: 4, next: 'C1' };
  if (xp < 1500) return { title: 'C1 Advanced', min: 1000, max: 1500, level: 5, next: 'C2' };
  return { title: 'C2 Fluent Master 👑', min: 1500, max: 99999, level: 6, next: 'MAX' };
};

const ADMIN_EMAILS = [
  'ayushfun01@gmail.com',
  'hacksejeet@gmail.com',
  'ayush.singh.something@klh.edu.in',
  'ayushsinghe07@gmail.com'
];

const VideoTrack = ({ track, className = "w-full h-full object-contain rounded-2xl bg-black" }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (track && ref.current) {
      track.attach(ref.current);
      return () => {
        track.detach(ref.current);
      };
    }
  }, [track]);
  return <video ref={ref} autoPlay playsInline className={className} />;
};

export default function App() {
  // Navigation / Layout state
  const [activeModal, setActiveModal] = useState(null);
  const [user, setUser] = useState(null);
  const isAdmin = user && (
    user.role === 'admin' ||
    ADMIN_EMAILS.includes(user.email)
  );
  const [view, setView] = useState('lobby');
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
  const [platformSettings, setPlatformSettings] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/settings/public`)
      .then(res => res.json())
      .then(data => setPlatformSettings(data))
      .catch(err => console.error('Failed to fetch settings:', err));
  }, []);
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
  const [showSocialPanel, setShowSocialPanel] = useState(false);
  const [showStreakCard, setShowStreakCard] = useState(false);
  const [socialTab, setSocialTab] = useState('All');
  const [allSocialUsers, setAllSocialUsers] = useState([]);
  const [socialSearch, setSocialSearch] = useState('');
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
  const [roomJoinTime, setRoomJoinTime] = useState(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [ytVideoId, setYtVideoId] = useState(null);
  const [ytSharingUser, setYtSharingUser] = useState(null);
  const [showYtModal, setShowYtModal] = useState(false);
  const [ytUrlInput, setYtUrlInput] = useState('');
  const [participants, setParticipants] = useState([]);
  const [activeActionUser, setActiveActionUser] = useState(null);
  const [focusedVideoParticipant, setFocusedVideoParticipant] = useState(null);
  const [kickModalInfo, setKickModalInfo] = useState({ kicked: false, by: '' });
  const [onlineStats, setOnlineStats] = useState({ online: 1, total: 1 });
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const [audioLevels, setAudioLevels] = useState({});
  const [chatMessages, setChatMessages] = useState([]);

  const prevParticipantsRef = useRef([]);

  useEffect(() => {
    const prev = prevParticipantsRef.current || [];
    const now = (participants || []).filter(p => p != null && p.id != null);
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    now.forEach(p => {
      if (!prev.find(pp => pp?.id === p?.id) && !p.isLocal) {
        setChatMessages(prevMsg => [...prevMsg, {
          id: `sys-${Date.now()}-${p.id}-join`,
          isSystem: true,
          text: `[${time}] ${p.name} joined.`
        }]);
      }
    });
    prev.forEach(p => {
      if (!now.find(pp => pp?.id === p?.id) && !p.isLocal) {
        setChatMessages(prevMsg => [...prevMsg, {
          id: `sys-${Date.now()}-${p.id}-leave`,
          isSystem: true,
          text: `[${time}] ${p.name} left.`
        }]);
      }
    });

    prevParticipantsRef.current = now;
  }, [participants]);
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isRealCall, setIsRealCall] = useState(false);
  const [xpFloater, setXpFloater] = useState(null); // { amount: number, key: number }
  const [activeGame, setActiveGame] = useState(null);
  const [gameLobby, setGameLobby] = useState(null);
  const [showGameSelector, setShowGameSelector] = useState(false);
  const [lobbyGridCols, setLobbyGridCols] = useState(3);
  const [joiningRoomId, setJoiningRoomId] = useState(null);

  // Custom Toast State (replaces window.alert)
  const [toastMessage, setToastMessage] = useState(null);

  // Always get a fresh token — Firebase caches and auto-refreshes internally
  const getFreshToken = async () => {
    if (!auth.currentUser) return user?.token || '';
    try {
      return await auth.currentUser.getIdToken(/* forceRefresh= */ false);
    } catch {
      return user?.token || '';
    }
  };

  const chatEndRef = useRef(null);

  useEffect(() => {
    let timeoutId;
    const originalAlert = window.alert;
    window.alert = (msg) => {
      const message = typeof msg === 'string' ? msg : JSON.stringify(msg);

      if (message.includes('Invalid token') || message.includes('Unauthorized') || message.includes('banned')) {
        signOut(auth).catch(console.error);
        setToastMessage(message.includes('banned') ? "Account banned for violating guidelines." : "Session expired. Please sign in again.");
      } else {
        setToastMessage(message);
      }

      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setToastMessage(null);
      }, 5000);
    };

    return () => {
      window.alert = originalAlert;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    const syncViewFromHash = () => {
      const hash = window.location.hash.replace('#', '');
      const path = window.location.pathname.replace('/', '');

      if (hash && ['admin', 'guidelines', 'messages', 'leaderboard', 'lobby', 'landing', 'feed', 'premium'].includes(hash)) {
        setView(hash);
      } else if (path && ['admin', 'guidelines', 'messages', 'leaderboard', 'lobby', 'landing', 'feed', 'premium'].includes(path)) {
        setView(path);
      }
    };

    window.addEventListener('hashchange', syncViewFromHash);
    syncViewFromHash(); // Check on mount
    return () => window.removeEventListener('hashchange', syncViewFromHash);
  }, []);


  // E2E Test Bot Backdoor Login
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('bot') === 'true') {
      const loginAsBot = async () => {
        try {
          const res = await fetch(`${API_URL}/api/bot-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ secret: 'e2e-test-secret' })
          });
          const data = await res.json();
          if (data.token) {
            const { signInWithCustomToken, auth } = await import('./firebase');
            await signInWithCustomToken(auth, data.token);
            console.log('Bot successfully logged in via custom token!');
            // Remove the bot param so it doesn't loop
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } catch (err) {
          console.error('Bot login failed:', err);
        }
      };
      loginAsBot();
    }
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
          socket.emit('authenticate', currentUser.uid);

          // 1. Instantly get the token (cached by Firebase, very fast)
          const token = await currentUser.getIdToken();

          const defaultAvatar = `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(currentUser.uid)}`;

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
        setTargetProfile({ id: userId, ...snap.data() });
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

  const toggleFollow = async (targetUserId) => {
    const idToFollow = typeof targetUserId === 'string' ? targetUserId : targetProfile?.id;
    if (!user || !idToFollow) return;
    const isFollowing = user?.following?.includes(idToFollow);

    // Optimistic UI update
    const newFollowing = isFollowing
      ? (user?.following || []).filter(id => id !== idToFollow)
      : [...(user?.following || []), idToFollow];

    let newTargetFollowers = null;
    if (targetProfile && targetProfile.id === idToFollow) {
      newTargetFollowers = isFollowing
        ? (targetProfile.followers || []).filter(id => id !== user.id)
        : [...(targetProfile.followers || []), user.id];
    }

    setUser(prev => ({ ...prev, following: newFollowing }));
    if (newTargetFollowers) {
      setTargetProfile(prev => ({ ...prev, followers: newTargetFollowers }));
    }

    try {
      const res = await fetch(`${API_URL}/api/users/${idToFollow}/toggle-follow`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getFreshToken()}`
        }
      });
      if (!res.ok) throw new Error('Failed to toggle follow on server');
    } catch (e) {
      console.error("Failed to toggle follow", e);
      setUser(prev => ({ ...prev, following: isFollowing ? [...(prev.following || []), idToFollow] : prev.following.filter(id => id !== idToFollow) }));
      alert("Action failed, please try again.");
    }
  };


  // Load configuration and room list on mount
  useEffect(() => {
    fetchConfig();
    fetchRooms();

    // 30s poll as a fallback only — socket 'rooms-updated' handles instant updates
    const roomPoll = setInterval(fetchRooms, 30000);
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

    const handleMessageReaction = (data) => {
      const { messageId, emoji, userId } = data;
      setChatMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          const newReactions = { ...(msg.reactions || {}) };
          if (newReactions[userId] === emoji) {
            delete newReactions[userId];
          } else {
            newReactions[userId] = emoji;
          }
          return { ...msg, reactions: newReactions };
        }
        return msg;
      }));
    };

    const handleYtShare = ({ videoId, sharingUser }) => {
      setYtVideoId(videoId);
      setYtSharingUser(sharingUser);
    };

    const handleParticipantKicked = ({ userId, by }) => {
      if (userId === user?.id) {
        teardownVoiceRoom();
        setKickModalInfo({ kicked: true, by });
      } else {
        fetchRooms();
      }
    };

    const handleParticipantMuted = ({ userId }) => {
      if (userId === user?.id) {
        LiveKitService.setLocalAudio(true, isRealCall);
        setIsMuted(true);
        setParticipants(prev => prev.map(p => p.isLocal ? { ...p, muted: true } : p));
        alert('A moderator has muted you.');
      } else {
        fetchRooms();
      }
    };

    const handleOwnerTransferred = () => {
      fetchRooms();
    };

    const handleOnlineStats = (stats) => {
      setOnlineStats(stats);
      if (stats.onlineUserIds) {
        setOnlineUserIds(new Set(stats.onlineUserIds));
      }
    };

    const handleRoomsUpdated = (payload) => {
      if (payload && payload.rooms) {
        setRooms(payload.rooms);
      } else {
        fetchRooms();
      }
    };

    socket.on('chat-history', handleChatHistory);
    socket.on('chat-message', handleChatMessage);
    socket.on('message-reaction', handleMessageReaction);
    socket.on('yt-share', handleYtShare);
    socket.on('participant-kicked', handleParticipantKicked);
    socket.on('participant-muted', handleParticipantMuted);
    socket.on('owner-transferred', handleOwnerTransferred);
    socket.on('online-stats', handleOnlineStats);
    socket.on('rooms-updated', handleRoomsUpdated);

    socket.on('game-lobby-updated', (lobby) => {
      setGameLobby(lobby);
      if (!lobby) setActiveGame(null);
    });
    socket.on('game-state', (game) => {
      setActiveGame(game);
      setGameLobby(null);
    });
    socket.on('game-ended', () => {
      setActiveGame(null);
      setGameLobby(null);
      setShowGameSelector(false);
    });
    socket.on('game-error', ({ message }) => {
      setToastMessage(message);
    });

    // Socket.IO reconnection handler — re-authenticate and re-join active room
    const handleReconnect = () => {
      console.log('[socket] Reconnected — re-authenticating and re-joining room');
      if (auth?.currentUser) {
        socket.emit('authenticate', auth.currentUser.uid);
      }
    };
    socket.on('connect', handleReconnect);

    return () => {
      socket.off('chat-history', handleChatHistory);
      socket.off('chat-message', handleChatMessage);
      socket.off('message-reaction', handleMessageReaction);
      socket.off('yt-share', handleYtShare);
      socket.off('participant-kicked', handleParticipantKicked);
      socket.off('participant-muted', handleParticipantMuted);
      socket.off('owner-transferred', handleOwnerTransferred);
      socket.off('online-stats', handleOnlineStats);
      socket.off('rooms-updated', handleRoomsUpdated);
      socket.off('game-lobby-updated');
      socket.off('game-state');
      socket.off('game-ended');
      socket.off('game-error');
      socket.off('connect', handleReconnect);
    };
  }, []);

  // Re-join socket.io room on reconnection (ensures chat/games/yt resume after network blips)
  useEffect(() => {
    const handleRoomRejoin = async () => {
      if (activeRoom && user?.id) {
        console.log('[socket] Re-joining room after reconnect:', activeRoom.id);
        socket.emit('join-room', { roomName: activeRoom.id, identity: user.id });

        // Note: We intentionally DO NOT call LiveKitService.join() here.
        // LiveKit SDK handles its own WebRTC reconnections automatically.
        // Calling join() here creates a race condition that instantly disconnects the user.
      }
    };
    socket.on('connect', handleRoomRejoin);
    return () => socket.off('connect', handleRoomRejoin);
  }, [activeRoom, user]);

  // Sync Call Status and Ping Server
  useEffect(() => {
    if (callState !== 'joined' || !activeRoom) return;

    // Send keep-alive ping to backend every 4 seconds
    const pingInterval = setInterval(async () => {
      fetch(`${API_URL}/api/rooms/${activeRoom.id}/ping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getFreshToken()}`
        },
        body: JSON.stringify({ userId: user.id, isSpeaking: !isMuted })
      }).catch(err => console.warn('Ping error:', err));
    }, 4000);

    // Add robust tab close cleanup to prevent ghost participants
    const handleBeforeUnload = () => {
      if (activeRoom && user && user.token) {
        // sendBeacon sends as text/plain body — our /leave-beacon endpoint reads the raw body as the token
        navigator.sendBeacon(
          `${API_URL}/api/rooms/${activeRoom.id}/leave-beacon`,
          user.token
        );
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(pingInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [callState, activeRoom, isMuted, participants, isRealCall, user]);

  // Sync XP floater to real Firestore updates via auth onSnapshot
  const prevXpRef = useRef(user?.xp || 0);
  useEffect(() => {
    if (!user?.xp) return;
    const diff = user.xp - prevXpRef.current;
    if (diff > 0 && callState === 'joined') {
      setXpFloater({ amount: diff, key: Date.now() });
    }
    prevXpRef.current = user.xp;
  }, [user?.xp, callState]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    if (isChatOpen) {
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [chatMessages, isChatOpen]);

  // Auto-join room from URL parameter if present
  useEffect(() => {
    if (rooms.length > 0 && user && user.id && callState === 'left' && !activeRoom) {
      const urlParams = new URLSearchParams(window.location.search);
      const roomId = urlParams.get('room');

      if (roomId) {
        const roomToJoin = rooms.find(r => r?.id === roomId);
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
        const updated = data.find(r => r?.id === activeRoom?.id);
        if (updated) {
          // Sync changes if needed
        }
      }
    } catch (err) {
      console.error('Failed to load rooms list:', err);
    }
  };

  // Fetch all users when Social panel opens on "All" tab
  useEffect(() => {
    if (showSocialPanel && socialTab === 'All' && allSocialUsers.length === 0) {
      fetch(`${API_URL}/api/users/all`)
        .then(res => res.json())
        .then(data => {
          if (data.users) setAllSocialUsers(data.users);
        })
        .catch(err => console.error('Failed to fetch social users:', err));
    }
  }, [showSocialPanel, socialTab]);


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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout to allow for Render cold starts

      const res = await fetch(`${API_URL}/api/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getFreshToken()}`
        },
        body: JSON.stringify({
          name: newRoomName,
          language: newRoomLanguage,
          topic: newRoomTopic,
          tags: tagsArray,
          accessType: newRoomAccessType,
          isOpenMic: newRoomIsOpenMic,
          ownerIsPremium: !!user?.isPremium
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (res.status === 429) {
        throw new Error("Too many requests. Please wait a moment and try again.");
      }

      const newRoom = await res.json();

      if (!res.ok) {
        throw new Error(newRoom.error || 'Failed to create room');
      }

      setRooms(prev => [...prev, newRoom]);
      setShowCreateModal(false);
      setNewRoomName('');
      setNewRoomTopic('');
      setNewRoomTags('Casual');
      setIsCreatingRoom(false);
      // Auto-join newly created room in the same tab
      joinVoiceRoom(newRoom);
    } catch (err) {
      setIsCreatingRoom(false);
      console.error('Error creating room:', err);
      alert(err.message || 'Failed to create new practice room.');
    } finally {
      setIsCreatingRoom(false);
    }
  };

  // Join a room logic
  const joinVoiceRoom = async (room) => {
    if (joiningRoomId) return false;
    if (!user || !user.id) {
      setShowAuthModal(true);
      return false;
    }

    if (user?.isRestricted) {
      alert("Your account is temporarily restricted from creating or joining rooms due to community guidelines violations. Pending manual review.");
      return false;
    }

    if (activeRoom) {
      alert('You are already in a room. Leave it first.');
      return false;
    }

    setJoiningRoomId(room.id);
    setIsMuted(true);
    setChatMessages([]);
    setCallState('joining');

    // Optimistically show room UI for zero-latency feel
    setActiveRoom(room);
    setIsChatOpen(true);
    
    // Optimsitically load participants from the database snapshot so the user sees everyone instantly
    if (room) {
      const optimisticParticipants = [
        {
          id: user.id,
          name: user.name || 'You',
          isLocal: true,
          muted: true,
          photoUrl: user?.photoUrl || '',
          color: user?.color || '#ff4d4d',
          emoji: user?.emoji || '👤'
        },
        {
          id: 'agent-ananya-optimistic',
          name: 'Ananya',
          isLocal: false,
          muted: false,
          photoUrl: '/ananya.png',
          color: '#8b5cf6',
          emoji: '✨',
          isAI: true
        },
        ...(room.participants || []).filter(p => p.id !== user.id).map(p => ({
          id: p.id,
          name: p.name || 'Guest',
          isLocal: false,
          muted: true,
          photoUrl: p.photoUrl || '',
          color: p.color || '#ff4d4d',
          emoji: p.emoji || '👤',
          isAI: (p.id || '').startsWith('agent')
        }))
      ];
      setParticipants(optimisticParticipants);
    }

    try {
      const res = await fetch(`${API_URL}/api/rooms/${room.id}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getFreshToken()}`
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

      setIsRealCall(data.isRealConnection);

      // Setup LiveKit WebRTC callbacks (must happen before connect)
      LiveKitService.setCallbacks({
        onParticipantsChange: (pList) => {
          setParticipants(pList);
        },
        onAudioLevels: (levels) => {
          setAudioLevels(levels);
        },
        onConnectionChange: ({ state, error }) => {
          console.log('[Room] Connection state:', state, error);
          if (state === 'joined' || state === 'connected') {
            setCallState('joined');
          } else if (state === 'error') {
            const msg = error || '';
            if (!msg.includes('Client initiated disconnect')) {
              setToastMessage(`Connection error: ${msg}`);
            }
            setActiveRoom(null);
            setCallState('left');
          } else if (state === 'left') {
            teardownVoiceRoom();
          }
        }
      });

      // Emit socket join with connected-guard (ensures emit isn't lost during cold start)
      const emitSocketJoin = () => {
        if (socket.connected) {
          socket.emit('join-room', { roomName: room.id, identity: user.id });
        } else {
          socket.once('connect', () => {
            socket.emit('join-room', { roomName: room.id, identity: user.id });
          });
        }
      };

      // Run Socket.IO join and LiveKit connect in PARALLEL for zero-latency
      emitSocketJoin();
      await LiveKitService.join(data.livekitUrl, data.token, data.isRealConnection, user);

      setRoomJoinTime(Date.now());
      fetchRooms().catch(() => {}); // refresh listing UI (non-blocking)
      return true;
    } catch (err) {
      console.error('Error joining call room:', err);
      setToastMessage(err.message || 'Could not join voice session.');
      setIsMuted(true);
      setActiveRoom(null);
      setCallState('left');
      setRoomJoinTime(null);
      return false;
    } finally {
      setJoiningRoomId(null);
    }
  };

  const teardownVoiceRoom = () => {
    LiveKitService.leave(isRealCall);
    if (activeRoom) {
      socket.emit('leave-room', activeRoom.id);

      // Calculate and save time spent
      if (roomJoinTime && user && user.id) {
        const timeSpentMinutes = Math.floor((Date.now() - roomJoinTime) / 60000);
        if (timeSpentMinutes > 0) {
          try {
            updateDoc(doc(db, 'users', user.id), {
              totalTimeSpent: (user.totalTimeSpent || 0) + timeSpentMinutes
            }).catch(console.error);
          } catch (err) {
            console.error("Failed to update time spent", err);
          }
        }
      }
    }
    setActiveRoom(null);
    setCallState('left');
    setRoomJoinTime(null);
    setParticipants([]);
    setAudioLevels({});
    setChatMessages([]);
    setIsScreenSharing(false);
    setYtVideoId(null);
    setYtSharingUser(null);
    setActiveGame(null);
    setShowGameSelector(false);
    setShowYtModal(false);
    setYtUrlInput('');
    setActiveActionUser(null);
    fetchRooms();
  };

  const handleGameSelect = (gameType) => {
    setShowGameSelector(false);
    socket.emit('game-invite', {
      roomId: activeRoom.id,
      gameType,
      initiator: {
        id: user.id,
        name: user.name,
        photoUrl: user.photoUrl,
        color: user.color
      }
    });
  };

  // Leave Voice Room trigger
  const leaveVoiceRoom = async () => {
    if (!activeRoom) return;

    try {
      const token = await auth.currentUser?.getIdToken();
      await fetch(`${API_URL}/api/rooms/${activeRoom.id}/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getFreshToken()}`
        },
        body: JSON.stringify({ userId: user.id })
      });
    } catch (err) {
      console.warn('Error while cleanly leaving backend room:', err);
    } finally {
      teardownVoiceRoom();
    }
  };

  // Local Microphone Mute controller
  const toggleMute = async () => {
    const nextMuted = !isMuted;
    try {
      await LiveKitService.setLocalAudio(nextMuted, isRealCall);
      setIsMuted(nextMuted);
      setParticipants(prev =>
        prev.map(p => p.isLocal ? { ...p, muted: nextMuted } : p)
      );
    } catch (err) {
      console.error('Microphone toggle failed:', err);
      setToastMessage('Microphone access failed. Check browser permissions.');
    }
  };

  const toggleScreenShare = async () => {
    try {
      const nextScreenShare = !isScreenSharing;
      const resolved = await LiveKitService.setLocalScreenShare(nextScreenShare, isRealCall);
      setIsScreenSharing(resolved);
    } catch (err) {
      console.error('Failed to set screen share:', err);
      alert('Could not start screen sharing: ' + err.message);
    }
  };

  const toggleCamera = async () => {
    try {
      const nextCameraOn = !isCameraOn;
      const resolved = await LiveKitService.setLocalCamera(nextCameraOn, isRealCall);
      setIsCameraOn(resolved);
    } catch (err) {
      console.error('Failed to set camera:', err);
      alert('Could not start camera: ' + err.message);
    }
  };

  const handleStartDM = async (targetId, targetName) => {
    const snap = await getDoc(doc(db, 'users', targetId));
    if (snap.exists()) {
      setActiveDm({ id: targetId, profile: { id: targetId, ...snap.data() } });
      setMsgTab('direct');
      setView('messages');
    }
  };

  const raiseHand = async () => {
    if (!activeRoom || !user) return;
    try {
      await fetch(`${API_URL}/api/rooms/${activeRoom.id}/raise-hand`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${await getFreshToken()}` }
      });
    } catch (e) { console.error('Raise hand failed', e); }
  };

  const lowerHand = async () => {
    if (!activeRoom || !user) return;
    try {
      await fetch(`${API_URL}/api/rooms/${activeRoom.id}/lower-hand`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${await getFreshToken()}` }
      });
    } catch (e) { console.error('Lower hand failed', e); }
  };

  const allowToSpeak = async (targetUserId) => {
    if (!activeRoom || !user) return;
    try {
      await fetch(`${API_URL}/api/rooms/${activeRoom.id}/allow-speak`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getFreshToken()}`,
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
    const svgCx = svgRect.left + svgRect.width / 2 - rect.left;
    const svgCy = svgRect.top + svgRect.height * 0.5 - rect.top;

    const dx = x - svgCx;
    const dy = y - svgCy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxOffset = 5;
    const ox = (dx / Math.max(dist, 1)) * Math.min(dist / 30, 1) * maxOffset;
    const oy = (dy / Math.max(dist, 1)) * Math.min(dist / 30, 1) * maxOffset;

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
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await getFreshToken()}` },
        body: JSON.stringify({ targetUserId: targetId, role })
      });
    } catch (e) { console.error('Promote failed', e); }
  };

  const kickUser = async (targetId) => {
    try {
      await fetch(`${API_URL}/api/rooms/${activeRoom.id}/kick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await getFreshToken()}` },
        body: JSON.stringify({ targetUserId: targetId })
      });
    } catch (e) { console.error('Kick failed', e); }
  };

  const muteUser = async (targetId) => {
    try {
      await fetch(`${API_URL}/api/rooms/${activeRoom.id}/mute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await getFreshToken()}` },
        body: JSON.stringify({ targetUserId: targetId })
      });
    } catch (e) { console.error('Mute failed', e); }
  };

  const endRoom = async () => {
    try {
      await fetch(`${API_URL}/api/rooms/${activeRoom.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${await getFreshToken()}` }
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
    const currentRoomData = rooms.find(r => r?.id === activeRoom?.id);
    return currentRoomData?.roles?.[userId] || 'guest';
  };

  // Calculations
  const filteredRooms = rooms.filter(room => {
    if (!room) return false;
    const matchLang = selectedLanguage === 'All Languages' || room.language === selectedLanguage;
    const searchLower = searchQuery.toLowerCase();
    const matchSearch = !searchQuery ||
      (room.name || '').toLowerCase().includes(searchLower) ||
      (room.topic || '').toLowerCase().includes(searchLower) ||
      (room.tags || []).some(t => (t || '').toLowerCase().includes(searchLower));
    return matchLang && matchSearch;
  }).sort((a, b) => {
    if (platformSettings?.premiumVisibilityBoost !== false) {
      if (a.ownerIsPremium && !b.ownerIsPremium) return -1;
      if (!a.ownerIsPremium && b.ownerIsPremium) return 1;
    }
    return (b.participants?.length || 0) - (a.participants?.length || 0);
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
    isAdmin,
    onlineStats,
    activeRoom
  };

  const usersInRooms = rooms.flatMap(r =>
    (r.participants || []).map(p => ({ ...p, roomName: r.name, roomId: r.id }))
  );

  const renderAppLayout = (children) => (
    <div className="layout-container lobby-bg relative min-h-[100dvh] overflow-x-hidden">

      <Sidebar {...layoutProps} />
      <div className="main-content hide-scrollbar z-10 relative">
        {children}
      </div>

      {/* MODALS MOVED HERE FOR GLOBAL ACCESS */}
      {/* PARTICIPANT ACTION CARD MODAL */}
      {activeActionUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/60 backdrop-blur-md p-4" onClick={() => setActiveActionUser(null)}>
          <div className="w-full max-w-sm rounded-[2rem] p-6 animate-fade-in relative bg-[#13151b] border border-white/10 backdrop-blur-2xl shadow-2xl text-text-primary" onClick={e => e.stopPropagation()}>
            <button onClick={() => setActiveActionUser(null)} className="absolute top-4 right-4 text-text-primary/40 hover:text-text-primary transition-colors bg-white/5 hover:bg-white/10 rounded-full p-1.5 z-20">
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white/10 flex items-center justify-center flex-shrink-0 border border-white/10" style={{ backgroundColor: activeActionUser.color || '#333' }}>
                {activeActionUser.photoUrl ? (
                  <img src={activeActionUser.photoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl">{activeActionUser.emoji || '👤'}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-white text-lg truncate">{activeActionUser.name}</span>
                </div>
                <span className="text-[10px] text-[var(--accent-primary)] font-black uppercase tracking-wider mt-0.5 block">
                  {getRole(activeActionUser.id) || 'guest'}
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-white/30 font-mono truncate max-w-[120px]">ID: {activeActionUser.id}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(activeActionUser.id);
                      alert('Copied User ID!');
                    }}
                    className="text-[9px] text-[var(--accent-primary)] font-bold hover:underline"
                  >
                    Copy ID
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <button onClick={() => { alert('User Blocked'); }} className="py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 text-xs font-bold rounded-xl transition-all">Block</button>
              <button onClick={() => { setShowReportModal(activeActionUser.id); setActiveActionUser(null); }} className="py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 text-xs font-bold rounded-xl transition-all">Report</button>
              <button onClick={() => { handleStartDM(activeActionUser.id, activeActionUser.name); setActiveActionUser(null); }} className="py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 text-xs font-bold rounded-xl transition-all">PM</button>
              <button
                onClick={async () => {
                  const isFollowing = user?.following?.includes(activeActionUser.id);
                  toggleFollow(activeActionUser.id);
                  const targetProfileSnap = await getDoc(doc(db, 'users', activeActionUser.id));
                  if (targetProfileSnap.exists()) {
                    setTargetProfile({ id: activeActionUser.id, ...targetProfileSnap.data() });
                  }
                }}
                className="py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 text-xs font-bold rounded-xl transition-all"
              >
                {user?.following?.includes(activeActionUser.id) ? 'Unfollow' : 'Follow'}
              </button>
              <button onClick={() => { alert('Reconnected audio link'); }} className="py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 text-xs font-bold rounded-xl transition-all col-span-2">Reconnect</button>
            </div>

            {(() => {
              const myRole = getRole(user.id);
              const targetRole = getRole(activeActionUser.id);
              const isOwner = myRole === 'owner';
              const isCoOwner = myRole === 'co-owner';
              const canModerate = isOwner || (isCoOwner && targetRole !== 'owner' && targetRole !== 'co-owner');

              if (!canModerate) return null;

              return (
                <div className="border-t border-white/5 pt-4 space-y-2">
                  <div className="text-[10px] text-white/30 font-bold uppercase tracking-widest mb-2">Room Moderation</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={async () => {
                        try {
                          await fetch(`${API_URL}/api/rooms/${activeRoom.id}/mute`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${await getFreshToken()}`
                            },
                            body: JSON.stringify({ targetUserId: activeActionUser.id })
                          });
                          alert('Muted participant in room');
                          setActiveActionUser(null);
                        } catch (err) {
                          alert(err.message);
                        }
                      }}
                      className="py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-xl transition-all"
                    >
                      Mute
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await fetch(`${API_URL}/api/rooms/${activeRoom.id}/kick`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${await getFreshToken()}`
                            },
                            body: JSON.stringify({ targetUserId: activeActionUser.id })
                          });
                          alert('Kicked participant from room');
                          setActiveActionUser(null);
                        } catch (err) {
                          alert(err.message);
                        }
                      }}
                      className="py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-xl transition-all"
                    >
                      Kick
                    </button>
                    <button onClick={() => { setChatMessages([]); alert('Cleared room chat'); }} className="py-2.5 bg-white/5 hover:bg-white/10 text-xs font-bold rounded-xl transition-all col-span-2">Clear Chat</button>

                    {isOwner && (
                      <>
                        <button
                          onClick={async () => {
                            const newRole = targetRole === 'co-owner' ? 'member' : 'co-owner';
                            try {
                              await fetch(`${API_URL}/api/rooms/${activeRoom.id}/promote`, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${await getFreshToken()}`
                                },
                                body: JSON.stringify({ targetUserId: activeActionUser.id, role: newRole })
                              });
                              alert(`Set role to ${newRole === 'co-owner' ? 'Co-Owner' : 'Guest'}`);
                              setActiveActionUser(null);
                              fetchRooms();
                            } catch (err) { alert(err.message); }
                          }}
                          className="py-2.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-xs font-bold rounded-xl transition-all"
                        >
                          {targetRole === 'co-owner' ? 'Set Guest' : 'Set Co-Owner'}
                        </button>
                        <button
                          onClick={async () => {
                            if (!window.confirm(`Are you sure you want to transfer room ownership to ${activeActionUser.name}? You will become Co-Owner.`)) return;
                            try {
                              await fetch(`${API_URL}/api/rooms/${activeRoom.id}/transfer-owner`, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${await getFreshToken()}`
                                },
                                body: JSON.stringify({ targetUserId: activeActionUser.id })
                              });
                              alert('Transferred room ownership!');
                              setActiveActionUser(null);
                              fetchRooms();
                            } catch (err) { alert(err.message); }
                          }}
                          className="py-2.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-xs font-bold rounded-xl transition-all"
                        >
                          Transfer Group
                        </button>
                      </>
                    )}

                    {(activeRoom.speakingQueue || []).includes(activeActionUser.id) && (
                      <button
                        onClick={async () => {
                          try {
                            await fetch(`${API_URL}/api/rooms/${activeRoom.id}/lower-hand-mod`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${await getFreshToken()}`
                              },
                              body: JSON.stringify({ targetUserId: activeActionUser.id })
                            });
                            alert('Lowered participant hand');
                            setActiveActionUser(null);
                          } catch (err) { alert(err.message); }
                        }}
                        className="py-2.5 bg-white/5 hover:bg-white/10 text-xs font-bold rounded-xl transition-all col-span-2"
                      >
                        Lower Hand
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="border-t border-white/5 pt-4 mt-4">
              <div className="flex items-center justify-between text-[10px] text-white/30 font-bold uppercase tracking-widest mb-2">
                <span>Volume Control</span>
                <span>{Math.round((activeActionUser.volume || 1) * 100)}%</span>
              </div>
              <div className="flex items-center gap-3">
                <Volume2 className="w-4 h-4 text-white/40" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={activeActionUser.volume !== undefined ? activeActionUser.volume : 1}
                  onChange={(e) => {
                    const newVol = parseFloat(e.target.value);
                    setParticipants(prev => prev.map(p => p.id === activeActionUser.id ? { ...p, volume: newVol } : p));
                    setActiveActionUser(prev => ({ ...prev, volume: newVol }));

                    if (isRealCall) {
                      const participant = LiveKitService.getRoom()?.remoteParticipants.get(activeActionUser.id);
                      if (participant) {
                        participant.audioTrackPublications.forEach(pub => {
                          if (pub.track) pub.track.setVolume(newVol);
                        });
                      }
                    }
                  }}
                  className="flex-1 accent-[var(--accent-primary)] bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KICKED OVERLAY */}
      {kickModalInfo.kicked && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0B0D12]/95 backdrop-blur-lg p-6 text-center animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-red-500/10 border-2 border-red-500 flex items-center justify-center mb-8">
            <X className="w-10 h-10 text-red-500 animate-pulse" />
          </div>
          <h2 className="text-3xl font-black text-white mb-6">
            <span className="text-yellow-500 font-extrabold">{kickModalInfo.by}</span> has kicked you out.
          </h2>
          <div className="space-y-2 text-sm text-yellow-500/80 mb-8 max-w-sm font-medium">
            <p>You have been kicked out 1 time in the last 15 minutes.</p>
            <p>If you get kicked out 4 more times, you will be banned for 15 minutes.</p>
          </div>
          <p className="text-xs text-white/40 mb-2 leading-relaxed italic max-w-xs">
            Kicking without any reasons is allowed on Free4Talk. So, don't be mad, dear!
          </p>
          <p className="text-[11px] text-[var(--accent-primary)] font-bold mb-10">
            Tip: You can create your own room to prevent being kicked.
          </p>
          <button
            onClick={() => setKickModalInfo({ kicked: false, by: '' })}
            className="px-8 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-bold rounded-2xl transition-all shadow-xl active:scale-[0.98]"
          >
            Close
          </button>
        </div>
      )}

      {/* YOUTUBE SHARING MODAL */}
      {showYtModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/60 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-3xl p-8 animate-fade-in relative bg-bg-base border border-border-color shadow-xl">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl md:text-2xl font-bold text-text-primary flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-xl border border-red-500/20">
                  <Youtube className="w-5 h-5 text-red-500" />
                </div>
                Co-Watch YouTube
              </h3>
              <button
                onClick={() => setShowYtModal(false)}
                className="text-text-primary/40 hover:text-text-primary transition-colors bg-white/5 hover:bg-white/10 rounded-full p-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-red-400 mb-2 drop-shadow-sm">YouTube Video Link</label>
                <input
                  type="text"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={ytUrlInput}
                  onChange={(e) => setYtUrlInput(e.target.value)}
                  className="w-full text-sm bg-bg-base/40 border border-white/10 rounded-xl px-4 py-3 text-text-primary placeholder-white/30 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all shadow-inner"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const id = getYoutubeId(ytUrlInput);
                    if (id) {
                      socket.emit('yt-share', { roomId: activeRoom.id, videoId: id, sharingUser: user.name });
                      setShowYtModal(false);
                      setYtUrlInput('');
                    } else {
                      alert('Invalid YouTube URL. Please paste a valid link.');
                    }
                  }}
                  className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors shadow-lg active:scale-[0.98]"
                >
                  Share Video
                </button>
                {ytVideoId && (
                  <button
                    onClick={() => {
                      socket.emit('yt-share', { roomId: activeRoom.id, videoId: null, sharingUser: null });
                      setShowYtModal(false);
                      setYtUrlInput('');
                    }}
                    className="py-3 px-4 rounded-xl text-sm font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                  >
                    Stop Video
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
                      className={`text-xl p-1 rounded-md hover:bg-[var(--bg-hover)] transition ${user.emoji === em ? 'bg-[var(--accent-primary-bg)] border border-[var(--accent-primary)]' : 'border border-transparent'
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
      {/* AUTH MODAL — Full Page Split Layout */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex animate-fade-in" style={{ background: '#0a0b0e' }}>

          {/* Left Side — Login */}
          <div className="flex-1 flex flex-col justify-between px-8 sm:px-16 lg:px-20 py-10 relative overflow-hidden">
            {/* Background subtle pattern */}
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.02' fill-rule='evenodd'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/svg%3E\")" }}></div>

            {/* Top — Brand */}
            <div className="relative z-10">
              <div className="flex items-center gap-0.5">
                <span className="text-xl font-black text-white tracking-tight">solith</span>
                <span className="text-xl font-black text-[#3B82F6]">.in</span>
              </div>
              <p className="text-[11px] text-white/30 mt-1 font-medium">Practice languages. Live.</p>
            </div>

            {/* Center — Login Form */}
            <div className="relative z-10 max-w-[380px]">
              <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-black text-white tracking-tight leading-[1.1] mb-4">
                Login to Your<br />Account!
              </h1>
              <p className="text-sm text-white/40 mb-10 leading-relaxed max-w-[320px]">
                Join live voice rooms, connect with native speakers worldwide, and track your language learning journey.
              </p>

              {/* Google Sign In Button */}
              <button
                onClick={handleLogin}
                className="flex items-center justify-center gap-3 w-full py-4 px-6 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: '#1a1d28', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Login With Google
              </button>

              {/* Divider */}
              <div className="flex items-center gap-4 my-8">
                <div className="flex-1 h-px bg-white/5"></div>
                <span className="text-[11px] text-white/20 font-medium uppercase tracking-widest">or</span>
                <div className="flex-1 h-px bg-white/5"></div>
              </div>

              {/* Continue as Guest */}
              <button
                onClick={() => setShowAuthModal(false)}
                className="w-full py-4 px-6 rounded-xl text-sm font-bold transition-all hover:bg-white/5"
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
              >
                Continue as Guest
              </button>

              <p className="mt-8 text-[10px] text-white/20 leading-relaxed">
                By signing in, you agree to our{' '}
                <button onClick={() => { setShowAuthModal(false); setView('guidelines'); }} className="underline hover:text-white/40 transition-colors">
                  Community Guidelines
                </button>
              </p>
            </div>

            {/* Bottom — Footer */}
            <div className="relative z-10 flex items-center gap-4 text-[11px] text-white/15 font-medium">
              <span>© 2025 solith.in</span>
              <span>·</span>
              <button onClick={() => { setShowAuthModal(false); setActiveModal('privacy'); }} className="hover:text-white/30 transition-colors">Privacy</button>
              <span>·</span>
              <button onClick={() => { setShowAuthModal(false); setActiveModal('contact'); }} className="hover:text-white/30 transition-colors">Contact</button>
            </div>
          </div>

          {/* Right Side — Feature Showcase (hidden on mobile) */}
          <div className="hidden lg:flex flex-1 items-center justify-center relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f1118 0%, #161923 50%, #0f1118 100%)' }}>
            {/* Decorative glow */}
            <div className="absolute top-1/4 right-1/4 w-80 h-80 rounded-full blur-[100px] pointer-events-none" style={{ background: 'rgba(59,130,246,0.06)' }}></div>
            <div className="absolute bottom-1/4 left-1/4 w-60 h-60 rounded-full blur-[80px] pointer-events-none" style={{ background: 'rgba(249,115,22,0.04)' }}></div>

            {/* Floating Cards */}
            <div className="relative w-[420px] h-[500px]">

              {/* Card 1: Live Room Preview */}
              <div className="absolute top-0 right-0 w-[260px] rounded-2xl p-5 animate-slide-up"
                style={{ background: 'linear-gradient(135deg, #1e2030, #181a26)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
                <div className="text-[10px] text-white/30 font-semibold mb-1">12:30 - 15:45</div>
                <div className="text-base font-bold text-white mb-3">Live English Room</div>
                <div className="flex items-center gap-1">
                  <div className="w-7 h-7 rounded-full" style={{ background: 'linear-gradient(135deg, #60a5fa, #2563eb)' }}></div>
                  <div className="w-7 h-7 rounded-full -ml-2" style={{ background: 'linear-gradient(135deg, #4ade80, #16a34a)' }}></div>
                  <div className="w-7 h-7 rounded-full -ml-2" style={{ background: 'linear-gradient(135deg, #c084fc, #7c3aed)' }}></div>
                  <div className="w-6 h-6 rounded-full bg-[#3B82F6] text-[9px] font-bold text-white flex items-center justify-center -ml-1">+8</div>
                </div>
              </div>

              {/* Card 2: XP / Progress Card */}
              <div className="absolute top-[120px] left-0 w-[240px] rounded-2xl p-5 animate-slide-up-delayed"
                style={{ background: 'linear-gradient(135deg, #1a1d2e, #141620)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: 'linear-gradient(135deg, #fb923c, #eab308)' }}>🔥</div>
                  <span className="text-[11px] text-white/40 font-medium">Your Progress</span>
                </div>
                <div className="text-3xl font-black text-white mb-1 tracking-tight">2,450 <span className="text-base font-bold text-[#3B82F6]">XP</span></div>
                <div className="text-xs text-white/30 font-medium">Gold League</div>
                <div className="mt-3 flex items-center gap-1">
                  <span className="text-[10px] text-white/20">⭐⭐⭐⭐</span>
                  <span className="text-xs font-bold text-white/40 ml-1">Level 4</span>
                </div>
              </div>

              {/* Card 3: Streak Week Chart */}
              <div className="absolute bottom-[80px] left-[40px] w-[200px] rounded-2xl p-4 animate-slide-up-delayed-2"
                style={{ background: 'linear-gradient(135deg, #1c1f2e, #161824)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
                <div className="flex items-end justify-between gap-1 h-16 mb-2">
                  {[40, 70, 55, 85, 30, 60, 75].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t-md transition-all" style={{ height: `${h}%`, background: i === 3 ? '#3B82F6' : 'rgba(59,130,246,0.2)' }}></div>
                  ))}
                </div>
                <div className="flex justify-between text-[8px] font-bold text-white/20">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <span key={d}>{d}</span>)}
                </div>
              </div>

              {/* Card 4: Chat Bubble */}
              <div className="absolute bottom-0 right-[10px] w-[250px] rounded-2xl p-4 animate-slide-up-delayed"
                style={{ background: 'linear-gradient(135deg, #1a1c2a, #151720)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>S</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Solith.in</span>
                      <span className="text-[9px] text-white/20">2 Min Ago</span>
                    </div>
                    <p className="text-[11px] text-white/40 mt-0.5">Hey there! Start practicing now 🌍</p>
                  </div>
                </div>
                <button className="mt-3 ml-auto block px-4 py-1.5 rounded-lg text-[10px] font-bold text-white bg-[#3B82F6] hover:bg-[#2563EB] transition-colors">
                  Join Now
                </button>
              </div>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={() => setShowAuthModal(false)}
            className="absolute top-5 right-5 w-10 h-10 rounded-xl flex items-center justify-center text-white/40 hover:text-white transition-all z-10"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            <X className="w-5 h-5" />
          </button>
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
                  onClick={() => setFollowListState({ isOpen: true, type: 'following', ids: user?.following || [], title: 'Following' })}
                >
                  <div className="font-extrabold text-xl text-yellow-100">{user?.following?.length || 0}</div>
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
                    className={`w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${user?.following?.includes(targetProfile.id)
                      ? 'bg-[#121212] border border-yellow-500/20 text-yellow-500/80 hover:text-yellow-500 hover:bg-yellow-500/10'
                      : 'bg-[var(--accent-primary)] text-white hover:scale-[1.02] hover:shadow-[0_0_15px_var(--accent-primary-glow)]'
                      }`}
                  >
                    {user?.following?.includes(targetProfile.id) ? (
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
                      setIsChatOpen(false);
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

      {showSocialPanel && (
        <div style={{
          position: 'fixed', right: 16, bottom: 80, width: 320,
          background: '#111827', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16, zIndex: 100, overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Users size={16} color="#1877f2" />
              <span style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>Social</span>
            </div>
            <button onClick={() => setShowSocialPanel(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
              <X size={16} />
            </button>
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)',
            padding: '0 16px'
          }}>
            {['All', 'Following', 'In Room'].map(tab => (
              <button key={tab}
                onClick={() => setSocialTab(tab)}
                style={{
                  padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer',
                  color: socialTab === tab ? '#1877f2' : 'rgba(255,255,255,0.4)',
                  fontWeight: socialTab === tab ? 700 : 500, fontSize: 13,
                  borderBottom: socialTab === tab ? '2px solid #1877f2' : '2px solid transparent',
                  marginBottom: -1
                }}>
                {tab}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <input
              placeholder="Search by Name"
              value={socialSearch}
              onChange={e => setSocialSearch(e.target.value)}
              style={{
                width: '100%', background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
                padding: '8px 12px', color: 'white', fontSize: 13, outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* User list */}
          <div style={{ maxHeight: 360, overflowY: 'auto', padding: '8px 0' }}>
            {socialTab === 'In Room' && usersInRooms.length === 0 && (
              <div style={{ padding: '20px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                No users currently in rooms.
              </div>
            )}
            {socialTab === 'In Room' && usersInRooms.map(p => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <img src={p.photoUrl || `https://api.dicebear.com/7.x/lorelei/svg?seed=${p.id}`}
                    style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                  <div>
                    <div style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>in {p.roomName}</div>
                  </div>
                </div>
                <button onClick={() => {
                  const room = rooms.find(r => r?.id === p?.roomId);
                  if (room) { joinVoiceRoom(room); setShowSocialPanel(false); }
                }} style={{
                  background: 'rgba(24,119,242,0.15)', border: '1px solid rgba(24,119,242,0.3)',
                  borderRadius: 8, padding: '5px 10px', color: '#60a5fa',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer'
                }}>Join</button>
              </div>
            ))}

            {socialTab === 'All' && (() => {
              const filtered = allSocialUsers.filter(u => u.id !== user?.id && u.name.toLowerCase().includes(socialSearch.toLowerCase()));
              if (filtered.length === 0) return (
                <div style={{ padding: '20px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                  No users to show.
                </div>
              );
              return filtered.map(u => (
                <SocialUserRow
                  key={u.id}
                  userId={u.id}
                  currentUser={user}
                  onlineUserIds={onlineUserIds}
                  openUserProfile={(id) => {
                    setShowSocialPanel(false);
                    openUserProfile(id);
                  }}
                  onDM={(id, profile) => {
                    setActiveDm({ id, profile });
                    setMsgTab('direct');
                    setView('messages');
                    setShowSocialPanel(false);
                  }}
                />
              ));
            })()}

            {socialTab === 'Following' && (() => {
              const followingIds = (user?.following || []);
              if (followingIds.length === 0) return (
                <div style={{ padding: '20px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                  You are not following anyone yet.
                </div>
              );
              return followingIds.slice(0, 20).map(followedId => (
                <SocialUserRow
                  key={followedId}
                  userId={followedId}
                  currentUser={user}
                  onlineUserIds={onlineUserIds}
                  openUserProfile={(id) => {
                    setShowSocialPanel(false);
                    openUserProfile(id);
                  }}
                  onDM={(id, profile) => {
                    setActiveDm({ id, profile });
                    setMsgTab('direct');
                    setView('messages');
                    setShowSocialPanel(false);
                  }}
                />
              ));
            })()}
          </div>
        </div>
      )}

      {/* Floating Social button — bottom right, always visible in lobby */}
      {!activeRoom && (
        <button
          onClick={() => setShowSocialPanel(!showSocialPanel)}
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 90,
            width: 52, height: 52, borderRadius: '50%',
            background: 'linear-gradient(135deg, #1877f2, #6c47ff)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 25px rgba(24,119,242,0.4)',
            transition: 'transform 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          title="Social"
        >
          <Users size={22} color="white" />
        </button>
      )}

      {/* Focused Video Modal */}
      {focusedVideoParticipant && focusedVideoParticipant.cameraTrack && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-black/90 backdrop-blur-md animate-fade-in" onClick={() => setFocusedVideoParticipant(null)}>
          <div className="relative w-full max-w-5xl aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10" onClick={e => e.stopPropagation()}>
            <VideoTrack track={focusedVideoParticipant.cameraTrack} className="w-full h-full object-contain" />
            <div className="absolute bottom-6 left-6 px-4 py-2 bg-black/60 backdrop-blur-md rounded-xl text-white font-bold text-lg">
              {focusedVideoParticipant.name || 'User'}
            </div>
            <button onClick={() => setFocusedVideoParticipant(null)} className="absolute top-6 right-6 p-3 rounded-full bg-black/50 hover:bg-white/20 text-white transition-colors backdrop-blur-md">
              <X size={24} />
            </button>
          </div>
        </div>
      )}
    </div>
  );

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
                <line x1={nodeLines.x1} y1={nodeLines.y1} x2={nodeLines.cx1} y2={nodeLines.cy1} stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
                <line x1={nodeLines.x1} y1={nodeLines.y1} x2={nodeLines.cx2} y2={nodeLines.cy2} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
                <line x1={nodeLines.x1} y1={nodeLines.y1} x2={nodeLines.cx3} y2={nodeLines.cy3} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                <circle cx={nodeLines.cx1} cy={nodeLines.cy1} r="3" fill="rgba(255,255,255,0.2)" />
                <circle cx={nodeLines.cx2} cy={nodeLines.cy2} r="2" fill="rgba(255,255,255,0.15)" />
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
                <clipPath id="faceClip"><ellipse cx="100" cy="105" rx="62" ry="72" /></clipPath>
              </defs>
              <ellipse cx="100" cy="105" rx="62" ry="72" fill="#fff" stroke="#fff" strokeWidth="0" />
              <path d="M38,105 Q38,140 60,160 Q80,178 100,180 Q120,178 140,160 Q162,140 162,105" fill="#f0f0f0" />
              <ellipse cx="100" cy="185" rx="16" ry="4" fill="#e0e0e0" />
              <path d="M84,185 Q100,200 116,185" fill="none" stroke="#ccc" strokeWidth="6" strokeLinecap="round" />
              <path d="M62,80 Q80,65 100,70 Q120,65 138,80" fill="none" stroke="#111" strokeWidth="14" strokeLinecap="round" />
              <path d="M55,68 Q70,40 100,35 Q130,40 145,68" fill="#111" stroke="#111" strokeWidth="2" />
              <path d="M50,72 Q65,42 100,37 Q135,42 150,72 Q145,85 100,82 Q55,85 50,72Z" fill="#111" />
              <circle id="leye" cx="78" cy="108" r="18" fill="#fff" stroke="#111" strokeWidth="3" />
              <circle id="reye" cx="122" cy="108" r="18" fill="#fff" stroke="#111" strokeWidth="3" />
              <circle id="lpupil" cx={78 + pupilOffset.x} cy={108 + pupilOffset.y} r="7" fill="#111" />
              <circle id="rpupil" cx={122 + pupilOffset.x} cy={108 + pupilOffset.y} r="7" fill="#111" />
              <circle cx="80" cy="105" r="2.5" fill="#fff" />
              <circle cx="124" cy="105" r="2.5" fill="#fff" />
              <rect x="56" y="95" width="44" height="26" rx="14" fill="none" stroke="#111" strokeWidth="3" />
              <rect x="100" y="95" width="44" height="26" rx="14" fill="none" stroke="#111" strokeWidth="3" />
              <path d="M100,95 L100,121" stroke="#111" strokeWidth="2" />
              <path d="M56,108 L44,108" stroke="#111" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M144,108 L156,108" stroke="#111" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M88,135 Q100,145 112,135" fill="none" stroke="#111" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M100,180 L94,205 M100,180 L106,205" stroke="#ccc" strokeWidth="6" strokeLinecap="round" />
              <rect x="60" y="200" width="80" height="20" rx="10" fill="#ddd" />
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
        {/* Guidelines View */}
        <div className={view === 'guidelines' ? 'block' : 'hidden'}>
          <Guidelines onBack={() => { setView('lobby'); window.history.pushState({}, '', '/'); }} />
        </div>

        {/* Messages View */}
        <div className={view === 'messages' ? "flex flex-col h-[calc(100vh-73px)] bg-bg-base overflow-hidden" : "hidden"}>
          <div className="flex border-b border-border-color bg-bg-surface px-4 py-2 gap-4 flex-shrink-0 items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => { setActiveDm(null); setMsgTab('global'); }}
                className={`px-4 py-2 font-bold text-sm rounded-xl transition-all ${!activeDm && msgTab === 'global' ? 'bg-[var(--accent-primary)] text-white shadow-[0_0_15px_var(--accent-primary-glow)]' : 'text-text-secondary hover:text-text-primary hover:bg-white/5'}`}
              >
                Global Chat
              </button>
              <button
                onClick={() => { setActiveDm(null); setMsgTab('direct'); }}
                className={`px-4 py-2 font-bold text-sm rounded-xl transition-all ${(activeDm || msgTab === 'direct') ? 'bg-[var(--accent-primary)] text-white shadow-[0_0_15px_var(--accent-primary-glow)]' : 'text-text-secondary hover:text-text-primary hover:bg-white/5'}`}
              >
                Direct Messages
              </button>
            </div>

            {activeRoom && (
              <button
                onClick={() => { setView('lobby'); window.location.hash = 'lobby'; }}
                className="px-3.5 py-1.5 bg-[var(--accent-primary)]/20 hover:bg-[var(--accent-primary)]/30 border border-[var(--accent-primary)]/40 text-[var(--accent-primary)] font-bold text-xs rounded-xl flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Return to Call ({activeRoom.name || 'Room'})</span>
              </button>
            )}
          </div>

          <div className="flex-1 min-h-0 relative overflow-hidden">
            {activeDm ? (
              <DirectMessage conversationId={activeDm.id} currentUser={user} targetProfile={activeDm.profile} onBack={() => setActiveDm(null)} openUserProfile={openUserProfile} />
            ) : msgTab === 'global' ? (
              <Suspense
                fallback={(
                  <div className="flex min-h-[100dvh] w-full items-center justify-center bg-bg-base text-text-primary">
                    <div className="w-full max-w-2xl rounded-[2rem] border border-border-color bg-bg-base px-6 py-8 shadow-2xl mx-4">
                      <div className="flex items-center gap-3 mb-5"><div className="h-3 w-3 rounded-full bg-[var(--accent-primary)] animate-pulse" /><span className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--accent-primary)]">Talk34 Live Chat</span></div>
                      <div className="h-8 w-48 rounded-full bg-white/5 mb-4" />
                      <div className="space-y-3"><div className="h-28 rounded-3xl border border-border-color bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))]" /><div className="h-16 rounded-3xl border border-border-color bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))]" /></div>
                      <div className="mt-6 h-12 rounded-2xl border border-border-color bg-bg-surface" />
                    </div>
                  </div>
                )}
              >
                <GlobalChatView user={user} onSignIn={() => setShowAuthModal(true)} />
              </Suspense>
            ) : (
              <MessagesView currentUser={user} onOpenConversation={(convoId, profile) => setActiveDm({ id: convoId, profile })} />
            )}
          </div>
        </div>

        {/* Community Feed View */}
        <div className={view === 'feed' ? 'block' : 'hidden'}>
          <CommunityFeed user={user} openUserProfile={openUserProfile} onBack={() => { setView('lobby'); window.history.pushState({}, '', '/'); }} />
        </div>

        {/* Premium Subscription View */}
        <div className={view === 'premium' ? 'block' : 'hidden'}>
          <PremiumSubscription user={user} onBack={() => { setView('lobby'); window.history.pushState({}, '', '/'); }} />
        </div>

        {/* Leaderboard View */}
        <div className={view === 'leaderboard' ? 'block' : 'hidden'}>
          <Leaderboard user={user} onBack={() => { setView('lobby'); window.history.pushState({}, '', '/'); }} openUserProfile={openUserProfile} />
        </div>

        <div className={view !== 'lobby' || activeRoom ? 'hidden' : "w-full pb-28 flex flex-col items-center min-h-screen"}>

          {/* Global Header — Apple Grade Glassmorphism */}
          <header className="w-full flex items-center justify-between px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 bg-[#0B0D14]/80 backdrop-blur-2xl sticky top-0 z-30 border-b border-white/[0.08] shadow-[0_4px_30px_rgba(0,0,0,0.5)]">

            {/* Left: Actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => { if (user) setShowCreateModal(true); else setShowAuthModal(true); }}
                className="px-3 sm:px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold rounded-xl text-xs sm:text-[13px] flex items-center gap-1.5 transition-all shadow-[0_4px_16px_rgba(37,99,235,0.4)] hover:scale-105 active:scale-95 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" /> <span>Start a Room</span>
              </button>

              <button
                onClick={() => { setView('premium'); window.location.hash = 'premium'; }}
                className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all hover:scale-105 active:scale-95 whitespace-nowrap shadow-sm"
                style={{
                  background: 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(245,158,11,0.15))',
                  border: '1px solid rgba(251,191,36,0.4)',
                  color: '#fbbf24'
                }}
              >
                <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span>Go Premium</span>
              </button>
            </div>

            {/* Center: Brand Identity */}
            <div className="flex items-center justify-center min-w-0 mx-2">
              <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setView('lobby')}>
                <span className="text-xl sm:text-3xl font-black tracking-tight text-white flex items-center select-none">
                  solith
                  <span className="text-[#3B82F6] font-bold flex items-center">
                    .
                    <span className="relative inline-block mx-[1px]">
                      <span className="opacity-0">i</span>
                      <span className="absolute inset-0 flex justify-center">
                        <span className="absolute bottom-0 leading-none">ı</span>
                        <span className="absolute bottom-[60%] sm:bottom-[65%] w-[10px] h-[10px] sm:w-[15px] sm:h-[15px] rounded-full overflow-hidden bg-white shadow-sm pointer-events-none z-10 border border-[#3B82F6]/20">
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
            <div className="flex items-center justify-end gap-2 sm:gap-4">

              {/* More Dropdown */}
              <div className="relative group">
                <button className="text-text-secondary hover:text-text-primary p-2 rounded-xl transition-colors hidden sm:block">
                  <MoreVertical className="w-5 h-5" />
                </button>
                <div className="absolute right-0 top-full mt-2 w-48 bg-bg-surface-elevated border border-border-color rounded-xl shadow-xl opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-all flex flex-col p-2 z-50">
                  <button className="text-left px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg flex items-center gap-2" onClick={() => setActiveModal('privacy')}><Shield className="w-4 h-4" /> Privacy Policy</button>
                  <button className="text-left px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg flex items-center gap-2" onClick={() => setActiveModal('contact')}><MessageSquare className="w-4 h-4" /> Contact Us</button>
                  <button className="text-left px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg flex items-center gap-2" onClick={() => setActiveModal('about')}><Info className="w-4 h-4" /> About Us</button>
                  <button className="text-left px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg flex items-center gap-2" onClick={() => window.open('https://facebook.com', '_blank')}><Facebook className="w-4 h-4" /> Facebook Group</button>
                </div>
              </div>

              {user ? (
                <>
                  {/* Level / XP */}
                  <div className="hidden lg:flex items-center gap-2 text-[13px] font-semibold text-text-secondary bg-bg-surface border border-white/5 px-3 py-1.5 rounded-full" title="Your current Level and XP">
                    <div className="w-2 h-2 rounded-full bg-[var(--accent-primary)] shadow-[0_0_8px_var(--accent-primary-glow)]"></div>
                    <span className="text-text-primary">Lvl {levelInfo ? levelInfo.level : 1}</span>
                    <span className="text-white/30">•</span>
                    <span>{(user?.xp || 0).toLocaleString()} XP</span>
                  </div>

                  {/* Streak */}
                  <button
                    onClick={() => setShowStreakCard(!showStreakCard)}
                    className="hidden sm:flex items-center gap-1.5 text-[13px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-3 py-1.5 rounded-full hover:bg-orange-500/20 transition-all relative"
                    title={`${user.streak || 1} Day Streak`}
                  >
                    <span className="animate-pulse">🔥</span>
                    <span>{user.streak || 1}</span>
                  </button>

                  {/* Streak & League Card */}
                  {showStreakCard && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowStreakCard(false)}></div>
                      <div className="absolute right-12 top-full mt-2 z-50 w-[360px] rounded-2xl overflow-hidden animate-fade-in"
                        style={{ background: 'linear-gradient(180deg, #1a1d28 0%, #12141c 100%)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}>

                        {/* Streak Header */}
                        <div className="px-6 pt-6 pb-4 text-center relative">
                          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>
                          <div className="text-5xl mb-2">🔥</div>
                          <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">{user.streak || 1}</div>
                          <div className="text-xs font-bold uppercase tracking-[0.2em] text-orange-400/80 mt-1">Day Streak</div>
                        </div>

                        {/* Weekly Calendar */}
                        <div className="px-6 pb-4">
                          <div className="flex items-center justify-between gap-1">
                            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
                              const today = new Date().getDay();
                              const dayIndex = today === 0 ? 6 : today - 1;
                              const isActive = i <= dayIndex;
                              const isToday = i === dayIndex;
                              return (
                                <div key={i} className="flex flex-col items-center gap-1.5">
                                  <span className="text-[10px] font-semibold text-white/30">{day}</span>
                                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${isToday ? 'bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)] scale-110' :
                                      isActive ? 'bg-orange-500/20 text-orange-400' : 'bg-white/5 text-white/20'
                                    }`}>
                                    {isActive ? '🔥' : '·'}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Divider */}
                        <div className="mx-6 h-px bg-white/5"></div>

                        {/* XP Progress */}
                        <div className="px-6 py-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-white/60">{levelInfo?.title || 'A1 Beginner'}</span>
                            <span className="text-xs font-bold text-[var(--accent-primary)]">{(user.xp || 0).toLocaleString()} XP</span>
                          </div>
                          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${xpPercentage}%`, background: 'linear-gradient(90deg, #3B82F6, #8B5CF6)' }}>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[10px] text-white/30">Lvl {levelInfo?.level || 1}</span>
                            <span className="text-[10px] text-white/30">{levelInfo?.next === 'MAX' ? 'MAX' : `Next: ${levelInfo?.next}`}</span>
                          </div>
                        </div>

                        {/* Divider */}
                        <div className="mx-6 h-px bg-white/5"></div>

                        {/* League Section */}
                        <div className="px-6 py-4">
                          <div className="text-xs font-bold uppercase tracking-wider text-white/40 mb-3">Your League</div>
                          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div className="text-3xl">
                              {(user.xp || 0) >= 1500 ? '👑' : (user.xp || 0) >= 1000 ? '💎' : (user.xp || 0) >= 600 ? '🥇' : (user.xp || 0) >= 300 ? '🥈' : (user.xp || 0) >= 100 ? '🥉' : '🌱'}
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-bold text-white">
                                {(user.xp || 0) >= 1500 ? 'Master League' : (user.xp || 0) >= 1000 ? 'Diamond League' : (user.xp || 0) >= 600 ? 'Gold League' : (user.xp || 0) >= 300 ? 'Silver League' : (user.xp || 0) >= 100 ? 'Bronze League' : 'Starter League'}
                              </div>
                              <div className="text-[11px] text-white/40 mt-0.5">
                                {(user.xp || 0) >= 1500 ? 'Top tier — you\'re a legend!' : `${((user.xp || 0) >= 1000 ? 1500 : (user.xp || 0) >= 600 ? 1000 : (user.xp || 0) >= 300 ? 600 : (user.xp || 0) >= 100 ? 300 : 100) - (user.xp || 0)} XP to next league`}
                              </div>
                            </div>
                          </div>

                          {/* League Tiers */}
                          <div className="grid grid-cols-6 gap-1.5 mt-3">
                            {[
                              { emoji: '🌱', name: 'Starter', min: 0 },
                              { emoji: '🥉', name: 'Bronze', min: 100 },
                              { emoji: '🥈', name: 'Silver', min: 300 },
                              { emoji: '🥇', name: 'Gold', min: 600 },
                              { emoji: '💎', name: 'Diamond', min: 1000 },
                              { emoji: '👑', name: 'Master', min: 1500 },
                            ].map((tier) => {
                              const isActive = (user.xp || 0) >= tier.min;
                              return (
                                <div key={tier.name} className={`flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all ${isActive ? 'bg-white/5' : 'opacity-30'}`} title={`${tier.name}: ${tier.min}+ XP`}>
                                  <span className="text-base">{tier.emoji}</span>
                                  <span className="text-[8px] font-bold text-white/50 truncate">{tier.name}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 pb-5 pt-1">
                          <button
                            onClick={() => { setShowStreakCard(false); setView('leaderboard'); }}
                            className="w-full py-2.5 rounded-xl text-xs font-bold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                          >
                            <Trophy className="w-3.5 h-3.5" /> View Leaderboard
                          </button>
                        </div>
                      </div>
                    </>
                  )}

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

          {/* Main Content Area — hidden when in a room */}
          {!activeRoom && (
            <>
            <div className="w-full max-w-[1400px] px-3 sm:px-6 lg:px-8 py-3 sm:py-8 flex flex-col items-center gap-3 sm:gap-5 relative">

            {/* Main Hero Video Banner */}
            <div className="w-full relative rounded-2xl border border-white/10 overflow-hidden shadow-2xl bg-black group">
              <video
                src="/freevideo.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-[150px] sm:h-[240px] lg:h-[300px] object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A0B0E] via-[#0A0B0E]/20 to-transparent pointer-events-none"></div>
              <div className="absolute bottom-4 sm:bottom-6 left-0 right-0 text-center z-10 px-3 pointer-events-none">
                <h2 className="text-xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight mb-1 sm:mb-2 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">Practice languages live on solith.in</h2>
                <p className="text-xs sm:text-base text-white/90 max-w-lg mx-auto leading-normal sm:leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] font-medium">
                  Join live voice rooms, talk with native speakers, and improve your pronunciation in real-time.
                </p>
              </div>
            </div>

            {/* Full Width Search Row */}
            <div className="w-full flex flex-row items-center gap-2 md:gap-4 bg-bg-base/60 backdrop-blur-md p-2 rounded-2xl border border-white/10 shadow-2xl overflow-hidden focus-within:border-[var(--accent-primary)] focus-within:bg-bg-base transition-all">
              <div className="relative flex-1 min-w-0 group flex items-center pl-3 md:pl-4 gap-2 md:gap-3">
                <Search className="w-5 h-5 flex-shrink-0 text-text-secondary group-focus-within:text-[var(--accent-primary)] transition-colors pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search rooms..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 py-3 md:py-4 pr-4 text-[14px] md:text-[15px] bg-transparent focus:outline-none text-text-primary placeholder:text-text-secondary border-none shadow-none font-medium relative z-0"
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
                  className="p-2 md:p-2.5 text-text-secondary hover:text-[var(--accent-primary)] bg-transparent hover:bg-white/5 rounded-lg transition-all mr-1"
                  title="Leaderboard"
                >
                  <Trophy className="w-4 h-4 md:w-5 md:h-5" />
                </button>
                <button
                  onClick={() => setShowSocialPanel(!showSocialPanel)}
                  style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: showSocialPanel ? '#1877f2' : 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                  title="Social">
                  <Users size={18} color="white" />
                </button>

                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/5">
                  {[3, 2, 1].map(cols => (
                    <button
                      key={cols}
                      onClick={() => setLobbyGridCols(cols)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${lobbyGridCols === cols
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-text-secondary hover:text-white'
                        }`}
                      title={`${cols}x Density`}
                    >
                      {cols}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Filters — Wrapped on Mobile and Desktop */}
          <div className="w-full max-w-[1400px] px-3 sm:px-6 lg:px-8 pt-2 pb-4 flex items-center justify-start gap-2 flex-wrap">
            {LANGUAGES.map(lang => (
              <button
                key={lang}
                onClick={() => setSelectedLanguage(lang)}
                className={`filter-pill text-[11px] uppercase tracking-wider font-extrabold whitespace-nowrap transition-all duration-200 ${selectedLanguage === lang ? 'active shadow-[0_4px_20px_rgba(37,99,235,0.4)] scale-[1.03]' : 'hover:border-white/20 hover:scale-[1.02]'
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
              <div className={`grid gap-4 ${lobbyGridCols === 3
                ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                : lobbyGridCols === 2
                  ? 'grid-cols-1 md:grid-cols-2'
                  : 'grid-cols-1'
                }`}>
                {filteredRooms.map(room => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    inThisRoom={activeRoom?.id === room.id}
                    onJoin={(roomToJoin) => joinVoiceRoom(roomToJoin)}
                    userFollowing={user?.following || []}
                    isJoining={joiningRoomId === room.id}
                    anyRoomJoining={!!joiningRoomId}
                  />
                ))}
              </div>
            )}
          </div>
          </>
          )}
        </div>

        {/* Active Room */}
        {(() => {
          if (!activeRoom) return null;

          const currentRoomData = rooms.find(r => r?.id === activeRoom?.id) || activeRoom;
          const safeParticipants = (participants || []).filter(p => p != null && p.id != null);
          const speakingQueue = currentRoomData.speakingQueue || [];
          const allowedSpeakers = currentRoomData.allowedSpeakers || [];
          const isOpenMic = currentRoomData.isOpenMic;
          const myRole = getRole(user?.id);
          const isHostOrCoHost = myRole === 'owner' || myRole === 'co-host';
          const isAllowedSpeaker = allowedSpeakers.includes(user?.id);
          const isListener = !isHostOrCoHost && !isAllowedSpeaker && !isOpenMic;
          const hasRaisedHand = speakingQueue.includes(user?.id);

          if (view !== 'lobby') {
            return (
              <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9990] animate-fade-in flex items-center gap-3 bg-[#0D1117]/95 backdrop-blur-2xl border border-white/10 px-4 py-2.5 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] text-white select-none">
                <div 
                  className="flex items-center gap-2 cursor-pointer group"
                  onClick={() => { setView('lobby'); window.location.hash = 'lobby'; }}
                  title="Click to return to active call"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                  <span className="text-xs font-bold text-white group-hover:text-[var(--accent-primary)] transition-colors max-w-[150px] truncate">
                    {activeRoom.name || 'Active Room'}
                  </span>
                  <span className="text-[10px] text-white/60 bg-white/10 px-2 py-0.5 rounded-full font-mono flex-shrink-0">
                    {safeParticipants.length} {safeParticipants.length === 1 ? 'user' : 'users'}
                  </span>
                </div>

                <div className="h-4 w-[1px] bg-white/15" />

                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleMute}
                    className={`p-2 rounded-xl border transition-all ${
                      isMuted 
                        ? 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30' 
                        : 'bg-white/5 text-white border-white/10 hover:bg-white/10'
                    }`}
                    title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                  >
                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-400" />}
                  </button>

                  <button
                    onClick={() => { setView('lobby'); window.location.hash = 'lobby'; }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs rounded-xl shadow-md transition-all hover:scale-105 active:scale-95"
                    title="Return to Call"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Return to Call</span>
                  </button>

                  <button
                    onClick={leaveVoiceRoom}
                    className="p-2 bg-red-600/80 hover:bg-red-600 text-white rounded-xl transition-all hover:scale-105"
                    title="Leave Call"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div className="call-room-bg font-sans animate-fade-in w-full h-screen relative flex flex-col overflow-hidden">
              {callState === 'joining' && (
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  color: 'rgba(255,255,255,0.6)', fontSize: 16, fontWeight: 600,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                  zIndex: 100
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    border: '3px solid rgba(24,119,242,0.3)',
                    borderTop: '3px solid #1877f2',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Connecting to room...
                </div>
              )}

              {/* Top Floating Controls — icon-only pill */}
              <div style={{
                position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(15,21,32,0.85)', backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16, padding: '8px 12px', zIndex: 50
              }}>
                <button onClick={toggleMute} style={{
                  width: 48, height: 48, borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: isMuted ? '#1877f2' : 'rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {isMuted ? <MicOff size={20} color="white" /> : <Mic size={20} color="white" />}
                </button>

                <button onClick={toggleCamera} style={{
                  width: 48, height: 48, borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: isCameraOn ? '#1877f2' : 'rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Camera size={20} color="white" />
                </button>

                <button onClick={toggleScreenShare} style={{
                  width: 48, height: 48, borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: isScreenSharing ? '#1877f2' : 'rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Monitor size={20} color="white" />
                </button>

                <button style={{
                  width: 48, height: 48, borderRadius: 12, border: 'none', cursor: 'default',
                  background: 'rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'block' }} />
                  <BarChart2 size={18} color="white" />
                </button>

                <button onClick={leaveVoiceRoom} style={{
                  width: 48, height: 48, borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: '#dc2626',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <LogOut size={20} color="white" />
                </button>
              </div>

              {/* Game lobby overlay */}
              {gameLobby && !activeGame && (
                <GameLobby
                  gameLobby={gameLobby}
                  currentUser={user}
                  onAccept={() => socket.emit('game-accept', {
                    roomId: activeRoom.id,
                    player: { id: user.id, name: user.name, photoUrl: user.photoUrl, color: user.color }
                  })}
                  onCancel={() => socket.emit('game-cancel', { roomId: activeRoom.id, userId: user.id })}
                  onStart={() => socket.emit('game-start', { roomId: activeRoom.id, userId: user.id })}
                />
              )}

              {/* Active game scrabble full screen view */}
              {activeGame && activeGame.type === 'scrabble' && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 150, background: 'rgba(0,0,0,0.85)', overflow: 'auto' }}>
                  <ScrabbleGame
                    activeGame={activeGame}
                    currentUser={user}
                    socket={socket}
                    roomId={activeRoom.id}
                  />
                  <button onClick={() => socket.emit('game-end', { roomId: activeRoom.id, userId: user.id })}
                    style={{ position: 'absolute', top: 12, right: 12, background: '#dc2626', border: 'none', borderRadius: 8, padding: '6px 12px', color: 'white', cursor: 'pointer', fontWeight: 700 }}>
                    End Game
                  </button>
                </div>
              )}

              {/* Participant Grid / Presenter View */}
              {(() => {
                const screenSharingParticipant = safeParticipants.find(p => p.isScreenSharing);
                const hasPresenterContent = screenSharingParticipant || ytVideoId || activeGame;

                if (hasPresenterContent) {
                  return (
                    <div className="flex flex-col lg:flex-row flex-1 w-full h-full p-4 md:p-8 pt-24 pb-32 gap-6 overflow-hidden">
                      {/* Large Screen Share / YouTube Viewer / Game */}
                      <div className="flex-1 flex flex-col bg-bg-surface rounded-3xl border border-white/5 overflow-hidden shadow-2xl relative min-h-[300px]">
                        {activeGame ? (
                          <GameContainer activeGame={activeGame} socket={socket} roomId={activeRoom.id} currentUser={user} />
                        ) : screenSharingParticipant ? (
                          <>
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
                          </>
                        ) : (
                          <>
                            <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 text-xs text-text-primary">
                              <Youtube className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                              <span>Shared YouTube Video (Shared by {ytSharingUser})</span>
                              <button onClick={() => socket.emit('yt-share', { roomId: activeRoom.id, videoId: null, sharingUser: null })} className="ml-2 px-2 py-0.5 bg-red-500/20 hover:bg-red-500/40 text-red-300 rounded-lg transition-colors text-[10px] font-bold">Stop</button>
                            </div>
                            <div className="flex-1 w-full h-full bg-black">
                              <iframe
                                src={`https://www.youtube.com/embed/${ytVideoId}?autoplay=1&enablejsapi=1`}
                                className="w-full h-full border-0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            </div>
                          </>
                        )}
                      </div>
                      {/* Side Participant List */}
                      <div className="w-full lg:w-[240px] flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto lg:overflow-x-hidden hide-scrollbar py-2 justify-start items-center">
                        {safeParticipants.map(p => {
                          const isSpeaking = (audioLevels[p.id] || 0) > 0.05;
                          const backendP = currentRoomData.participants?.find(bp => bp?.id === p?.id);
                          const pPhotoUrl = getAvatarUrl(p.isLocal ? user?.photoUrl : (backendP?.photoUrl || p.photoUrl), p.id);
                          const pColor = p.isLocal ? (user?.color || '#1877f2') : (backendP?.color || p.color || '#333');
                          const pName = p.isLocal ? 'You' : (backendP?.name || p.name || 'User');
                          const targetRole = getRole(p.id);

                          return (
                            <div key={p.id}
                              onClick={() => !p.isLocal && setActiveActionUser(p)}
                              className="group flex-shrink-0"
                              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: p.isLocal ? 'default' : 'pointer' }}
                            >
                              <div style={{
                                width: 80, height: 80, borderRadius: '50%', overflow: 'hidden',
                                border: isSpeaking ? (p.isAI ? '2.5px solid #a855f7' : '2.5px solid #1877f2') : '2.5px solid rgba(255,255,255,0.12)',
                                boxShadow: isSpeaking ? (p.isAI ? '0 0 20px rgba(168,85,247,0.6)' : '0 0 20px rgba(24,119,242,0.6)') : 'none',
                                transition: 'all 0.2s ease',
                                background: pColor, position: 'relative', flexShrink: 0
                              }}>
                                {p.isCameraOn && p.cameraTrack ? (
                                  <VideoTrack track={p.cameraTrack} className="w-full h-full object-cover" />
                                ) : pPhotoUrl ? (
                                  <img
                                    src={pPhotoUrl}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    alt=""
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.parentNode.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;color:white">${pName.slice(0, 2).toUpperCase()}</div>`;
                                    }}
                                  />
                                ) : (
                                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800, color: 'white' }}>
                                    {pName.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                                {p.muted && (
                                  <div style={{
                                    position: 'absolute', bottom: 3, right: 3,
                                    background: '#dc2626', borderRadius: '50%',
                                    width: 20, height: 20,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    border: '2px solid #080c14'
                                  }}>
                                    <MicOff size={10} color="white" />
                                  </div>
                                )}
                                {!p.isLocal && (
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity" style={{
                                    position: 'absolute', top: 4, right: 4,
                                    background: 'rgba(0,0,0,0.7)', borderRadius: 6, padding: 3
                                  }}>
                                    <Settings size={10} color="white" />
                                  </div>
                                )}
                              </div>
                              <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 600, maxWidth: 80, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {pName}
                              </span>
                              {p.isAI ? (
                                <span style={{ background: 'rgba(168,85,247,0.2)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)', fontSize: 9, fontWeight: 900, padding: '2px 8px', borderRadius: 20, marginTop: -4, letterSpacing: '0.05em' }}>
                                  AI HOST
                                </span>
                              ) : targetRole === 'owner' ? (
                                <span style={{ background: '#6c47ff', color: 'white', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, marginTop: -4 }}>
                                  Owner
                                </span>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                // Default view: Circular participant avatars anchored at the bottom center
                return (
                  <div className="flex-1 w-full h-full relative flex flex-col items-center justify-end overflow-hidden" style={{ paddingBottom: 140 }}>
                    {/* Circular participant avatars */}
                    <div style={{
                      position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)',
                      display: 'flex', alignItems: 'flex-end', gap: 20, zIndex: 10
                    }}>
                      {safeParticipants.map(p => {
                        const isSpeaking = (audioLevels[p.id] || 0) > 0.05;
                        const backendP = currentRoomData.participants?.find(bp => bp?.id === p?.id);
                        const pPhotoUrl = getAvatarUrl(p.isLocal ? user?.photoUrl : (backendP?.photoUrl || p.photoUrl), p.id);
                        const pColor = p.isLocal ? (user?.color || '#1877f2') : (backendP?.color || p.color || '#333');
                        const pName = p.isLocal ? 'You' : (backendP?.name || p.name || 'User');
                        const targetRole = getRole(p.id);

                        return (
                          <div key={p.id}
                            onClick={() => !p.isLocal && setActiveActionUser(p)}
                            className="group"
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: p.isLocal ? 'default' : 'pointer' }}
                          >
                            <div style={{
                              width: 80, height: 80, borderRadius: '50%', overflow: 'hidden',
                              border: isSpeaking ? (p.isAI ? '2.5px solid #a855f7' : '2.5px solid #1877f2') : '2.5px solid rgba(255,255,255,0.12)',
                              boxShadow: isSpeaking ? (p.isAI ? '0 0 20px rgba(168,85,247,0.6)' : '0 0 20px rgba(24,119,242,0.6)') : 'none',
                              transition: 'all 0.2s ease',
                              flexShrink: 0, cursor: (p.isCameraOn && p.cameraTrack) ? 'zoom-in' : 'inherit'
                            }}
                            onClick={(e) => {
                              if (p.isCameraOn && p.cameraTrack) {
                                e.stopPropagation();
                                setFocusedVideoParticipant(p);
                              }
                            }}>
                              {p.isCameraOn && p.cameraTrack ? (
                                <VideoTrack track={p.cameraTrack} className="w-full h-full object-cover" />
                              ) : pPhotoUrl ? (
                                <img
                                  src={pPhotoUrl}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  alt=""
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.parentNode.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;color:white">${pName.slice(0, 2).toUpperCase()}</div>`;
                                  }}
                                />
                              ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800, color: 'white' }}>
                                  {pName.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              {p.muted && (
                                <div style={{
                                  position: 'absolute', bottom: 3, right: 3,
                                  background: '#dc2626', borderRadius: '50%',
                                  width: 20, height: 20,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  border: '2px solid #080c14'
                                }}>
                                  <MicOff size={10} color="white" />
                                </div>
                              )}
                              {!p.isLocal && (
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity" style={{
                                  position: 'absolute', top: 4, right: 4,
                                  background: 'rgba(0,0,0,0.7)', borderRadius: 6, padding: 3
                                }}>
                                  <Settings size={10} color="white" />
                                </div>
                              )}
                            </div>
                            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 600, maxWidth: 80, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {pName}
                            </span>
                            {p.isAI ? (
                              <span style={{ background: 'rgba(168,85,247,0.2)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)', fontSize: 9, fontWeight: 900, padding: '2px 8px', borderRadius: 20, marginTop: -4, letterSpacing: '0.05em' }}>
                                AI HOST
                              </span>
                            ) : targetRole === 'owner' ? (
                              <span style={{ background: '#6c47ff', color: 'white', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, marginTop: -4 }}>
                                Owner
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Room Sidebar Panel — always visible */}
              <RoomPanel
                isChatOpen={true}
                setIsChatOpen={setIsChatOpen}
                chatMessages={chatMessages}
                sendChatMessage={(e, customMsg) => {
                  if (customMsg) {
                    setChatMessages(prev => [...prev, customMsg]);
                    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
                  } else {
                    sendChatMessage(e);
                  }
                }}
                chatInput={chatInput}
                setChatInput={setChatInput}
                chatEndRef={chatEndRef}
                participants={safeParticipants}
                activeRoom={activeRoom}
                user={user}
                setUser={setUser}
                socket={socket}
                ytVideoId={ytVideoId}
                getRole={getRole}
                API_URL={API_URL}
                getAvatarUrl={getAvatarUrl}
                rooms={rooms}
                onlineUserIds={onlineUserIds}
                setActiveDm={setActiveDm}
                setMsgTab={setMsgTab}
                setView={setView}
                joinVoiceRoom={joinVoiceRoom}
                openUserProfile={openUserProfile}
              />

              {/* Bottom Floating Controls */}
              <div style={{
                position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'rgba(15,21,32,0.85)', backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 28, padding: '10px 20px', zIndex: 50
              }}>
                <button onClick={hasRaisedHand ? lowerHand : raiseHand}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22 }}>
                  ✋
                </button>
                <button onClick={() => setIsChatOpen(!isChatOpen)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: isChatOpen ? '#1877f2' : 'rgba(255,255,255,0.5)'
                  }}>
                  <MessageSquare size={20} />
                </button>
                <div className="relative">
                  <button onClick={() => setShowGameSelector(!showGameSelector)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'rgba(255,255,255,0.5)'
                    }}>
                    <MoreVertical size={20} />
                  </button>
                  {/* Replace old game selector */}
                  {showGameSelector && (
                    <GameSelector
                      onSelect={handleGameSelect}
                      onClose={() => setShowGameSelector(false)}
                    />
                  )}
                </div>
              </div>

            </div>
          );
        })()}

        {/* Custom Global Toast */}
        {toastMessage && (
          <div className="fixed top-6 md:top-20 left-1/2 -translate-x-1/2 z-[9999] animate-fade-in pointer-events-none">
            <div className="bg-[#111] backdrop-blur-xl border border-white/10 text-white px-6 py-3.5 rounded-full shadow-2xl flex items-center gap-3 max-w-sm md:max-w-md text-left mx-4 w-max">
              <span className="text-[var(--accent-primary)] flex-shrink-0">
                <AlertCircle className="w-5 h-5" />
              </span>
              <span className="text-sm font-bold truncate leading-tight max-w-[280px]">
                {typeof toastMessage === 'string' ? toastMessage : JSON.stringify(toastMessage)}
              </span>
            </div>
          </div>
        )}
      </>
    )
  );
}
