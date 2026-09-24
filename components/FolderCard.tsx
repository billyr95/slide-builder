'use client'

interface FolderCardProps {
  name: string
  onOpen: () => void
}

// Same card footprint as SlideCard so folders and slides sit in one
// consistent grid, but no thumbnail preview or delete/move controls --
// there's no delete-folder feature yet (see lib/db/schema.ts's own comment
// on folders.parentFolderId).
export default function FolderCard({ name, onOpen }: FolderCardProps) {
  return (
    <button
      onClick={onOpen}
      className="group text-left block bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-600 transition-colors"
    >
      <div className="rounded-lg overflow-hidden mb-3 bg-zinc-800 flex items-center justify-center" style={{ aspectRatio: '1920 / 1080' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600 group-hover:text-zinc-500 transition-colors">
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
        </svg>
      </div>
      <p className="text-sm font-medium truncate">{name}</p>
      <p className="text-xs text-zinc-600 mt-0.5">Folder</p>
    </button>
  )
}
