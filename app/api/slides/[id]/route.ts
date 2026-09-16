import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { slides } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

async function loadOwnedSlide(id: string, userId: string, isAdmin: boolean) {
  const rows = await db.select().from(slides).where(eq(slides.id, id)).limit(1)
  const slide = rows[0]
  if (!slide) return { slide: null, allowed: false }
  // Members can only touch their own; admins can touch anyone's (used by
  // the admin portal's slide-oversight view/edit).
  const allowed = isAdmin || slide.userId === userId
  return { slide, allowed }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slide, allowed } = await loadOwnedSlide(params.id, session.user.id, session.user.role === 'admin')
  if (!slide) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return NextResponse.json(slide)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slide, allowed } = await loadOwnedSlide(params.id, session.user.id, session.user.role === 'admin')
  if (!slide) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const patch: Partial<typeof slides.$inferInsert> = { updatedAt: new Date() }
  if (typeof body.title === 'string') patch.title = body.title.trim() || 'Untitled Slide'
  if (body.orientation === 'landscape' || body.orientation === 'portrait') patch.orientation = body.orientation
  if (body.data !== undefined) patch.data = body.data

  const [updated] = await db.update(slides).set(patch).where(eq(slides.id, params.id)).returning()
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slide, allowed } = await loadOwnedSlide(params.id, session.user.id, session.user.role === 'admin')
  if (!slide) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await db.delete(slides).where(eq(slides.id, params.id))
  return NextResponse.json({ ok: true })
}
