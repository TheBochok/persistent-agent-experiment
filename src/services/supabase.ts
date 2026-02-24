import { createClient } from '@supabase/supabase-js';
import config from '../config/env.js';
import type { User } from '../types/index.js';

// Lazy initialize to avoid crashing if env vars aren't ready at import time
let _supabase: any = null;

export const getSupabase = () => {
  if (!_supabase) {
    if (!config.SUPABASE_URL || !config.SUPABASE_KEY) {
      throw new Error(`Supabase configuration missing. URL: ${!!config.SUPABASE_URL}, KEY: ${!!config.SUPABASE_KEY}`);
    }
    _supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY, {
      auth: {
        persistSession: false
      }
    });
  }
  return _supabase;
};

// Compatibility object for existing code
export const supabase = {
  from: (table: string) => getSupabase().from(table),
  rpc: (fn: string, args: any) => getSupabase().rpc(fn, args),
};

export const getUser = async (userId: string): Promise<User | null> => {
  const { data, error } = await getSupabase()
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching user:', error);
    return null;
  }
  return data as User | null;
};

export const createUser = async (userId: string, name: string): Promise<User | null> => {
  const { data, error } = await getSupabase()
    .from('users')
    .insert([{ id: userId, name: name, affection: 10, timezone: 'UTC' }])
    .select()
    .single();

  if (error) {
    console.error('Error creating user:', error);
    return null;
  }
  return data as User;
};

export const updateUserTimezone = async (userId: string, timezone: string): Promise<User | null> => {
  const { data, error } = await getSupabase()
    .from('users')
    .update({ timezone: timezone })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating timezone:', error);
    return null;
  }
  return data as User;
};

export const updateUserAffection = async (userId: string, change: number): Promise<number> => {
  const user = await getUser(userId);
  if (!user) return 50; // Default or error

  let newAffection = user.affection + change;
  newAffection = Math.max(0, Math.min(100, newAffection));

  const { error } = await getSupabase()
    .from('users')
    .update({ affection: newAffection })
    .eq('id', userId);

  if (error) {
    console.error('Error updating affection:', error);
  }
  return newAffection;
};

export const addChatMessage = async (userId: string, role: 'user' | 'assistant', content: string) => {
  const { error } = await getSupabase().from('chat_history').insert({
    user_id: userId,
    role,
    content
  });

  if (error) {
    console.error('Error saving chat message:', error);
  }
};

export const getRecentChatHistory = async (userId: string, limit = 10): Promise<string> => {
  const { data, error } = await getSupabase()
    .from('chat_history')
    .select('role, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching chat history:', error);
    return '';
  }

  // Format as "Role: Content" and reverse back to chronological order
  return data
    .reverse()
    .map((m: any) => `${m.role === 'user' ? 'Him' : 'Me'}: ${m.content}`)
    .join('\n');
};

export const getRawChatHistory = async (userId: string, limit = 5): Promise<any[]> => {
  const { data, error } = await getSupabase()
    .from('chat_history')
    .select('role, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching raw chat history:', error);
    return [];
  }
  return data; // Returns most recent first
};
