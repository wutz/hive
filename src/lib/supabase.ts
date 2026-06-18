import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://icbmhwuzmazxwsrcough.supabase.co'
const supabaseKey = 'sb_publishable_Cp0lPDleO8haCvdYLm-0zA_3GHp3pZA'

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
})
