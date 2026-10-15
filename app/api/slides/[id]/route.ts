import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { slides, users, folders, slideGroups } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// Slides are shared/org-wide -- any authenticated user can view, edit, or
// delete any saved slide, not just ones they created. userId is retained
// purely as "who originally created this" metadata, never an access check.
async function loadSlide(id: string) {
  const rows = await db.select().from(slides).where(eq(slides.id, id)).limit(1)
  return rows[0] ?? null
}

// "A group with no members is deleted automatically" -- there's no DB
// trigger for this, so every code path that can drop a group to zero
// members (removing a slide from its group, or deleting a grouped slide
// outright) calls this right after, to keep that invariant true in
// practice. Safe to call speculatively (checks membership itself) and a
// no-op if the group still has members or doesn't exist.
async function deleteGroupIfEmpty(groupId: string) {
  const [remaining] = await db.select({ id: slides.id }).from(slides).where(eq(slides.groupId, groupId)).limit(1)
  if (!remaining) await db.delete(slideGroups).where(eq(slideGroups.id, groupId))
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
  if (body.screenType === 'projector' || body.screenType === 'lobby') patch.screenType = body.screenType
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
  // Group membership: `groupId: null` explicitly means "remove from group"
  // (see "Remove from group" below); a string id means "Group with..." or
  // "Create lobby/projector version" adding this slide to a group --
  // verified to still exist first, same stale-reference guard as folderId.
  // `undefined`/absent leaves membership untouched (the ordinary autosave
  // PUT never includes this key at all).
  let groupIdToCleanup: string | null = null
  if (body.groupId === null) {
    groupIdToCleanup = slide.groupId
    patch.groupId = null
  } else if (typeof body.groupId === 'string' && body.groupId) {
    const [match] = await db.select({ id: slideGroups.id }).from(slideGroups).where(eq(slideGroups.id, body.groupId)).limit(1)
    if (match) patch.groupId = match.id
  }

  try {
    const [updated] = await db.update(slides).set(patch).where(eq(slides.id, params.id)).returning()
    if (groupIdToCleanup) await deleteGroupIfEmpty(groupIdToCleanup)
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
  if (slide.groupId) await deleteGroupIfEmpty(slide.groupId)
  return NextResponse.json({ ok: true })
}
