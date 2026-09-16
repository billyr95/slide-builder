import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import * as schema from './schema'

type Db = ReturnType<typeof drizzle<typeof schema>>

// Lazy on purpose: Next's build-time "collecting page data" step imports
// every route module (including this one, transitively) without ever
// calling a route handler. Reading DATABASE_URL eagerly at module load
// made that import throw and failed the production build even though no
// query was ever run -- deferring the check to first real use (inside the
// Proxy's get trap, which only fires when a request handler actually calls
// db.select/.insert/etc.) keeps the build green regardless of whether a
// database is connected yet.
let cached: Db | null = null

function getDb(): Db {
  if (cached) return cached
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL (or POSTGRES_URL) is not set — connect a Postgres database first.')
  }
  const sql = neon(connectionString)
  cached = drizzle(sql, { schema })
  return cached
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver)
  },
})
