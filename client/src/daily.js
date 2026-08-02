import DailyIframe from '@daily-co/daily-js';

let callObject = null;
let audioLevelCallback = null;
let participantCallback = null;
let connectionCallback = null;

// Mock session interval timers
let mockSpeakingInterval = null;
let mockActiveSpeakers = {};

export const DailyService = {
  /**
   * Check if Daily.js can be loaded and initialized
   */
  isSupported: () => {
    return DailyIframe.supportedByBrowser();
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
   * Join a room (Real Daily.co connection OR Mock connection)
   */
  join: async (url, token, isReal, localUser) => {
    if (!isReal) {
      console.log('DailyService: Joining in Mock Demo Mode');
      connectionCallback?.({ state: 'joining' });

      // Simulate network latency
      await new Promise(resolve => setTimeout(resolve, 800));

      connectionCallback?.({ state: 'joined', isMock: true });

      // Start simulated speaking pulses for mock participants
      mockActiveSpeakers = {};
      mockSpeakingInterval = setInterval(() => {
        const levels = {};
        // Randomly pick a mock participant to "speak"
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
      participantCallback?.([
        { id: localUser.id, name: localUser.name, isLocal: true, muted: true },
        { id: 'mock-user-1', name: 'Sophia', isLocal: false, muted: false },
        { id: 'mock-user-2', name: 'Hiro', isLocal: false, muted: false },
        { id: 'mock-user-3', name: 'Elena', isLocal: false, muted: true }
      ]);
      return true;
    }

    try {
      console.log(`DailyService: Joining real room: ${url}`);
      connectionCallback?.({ state: 'joining' });

      // Cleanup existing call object
      if (callObject) {
        await callObject.destroy();
      }

      // Create new call object (voice only)
      callObject = DailyIframe.createCallObject({
        subscribeToTracksAutomatically: true,
        dailyConfig: {
          experimentalChromeVideoMuteLight: true,
          // Request audio levels callback
          audioSource: true,
          videoSource: false
        }
      });

      // Bind Daily.co events
      callObject.on('joining-meeting', () => {
        connectionCallback?.({ state: 'joining' });
      });

      callObject.on('joined-meeting', () => {
        connectionCallback?.({ state: 'joined', isMock: false });
        // Set local user details in daily
        callObject.setUserName(localUser.name);
        
        // Start audio level updates
        callObject.startAudioLevelUpdates(200); // update every 200ms
        
        // Trigger initial participant update
        updateParticipantsList();
      });

      callObject.on('left-meeting', () => {
        connectionCallback?.({ state: 'left' });
        cleanupRealCall();
      });

      callObject.on('error', (e) => {
        console.error('Daily Call Object Error:', e);
        connectionCallback?.({ state: 'error', error: e.errorMsg });
      });

      callObject.on('participant-joined', () => {
        updateParticipantsList();
      });

      callObject.on('participant-updated', () => {
        updateParticipantsList();
      });

      callObject.on('participant-left', () => {
        updateParticipantsList();
      });

      callObject.on('audio-level', (e) => {
        // e.participants contains key-value pairs of participantId -> level (0 to 1)
        if (audioLevelCallback && e.participants) {
          audioLevelCallback(e.participants);
        }
      });

      // Join options
      const joinOptions = { url };
      if (token) {
        joinOptions.token = token;
      }

      await callObject.join(joinOptions);
      return true;
    } catch (err) {
      console.error('DailyService.join failed:', err);
      connectionCallback?.({ state: 'error', error: err.message });
      cleanupRealCall();
      throw err;
    }
  },

  /**
   * Leave current room
   */
  leave: async (isReal) => {
    if (!isReal) {
      console.log('DailyService: Leaving Mock Demo Mode');
      if (mockSpeakingInterval) {
        clearInterval(mockSpeakingInterval);
        mockSpeakingInterval = null;
      }
      connectionCallback?.({ state: 'left' });
      return;
    }

    if (callObject) {
      try {
        await callObject.leave();
      } catch (err) {
        console.error('DailyService.leave error:', err);
      } finally {
        cleanupRealCall();
      }
    }
  },

  /**
   * Mute/Unmute local user microphone
   */
  setLocalAudio: (muted, isReal) => {
    if (!isReal) {
      console.log(`DailyService: Set mock audio muted to ${muted}`);
      // Notify client that local participant state updated
      // We read current mock participants and update local user's mute state
      return muted;
    }

    if (callObject) {
      callObject.setLocalAudio(!muted);
      return muted;
    }
    return true;
  }
};

/**
 * Sync daily participants list with React
 */
function updateParticipantsList() {
  if (!callObject) return;

  const participants = callObject.participants();
  const list = Object.values(participants).map(p => ({
    id: p.session_id || p.user_id,
    name: p.user_name || 'Guest Practicer',
    isLocal: p.local,
    muted: !p.audio
  }));

  participantCallback?.(list);
}

/**
 * Destroy call object and reset listeners
 */
function cleanupRealCall() {
  if (callObject) {
    try {
      callObject.stopAudioLevelUpdates();
      callObject.destroy();
    } catch (e) {
      console.warn('Error during Daily teardown:', e);
    }
    callObject = null;
  }
}
