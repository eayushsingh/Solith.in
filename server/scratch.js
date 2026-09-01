import * as openai from '@livekit/agents-plugin-openai';
const llm = new openai.LLM({
  apiKey: 'test',
  model: 'llama3-8b-8192',
  baseURL: 'https://api.groq.com/openai/v1'
});
console.log(llm);
