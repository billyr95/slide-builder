import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { slides, users, folders, slideGroups } from '@/lib/db/schema'
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
      screenType: slides.screenType,
      groupId: slides.groupId,
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

  try {
    // Created inside whichever folder the caller currently has open
    // (Dashboard passes its open folder's id); falls back to the root "All
    // Slides" folder so a slide is never created with nowhere to live. The
    // requested folder is verified to still exist first -- the caller's
    // copy of it can go stale (e.g. deleted in another tab), and inserting
    // a folderId with no matching row would otherwise fail the insert's FK
    // constraint and surface as an opaque 500 with no indication why.
    let folderId: string | null = null
    if (typeof body.folderId === 'string' && body.folderId) {
      const [match] = await db.select({ id: folders.id }).from(folders).where(eq(folders.id, body.folderId)).limit(1)
      folderId = match?.id ?? null
    }
    if (!folderId) folderId = await getRootFolderId()

    // Same stale-reference guard as folderId above -- used by "Create lobby
    // version"/"Create projector version" (lib/slideGroupActions.ts), which
    // creates the duplicate pre-assigned to the source slide's group.
    let groupId: string | null = null
    if (typeof body.groupId === 'string' && body.groupId) {
      const [match] = await db.select({ id: slideGroups.id }).from(slideGroups).where(eq(slideGroups.id, body.groupId)).limit(1)
      groupId = match?.id ?? null
    }

    const [created] = await db.insert(slides).values({
      userId: session.user.id,
      folderId,
      groupId,
      title: (body.title || 'Untitled Slide').trim() || 'Untitled Slide',
      orientation: body.orientation === 'portrait' ? 'portrait' : 'landscape',
      screenType: body.screenType === 'lobby' ? 'lobby' : 'projector',
      data: body.data,
    }).returning()

    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    console.error('POST /api/slides failed', err)
    return NextResponse.json({ error: 'Failed to create slide' }, { status: 500 })
  }
}
