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
  isCameraMock: false,
  triggerMockParticipantsList: () => {
    const local = LiveKitService.localUserMock || { id: 'local', name: 'You', photoUrl: '', color: '#ff4d4d', emoji: '👤' };
    participantCallback?.([
      { 
        id: local.id, 
        name: local.name, 
        isLocal: true, 
        muted: LiveKitService.isMutedMock, 
        isScreenSharing: LiveKitService.isScreenSharingMock,
        isCameraOn: LiveKitService.isCameraMock,
        photoUrl: local.photoUrl || '', 
        color: local.color || '#0d94a8', 
        emoji: local.emoji || '👤' 
      },
      { id: 'mock-user-1', name: 'Sophia', isLocal: false, muted: false, photoUrl: '', color: '#ff944d', emoji: '🦊' },
      { id: 'mock-user-2', name: 'Hiro', isLocal: false, muted: false, photoUrl: '', color: '#ffd11a', emoji: '🐼' },
      { id: 'mock-user-3', name: 'Elena', isLocal: false, muted: true, photoUrl: '', color: '#4da6ff', emoji: '🦁' }
    ]);
  },

  setLocalCamera: async (enable, isRealCall) => {
    if (!isRealCall) {
      console.log(`LiveKitService: Set mock camera to ${enable}`);
      LiveKitService.isCameraMock = enable;
      LiveKitService.triggerMockParticipantsList();
      return enable;
    }
    try {
      if (roomObject && roomObject.localParticipant) {
        await roomObject.localParticipant.setCameraEnabled(enable);
      }
      return enable;
    } catch (err) {
      console.error('Camera error:', err);
      throw new Error(err.message || 'Camera permission denied or camera device unavailable.');
    }
  },

  setLocalScreenShare: async (enable, isRealCall) => {
    if (!isRealCall) {
      console.log(`LiveKitService: Set mock screen share to ${enable}`);
      LiveKitService.isScreenSharingMock = enable;
      LiveKitService.triggerMockParticipantsList();
      return enable;
    }
    try {
      if (enable) {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
          throw new Error('Screen sharing is not supported on this mobile browser version.');
        }
        await roomObject.localParticipant.setScreenShareEnabled(true);
      } else {
        await roomObject.localParticipant.setScreenShareEnabled(false);
      }
      return enable;
    } catch (err) {
      console.error('Screen share error:', err);
      throw new Error(err.message || 'Screen share permission denied or not supported.');
    }
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
      // Validate LiveKit URL is present and looks like a valid WebSocket URL
      if (!livekitUrl || !livekitUrl.startsWith('wss://')) {
        console.error('[LiveKit] Invalid URL rejected:', livekitUrl);
        throw new Error('Invalid LiveKit URL configured. Please check server settings.');
      }
      console.log(`[LiveKit] Connecting to:`, livekitUrl);
      connectionCallback?.({ state: 'joining' });

      // Clean up previous room object if any, ensuring its listeners are removed first
      if (roomObject) {
        const oldRoom = roomObject;
        roomObject = null;
        try {
          oldRoom.removeAllListeners();
          await oldRoom.disconnect();
        } catch (e) {}
      }

      // Create new Room object
      const currentRoom = new Room({
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
      roomObject = currentRoom;

      // Bind LiveKit events specifically scoped to currentRoom
      currentRoom.on(RoomEvent.Connected, () => {
        if (roomObject !== currentRoom) return;
        console.log('LiveKitService: RoomEvent.Connected fired!');
        playSound('join');
        connectionCallback?.({ state: 'joined', isMock: false });
        updateParticipantsList();
      });

      currentRoom.on(RoomEvent.Disconnected, (reason) => {
        if (roomObject !== currentRoom) return;
        console.log('LiveKitService: RoomEvent.Disconnected fired!', reason);
        playSound('leave');
        connectionCallback?.({ state: 'left', reason });
        cleanupRealCall(currentRoom);
      });

      currentRoom.on(RoomEvent.ParticipantConnected, () => {
        if (roomObject !== currentRoom) return;
        updateParticipantsList();
      });

      currentRoom.on(RoomEvent.ParticipantDisconnected, () => {
        if (roomObject !== currentRoom) return;
        updateParticipantsList();
      });

      currentRoom.on(RoomEvent.ParticipantMetadataChanged, () => {
        if (roomObject !== currentRoom) return;
        updateParticipantsList();
      });

      currentRoom.on(RoomEvent.LocalTrackPublished, () => {
        if (roomObject !== currentRoom) return;
        updateParticipantsList();
      });

      currentRoom.on(RoomEvent.LocalTrackUnpublished, () => {
        if (roomObject !== currentRoom) return;
        updateParticipantsList();
      });

      currentRoom.on(RoomEvent.TrackPublished, () => {
        if (roomObject !== currentRoom) return;
        updateParticipantsList();
      });

      currentRoom.on(RoomEvent.TrackUnpublished, () => {
        if (roomObject !== currentRoom) return;
        updateParticipantsList();
      });

      currentRoom.on(RoomEvent.TrackMuted, () => {
        if (roomObject !== currentRoom) return;
        updateParticipantsList();
      });

      currentRoom.on(RoomEvent.TrackUnmuted, () => {
        if (roomObject !== currentRoom) return;
        updateParticipantsList();
      });

      currentRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (roomObject !== currentRoom) return;
        if (track.kind === Track.Kind.Audio) {
          const element = track.attach();
          if (element) {
            element.setAttribute('data-livekit-audio', 'true');
            document.body.appendChild(element);
          }
        }
        updateParticipantsList();
      });

      currentRoom.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
        if (roomObject !== currentRoom) return;
        const detached = track.detach();
        const els = Array.isArray(detached) ? detached : (detached ? [detached] : []);
        els.forEach(el => el.remove());
        updateParticipantsList();
      });

      currentRoom.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        if (roomObject !== currentRoom) return;
        if (audioLevelCallback) {
          const levels = {};
          if (speakers) {
            speakers.forEach(speaker => {
              const speakerId = speaker.isLocal ? (user?.id || 'local') : speaker.identity;
              levels[speakerId] = speaker.audioLevel || 0.8;
            });
          }
          audioLevelCallback(levels);
        }
      });

      // Join the room
      await currentRoom.connect(livekitUrl, token);
      
      // Start microphone muted by default (fire-and-forget for faster join)
      currentRoom.localParticipant?.setMicrophoneEnabled(false).catch(() => {});

      return true;
    } catch (err) {
      console.error('LiveKitService.join failed:', err);
      const isClientDisconnect = err?.message?.toLowerCase().includes('client initiated disconnect');
      if (!isClientDisconnect) {
        connectionCallback?.({ state: 'error', error: err.message });
      }
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
      const toDestroy = roomObject;
      roomObject = null;
      try {
        toDestroy.removeAllListeners();
        await toDestroy.disconnect();
      } catch (err) {
        console.error('LiveKitService.leave error:', err);
      } finally {
        await cleanupRealCall(toDestroy);
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
    const isScreenSharing = !!screenSharePub && !screenSharePub.isMuted && !!screenSharePub.track;
    const screenShareTrack = isScreenSharing ? screenSharePub?.track : null;

    const cameraPub = videoPubs ? Array.from(videoPubs.values()).find(pub => pub.source === Track.Source.Camera) : null;
    const isCameraOn = !!cameraPub && !cameraPub.isMuted && !!cameraPub.track;
    const cameraTrack = isCameraOn ? cameraPub?.track : null;
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
      emoji: meta.emoji || '👤',
      profileAnimation: meta.profileAnimation || 'none'
    });
  }

  // Add remote participants
  if (roomObject.remoteParticipants) {
    roomObject.remoteParticipants.forEach(p => {
      const isMuted = !p.isMicrophoneEnabled;
      const videoPubs = p.videoTrackPublications;
      const screenSharePub = videoPubs ? Array.from(videoPubs.values()).find(pub => pub.source === Track.Source.ScreenShare) : null;
      const isScreenSharing = !!screenSharePub && !screenSharePub.isMuted && !!screenSharePub.track;
      const screenShareTrack = isScreenSharing ? screenSharePub?.track : null;

      const cameraPub = videoPubs ? Array.from(videoPubs.values()).find(pub => pub.source === Track.Source.Camera) : null;
      const isCameraOn = !!cameraPub && !cameraPub.isMuted && !!cameraPub.track;
      const cameraTrack = isCameraOn ? cameraPub?.track : null;
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
        isAI: isAI,
        profileAnimation: meta.profileAnimation || 'none'
      });
    });
  }

  participantCallback?.(list);
}

/**
 * Destroy room object and reset listeners
 */
async function cleanupRealCall() {
  if (typeof document !== 'undefined') {
    document.querySelectorAll('[data-livekit-audio="true"]').forEach(el => el.remove());
  }
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
