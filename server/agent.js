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

// VAD is loaded once per process lifetime — not per room — to save memory.
// It's held in this module-level variable after first load.
let cachedVad = null;

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
    // STEP 4 — Memory logging at startup
    const startMem = process.memoryUsage();
    console.log('[Ananya] Memory at start:', Math.round(startMem.rss / 1024 / 1024), 'MB RSS');

    // STEP 5 — Fail fast on missing env vars
    const required = ['GROQ_API_KEY', 'ELEVENLABS_API_KEY'];
    for (const key of required) {
      if (!process.env[key]) {
        console.error(`[Ananya] FATAL: missing env var ${key}`);
        throw new Error(`Missing required env var: ${key}`);
      }
    }
    console.log('[Ananya] ✓ All required env vars present');
    console.log(`[Ananya] ✓ Entered room: ${ctx.room.name}`);

    // The web server URL — agent and server are now separate processes,
    // but on the same Render internal network if on same account.
    // Use the public backend URL so the agent can still broadcast chat.
    const serverUrl = process.env.SERVER_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;

    // Broadcast a message to the room's chat via the web API
    const broadcastChat = async (text, senderName, senderId, color) => {
      if (!text?.trim()) return;
      try {
        await fetch(`${serverUrl}/api/rooms/${ctx.room.name}/agent-chat`, {
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

    // --- Connect to room ---
    console.log('[Ananya] Step: connecting to room...');
    await ctx.connect();
    console.log('[Ananya] ✓ Connected');

    // --- Load VAD (once per process, lazily) ---
    if (!cachedVad) {
      console.log('[Ananya] Step: loading VAD (first time this process)...');
      const vadPromise = Promise.race([
        silero.VAD.load(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('VAD load timeout after 10s')), 10000)
        )
      ]);
      try {
        cachedVad = await vadPromise;
        console.log('[Ananya] ✓ VAD loaded');
      } catch (e) {
        console.error('[Ananya] ✗ VAD load failed:', e.message);
        throw e; // fail fast — don't hang silently
      }
    } else {
      console.log('[Ananya] ✓ VAD already loaded (reusing cached)');
    }

    // --- Construct pipeline clients ---
    console.log('[Ananya] Step: constructing STT...');
    const stt = new openai.STT({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
      model: 'whisper-large-v3',
      language: 'en',
    });
    console.log('[Ananya] ✓ STT constructed');

    console.log('[Ananya] Step: constructing LLM...');
    const llmClient = new openai.LLM({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
      model: 'llama-3.1-8b-instant',
    });
    console.log('[Ananya] ✓ LLM constructed');

    console.log('[Ananya] Step: constructing TTS...');
    const tts = new elevenlabs.TTS({
      apiKey: process.env.ELEVENLABS_API_KEY,
      voiceId: 'EXAVITQu4vr4xnSDxMaL', // "Sarah" — warm female voice
      modelId: 'eleven_turbo_v2_5',
      stability: 0.5,
      similarityBoost: 0.8,
    });
    console.log('[Ananya] ✓ TTS constructed');

    console.log('[Ananya] Step: constructing Agent pipeline...');
    const agent = new Agent({
      vad: cachedVad,
      stt,
      llm: llmClient,
      tts,
      chatCtx: new llm.ChatContext().append({
        role: llm.ChatRole.SYSTEM,
        text: SYSTEM_PROMPT,
      }),
      instructions: SYSTEM_PROMPT,
      turnHandling: {
        interruption: { enabled: true }
      }
    });
    console.log('[Ananya] ✓ Agent pipeline constructed');

    // --- Wire up chat broadcasting ---
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

    // --- Start the session ---
    console.log('[Ananya] Starting session...');
    const session = new AgentSession();
    try {
      await session.start({ agent, room: ctx.room });
      console.log('[Ananya] ✓ Pipeline started');
    } catch (e) {
      console.error('[Ananya] ✗ Session start failed:', e.message, e.stack);
      return;
    }

    // Enable audio if available
    try {
      if (agent.session?.setAudioEnabled) {
        await agent.session.setAudioEnabled(true);
        console.log('[Ananya] ✓ Audio enabled');
      }
    } catch (e) {
      console.warn('[Ananya] setAudioEnabled not available:', e.message);
    }

    // Wait, then greet
    await new Promise(r => setTimeout(r, 2000));

    // STEP 4 — Memory before speaking
    console.log('[Ananya] Memory before speaking:', Math.round(process.memoryUsage().rss / 1024 / 1024), 'MB RSS');

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

    // --- Greet new participants ---
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

    // --- Silence breaker ---
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

// STEP 3: Start command on Render should be:
//   node --max-old-space-size=400 agent.js start
// This caps heap at 400MB so Node fails predictably with OOM error
// instead of being SIGKILLed silently (exit code 137).
cli.runApp({
  agent: fileURLToPath(import.meta.url),
  agentName: 'agent-ananya',
});
