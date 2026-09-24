#!/usr/bin/env -S npx tsx
import { loadEnvLocal } from '../lib/loadEnvLocal'
loadEnvLocal()

import { db } from '../lib/db'
import { folders, slides } from '../lib/db/schema'

async function run() {
  const allFolders = await db.select().from(folders)
  console.log('FOLDERS:')
  for (const f of allFolders) console.log(`  ${f.id} name=${f.name} parent=${f.parentFolderId}`)

  const allSlides = await db.select({ id: slides.id, title: slides.title, folderId: slides.folderId }).from(slides)
  console.log('SLIDES:')
  for (const s of allSlides) console.log(`  ${s.id} folder=${s.folderId} title=${s.title}`)
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
