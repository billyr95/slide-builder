import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { trainingEntries } from '@/lib/db/schema'
import { rowToTrainEntry } from '@/lib/db/trainingEntryMapping'
import { buildBatchLine } from '@/lib/trainExport'
import { desc, eq } from 'drizzle-orm'

// Admin-only: builds the same Batch-API JSONL the old client-side export
// produced (one line per entry via buildBatchLine), just from the shared
// server-side pool instead of a local IndexedDB queue.
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const scope = req.nextUrl.searchParams.get('scope')
  const rows = scope === 'mine'
    ? await db.select().from(trainingEntries).where(eq(trainingEntries.userId, session.user.id)).orderBy(desc(trainingEntries.createdAt))
    : await db.select().from(trainingEntries).orderBy(desc(trainingEntries.createdAt))

  const lines = rows.map(row => buildBatchLine(rowToTrainEntry(row)))
  const jsonl = lines.join('\n') + (lines.length ? '\n' : '')
  const stamp = new Date().toISOString().slice(0, 10)

  return new NextResponse(jsonl, {
    headers: {
      'Content-Type': 'application/jsonl',
      'Content-Disposition': `attachment; filename="training-batch-${scope === 'mine' ? 'mine' : 'all'}-${stamp}.jsonl"`,
    },
  })
}
