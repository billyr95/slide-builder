'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import NewSlideFlow from '@/components/NewSlideFlow'

interface SlideSummary {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export default function Dashboard() {
  const { data: session } = useSession()
  const [slides, setSlides] = useState<SlideSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showNewFlow, setShowNewFlow] = useState(false)

  useEffect(() => {
    fetch('/api/slides')
      .then(res => res.json())
      .then(setSlides)
      .finally(() => setLoading(false))
  }, [])

  const filtered = slides.filter(s => s.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="min-h-screen bg-zinc-950 text-white" style={{ fontFamily: "'Theinhardt', sans-serif" }}>
      {showNewFlow && (
        <NewSlideFlow initialScreenType="projector" onClose={() => setShowNewFlow(false)} />
      )}

      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-white rounded" />
          <span className="text-sm font-semibold tracking-wide">Slide Builder</span>
        </div>
        <div className="flex items-center gap-3">
          {session?.user?.role === 'admin' && (
            <Link href="/admin" className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded-md hover:bg-zinc-800 transition-colors">
              Admin →
            </Link>
          )}
          <span className="text-xs text-zinc-500">{session?.user?.email}</span>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded-md hover:bg-zinc-800 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-8">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search your slides…"
            className="flex-1 max-w-md bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
          />
          <button
            onClick={() => setShowNewFlow(true)}
            className="ml-auto text-sm font-medium bg-white text-black px-4 py-2 rounded-lg hover:bg-zinc-200 transition-colors"
          >
            + New
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-zinc-500">
            {slides.length === 0 ? 'No slides yet — click "+ New" to make your first one.' : 'No slides match your search.'}
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(slide => (
              <Link
                key={slide.id}
                href={`/editor/${slide.id}`}
                className="block bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-600 transition-colors"
              >
                <div className="aspect-video bg-zinc-800 rounded-lg mb-3 flex items-center justify-center">
                  <span className="text-zinc-600 text-xs">No preview</span>
                </div>
                <p className="text-sm font-medium truncate">{slide.title}</p>
                <p className="text-xs text-zinc-500 mt-1">Updated {timeAgo(slide.updatedAt)}</p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
