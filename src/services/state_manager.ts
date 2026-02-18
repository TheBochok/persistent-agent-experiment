import { supabase } from './supabase.js';
import type { HerState, DiaryEntry } from '../types/index.js';

export const getState = async (userId: string): Promise<HerState | null> => {
  const { data, error } = await supabase
    .from('her_state')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error(`Error fetching state for user ${userId}:`, error);
    return null;
  }
  return data as HerState;
};

export const initializeState = async (userId: string): Promise<HerState | null> => {
  const initialState: Partial<HerState> = {
    user_id: userId,
    current_activity: 'waking up',
    mood: 'neutral',
    last_update: new Date().toISOString(),
    diary_log: [],
  };

  const { data, error } = await supabase
    .from('her_state')
    .insert([initialState])
    .select()
    .single();

  if (error) {
    console.error(`Error initializing state for user ${userId}:`, error);
    return null;
  }
  return data as HerState;
};

export const updateState = async (userId: string, updates: Partial<HerState>): Promise<HerState | null> => {
  const { data, error } = await supabase
    .from('her_state')
    .update({ ...updates, last_update: new Date().toISOString() })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error(`Error updating state for user ${userId}:`, error);
    return null;
  }
  return data as HerState;
};

export const appendDiaryEntry = async (userId: string, entry: DiaryEntry) => {
  const currentState = await getState(userId);
  if (!currentState) return;

  const newLog = [...currentState.diary_log, entry];
  await updateState(userId, { diary_log: newLog });
};
