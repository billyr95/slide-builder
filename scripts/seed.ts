#!/usr/bin/env -S npx tsx
/**
 * One-off admin account creation. Run via:
 *   SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD=... npx tsx scripts/seed.ts
 *
 * Also seeds a second, specific admin (bcumento@92ny.org) whenever
 * SEED_ADMIN_2_PASSWORD is set. Its email is hardcoded here since an email
 * address isn't sensitive, but the password is never hardcoded -- it's read
 * from the environment at seed time and hashed with bcrypt before storing,
 * same as the primary account.
 *
 * There's no signup UI by design (~8-9 users max, added manually). Every
 * other account gets added the same way later: re-run this script (or a
 * copy of it) with different env vars, or insert directly via `npm run
 * db:studio`. TODO: build an admin "add user" UI if the account count ever
 * makes one-off script runs annoying.
 */
import bcrypt from 'bcryptjs'
import { loadEnvLocal } from '../lib/loadEnvLocal'

loadEnvLocal()

import { db } from '../lib/db'
import { users } from '../lib/db/schema'
import { eq } from 'drizzle-orm'

async function createAdmin(email: string, password: string) {
  if (password.length < 8) {
    console.error(`Password for ${email} should be at least 8 characters. Skipping.`)
    return
  }

  const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1)
  if (existing.length > 0) {
    console.error(`A user with email ${email} already exists (id: ${existing[0].id}). Not overwriting.`)
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const [created] = await db.insert(users).values({
    email: email.toLowerCase(),
    passwordHash,
    role: 'admin',
  }).returning({ id: users.id, email: users.email, role: users.role })

  console.log('Created admin user:', created)
}

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL
  const password = process.env.SEED_ADMIN_PASSWORD
  const admin2Password = process.env.SEED_ADMIN_2_PASSWORD

  if (!email && !password && !admin2Password) {
    console.error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (and/or SEED_ADMIN_2_PASSWORD for bcumento@92ny.org) before running this script.')
    process.exit(1)
  }

  if (email && password) {
    await createAdmin(email, password)
  } else if (email || password) {
    console.error('Set both SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to seed that account.')
  }

  if (admin2Password) {
    await createAdmin('bcumento@92ny.org', admin2Password)
  }
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
