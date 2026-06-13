import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import * as schema from './schema'

let db: ReturnType<typeof createDb> | null = null

function createDb() {
  const client = createClient({
    url: process.env.DATABASE_URL || 'file:local.db',
    authToken: process.env.DATABASE_AUTH_TOKEN,
  })
  return drizzle(client, { schema })
}

export function getDb() {
  if (!db) {
    db = createDb()
  }
  return db
}

export type Database = ReturnType<typeof getDb>
