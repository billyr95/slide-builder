import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { slides, users } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'
import { getRootFolderId } from '@/lib/folderContents'

// The full flat list of every slide, org-wide -- used by the admin
// portal's flat browse view and the Dashboard's global search (which
// intentionally searches across every folder, not just the one currently
// open, so it needs the whole set client-side to filter/rank).
// folderId lets a caller compute a result's path via lib/folderPath.ts;
// ordinary folder-scoped browsing goes through /api/folders/[id] instead,
// not this endpoint.
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db
    .select({
      id: slides.id,
      title: slides.title,
      orientation: slides.orientation,
      createdAt: slides.createdAt,
      updatedAt: slides.updatedAt,
      userId: slides.userId,
      ownerEmail: users.email,
      folderId: slides.folderId,
    })
    .from(slides)
    .innerJoin(users, eq(slides.userId, users.id))
    .orderBy(desc(slides.updatedAt))
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.data) return NextResponse.json({ error: 'Missing data' }, { status: 400 })

  // Created inside whichever folder the caller currently has open
  // (Dashboard passes its open folder's id); falls back to the root "All
  // Slides" folder so a slide is never created with nowhere to live.
  const folderId = typeof body.folderId === 'string' && body.folderId ? body.folderId : await getRootFolderId()

  const [created] = await db.insert(slides).values({
    userId: session.user.id,
    folderId,
    title: (body.title || 'Untitled Slide').trim() || 'Untitled Slide',
    orientation: body.orientation === 'portrait' ? 'portrait' : 'landscape',
    data: body.data,
  }).returning()

  return NextResponse.json(created, { status: 201 })
}
