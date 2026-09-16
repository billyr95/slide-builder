'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'

interface SlideSummary {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  userId: string
  ownerEmail: string
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

export default function AdminPage() {
  const { data: session, status } = useSession()
  const [slides, setSlides] = useState<SlideSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/slides?all=1')
      .then(res => res.json())
      .then(setSlides)
      .finally(() => setLoading(false))
  }, [])

  // Middleware already redirects non-admins away from /admin, but this
  // page still calls an admin-only API directly, so guard the render too
  // (avoids a flash of admin content while the session is still loading).
  if (status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-500 text-sm">Loading…</div>
  }
  if (session?.user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white gap-3">
        <p className="text-sm text-zinc-400">Admins only.</p>
        <Link href="/" className="text-sm text-white underline">Back to dashboard</Link>
      </div>
    )
  }

  const q = search.toLowerCase()
  const filtered = slides.filter(s => s.title.toLowerCase().includes(q) || s.ownerEmail.toLowerCase().includes(q))

  return (
    <div className="min-h-screen bg-zinc-950 text-white" style={{ fontFamily: "'Theinhardt', sans-serif" }}>
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-white rounded" />
          <span className="text-sm font-semibold tracking-wide">Admin</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/train" className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded-md hover:bg-zinc-800 transition-colors">
            Training data →
          </Link>
          <Link href="/" className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded-md hover:bg-zinc-800 transition-colors">
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-lg font-semibold mb-1">All slides</h1>
          <p className="text-sm text-zinc-500">
            Every user's saved slides. Opening one loads it into the normal editor for viewing/editing.
          </p>
        </div>

        {/*
          TODO: user management (add/remove/deactivate accounts, change
          roles) has no UI yet. With ~8-9 users max, accounts are added
          manually via scripts/seed.ts (or a direct DB insert / `npm run
          db:studio`) until that becomes annoying enough to justify one.
        */}

        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by slide title or owner email…"
          className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors mb-6"
        />

        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-zinc-500">{slides.length === 0 ? 'No slides yet.' : 'No slides match your search.'}</p>
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
                <p className="text-xs text-zinc-500 mt-1 truncate">{slide.ownerEmail}</p>
                <p className="text-xs text-zinc-600 mt-0.5">Updated {timeAgo(slide.updatedAt)}</p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
