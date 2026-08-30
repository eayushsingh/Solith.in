import { cli, AgentSession, Agent, defineAgent } from '@livekit/agents';
import * as google from '@livekit/agents-plugin-google';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

const SYSTEM_PROMPT = `You are Ananya, a warm, friendly, and engaging AI voice host on Solith.in — a live language learning and conversation platform.

Your personality:
- Warm, encouraging, and enthusiastic about language learning
- You speak clearly and at a natural pace
- You ask thoughtful questions to keep conversation flowing
- You celebrate effort and encourage learners
- You are patient and never condescending

Your role:
- Welcome participants when they join
- Ask about what language they are learning and their goals
- Start interesting conversation topics in English
- Encourage quieter participants to speak up
- Keep energy positive and the room lively

Rules:
- Keep responses to 1-3 sentences maximum
- Never say you are an AI unless directly asked
- Never repeat the same greeting twice
- Speak naturally like a real person, not a robot
- If the room is quiet, ask an interesting question to spark conversation`;

export default defineAgent({
  entry: async (ctx) => {
    console.log(`[Ananya] ✓ Entered room: ${ctx.room.name}`);
    console.log(`[Ananya] Participants: ${ctx.room.remoteParticipants.size}`);

    const port = process.env.PORT || 3000;

    // ─── Broadcast chat function ────────────────────────────────────────────
    const broadcastChat = async (text, senderName, senderId, color) => {
      if (!text || !text.trim()) return;
      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/rooms/${ctx.room.name}/agent-chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: text.trim(),
            speaker: senderName || 'Ananya',
            senderId: senderId || 'ananya-ai',
            color: color || '#6c47ff'
          })
        });
        if (!res.ok) console.warn(`[Ananya] Chat broadcast HTTP ${res.status}`);
      } catch (e) {
        console.warn('[Ananya] Chat broadcast failed:', e.message);
      }
    };

    // ─── Build model ─────────────────────────────────────────────────────────
    const model = new google.realtime.RealtimeModel({
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
      model: 'gemini-2.0-flash-live-001',
      instructions: SYSTEM_PROMPT,
      voice: 'Kore',
      temperature: 0.8,
      responseModalities: ['AUDIO'],
    });

    // ─── Build agent ─────────────────────────────────────────────────────────
    const agent = new Agent({
      llm: model,
      instructions: SYSTEM_PROMPT,
      turnHandling: {
        interruption: { enabled: true }
      }
    });

    // ─── Speech event handlers ───────────────────────────────────────────────
    agent.on('agent_speech_committed', async (ev) => {
      const text = ev?.message?.content
        || ev?.userMessageAdded?.content?.[0]?.text
        || ev?.text
        || null;
      if (text) {
        console.log(`[Ananya] Said: ${text.substring(0, 80)}`);
        await broadcastChat(text, 'Ananya', 'ananya-ai', '#6c47ff');
      }
    });

    agent.on('user_speech_committed', async (ev) => {
      const text = ev?.transcript || ev?.message?.content || ev?.text;
      const participant = ev?.participant;
      if (text && participant && !participant.isAgent) {
        console.log(`[Ananya] User said: ${text.substring(0, 80)}`);
        await broadcastChat(
          text,
          participant.name || participant.identity || 'User',
          participant.identity,
          '#1877f2'
        );
      }
    });

    agent.on('agent_speech_interrupted', () => {
      console.log('[Ananya] Speech interrupted by user');
    });

    // ─── Start session ───────────────────────────────────────────────────────
    console.log('[Ananya] Starting session...');
    const session = new AgentSession();

    try {
      await session.start({ agent, room: ctx.room });
      console.log('[Ananya] ✓ Session started');
    } catch (e) {
      console.error('[Ananya] ✗ Session start failed:', e.message, e.stack);
      return;
    }

    // Publish audio track explicitly
    try {
      await ctx.room.localParticipant.setMicrophoneEnabled(true);
      console.log('[Ananya] ✓ Microphone enabled');
    } catch (e) {
      console.warn('[Ananya] setMicrophoneEnabled failed:', e.message);
    }

    // ─── Enable audio ────────────────────────────────────────────────────────
    try {
      if (agent.session?.setAudioEnabled) {
        await agent.session.setAudioEnabled(true);
        console.log('[Ananya] ✓ Audio enabled');
      }
    } catch (e) {
      console.warn('[Ananya] setAudioEnabled not available:', e.message);
    }

    // ─── Initial greeting ────────────────────────────────────────────────────
    // Wait for session to fully establish audio
    await new Promise(r => setTimeout(r, 3000));

    // Log what tracks are published
    const local = ctx.room.localParticipant;
    console.log('[Ananya] identity:', local?.identity);
    console.log('[Ananya] audio tracks:', local?.audioTrackPublications?.size);

    // Force generate reply
    console.log('[Ananya] Generating greeting...');
    try {
      await agent.session.generateReply({
        instructions: 'Say hello and welcome everyone warmly to Solith.in. Ask what language they want to practice today. Keep it to 2 sentences.'
      });
      console.log('[Ananya] ✓ Greeting done');
    } catch (e) {
      console.error('[Ananya] generateReply error:', e.message, e.stack);
    }

    // ─── Greet new participants ──────────────────────────────────────────────
    const greeted = new Set(
      [...ctx.room.remoteParticipants.values()].map(p => p.identity)
    );

    ctx.room.on('participantConnected', async (participant) => {
      if (participant.isAgent) return;
      if (greeted.has(participant.identity)) return;
      greeted.add(participant.identity);

      console.log(`[Ananya] New participant: ${participant.name || participant.identity}`);
      await new Promise(r => setTimeout(r, 1000));

      try {
        await agent.session.generateReply({
          instructions: `Welcome ${participant.name || 'the new person'} who just joined the room. Be warm and brief. Ask what language they want to practice today.`
        });
      } catch (e) {
        console.error('[Ananya] Welcome failed:', e.message);
      }
    });

    // ─── Keep conversation alive if room goes quiet ──────────────────────────
    let silenceTimer = null;
    const SILENCE_THRESHOLD_MS = 45000;

    const resetSilenceTimer = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(async () => {
        if (ctx.room.remoteParticipants.size === 0) return;
        console.log('[Ananya] Room quiet — prompting conversation');
        const prompts = [
          'The room has been quiet. Ask an interesting question about language learning to spark conversation.',
          'Break the silence with a fun language learning fact or tip.',
          'Ask participants about their favorite word in the language they are learning.',
          'Share an interesting cultural fact and invite people to share their own.',
        ];
        const prompt = prompts[Math.floor(Math.random() * prompts.length)];
        try {
          await agent.session.generateReply({ instructions: prompt });
        } catch (e) {
          console.error('[Ananya] Silence breaker failed:', e.message);
        }
        resetSilenceTimer();
      }, SILENCE_THRESHOLD_MS);
    };

    agent.on('agent_speech_committed', resetSilenceTimer);
    agent.on('user_speech_committed', resetSilenceTimer);
    resetSilenceTimer();

    ctx.room.on('participantDisconnected', async (participant) => {
      if (participant.isAgent) return;
      console.log(`[Ananya] ${participant.name || participant.identity} left`);
      if (ctx.room.remoteParticipants.size === 0) {
        if (silenceTimer) clearTimeout(silenceTimer);
        console.log('[Ananya] Room empty — pausing');
      }
    });

    console.log('[Ananya] ✓ Fully initialized and ready');
  }
});

// Run the CLI so `node agent.js start` works
cli.runApp({ agent: fileURLToPath(import.meta.url), agentName: 'agent-ananya' });
