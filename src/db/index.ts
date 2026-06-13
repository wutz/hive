import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

let db: ReturnType<typeof createDb> | null = null

function createDb() {
  const client = postgres(process.env.DATABASE_URL!, {
    prepare: false,
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
