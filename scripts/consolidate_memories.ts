import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import OpenAI from 'openai';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent';
const grok = new OpenAI({
  apiKey: process.env.GROK_API_KEY,
  baseURL: process.env.GROK_BASE_URL,
});

async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        outputDimensionality: 768
      })
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.embedding.values;
  } catch (e) { return null; }
}

async function nightlyConsolidation() {
  console.log("[Consolidation] Starting nightly memory synthesis...");
  
  // 1. Get all users
  const { data: users } = await supabase.from('users').select('id');
  if (!users) return;

  for (const user of users) {
    const userId = user.id;
    
    // 2. Fetch today's chat history
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);
    
    const { data: messages } = await supabase
      .from('chat_history')
      .select('role, content')
      .eq('user_id', userId)
      .gt('created_at', yesterday.toISOString());

    if (!messages || messages.length < 5) {
      console.log(`[Consolidation] Not enough messages for user ${userId}. Skipping.`);
      continue;
    }

    const transcript = messages.map(m => `${m.role}: ${m.content}`).join('\n');

    // 3. Ask Grok to synthesize key facts
    const prompt = `
Transcript of today's conversation:
${transcript}

Task:
Extract exactly 3-5 key facts about the user or our relationship that are worth remembering long-term.
Focus on: Preferences, names, recurring topics, significant emotional moments, or life updates.
Avoid: Generic small talk or temporary state.

Output ONLY a JSON array of strings: ["Fact 1", "Fact 2", ...]
`;

    try {
      const completion = await grok.chat.completions.create({
        messages: [{ role: 'system', content: prompt }],
        model: 'grok-4-fast-non-reasoning',
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(completion.choices[0].message.content || '{"facts": []}');
      const facts = result.facts || [];

      for (const fact of facts) {
        const embedding = await generateEmbedding(fact);
        if (embedding) {
          await supabase.from('memories').insert({
            user_id: userId,
            content: fact,
            embedding
          });
          console.log(`[Consolidation] Saved new long-term memory for ${userId}: ${fact}`);
        }
      }
    } catch (e) {
      console.error(`[Consolidation] Error processing user ${userId}:`, e);
    }
  }
  console.log("[Consolidation] Finished.");
}

nightlyConsolidation();
