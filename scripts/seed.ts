#!/usr/bin/env -S npx tsx
/**
 * One-off admin account creation. Run via:
 *   SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD=... npx tsx scripts/seed.ts
 *
 * There's no signup UI by design (~8-9 users max, added manually). Every
 * other account gets added the same way later: re-run this script (or a
 * copy of it) with different env vars, or insert directly via `npm run
 * db:studio`. TODO: build an admin "add user" UI if the account count ever
 * makes one-off script runs annoying.
 */
import bcrypt from 'bcrypt'
import { loadEnvLocal } from '../lib/loadEnvLocal'

loadEnvLocal()

import { db } from '../lib/db'
import { users } from '../lib/db/schema'
import { eq } from 'drizzle-orm'

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL
  const password = process.env.SEED_ADMIN_PASSWORD
  if (!email || !password) {
    console.error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD env vars before running this script.')
    process.exit(1)
  }
  if (password.length < 8) {
    console.error('SEED_ADMIN_PASSWORD should be at least 8 characters.')
    process.exit(1)
  }

  const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1)
  if (existing.length > 0) {
    console.error(`A user with email ${email} already exists (id: ${existing[0].id}). Not overwriting.`)
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const [created] = await db.insert(users).values({
    email: email.toLowerCase(),
    passwordHash,
    role: 'admin',
  }).returning({ id: users.id, email: users.email, role: users.role })

  console.log('Created admin user:', created)
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
