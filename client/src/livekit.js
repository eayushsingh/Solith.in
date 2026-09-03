import { Room, RoomEvent, Track, setLogLevel } from 'livekit-client';
import { playSound } from './utils/sounds';

let roomObject = null;
let audioLevelCallback = null;
let participantCallback = null;
let connectionCallback = null;

// Mock session interval timers
let mockSpeakingInterval = null;
let mockActiveSpeakers = {};

export const LiveKitService = {
  /**
   * Check if LiveKit is supported by the browser
   */
  isSupported: () => {
    return Room.isSupported;
  },

  /**
   * Set up event callbacks from the UI layer
   */
  setCallbacks: ({ onAudioLevels, onParticipantsChange, onConnectionChange }) => {
    audioLevelCallback = onAudioLevels;
    participantCallback = onParticipantsChange;
    connectionCallback = onConnectionChange;
  },

  localUserMock: null,
  isMutedMock: true,
  isScreenSharingMock: false,
  triggerMockParticipantsList: () => {
    const local = LiveKitService.localUserMock || { id: 'local', name: 'You', photoUrl: '', color: '#ff4d4d', emoji: '👤' };
    participantCallback?.([
      { 
        id: local.id, 
        name: local.name, 
        isLocal: true, 
        muted: LiveKitService.isMutedMock, 
        isScreenSharing: LiveKitService.isScreenSharingMock,
        photoUrl: local.photoUrl || '', 
        color: local.color || '#0d94a8', 
        emoji: local.emoji || '👤' 
      },
      { id: 'mock-user-1', name: 'Sophia', isLocal: false, muted: false, photoUrl: '', color: '#ff944d', emoji: '🦊' },
      { id: 'mock-user-2', name: 'Hiro', isLocal: false, muted: false, photoUrl: '', color: '#ffd11a', emoji: '🐼' },
      { id: 'mock-user-3', name: 'Elena', isLocal: false, muted: true, photoUrl: '', color: '#4da6ff', emoji: '🦁' }
    ]);
  },

  /**
   * Join a room (Real LiveKit connection OR Mock connection)
   */
  join: async (livekitUrl, token, isRealCall, user) => {
    if (!isRealCall) {
      console.log('LiveKitService: Joining in Mock Demo Mode');
      connectionCallback?.({ state: 'joining' });

      // Simulate network latency
      await new Promise(resolve => setTimeout(resolve, 800));

      connectionCallback?.({ state: 'joined', isMock: true });

      // Start simulated speaking pulses for mock participants
      mockActiveSpeakers = {};
      if (mockSpeakingInterval) clearInterval(mockSpeakingInterval);
      mockSpeakingInterval = setInterval(() => {
        const levels = {};
        const mockIds = ['mock-user-1', 'mock-user-2', 'mock-user-3'];
        mockIds.forEach(id => {
          if (Math.random() > 0.6) {
            levels[id] = Math.random() * 0.8 + 0.2; // random volume
          } else {
            levels[id] = 0;
          }
        });
        audioLevelCallback?.(levels);
      }, 1000);

      // Trigger initial mock participant list
      LiveKitService.localUserMock = user;
      LiveKitService.isMutedMock = true;
      LiveKitService.triggerMockParticipantsList();

      return true;
    }

    try {
      // Never connect to Free4Talk's server
      if (!livekitUrl || livekitUrl.includes('freetalk')) {
        console.error('[LiveKit] Invalid URL rejected:', livekitUrl);
        throw new Error('Invalid LiveKit URL configured. Please check server settings.');
      }
      console.log(`[LiveKit] Connecting to:`, livekitUrl);
      connectionCallback?.({ state: 'joining' });

      // Cleanup existing room object if any
      if (roomObject) {
        await cleanupRealCall();
      }

      // Create new Room object
      roomObject = new Room({
        adaptiveStream: false,
        dynacast: false,
        disconnectOnPageLeave: false, // Prevents background ping timeouts
        publishDefaults: {
          audioBitrate: 32_000,
        },
        audioCaptureDefaults: {
          autoGainControl: false, // Fix for "voice is not loud" (prevents browser from aggressively lowering mic volume)
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      // Bind LiveKit events
      roomObject.on(RoomEvent.Connected, () => {
        console.log('LiveKitService: RoomEvent.Connected fired!');
        playSound('join');
        connectionCallback?.({ state: 'joined', isMock: false });
        updateParticipantsList();
      });

      roomObject.on(RoomEvent.Disconnected, () => {
        console.log('LiveKitService: RoomEvent.Disconnected fired!');
        playSound('leave');
        connectionCallback?.({ state: 'left' });
        cleanupRealCall();
      });

      roomObject.on(RoomEvent.ParticipantConnected, () => {
        updateParticipantsList();
      });

      roomObject.on(RoomEvent.ParticipantDisconnected, () => {
        updateParticipantsList();
      });

      roomObject.on(RoomEvent.LocalTrackPublished, () => {
        updateParticipantsList();
      });

      roomObject.on(RoomEvent.LocalTrackUnpublished, () => {
        updateParticipantsList();
      });

      roomObject.on(RoomEvent.TrackPublished, () => {
        updateParticipantsList();
      });

      roomObject.on(RoomEvent.TrackUnpublished, () => {
        updateParticipantsList();
      });

      roomObject.on(RoomEvent.TrackMuted, () => {
        updateParticipantsList();
      });

      roomObject.on(RoomEvent.TrackUnmuted, () => {
        updateParticipantsList();
      });

      roomObject.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const element = track.attach();
          document.body.appendChild(element);
        }
        updateParticipantsList();
      });

      roomObject.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
        const detached = track.detach();
        const els = Array.isArray(detached) ? detached : (detached ? [detached] : []);
        els.forEach(el => el.remove());
        updateParticipantsList();
      });

      roomObject.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        if (audioLevelCallback) {
          const levels = {};
          if (speakers) {
            speakers.forEach(speaker => {
              const speakerId = speaker.isLocal ? user.id : speaker.identity;
              levels[speakerId] = speaker.audioLevel || 0.8;
            });
          }
          audioLevelCallback(levels);
        }
      });

      // Join the room
      await roomObject.connect(livekitUrl, token);
      
      // Start microphone muted by default (fire-and-forget for faster join)
      roomObject.localParticipant.setMicrophoneEnabled(false).catch(() => {});

      return true;
    } catch (err) {
      console.error('LiveKitService.join failed:', err);
      connectionCallback?.({ state: 'error', error: err.message });
      await cleanupRealCall();
      throw err;
    }
  },

  /**
   * Leave current room
   */
  leave: async (isReal) => {
    if (!isReal) {
      console.log('LiveKitService: Leaving Mock Demo Mode');
      if (mockSpeakingInterval) {
        clearInterval(mockSpeakingInterval);
        mockSpeakingInterval = null;
      }
      connectionCallback?.({ state: 'left' });
      return;
    }

    if (roomObject) {
      try {
        await roomObject.disconnect();
      } catch (err) {
        console.error('LiveKitService.leave error:', err);
      } finally {
        await cleanupRealCall();
      }
    }
  },

  /**
   * Mute/Unmute local user microphone
   */
  setLocalAudio: async (muted, isReal) => {
    if (!isReal) {
      console.log(`LiveKitService: Set mock audio muted to ${muted}`);
      LiveKitService.isMutedMock = muted;
      LiveKitService.triggerMockParticipantsList();
      return muted;
    }

    if (roomObject) {
      await roomObject.localParticipant.setMicrophoneEnabled(!muted);
      return muted;
    }
    return true;
  },

  setLocalCamera: async (enable, isRealCall) => {
    if (!isRealCall) return false;
    try {
      if (roomObject && roomObject.localParticipant) {
        await roomObject.localParticipant.setCameraEnabled(enable);
      }
      return enable;
    } catch (err) {
      console.error('Camera error:', err);
      return false;
    }
  },

  setLocalScreenShare: async (enable, isRealCall) => {
    if (!isRealCall) return false;
    try {
      if (enable) {
        await roomObject.localParticipant.setScreenShareEnabled(true);
      } else {
        await roomObject.localParticipant.setScreenShareEnabled(false);
      }
      return enable;
    } catch (err) {
      console.error('Screen share error:', err);
      return false;
    }
  }
};

