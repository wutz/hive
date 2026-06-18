import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Singleton client — reused across requests in the same Worker isolate
let client: ReturnType<typeof postgres> | null = null

function getClient() {
  if (!client) {
    client = postgres(process.env.DATABASE_URL!, {
      prepare: false,
      connect_timeout: 30,
      idle_timeout: 30,
      max_lifetime: 60 * 5,
      max: 10,
      onnotice: () => {},
    })
  }
  return client
}

export function getDb() {
  return drizzle(getClient(), { schema })
}

export type Database = ReturnType<typeof getDb>
