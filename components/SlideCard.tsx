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
}

// Shared by the Dashboard and Admin portal: a card linking into the real
// editor, with a live preview lazily fetched per-card (the list endpoints
// stay lightweight -- they don't return each slide's full `data` blob).
export default function SlideCard({ id, title, orientation, updatedAt, subtitle }: SlideCardProps) {
  const [data, setData] = useState<SlideData | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/slides/${id}`)
      .then(res => (res.ok ? res.json() : null))
      .then(slide => { if (!cancelled && slide) setData(slide.data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [id])

  return (
    <Link
      href={`/editor/${id}`}
      className="block bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-600 transition-colors"
    >
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
