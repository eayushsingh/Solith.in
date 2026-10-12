import { LiveKitService } from './livekit.js';

describe('LiveKitService Real Participant Behavior', () => {

  test('triggerMockParticipantsList emits only local user and no dummy bots', () => {
    let emittedParticipants = [];
    LiveKitService.setCallbacks({
      onParticipantsChange: (list) => {
        emittedParticipants = list;
      },
      onAudioLevels: () => {},
      onConnectionChange: () => {}
    });

    LiveKitService.localUserMock = {
      id: 'real-user-ayush',
      name: 'Ayush',
      color: '#3B82F6',
      emoji: '👑'
    };

    LiveKitService.triggerMockParticipantsList();

    expect(emittedParticipants).toHaveLength(1);
    expect(emittedParticipants[0].id).toBe('real-user-ayush');
    expect(emittedParticipants[0].name).toBe('Ayush');

    // Confirm that no dummy bot identities exist
    const hasBots = emittedParticipants.some(p => 
      p.id.includes('mock-user') || 
      p.name === 'Sophia' || 
      p.name === 'Hiro' || 
      p.name === 'Elena'
    );
    expect(hasBots).toBe(false);
  });

  test('leave in simulator mode clears all audio level visualizer pulses', async () => {
    let currentLevels = { 'some-user': 0.8 };
    LiveKitService.setCallbacks({
      onParticipantsChange: () => {},
      onAudioLevels: (levels) => {
        currentLevels = levels;
      },
      onConnectionChange: () => {}
    });

    await LiveKitService.leave(false);
    expect(currentLevels).toEqual({});
  });

});
