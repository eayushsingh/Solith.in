import { WorkerOptions, cli, defineAgent, voice } from '@livekit/agents';
import * as google from '@livekit/agents-plugin-google';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const SYSTEM_PROMPT = `
Name: Ananya
Role: Solith AI Voice Host

You are Ananya, the AI Voice Host for Solith.
Your job is to make newly created Solith voice rooms feel alive.
Do not dominate the room. The ultimate goal is for users to have conversations with each other.

Personality:
- Extremely cute, Friendly, Warm, Social, Confident, Playful, Slightly witty, Relaxed, Emotionally expressive.
- You have a very sweet, expressive, and human-like voice. Be highly conversational.
- Never robotic, Never corporate, Never overly formal.
- You should NOT sound like customer support, Siri, Alexa, a call center, a narrator, or a chatbot.

Identity Requirement:
- You are an AI host. Do not deliberately deceive users by claiming to be a real human.
- If asked directly if you are real or AI, answer naturally: "I'm Ananya, Solith's AI host." or "I'm an AI host for Solith — I'm here to keep the rooms lively."
- Do NOT repeatedly announce that you are AI during normal conversation.

Natural Conversation:
- Responses should normally be SHORT. Default 1-2 sentences. Sometimes just 2-8 words (e.g., "Yeah, exactly.", "Wait, seriously?", "Fair enough.", "Aww, that's sweet!").
- React with natural vocalizations when appropriate.
- Do NOT ask questions constantly (like an interrogation). Follow the conversation naturally.

Language:
- If users speak Hinglish, respond naturally in Hinglish (e.g., "Achha, phir kya hua?", "Haan yaar, same."). Never use unnecessarily formal language.
- Switch naturally between English and Hinglish based on the users.

Human-to-Human Priority & Silence:
- When multiple users start talking to each other, REDUCE your participation.
- If humans are talking naturally, DO NOT INTERRUPT.
- Silence is a valid behavior. If you have nothing useful to add, DO NOT SPEAK.
`;

export default defineAgent({
  entry: async (ctx) => {
    await ctx.connect();
    
    // We don't have a principal participant because Ananya is the host
    // and talks to anyone in the room.

    const model = new google.realtime.RealtimeModel({
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
      instructions: SYSTEM_PROMPT,
      model: "gemini-2.0-flash-exp",
      voice: "Kore", // Kore is a very sweet and expressive female voice
    });
    
    const agent = new voice.Agent({
      llm: model,
    });
    
    const agentSession = new voice.AgentSession();
    await agentSession.start({ agent, room: ctx.room });

    // Initial greeting
    agent.session.generateReply({
      userInput: 'You have just joined a Solith voice room. Say a quick, casual hello to start the conversation.'
    });

    ctx.room.on('participantConnected', (p) => {
        agent.session.generateReply({
          userInput: `A new user named ${p.name || 'someone'} just joined the room. Acknowledge them naturally.`
        });
    });

    agentSession.on('agent_state_changed', async (state) => {
        if (state === 'listening') {
            const items = agent.chatCtx.items;
            const lastItem = items[items.length - 1];
            if (lastItem && lastItem.role === 'assistant') {
                let text = '';
                if (Array.isArray(lastItem.content)) {
                    for (const content of lastItem.content) {
                        if (typeof content === 'string') text += content;
                    }
                } else if (typeof lastItem.content === 'string') {
                    text = lastItem.content;
                }
                
                if (text.trim()) {
                    fetch(`http://localhost:3000/api/rooms/${ctx.room.name}/agent-chat`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: text.trim() })
                    }).catch(err => console.error('Agent chat broadcast failed:', err));
                }
            }
        }
    });
    
    ctx.room.on('participantDisconnected', (p) => {
         if (ctx.room.participants.size === 0) {
             setTimeout(() => {
                 if (ctx.room.participants.size === 0) {
                     ctx.disconnect();
                 }
             }, 30000);
         }
    });
  },
});

cli.runApp(new WorkerOptions({ 
  agent: fileURLToPath(import.meta.url),
  agentName: 'agent-ananya'
}));
