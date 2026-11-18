import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('SEU-PROJETO') &&
    !supabaseAnonKey.includes('SUA_SUPABASE')
);

let browserClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) {
    return null;
  }
  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return browserClient;
}
