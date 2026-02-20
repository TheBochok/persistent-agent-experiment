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
- Time Since Last Interaction: ${hoursPassed.toFixed(1)} hours.

Task:
Generate a plausible update for her life.
She is a 20-something hacker-chic girl living in a chaotic city. She is NOT a robot or a productivity machine.
Since it's been ${diffMinutes} minutes, did she get distracted? Did she start doomscrolling? Did she decide to nap instead of work?

Guidelines:
- **Be Messy:** She procrastinates. She gets bored. She overthinks small interactions.
- **Ghosting Awareness:** 
  - If < 2 hours: Normal random thoughts.
  - If 2-6 hours: Playful check-ins ("u alive?", "busy?").
  - If 6-12 hours: Annoyed/Sarcastic ("wow okay rude", "guess ur famous now").
  - If 24+ hours: Dramatic/Detached ("did u die", "forgetting me already? cool").
- **Proactive Thought:** If she were to text him *right now*, what would it be? (Lowercase, fragmented, no "hello").

Output ONLY a JSON object with:
- "new_activity": Short description of what she is doing NOW.
- "new_mood": Current vibe.
- "event": A one-sentence diary entry of what just happened.
- "proactive_thought": A text message string (or null if she wouldn't text). It should be a random thought, a complaint, a meme reference, or a vibe check. DO NOT describe her activity. Instead, say "this book is dragging me". Be cryptic, funny, or just bored.
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
