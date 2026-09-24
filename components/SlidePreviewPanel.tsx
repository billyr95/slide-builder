'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import SlideThumbnail from './SlideThumbnail'
import { SlideData, Orientation } from '@/lib/types'
import { timeAgo } from '@/lib/timeAgo'

export interface PreviewSlide {
  id: string
  title: string
  orientation: Orientation
  updatedAt: string
  ownerEmail: string
}

export interface PreviewFolder {
  id: string
  name: string
  createdAt: string
  itemCount: number
}

export type PreviewSelection =
  | { kind: 'slide'; slide: PreviewSlide }
  | { kind: 'folder'; folder: PreviewFolder }
  | null

interface SlidePreviewPanelProps {
  selection: PreviewSelection
  onDeleted: (id: string) => void
}

function BigFolderIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" className="text-zinc-600">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  )
}

// The right-hand pane of the Dashboard's Finder-style split view -- shows
// whatever's currently selected in FolderTreeView. A slide gets a real
// rendered thumbnail (same SlideThumbnail/SlideCanvas the dashboard grid
// and search results already use, so 16:9 and 9:16 both preview cleanly)
// plus View/Delete; a folder gets basic info only (no actions -- there's
// no delete-folder feature yet, matching lib/db/schema.ts's own note on
// that).
export default function SlidePreviewPanel({ selection, onDeleted }: SlidePreviewPanelProps) {
  const router = useRouter()
  const [data, setData] = useState<SlideData | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setData(null)
    if (selection?.kind !== 'slide') return
    const slideId = selection.slide.id
    let cancelled = false
    fetch(`/api/slides/${slideId}`)
      .then(res => (res.ok ? res.json() : null))
      .then(slide => { if (!cancelled && slide) setData(slide.data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [selection])

  if (!selection) {
    return (
      <div className="w-72 flex-shrink-0 h-fit border border-zinc-800 rounded-xl p-6 flex items-center justify-center text-center">
        <p className="text-sm text-zinc-600">Select a file or folder to preview it here.</p>
      </div>
    )
  }

  if (selection.kind === 'folder') {
    const { folder } = selection
    return (
      <div className="w-72 flex-shrink-0 h-fit border border-zinc-800 rounded-xl p-4">
        <div className="rounded-lg bg-zinc-900 aspect-square flex items-center justify-center mb-3">
          <BigFolderIcon />
        </div>
        <p className="text-sm font-medium truncate">{folder.name}</p>
        <p className="text-xs text-zinc-500 mt-1">{folder.itemCount} item{folder.itemCount === 1 ? '' : 's'}</p>
        <p className="text-xs text-zinc-600 mt-0.5">Created {timeAgo(folder.createdAt)}</p>
      </div>
    )
  }

  const { slide } = selection

  async function handleDelete() {
    if (deleting) return
    if (!window.confirm(`Delete "${slide.title}"? This can't be undone.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/slides/${slide.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`Delete failed (${res.status})`)
      onDeleted(slide.id)
    } catch (e) {
      console.error(e)
      window.alert('Failed to delete the slide. Please try again.')
      setDeleting(false)
    }
  }

  return (
    <div className="w-72 flex-shrink-0 h-fit border border-zinc-800 rounded-xl p-4">
      <div className="rounded-lg overflow-hidden mb-3 bg-zinc-900">
        {data ? (
          <SlideThumbnail data={data} orientation={slide.orientation} />
        ) : (
          <div className="flex items-center justify-center text-xs text-zinc-600" style={{ aspectRatio: slide.orientation === 'landscape' ? '1920 / 1080' : '1080 / 1920' }}>
            Loading…
          </div>
        )}
      </div>
      <p className="text-sm font-medium truncate">{slide.title}</p>
      <p className="text-xs text-zinc-500 mt-1 truncate">Created by {slide.ownerEmail}</p>
      <p className="text-xs text-zinc-600 mt-0.5">Updated {timeAgo(slide.updatedAt)}</p>
      <div className="flex gap-2 mt-4">
        <button
          onClick={() => router.push(`/editor/${slide.id}`)}
          className="flex-1 text-sm font-medium bg-white text-black px-3 py-1.5 rounded-lg hover:bg-zinc-200 transition-colors"
        >
          View
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex-1 text-sm font-medium bg-zinc-800 hover:bg-red-900 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
        >
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  )
}
