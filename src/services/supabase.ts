import { createClient } from '@supabase/supabase-js';
import config from '../config/env.js';
import type { User } from '../types/index.js';

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY);

export const getUser = async (userId: string): Promise<User | null> => {
  const { data, error } = await supabase
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
  const { data, error } = await supabase
    .from('users')
    .insert([{ id: userId, name: name, affection: 50 }])
    .select()
    .single();

  if (error) {
    console.error('Error creating user:', error);
    return null;
  }
  return data as User;
};

export const updateUserAffection = async (userId: string, change: number): Promise<number> => {
  const user = await getUser(userId);
  if (!user) return 50; // Default or error

  let newAffection = user.affection + change;
  newAffection = Math.max(0, Math.min(100, newAffection));

  const { error } = await supabase
    .from('users')
    .update({ affection: newAffection })
    .eq('id', userId);

  if (error) {
    console.error('Error updating affection:', error);
  }
  return newAffection;
};

export { supabase };
