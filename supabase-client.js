import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.105.0';

export const SUPABASE_URL = 'https://efythbvsdbxrsibvkhmc.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_w1r0-1gnUHKZ2_55YGMWPQ_V7ARypeB';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
