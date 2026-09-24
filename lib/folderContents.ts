import { db } from '@/lib/db'
import { folders, slides, users } from '@/lib/db/schema'
import { eq, isNull, asc, desc, sql } from 'drizzle-orm'

// Server-side shape, pre-JSON-serialization -- drizzle's timestamp columns
// return Date objects here; NextResponse.json() turns them into ISO
// strings for the actual HTTP response, same as every other route in this
// app (see e.g. app/api/slides/[id]/route.ts's PUT handler).
export interface FolderSummary {
  id: string
  name: string
  createdAt: Date
}

export interface SlideSummary {
  id: string
  title: string
  orientation: 'landscape' | 'portrait'
  createdAt: Date
  updatedAt: Date
  userId: string
  ownerEmail: string
  sizeBytes: number
}

export interface FolderContents {
  folder: { id: string; name: string; parentFolderId: string | null }
  // From the root down to (and including) this folder.
  breadcrumb: { id: string; name: string }[]
  subfolders: FolderSummary[]
  slides: SlideSummary[]
}

// Shared by GET /api/folders/[id] and GET /api/folders/root -- single
// source of truth for "what does the dashboard show when this folder is
// open", so the two entry points can't drift into showing different
// shapes for what's conceptually the same operation.
export async function getFolderContents(folderId: string): Promise<FolderContents | null> {
  const [folder] = await db.select().from(folders).where(eq(folders.id, folderId)).limit(1)
  if (!folder) return null

  // Walk the parent chain to build the breadcrumb. Folder nesting is
  // expected to stay shallow for this org's use (a handful of levels at
  // most), so a handful of small sequential queries here is simpler and
  // plenty fast rather than a recursive CTE; guarded against a cycle
  // (shouldn't be reachable -- creation always attaches to an existing
  // folder -- but this must never infinite-loop if data is ever edited by
  // hand).
  const breadcrumb: { id: string; name: string }[] = [{ id: folder.id, name: folder.name }]
  let parentId = folder.parentFolderId
  let guard = 0
  while (parentId && guard++ < 50) {
    const [parent] = await db.select({ id: folders.id, name: folders.name, parentFolderId: folders.parentFolderId })
      .from(folders).where(eq(folders.id, parentId)).limit(1)
    if (!parent) break
    breadcrumb.unshift({ id: parent.id, name: parent.name })
    parentId = parent.parentFolderId
  }

  const subfolders = await db.select({ id: folders.id, name: folders.name, createdAt: folders.createdAt })
    .from(folders).where(eq(folders.parentFolderId, folderId)).orderBy(asc(folders.name))

  const slideRows = await db.select({
    id: slides.id, title: slides.title, orientation: slides.orientation,
    createdAt: slides.createdAt, updatedAt: slides.updatedAt, userId: slides.userId, ownerEmail: users.email,
    sizeBytes: sql<number>`pg_column_size(${slides.data})`.mapWith(Number),
  }).from(slides).innerJoin(users, eq(slides.userId, users.id)).where(eq(slides.folderId, folderId)).orderBy(desc(slides.updatedAt))

  return {
    folder: { id: folder.id, name: folder.name, parentFolderId: folder.parentFolderId },
    breadcrumb,
    subfolders,
    slides: slideRows,
  }
}

// The single seeded top-level folder ("All Slides") every browsing path
// starts from, and the fallback destination for a newly created slide/
// folder when no folderId is given explicitly.
export async function getRootFolderId(): Promise<string> {
  const [root] = await db.select({ id: folders.id }).from(folders).where(isNull(folders.parentFolderId)).limit(1)
  if (!root) throw new Error('No root folder found -- the folders migration/backfill has not been run.')
  return root.id
}
