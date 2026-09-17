'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import SlideThumbnail from './SlideThumbnail'
import { SlideData, Orientation } from '@/lib/types'
import { timeAgo } from '@/lib/timeAgo'

const ASPECT: Record<Orientation, string> = {
  landscape: '1920 / 1080',
  portrait: '1080 / 1920',
}

interface SlideCardProps {
  id: string
  title: string
  orientation: Orientation
  updatedAt: string
  // e.g. the owner's email, shown for the admin portal's all-users view.
  subtitle?: string
  // Omitted entirely hides the delete control -- both current callers
  // (Dashboard, Admin portal) always pass it, but this keeps the card
  // usable read-only if that ever changes.
  onDeleted?: (id: string) => void
}

// Shared by the Dashboard and Admin portal: a card linking into the real
// editor, with a live preview lazily fetched per-card (the list endpoints
// stay lightweight -- they don't return each slide's full `data` blob).
export default function SlideCard({ id, title, orientation, updatedAt, subtitle, onDeleted }: SlideCardProps) {
  const [data, setData] = useState<SlideData | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/slides/${id}`)
      .then(res => (res.ok ? res.json() : null))
      .then(slide => { if (!cancelled && slide) setData(slide.data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [id])

  async function handleDelete(e: React.MouseEvent) {
    // Stop the click from also triggering the card's own <Link> navigation.
    e.preventDefault()
    e.stopPropagation()
    if (deleting) return
    if (!window.confirm(`Delete "${title}"? This can't be undone.`)) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/slides/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`Delete failed (${res.status})`)
      onDeleted?.(id)
    } catch (e) {
      console.error(e)
      window.alert('Failed to delete the slide. Please try again.')
      setDeleting(false)
    }
  }

  return (
    <Link
      href={`/editor/${id}`}
      className="group relative block bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-600 transition-colors"
    >
      <button
        onClick={handleDelete}
        disabled={deleting}
        title="Delete slide"
        className="absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-950/80 text-zinc-400 opacity-0 group-hover:opacity-100 hover:bg-red-900 hover:text-white transition-colors disabled:opacity-60"
      >
        {deleting ? (
          '…'
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
          </svg>
        )}
      </button>
      <div className="rounded-lg overflow-hidden mb-3 bg-zinc-800" style={{ aspectRatio: ASPECT[orientation] }}>
        {data ? (
          <SlideThumbnail data={data} orientation={orientation} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-zinc-600 text-xs">Loading…</span>
          </div>
        )}
      </div>
      <p className="text-sm font-medium truncate">{title}</p>
      {subtitle && <p className="text-xs text-zinc-500 mt-1 truncate">{subtitle}</p>}
      <p className="text-xs text-zinc-600 mt-0.5">Updated {timeAgo(updatedAt)}</p>
    </Link>
  )
}
