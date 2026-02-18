import { createClient } from '@supabase/supabase-js';
import config from '../config/env.js';
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY, {
    auth: {
        persistSession: false
    }
});
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
        .insert([{ id: userId, name: name, affection: 10, timezone: 'UTC' }])
        .select()
        .single();
    if (error) {
        console.error('Error creating user:', error);
        return null;
    }
    return data;
};
export const updateUserTimezone = async (userId, timezone) => {
    const { data, error } = await supabase
        .from('users')
        .update({ timezone: timezone })
        .eq('id', userId)
        .select()
        .single();
    if (error) {
        console.error('Error updating timezone:', error);
        return null;
    }
    return data;
};
export const updateUserAffection = async (userId, change) => {
    const user = await getUser(userId);
    if (!user)
        return 50; // Default or error
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
export const addChatMessage = async (userId, role, content) => {
    const { error } = await supabase.from('chat_history').insert({
        user_id: userId,
        role,
        content
    });
    if (error) {
        console.error('Error saving chat message:', error);
    }
};
export const getRecentChatHistory = async (userId, limit = 10) => {
    const { data, error } = await supabase
        .from('chat_history')
        .select('role, content')
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
        .map((m) => `${m.role === 'user' ? 'Him' : 'Me'}: ${m.content}`)
        .join('\n');
};
export { supabase };
