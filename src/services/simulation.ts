import OpenAI from 'openai';
import config from '../config/env.js';
import { getState, updateState, appendDiaryEntry } from './state_manager.js';
import { getUser } from './supabase.js';
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
  
  const now = new Date();
  const localTime = now.toLocaleTimeString('en-US', { timeZone, hour: '2-digit', minute: '2-digit' });

  const lastUpdate = new Date(currentState.last_update);
  const diffMinutes = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60));

  if (diffMinutes < 15) return null;

  const hoursPassed = diffMinutes / 60;
  
  const prompt = `
Context: It is currently ${localTime} (${timeZone}).
Current State:
- Activity: ${currentState.current_activity}
- Mood: ${currentState.mood}
- Recent Diary: ${JSON.stringify(currentState.diary_log.slice(-3))}
- Affection Level: ${affection}/100

Task:
Generate a plausible transition or update. 
Since it's been ${diffMinutes} minutes, did she finish what she was doing? Did something small happen?

If the time of day changed significantly (e.g., morning to afternoon), shift her activity.
Activities should be realistic: work, coffee, gym, browsing, chores, social, etc.

Output ONLY a JSON object with:
- "new_activity": Current activity.
- "new_mood": Current mood.
- "event": A one-sentence diary entry of what happened.
- "proactive_thought": A short, informal message she might send to him right now if she felt like it (keep it lowercase, fragmented, and based on her hacker-chic personality).
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
