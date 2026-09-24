export interface FolderFlat {
  id: string
  name: string
  parentFolderId: string | null
}

// Shared by the Dashboard's global-search result captions ("which folder
// does this live in") and FolderPickerModal's row labels -- both need the
// same full "Root / Sub / Sub" path string built from the same flat folder
// list, so this is the one place that walks the parentFolderId chain.
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
