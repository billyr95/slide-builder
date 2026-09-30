import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { slides, users, folders } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// Slides are shared/org-wide -- any authenticated user can view, edit, or
// delete any saved slide, not just ones they created. userId is retained
// purely as "who originally created this" metadata, never an access check.
async function loadSlide(id: string) {
  const rows = await db.select().from(slides).where(eq(slides.id, id)).limit(1)
  return rows[0] ?? null
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const slide = await loadSlide(params.id)
  if (!slide) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [owner] = await db.select({ email: users.email }).from(users).where(eq(users.id, slide.userId)).limit(1)
  return NextResponse.json({ ...slide, ownerEmail: owner?.email ?? null })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const slide = await loadSlide(params.id)
  if (!slide) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const patch: Partial<typeof slides.$inferInsert> = { updatedAt: new Date() }
  if (typeof body.title === 'string') patch.title = body.title.trim() || 'Untitled Slide'
  if (body.orientation === 'landscape' || body.orientation === 'portrait') patch.orientation = body.orientation
  if (body.data !== undefined) patch.data = body.data
  // "Move to..." -- any authenticated user can move any slide into any
  // folder, consistent with the shared-edit model. Verified to still exist
  // first (same reasoning as POST /api/slides): a stale/deleted folderId
  // would otherwise fail the update's FK constraint and surface as an
  // opaque 500, silently breaking autosave for the rest of this patch too.
  if (typeof body.folderId === 'string' && body.folderId) {
    const [match] = await db.select({ id: folders.id }).from(folders).where(eq(folders.id, body.folderId)).limit(1)
    if (match) patch.folderId = match.id
  }

  try {
    const [updated] = await db.update(slides).set(patch).where(eq(slides.id, params.id)).returning()
    return NextResponse.json(updated)
  } catch (err) {
    console.error('PUT /api/slides/[id] failed', err)
    return NextResponse.json({ error: 'Failed to save slide' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const slide = await loadSlide(params.id)
  if (!slide) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.delete(slides).where(eq(slides.id, params.id))
  return NextResponse.json({ ok: true })
}
