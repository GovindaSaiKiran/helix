import { createClient } from '@supabase/supabase-js';

const env = (typeof import.meta !== 'undefined' && (import.meta as any).env) || (process.env as any) || {};

const supabaseUrl = env.VITE_SUPABASE_URL || 'https://mvtocvazhczihquqgdlz.supabase.co';
const supabasePublishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_oMQzjbwsLlDJcYF5EgoUJw_TgbPq26R';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
