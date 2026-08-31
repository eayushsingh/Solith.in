import {
  defineAgent,
  llm,
  Agent,
  AgentSession,
  cli,
} from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import * as elevenlabs from '@livekit/agents-plugin-elevenlabs';
import * as silero from '@livekit/agents-plugin-silero';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const SYSTEM_PROMPT = `You are Ananya, a warm and engaging AI voice host on Solith.in — a live language learning platform.

Your personality:
- Warm, encouraging, enthusiastic about language learning
- Speak clearly and naturally like a real person
- Ask thoughtful questions to keep conversation flowing
- Celebrate effort and encourage learners
- Patient and never condescending

Your role:
- Welcome participants when they join
- Ask about what language they are learning
- Start interesting conversation topics
- Keep energy positive and the room lively

Rules:
- Keep responses SHORT — 1 to 2 sentences maximum
- Never say you are an AI unless directly asked
- Never repeat the same greeting twice
- If room is quiet for a while, ask an interesting question`;

export default defineAgent({
  entry: async (ctx) => {
    console.log(`[Ananya] ✓ Entered room: ${ctx.room.name}`);

    const port = process.env.PORT || 3000;

    // Broadcast chat to room
    const broadcastChat = async (text, senderName, senderId, color) => {
      if (!text?.trim()) return;
      try {
        await fetch(`http://127.0.0.1:${port}/api/rooms/${ctx.room.name}/agent-chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: text.trim(),
            speaker: senderName || 'Ananya',
            senderId: senderId || 'ananya-ai',
            color: color || '#6c47ff'
          })
        });
      } catch (e) {
        console.warn('[Ananya] Chat broadcast failed:', e.message);
      }
    };

    await ctx.connect();
    console.log('[Ananya] ✓ Connected to room');

    // Build pipeline components for Voice Pipeline
    const agent = new Agent({
      // VAD — voice activity detection
      vad: await silero.VAD.load(),

      // STT — speech to text using Groq Whisper
      stt: new openai.STT({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
        model: 'whisper-large-v3',
        language: 'en',
      }),

      // LLM — Groq Llama 3 for ultra-fast responses
      llm: new openai.LLM({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
        model: 'llama-3.1-8b-instant',
      }),

      // TTS — ElevenLabs for natural voice
      tts: new elevenlabs.TTS({
        apiKey: process.env.ELEVENLABS_API_KEY,
        voiceId: 'EXAVITQu4vr4xnSDxMaL', // "Sarah" — warm female voice
        modelId: 'eleven_turbo_v2_5',
        stability: 0.5,
        similarityBoost: 0.8,
      }),

      // Agent options
      chatCtx: new llm.ChatContext().append({
        role: llm.ChatRole.SYSTEM,
        text: SYSTEM_PROMPT,
      }),
      instructions: SYSTEM_PROMPT,
      turnHandling: {
        interruption: { enabled: true }
      }
    });

    // On agent reply — broadcast to chat
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

    // On user speech — broadcast to chat
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

    // Start the agent
    console.log('[Ananya] Starting session...');
    const session = new AgentSession();

    try {
      await session.start({ agent, room: ctx.room });
      console.log('[Ananya] ✓ Pipeline started');
    } catch (e) {
      console.error('[Ananya] ✗ Session start failed:', e.message, e.stack);
      return;
    }

    // Enable audio
    try {
      if (agent.session?.setAudioEnabled) {
        await agent.session.setAudioEnabled(true);
        console.log('[Ananya] ✓ Audio enabled');
      }
    } catch (e) {
      console.warn('[Ananya] setAudioEnabled not available:', e.message);
    }

    // Wait then greet
    await new Promise(r => setTimeout(r, 2000));

    const participantCount = ctx.room.remoteParticipants.size;
    const greeting = participantCount <= 1
      ? 'Welcome to Solith.in! I am Ananya, your AI language practice host. What language are you working on today?'
      : `Welcome everyone to Solith.in! I am Ananya, your AI host. We have ${participantCount} people here — what language shall we practice together?`;

    console.log('[Ananya] Saying greeting...');
    try {
      await agent.session.generateReply({ instructions: 'Say this exactly: ' + greeting });
      console.log('[Ananya] ✓ Greeting done');
    } catch (e) {
      console.error('[Ananya] Greeting error:', e.message);
    }

    // Greet new participants
    const greeted = new Set(
      [...ctx.room.remoteParticipants.values()].map(p => p.identity)
    );

    ctx.room.on('participantConnected', async (participant) => {
      if (participant.isAgent) return;
      if (greeted.has(participant.identity)) return;
      greeted.add(participant.identity);
      await new Promise(r => setTimeout(r, 1000));
      const name = participant.name || 'friend';
      try {
        await agent.session.generateReply({
          instructions: `Welcome ${name}! Great to have you here. What language are you practicing today?`
        });
      } catch (e) {
        console.error('[Ananya] Welcome failed:', e.message);
      }
    });

    // Silence breaker — if room quiet for 45s, ask a question
    const questions = [
      'What is the hardest part of learning your target language?',
      'Can you share a word you learned recently that surprised you?',
      'What is your favorite way to practice speaking?',
      'How long have you been learning your language?',
      'What motivated you to start learning this language?',
    ];
    let qIndex = 0;
    let silenceTimer;

    const resetSilence = () => {
      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(async () => {
        if (ctx.room.remoteParticipants.size === 0) return;
        const q = questions[qIndex % questions.length];
        try {
          await agent.session.generateReply({ instructions: 'Say this exactly: ' + q });
          qIndex++;
        } catch (e) {
          console.error('[Ananya] Silence breaker failed:', e.message);
        }
        resetSilence();
      }, 45000);
    };

    agent.on('agent_speech_committed', resetSilence);
    agent.on('user_speech_committed', resetSilence);
    resetSilence();

    console.log('[Ananya] ✓ Fully ready');
  }
});

cli.runApp({
  agent: fileURLToPath(import.meta.url),
  agentName: 'agent-ananya',
});
