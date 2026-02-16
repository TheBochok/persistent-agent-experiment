"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = exports.updateUserAffection = exports.createUser = exports.getUser = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const env_1 = require("../config/env");
const index_1 = require("../types/index");
const supabase = (0, supabase_js_1.createClient)(env_1.config.SUPABASE_URL, env_1.config.SUPABASE_KEY);
exports.supabase = supabase;
const getUser = async (userId) => {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
    if (error) {
        console.error('Error fetching user:', error);
        return null;
    }
    return data;
};
exports.getUser = getUser;
const createUser = async (userId, name) => {
    const { data, error } = await supabase
        .from('users')
        .insert([{ id: userId, name: name, affection: 50 }])
        .select()
        .single();
    if (error) {
        console.error('Error creating user:', error);
        return null;
    }
    return data;
};
exports.createUser = createUser;
const updateUserAffection = async (userId, change) => {
    const user = await (0, exports.getUser)(userId);
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
exports.updateUserAffection = updateUserAffection;
//# sourceMappingURL=supabase.js.map