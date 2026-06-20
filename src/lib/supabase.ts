import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://icbmhwuzmazxwsrcough.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Cp0lPDleO8haCvdYLm-0zA_3GHp3pZA'

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
})
