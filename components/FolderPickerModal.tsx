'use client'

import { useMemo, useState } from 'react'
import { FolderFlat, buildFolderPath } from '@/lib/folderPath'

interface FolderPickerModalProps {
  folders: FolderFlat[]
  // Pre-selected/current folder, if known -- just visually highlighted,
  // still pickable (e.g. re-confirming "move" without changing anything).
  currentFolderId?: string
  onPick: (folderId: string) => void
  onClose: () => void
}

// A simple "Move to..." picker -- every folder shown as one row labeled
// with its full path (built the same way the Dashboard's global search
// captions are, via lib/folderPath.ts), since folders can nest arbitrarily
// deep and a flat path-labeled list is far simpler to get right than a
// collapsible tree while staying just as usable at this org's scale.
export default function FolderPickerModal({ folders, currentFolderId, onPick, onClose }: FolderPickerModalProps) {
  const [search, setSearch] = useState('')

  const rows = useMemo(() => {
    return folders
      .map(f => ({ id: f.id, path: buildFolderPath(folders, f.id) }))
      .sort((a, b) => a.path.localeCompare(b.path))
      .filter(r => r.path.toLowerCase().includes(search.toLowerCase()))
  }, [folders, search])

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-xl p-4 max-h-[70vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-sm font-medium text-white mb-3">Move to…</p>
        <input
          autoFocus
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search folders…"
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors mb-3"
        />
        <div className="overflow-y-auto custom-scrollbar flex-1 -mx-1">
          {rows.length === 0 ? (
            <p className="text-sm text-zinc-500 px-1">No folders match.</p>
          ) : (
            rows.map(r => (
              <button
                key={r.id}
                onClick={() => onPick(r.id)}
                className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors mx-1 ${
                  r.id === currentFolderId ? 'bg-zinc-800 text-white' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                {r.path}
              </button>
            ))
          )}
        </div>
        <button
          onClick={onClose}
          className="mt-3 text-sm text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors self-end"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
