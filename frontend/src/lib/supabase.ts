import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY as string

if (!supabaseUrl || (!supabaseKey && !supabaseAnonKey)) {
  throw new Error("Missing VITE_SUPABASE_URL or (VITE_SUPABASE_ANON_KEY && VITE_SUPABASE_PUBLISHABLE_KEY) in .env");
}

export const supabase = createClient(supabaseUrl, (supabaseKey ? supabaseKey : supabaseAnonKey));