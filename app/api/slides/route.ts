import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { slides, users } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const wantsAll = req.nextUrl.searchParams.get('all') === '1'

  // Admin-only "all users' slides" view, for the admin portal's slide
  // oversight page. Everyone else (and admins who didn't ask for `all`)
  // only ever sees their own.
  if (wantsAll && session.user.role === 'admin') {
    const rows = await db
      .select({
        id: slides.id,
        title: slides.title,
        createdAt: slides.createdAt,
        updatedAt: slides.updatedAt,
        userId: slides.userId,
        ownerEmail: users.email,
      })
      .from(slides)
      .innerJoin(users, eq(slides.userId, users.id))
      .orderBy(desc(slides.updatedAt))
    return NextResponse.json(rows)
  }

  const rows = await db
    .select({
      id: slides.id,
      title: slides.title,
      createdAt: slides.createdAt,
      updatedAt: slides.updatedAt,
    })
    .from(slides)
    .where(eq(slides.userId, session.user.id))
    .orderBy(desc(slides.updatedAt))
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.data) return NextResponse.json({ error: 'Missing data' }, { status: 400 })

  const [created] = await db.insert(slides).values({
    userId: session.user.id,
    title: (body.title || 'Untitled Slide').trim() || 'Untitled Slide',
    data: body.data,
  }).returning()

  return NextResponse.json(created, { status: 201 })
}
