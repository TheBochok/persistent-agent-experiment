import { createClient } from '@supabase/supabase-js';
import config from '../config/env.js';
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY);
export const getUser = async (userId) => {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
    if (error) {
        console.error('Error fetching user:', error);
        return null;
    }
    return data;
};
export const createUser = async (userId, name) => {
    const { data, error } = await supabase
        .from('users')
        .insert([{ id: userId, name, affection: 50 }])
        .select()
        .single();
    if (error) {
        console.error('Error creating user:', error);
        return null;
    }
    return data;
};
export const updateUserAffection = async (userId, currentAffection, delta) => {
    const newAffection = Math.max(0, Math.min(100, currentAffection + delta));
    const { error } = await supabase
        .from('users')
        .update({ affection: newAffection })
        .eq('id', userId);
    if (error) {
        console.error('Error updating affection:', error);
    }
};
