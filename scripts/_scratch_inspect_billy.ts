#!/usr/bin/env -S npx tsx
import { loadEnvLocal } from '../lib/loadEnvLocal'
loadEnvLocal()

import { db } from '../lib/db'
import { users, slides, folders, trainingEntries } from '../lib/db/schema'
import { eq } from 'drizzle-orm'

async function run() {
  const [user] = await db.select().from(users).where(eq(users.email, 'billy.e.riley@gmail.com')).limit(1)
  if (!user) { console.log('No user found with that email.'); return }
  console.log('user:', { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt })

  const createdSlides = await db.select({ id: slides.id }).from(slides).where(eq(slides.userId, user.id))
  console.log('slides created by him:', createdSlides.length)

  const activeEditorSlides = await db.select({ id: slides.id }).from(slides).where(eq(slides.activeEditorId, user.id))
  console.log('slides currently showing him as active editor:', activeEditorSlides.length)

  const createdFolders = await db.select({ id: folders.id, name: folders.name }).from(folders).where(eq(folders.createdBy, user.id))
  console.log('folders created by him:', createdFolders.length, createdFolders.map(f => f.name))

  const trainingRows = await db.select({ id: trainingEntries.id }).from(trainingEntries).where(eq(trainingEntries.userId, user.id))
  console.log('training entries created by him:', trainingRows.length)
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
