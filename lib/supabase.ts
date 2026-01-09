import { createClient } from '@supabase/supabase-js';

// Mengambil kunci dari .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Membuat client untuk interaksi ke DB
export const supabase = createClient(supabaseUrl, supabaseAnonKey);