#!/usr/bin/env -S npx tsx
import bcrypt from 'bcryptjs'
import { loadEnvLocal } from '../lib/loadEnvLocal'
loadEnvLocal()

import { db } from '../lib/db'
import { users, slides, folders, trainingEntries } from '../lib/db/schema'
import { eq } from 'drizzle-orm'

const PASSWORD = process.env.NEW_USERS_PASSWORD
if (!PASSWORD) {
  console.error('Set NEW_USERS_PASSWORD before running this script.')
  process.exit(1)
}

async function createAdmin(email: string, password: string) {
  const lower = email.toLowerCase()
  const existing = await db.select().from(users).where(eq(users.email, lower)).limit(1)
  if (existing.length > 0) {
    console.log(`${lower} already exists (id: ${existing[0].id}) -- reusing it.`)
    return existing[0]
  }
  const passwordHash = await bcrypt.hash(password, 12)
  const [created] = await db.insert(users).values({ email: lower, passwordHash, role: 'admin' }).returning()
  console.log('Created admin user:', { id: created.id, email: created.email, role: created.role })
  return created
}

async function run() {
  // 1. Create the new account that inherits billy.e.riley@gmail.com's data
  // and role FIRST -- every FK reference gets repointed at its id before
  // the old account is deleted, so nothing cascade-deletes.
  const briley = await createAdmin('briley@92ny.org', PASSWORD!)

  const [billy] = await db.select().from(users).where(eq(users.email, 'billy.e.riley@gmail.com')).limit(1)
  if (!billy) {
    console.log('billy.e.riley@gmail.com not found -- nothing to migrate/delete.')
  } else {
    if (billy.role !== briley.role) {
      await db.update(users).set({ role: billy.role }).where(eq(users.id, briley.id))
      console.log(`Matched briley@92ny.org's role to billy's (${billy.role})`)
    }

    const movedSlides = await db.update(slides).set({ userId: briley.id }).where(eq(slides.userId, billy.id)).returning({ id: slides.id })
    console.log('Reassigned slides.userId (created-by):', movedSlides.length)

    const movedFolders = await db.update(folders).set({ createdBy: briley.id }).where(eq(folders.createdBy, billy.id)).returning({ id: folders.id, name: folders.name })
    console.log('Reassigned folders.createdBy:', movedFolders.map(f => f.name))

    const movedTraining = await db.update(trainingEntries).set({ userId: briley.id }).where(eq(trainingEntries.userId, billy.id)).returning({ id: trainingEntries.id })
    console.log('Reassigned training_entries.userId:', movedTraining.length)

    // slides.activeEditorId is left alone -- it's an ephemeral "who has
    // this open right now" heartbeat, not owned content/permissions; its
    // onDelete:'set null' FK clears it safely on its own.
    await db.delete(users).where(eq(users.id, billy.id))
    console.log('Deleted billy.e.riley@gmail.com')
  }

  // 2. The other three new accounts -- no data to migrate.
  await createAdmin('MRoberson@92ny.org', PASSWORD!)
  await createAdmin('APolicastro@92ny.org', PASSWORD!)
  await createAdmin('Slitus@92ny.org', PASSWORD!)
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
