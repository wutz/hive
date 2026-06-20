import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

const supabaseUrl = process.env.SUPABASE_URL || 'https://icbmhwuzmazxwsrcough.supabase.co'
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || ''

let client: ReturnType<typeof createClient<Database>> | null = null

export function getSupabase() {
  if (!client) {
    client = createClient<Database>(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    })
  }
  return client
}
