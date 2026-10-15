import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { slideGroups } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'

// The flat list of every slide group, org-wide -- the Dashboard's file
// browser joins this (client-side) against GET /api/slides' own flat list
// (each slide already carries its own groupId) to build the expandable
// group rows, same "two flat lists combined in the client" pattern GET
// /api/folders + GET /api/slides already use for the folder tree.
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db.select().from(slideGroups).orderBy(desc(slideGroups.createdAt))
  return NextResponse.json(rows)
}

// Creates a new, empty group -- callers (lib/slideGroupActions.ts) then PUT
// each member slide's groupId to it. Kept this minimal/composable rather
// than one endpoint trying to handle every "create a lobby version"/"group
// with..." combination at once.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const name = (typeof body.name === 'string' && body.name.trim()) || 'Untitled Group'

  try {
    const [created] = await db.insert(slideGroups).values({
      name,
      createdBy: session.user.id,
    }).returning()
    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    console.error('POST /api/slide-groups failed', err)
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 })
  }
}
