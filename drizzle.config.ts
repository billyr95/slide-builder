import type { Config } from 'drizzle-kit'
import { loadEnvLocal } from './lib/loadEnvLocal'

// drizzle-kit's CLI only auto-loads a plain .env, not Next.js's .env.local
// convention.
loadEnvLocal()

export default {
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || process.env.POSTGRES_URL || '',
  },
} satisfies Config
