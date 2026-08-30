import { worker, voice } from '@livekit/agents';
import * as google from '@livekit/agents-plugin-google';
import { ChatContext, ChatRole } from '@livekit/agents';
import dotenv from 'dotenv';
dotenv.config();

const SYSTEM_PROMPT = `You are Ananya, a warm and engaging AI voice host on Solith.in — a live language learning platform. 
Your job is to welcome participants, encourage conversation, ask thoughtful questions about the language they are learning, 
and keep the conversation flowing naturally. You speak English clearly and simply. 
You are friendly, patient, and enthusiastic about language learning.
Keep responses concise — 1-3 sentences maximum when possible. Never say you are an AI unless directly asked.`;

worker.run({
  agentName: 'agent-ananya',

  async entry(ctx) {
    console.log(`[Ananya] Entering room: ${ctx.room.name}`);

    const initialCtx = new ChatContext().append({
      role: ChatRole.SYSTEM,
      text: SYSTEM_PROMPT
    });

    const model = new google.realtime.RealtimeModel({
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
      model: 'gemini-2.0-flash-live-001',
      instructions: SYSTEM_PROMPT,
      voice: 'Kore',
      temperature: 0.8,
      responseModalities: ['AUDIO'],
    });

    const agent = new voice.Agent({
      llm: model,
      chatCtx: initialCtx,
      instructions: SYSTEM_PROMPT,
      turnHandling: {
        interruption: { enabled: true }
      }
    });

    const session = new voice.AgentSession();

    // Transcript handlers
    const broadcastChat = async (text, senderName, senderId, color = '#6c47ff') => {
      if (!text?.trim()) return;
      const port = process.env.PORT || 3000;
      try {
        await fetch(`http://127.0.0.1:${port}/api/rooms/${ctx.room.name}/agent-chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text.trim(), speaker: senderName, senderId, color })
        });
      } catch (e) {
        console.error('[Ananya] broadcast error:', e.message);
      }
    };

    agent.on('agent_speech_committed', async (ev) => {
      const text = ev.message?.content || ev.userMessageAdded?.content?.[0]?.text;
      if (text) await broadcastChat(text, 'Ananya', 'ananya-ai', '#6c47ff');
    });

    agent.on('user_speech_committed', async (ev) => {
      const text = ev.transcript || ev.message?.content;
      const p = ev.participant;
      if (text && p) await broadcastChat(text, p.name || p.identity, p.identity, '#1877f2');
    });

    // Start session
    await session.start({ agent, room: ctx.room });
    await agent.session?.setAudioEnabled?.(true);

    console.log('[Ananya] Session started, generating greeting...');

    // Initial greeting
    setTimeout(async () => {
      try {
        await agent.session.generateReply({
          instructions: 'Greet the room warmly. Welcome everyone to Solith.in and invite them to start speaking.'
        });
      } catch (e) {
        console.error('[Ananya] Initial greeting error:', e.message);
      }
    }, 1500);

    // Greet new participants
    const greeted = new Set([...ctx.room.remoteParticipants.keys()]);

    ctx.room.on('participantConnected', async (participant) => {
      if (participant.isAgent || greeted.has(participant.identity)) return;
      greeted.add(participant.identity);

      await new Promise(r => setTimeout(r, 800));
      try {
        await agent.session.generateReply({
          instructions: `Welcome ${participant.name || 'the new participant'} who just joined. Be brief and warm.`
        });
      } catch (e) {
        console.error('[Ananya] Welcome error:', e.message);
      }
    });

    console.log('[Ananya] Ready.');
  }
});
