import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Use placeholder values during development so the app doesn't crash
// before .env is set up — the UI will show a config banner instead
const url = supabaseUrl  || 'https://placeholder.supabase.co'
const key = supabaseKey  || 'placeholder-anon-key'

export const supabase = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
})

export const isConfigured = Boolean(supabaseUrl && supabaseKey)
