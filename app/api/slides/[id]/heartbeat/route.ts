import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { checkAndRefreshActiveEditor } from '@/lib/activeEditorTracking'

// Pinged once when the editor finishes loading a slide, then again every
// autosave tick while it stays open (see app/editor/[id]/page.tsx). Slides
// are shared/org-wide now, so this isn't an access check -- it's purely the
// "someone else has this open" advisory warning's data source.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await checkAndRefreshActiveEditor(params.id, session.user.id)
  if (!result.found) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ otherEditor: result.otherEditor })
}
