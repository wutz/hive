import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || 'https://icbmhwuzmazxwsrcough.supabase.co'
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || ''

let client: ReturnType<typeof createClient> | null = null

export function getSupabase() {
  if (!client) {
    client = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    })
  }
  return client
}

// Keep Drizzle for server functions that still use it
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

let pgClient: ReturnType<typeof postgres> | null = null

function getPgClient() {
  if (!pgClient) {
    pgClient = postgres(process.env.DATABASE_URL!, {
      prepare: false,
      connect_timeout: 30,
      idle_timeout: 30,
      max_lifetime: 60 * 5,
      max: 10,
      onnotice: () => {},
    })
  }
  return pgClient
}

export function getDb() {
  return drizzle(getPgClient(), { schema })
}

export type Database = ReturnType<typeof getDb>