/**
 * Sync LiveKit participants list with React
 */
function updateParticipantsList() {
  if (!roomObject) return;

  const list = [];
  
  // Add local participant
  if (roomObject.localParticipant) {
    const isMuted = !roomObject.localParticipant.isMicrophoneEnabled;
    const videoPubs = roomObject.localParticipant.videoTrackPublications;
    const screenSharePub = videoPubs ? Array.from(videoPubs.values()).find(pub => pub.source === Track.Source.ScreenShare) : null;
    const isScreenSharing = !!screenSharePub;
    const screenShareTrack = screenSharePub?.track;

    const cameraPub = videoPubs ? Array.from(videoPubs.values()).find(pub => pub.source === Track.Source.Camera) : null;
    const isCameraOn = !!cameraPub;
    const cameraTrack = cameraPub?.track;
    let meta = {};
    try { if (roomObject.localParticipant.metadata) meta = JSON.parse(roomObject.localParticipant.metadata); } catch(e){}
    list.push({
      id: roomObject.localParticipant.identity,
      name: roomObject.localParticipant.name || 'Local User',
      isLocal: true,
      muted: isMuted,
      isScreenSharing: isScreenSharing,
      screenShareTrack: screenShareTrack,
      isCameraOn: isCameraOn,
      cameraTrack: cameraTrack,
      photoUrl: meta.photoUrl || '',
      color: meta.color || '#ff4d4d',
      emoji: meta.emoji || '👤'
    });
  }

  // Add remote participants
  if (roomObject.remoteParticipants) {
    roomObject.remoteParticipants.forEach(p => {
      const isMuted = !p.isMicrophoneEnabled;
      const videoPubs = p.videoTrackPublications;
      const screenSharePub = videoPubs ? Array.from(videoPubs.values()).find(pub => pub.source === Track.Source.ScreenShare) : null;
      const isScreenSharing = !!screenSharePub;
      const screenShareTrack = screenSharePub?.track;

      const cameraPub = videoPubs ? Array.from(videoPubs.values()).find(pub => pub.source === Track.Source.Camera) : null;
      const isCameraOn = !!cameraPub;
      const cameraTrack = cameraPub?.track;
      let meta = {};
      try { if (p.metadata) meta = JSON.parse(p.metadata); } catch(e){}
      const isAI = p.identity.startsWith('agent');
      list.push({
        id: p.identity,
        name: p.name || (isAI ? 'Ananya' : 'Guest Practicer'),
        isLocal: false,
        muted: isMuted,
        isScreenSharing: isScreenSharing,
        screenShareTrack: screenShareTrack,
        isCameraOn: isCameraOn,
        cameraTrack: cameraTrack,
        photoUrl: meta.photoUrl || '',
        color: meta.color || (isAI ? '#8b5cf6' : '#ff4d4d'),
        emoji: meta.emoji || (isAI ? '✨' : '👤'),
        isAI: isAI
      });
    });
  }

  participantCallback?.(list);
}

/**
 * Destroy room object and reset listeners
 */
async function cleanupRealCall() {
  if (roomObject) {
    const toDestroy = roomObject;
    roomObject = null; // clear reference first to prevent reentrancy
    try {
      await toDestroy.disconnect();
    } catch (e) {
      console.warn('Error during LiveKit teardown:', e);
    }
  }
}
