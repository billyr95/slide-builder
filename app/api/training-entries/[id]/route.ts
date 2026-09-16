import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { trainingEntries } from '@/lib/db/schema'
import { trainEntryToRow, rowToTrainEntry } from '@/lib/db/trainingEntryMapping'
import { eq } from 'drizzle-orm'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const existing = await db.select().from(trainingEntries).where(eq(trainingEntries.id, params.id)).limit(1)
  if (!existing[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  // Preserve the entry's original owner -- editing someone's entry in the
  // admin portal shouldn't reassign whose data it counts as.
  const row = trainEntryToRow(body, existing[0].userId)
  const [updated] = await db.update(trainingEntries).set(row).where(eq(trainingEntries.id, params.id)).returning()
  return NextResponse.json(rowToTrainEntry(updated))
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await db.delete(trainingEntries).where(eq(trainingEntries.id, params.id))
  return NextResponse.json({ ok: true })
}
