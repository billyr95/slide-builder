import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getFolderContents, getRootFolderId } from '@/lib/folderContents'

// The Dashboard's entry point -- resolves and returns the seeded "All
// Slides" root folder's contents in one round trip, same shape as
// GET /api/folders/[id].
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rootId = await getRootFolderId()
  const contents = await getFolderContents(rootId)
  return NextResponse.json(contents)
}
