import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { folders } from '@/lib/db/schema'
import { asc } from 'drizzle-orm'

// GET returns the full flat folder list (id/name/parentFolderId only --
// cheap at this org's scale) for building folder paths client-side
// (Dashboard's global search captions, FolderPickerModal's rows). Folder
// browsing itself goes through /api/folders/[id] and /api/folders/root.
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db.select({ id: folders.id, name: folders.name, parentFolderId: folders.parentFolderId })
    .from(folders).orderBy(asc(folders.name))
  return NextResponse.json(rows)
}

// Folders are shared/org-wide, same as slides -- any authenticated user can
// create one inside whatever folder they currently have open.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 })
  if (typeof body.parentFolderId !== 'string' || !body.parentFolderId) {
    return NextResponse.json({ error: 'Missing parentFolderId' }, { status: 400 })
  }

  const [created] = await db.insert(folders).values({
    name,
    parentFolderId: body.parentFolderId,
    createdBy: session.user.id,
  }).returning()

  return NextResponse.json(created, { status: 201 })
}
