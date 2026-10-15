import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { slideGroups, slides } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// Direct "delete this whole group" -- not reachable from any spec'd UI
// action (groups otherwise only disappear automatically once their last
// member leaves, see app/api/slides/[id]/route.ts's deleteGroupIfEmpty),
// but kept as a defensive/admin-cleanup path. Ungroups every member first
// (their rows are untouched otherwise -- deleting a group never deletes
// slides) rather than relying on the FK's onDelete:set null alone, so the
// response can't race a caller that immediately re-fetches the slide list.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await db.update(slides).set({ groupId: null }).where(eq(slides.groupId, params.id))
    await db.delete(slideGroups).where(eq(slideGroups.id, params.id))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/slide-groups/[id] failed', err)
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 })
  }
}
