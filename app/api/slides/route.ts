import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { slides, users } from '@/lib/db/schema'
import { desc, eq, sql } from 'drizzle-orm'
import { getRootFolderId } from '@/lib/folderContents'

// The full flat list of every slide, org-wide -- the Dashboard's Finder-
// style tree view builds its whole nested structure from this (joined
// with GET /api/folders' flat folder list) rather than fetching one
// folder's contents at a time, since folders can be expanded several at
// once; the admin portal's flat list and the Dashboard's global search
// (which searches every folder, not just an open one) also both read from
// here. folderId lets a caller place a slide in the tree or compute its
// path via lib/folderPath.ts.
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
      // Computed in Postgres (pg_column_size) rather than selecting the
      // actual `data` JSONB blob -- keeps this list endpoint cheap to
      // transfer while still giving the tree view's "Size" column a real
      // number, not a placeholder.
      sizeBytes: sql<number>`pg_column_size(${slides.data})`.mapWith(Number),
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
