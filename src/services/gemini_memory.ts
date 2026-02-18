import config from '../config/env.js';
import { getSupabase } from './supabase.js';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent';

export const generateEmbedding = async (text: string): Promise<number[] | null> => {
  if (!config.GEMINI_API_KEY) {
    console.error('Missing GEMINI_API_KEY');
    return null;
  }
  
  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${config.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        outputDimensionality: 768
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini Embedding Error:', errText);
      return null;
    }

    const data = await response.json();
    console.log(`[Gemini Memory] Embedding generated for: "${text.substring(0, 20)}..." | Sample: ${data.embedding.values.slice(0, 5)}`);
    return data.embedding.values; 
  } catch (error) {
    console.error('Gemini Embedding Failed:', error);
    return null;
  }
};

export const addMemory = async (userId: string, content: string): Promise<boolean> => {
  const embedding = await generateEmbedding(content);
  if (!embedding) return false;

  const { error } = await getSupabase().from('memories').insert({
    user_id: userId,
    content,
    embedding
  });

  if (error) {
    console.error('Supabase Memory Insert Error:', error);
    return false;
  }
  console.log(`[Memory] Saved: "${content}"`);
  return true;
};

export const searchMemories = async (userId: string, query: string, limit = 3): Promise<string[]> => {
  const embedding = await generateEmbedding(query);
  if (!embedding) return [];

  console.log(`[Memory Debug] Searching for userId: ${userId}`);

  // Call the Supabase RPC function we created
  const { data, error } = await getSupabase().rpc('match_memories', {
    query_embedding: embedding,
    match_threshold: 0.1, // EXTREMELY LOW for testing
    match_count: limit,
    filter_user_id: userId
  });

  if (error) {
    console.error('Memory Search Error:', error);
    return [];
  }

  if (data) {
    console.log(`[Memory Debug] Raw results from Supabase:`, data.map((d: any) => ({ content: d.content, score: d.similarity })));
  }

  // data is array of { id, content, similarity }
  return data.map((m: any) => m.content);
};
