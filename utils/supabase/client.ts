import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Kita ambil variable-nya dulu
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Validasi manual biar TypeScript ga marah (ga perlu tanda seru !)
  if (!supabaseUrl || !supabaseKey) {
    // Kalau di mode development, kita kasih peringatan di console browser
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Supabase URL atau Key belum disetting di .env!')
    }
    // Return client kosong atau throw error, tapi biar app ga crash kita return client dengan string kosong (fallback)
    return createBrowserClient(supabaseUrl || '', supabaseKey || '')
  }

  // Kalau ada, buat client-nya
  return createBrowserClient(supabaseUrl, supabaseKey)
}