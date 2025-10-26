// src/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

// Prefer Vite env variables. For local development, create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
	// Warn in dev but don't throw so local runs with old keys will still work if you set them in process.env
	// IMPORTANT: Move any hard-coded keys into environment variables and revoke old keys if they were committed.
	// eslint-disable-next-line no-console
	console.warn('[supabaseClient] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set. Make sure to set them in .env or your hosting environment.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
