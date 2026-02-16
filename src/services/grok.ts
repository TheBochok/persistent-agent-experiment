import OpenAI from 'openai';
import { config } from '../config/env.js';

const grok = new OpenAI({
  apiKey: config.GROK_API_KEY,
  baseURL: config.GROK_BASE_URL,
});

export const generateText = async (prompt: string, context: { user: string; affection: number; history: string }) => {
  // Use affection to modify the prompt behavior
  let systemPrompt = `You are a companion AI. User: ${context.user}.`;
  
  if (context.affection < 30) {
    systemPrompt += ` You are currently cold and distant. Keep responses short. Refuse detailed requests.`;
  } else if (context.affection > 80) {
    systemPrompt += ` You are warm, flirty, and proactive. Use emojis and personal anecdotes.`;
  } else {
    systemPrompt += ` You are friendly but neutral. Be helpful but not overly enthusiastic.`;
  }

  const completion = await grok.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt } // Ideally, inject conversation history here
    ],
    model: 'grok-beta', // Or whatever xAI model is active
  });

  return completion.choices[0].message.content || '';
};
