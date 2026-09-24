export interface FolderFlat {
  id: string
  name: string
  parentFolderId: string | null
  createdAt: string
}

// Used by the Dashboard's global-search result captions ("which folder
// does this live in") -- walks the parentFolderId chain to build the full
// "Root / Sub / Sub" path string from a flat folder list.
export function buildFolderPath(folders: FolderFlat[], folderId: string | null | undefined): string {
  if (!folderId) return ''
  const byId = new Map(folders.map(f => [f.id, f]))
  const parts: string[] = []
  let cur = byId.get(folderId)
  let guard = 0
  while (cur && guard++ < 50) {
    parts.unshift(cur.name)
    cur = cur.parentFolderId ? byId.get(cur.parentFolderId) : undefined
  }
  return parts.join(' / ')
}
