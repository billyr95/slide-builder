import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { trainingEntries } from '@/lib/db/schema'
import { trainEntryToRow, rowToTrainEntry } from '@/lib/db/trainingEntryMapping'
import { desc, eq } from 'drizzle-orm'

// Any authenticated user can create an entry -- this is what both the main
// editor's live-logging-on-Export and /train's manual "Add to queue" call.
// Data collection stays pooled across every account from day one, even
// though only admins can browse/manage the pool (see GET below).
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const row = trainEntryToRow(body, session.user.id)
  const [created] = await db.insert(trainingEntries).values(row).returning()
  return NextResponse.json(rowToTrainEntry(created), { status: 201 })
}

// Admin-only: list/browse the pooled training data. ?scope=mine restricts
// to the admin's own logged/added entries; default is everyone's.
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const scope = req.nextUrl.searchParams.get('scope')
  const rows = scope === 'mine'
    ? await db.select().from(trainingEntries).where(eq(trainingEntries.userId, session.user.id)).orderBy(desc(trainingEntries.createdAt))
    : await db.select().from(trainingEntries).orderBy(desc(trainingEntries.createdAt))

  return NextResponse.json(rows.map(rowToTrainEntry))
}
