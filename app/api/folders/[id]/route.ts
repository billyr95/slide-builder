import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getFolderContents } from '@/lib/folderContents'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contents = await getFolderContents(params.id)
  if (!contents) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(contents)
}
