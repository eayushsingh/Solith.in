import { Room, RoomEvent, Track, setLogLevel } from 'livekit-client';

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

  /**
   * Join a room (Real LiveKit connection OR Mock connection)
   */
  join: async (url, token, isReal, localUser) => {


    try {
      console.log(`LiveKitService: Joining real room at: ${url}`);
      connectionCallback?.({ state: 'joining' });

      // Cleanup existing room object if any
      if (roomObject) {
        await cleanupRealCall();
      }

      // Create new Room object
      roomObject = new Room({
        adaptiveStream: false,
        dynacast: false,
        publishDefaults: {
          audioBitrate: 32_000,
        }
      });

      // Bind LiveKit events
      roomObject.on(RoomEvent.Connected, () => {
        connectionCallback?.({ state: 'joined', isMock: false });
        updateParticipantsList();
      });

      roomObject.on(RoomEvent.Disconnected, () => {
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
          // LiveKit provides an array of active participants
          // We'll give active speakers a baseline level of 0.8 to trigger our UI pulsing
          if (speakers) {
            speakers.forEach(speaker => {
              const speakerId = speaker.isLocal ? localUser.id : speaker.identity;
              levels[speakerId] = speaker.audioLevel || 0.8;
            });
          }
          audioLevelCallback(levels);
        }
      });

      // Join the room
      await roomObject.connect(url, token);
      
      // Start microphone muted by default
      await roomObject.localParticipant.setMicrophoneEnabled(false);

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
  setLocalAudio: (muted, isReal) => {


    if (roomObject) {
      roomObject.localParticipant.setMicrophoneEnabled(!muted)
        .catch(err => console.error('Failed to set microphone state:', err));
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
    list.push({
      id: roomObject.localParticipant.identity,
      name: roomObject.localParticipant.name || 'Local User',
      isLocal: true,
      muted: isMuted
    });
  }

  // Add remote participants
  if (roomObject.participants) {
    roomObject.participants.forEach(p => {
      const isMuted = !p.isMicrophoneEnabled;
      list.push({
        id: p.identity,
        name: p.name || 'Guest Practicer',
        isLocal: false,
        muted: isMuted
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
