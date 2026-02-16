import { User } from '../types/index';
declare const supabase: import("@supabase/supabase-js").SupabaseClient<any, "public", "public", any, any>;
export declare const getUser: (userId: string) => Promise<User | null>;
export declare const createUser: (userId: string, name: string) => Promise<User | null>;
export declare const updateUserAffection: (userId: string, change: number) => Promise<number>;
export { supabase };
//# sourceMappingURL=supabase.d.ts.map