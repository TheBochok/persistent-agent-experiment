import OpenAI from 'openai';
import config from '../config/env.js';
import { getState, updateState, appendDiaryEntry } from './state_manager.js';
import { getUser, getRawChatHistory } from './supabase.js';
import type { DiaryEntry } from '../types/index.js';

const grok = new OpenAI({
  apiKey: config.GROK_API_KEY,
  baseURL: config.GROK_BASE_URL,
});

export const simulateGap = async (userId: string): Promise<string | null> => {
  const currentState = await getState(userId);
  if (!currentState) {
    console.warn(`No state found for user ${userId}. Skipping simulation.`);
    return null;
  }

  // Get user's affection and timezone
  const user = await getUser(userId);
  const timeZone = user?.timezone || 'UTC';
  const affection = user?.affection || 0;
  
  // Check chat history to prevent spam
  const history = await getRawChatHistory(userId, 5); // Most recent first
  const lastMessage = history[0];
  
  // Rule 1: Never text if the last message was yours (the bot's) less than 2 hours ago.
  // Unless it's a "double text" scenario, but let's be strict to avoid the 8-message spam.
  if (lastMessage && lastMessage.role === 'assistant') {
      const lastMsgTime = new Date(lastMessage.created_at).getTime();
      const timeSinceLastMsg = (Date.now() - lastMsgTime) / (1000 * 60 * 60);
      
      // If she sent the last message and it's been less than 6 hours, silence.
      // This forces her to wait for a reply.
      if (timeSinceLastMsg < 6) {
          console.log(`[Simulation] Skipping: Last message was mine (${timeSinceLastMsg.toFixed(1)}h ago). Waiting for reply.`);
          return null;
      }
  }

  // Rule 2: If the last 2 messages are hers, NEVER send a third unsolicited.
  const myConsecutiveCount = history.findIndex(m => m.role === 'user');
  if (myConsecutiveCount === -1) myConsecutiveCount = history.length; // All hers
  
  if (myConsecutiveCount >= 2) {
      console.log(`[Simulation] Skipping: Sent ${myConsecutiveCount} messages in a row. Waiting for user.`);
      return null;
  }

  const now = new Date();
  const localTime = now.toLocaleTimeString('en-US', { timeZone, hour: '2-digit', minute: '2-digit' });

  const lastUpdate = new Date(currentState.last_update);
  const diffMinutes = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60));

  if (diffMinutes < 15) return null;

  const hoursPassed = diffMinutes / 60;
  
  // Check specifically for "Call" context in the last few messages
  const lastUserMsg = history.find(m => m.role === 'user')?.content.toLowerCase() || "";
  const callContext = lastUserMsg.includes('call') || lastUserMsg.includes('facetime') || lastUserMsg.includes('voice');

  const prompt = `
Context: It is currently ${localTime} (${timeZone}).
Current State:
- Activity: ${currentState.current_activity}
- Mood: ${currentState.mood}
- Recent Diary: ${JSON.stringify(currentState.diary_log.slice(-3))}
- Affection Level: ${affection}/100
- Time Since Last Interaction: ${hoursPassed.toFixed(1)} hours.
- Last User Message: "${lastUserMsg}" (Check if this implies a pending action like a call)

Task:
Generate a plausible update for her life.
She is a 20-something hacker-chic girl.
Since it's been ${diffMinutes} minutes, did she get distracted?

**CRITICAL RULES:**
1. **NO PERFORMING.** Do not tweet into the void. Talk TO him.
2. **CONTEXT AWARENESS.** If the last message was about a call/meeting/sleep, RESPECT THAT. Do not ignore it.
   - If he said "call?", acknowledge it or say you fell asleep waiting.
   - If he said "goodnight", do not text him 15 mins later with a meme.
3. **NO SPAM.** You have already sent ${myConsecutiveCount} messages in a row. Be extremely selective.
   - If > 0 messages sent recently, only text if it's URGENT or a direct follow-up.
4. **Vibe:** Lowercase, messy, direct.

Output ONLY a JSON object with:
- "new_activity": Short description.
- "new_mood": Current vibe.
- "event": Diary entry.
- "proactive_thought": A text message string (or null).
   - Return NULL if he hasn't replied to your last message and it's been < 6 hours.
   - Return NULL if the conversation naturally ended (e.g. "goodnight").
`;

  try {
    const completion = await grok.chat.completions.create({
      messages: [{ role: 'system', content: prompt }],
      model: 'grok-4-fast-non-reasoning',
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');

    if (result.new_activity && result.new_mood) {
      await updateState(userId, {
        current_activity: result.new_activity,
        mood: result.new_mood,
      });

      if (result.event) {
        const entry: DiaryEntry = {
          timestamp: new Date().toISOString(),
          event: result.event,
        };
        await appendDiaryEntry(userId, entry);
      }
      
      console.log(`[Simulation] Updated state for ${userId}: ${result.new_activity} (${result.new_mood})`);
      
      // Return the thought if she decides to be proactive
      return result.proactive_thought || null;
    }

  } catch (error) {
    console.error('Error simulating gap:', error);
  }
  return null;
};
