'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import NewSlideFlow from '@/components/NewSlideFlow'
import SlideCard from '@/components/SlideCard'
import FolderTreeView, { SlideRow } from '@/components/FolderTreeView'
import FolderPickerModal from '@/components/FolderPickerModal'
import { buildFolderPath, FolderFlat } from '@/lib/folderPath'

export default function Dashboard() {
  const { data: session } = useSession()

  const [folders, setFolders] = useState<FolderFlat[] | null>(null)
  const [slides, setSlides] = useState<SlideRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showNewFlow, setShowNewFlow] = useState(false)
  const [movingSlideId, setMovingSlideId] = useState<string | null>(null)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/folders').then(res => res.json()),
      fetch('/api/slides').then(res => res.json()),
    ])
      .then(([f, s]) => { setFolders(f); setSlides(s) })
      .finally(() => setLoading(false))
  }, [])

  const rootId = useMemo(() => folders?.find(f => !f.parentFolderId)?.id ?? null, [folders])

  const isSearching = search.trim().length > 0
  const searchResults = useMemo(() => {
    if (!isSearching || !slides) return null
    const q = search.toLowerCase()
    return slides.filter(s => s.title.toLowerCase().includes(q))
  }, [isSearching, slides, search])

  function handleDeleted(id: string) {
    setSlides(prev => (prev ? prev.filter(s => s.id !== id) : prev))
  }

  async function handleNewFolder() {
    const name = window.prompt('Folder name:')
    if (!name || !name.trim()) return
    const parentFolderId = selectedFolderId ?? rootId
    if (!parentFolderId) return
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), parentFolderId }),
      })
      if (!res.ok) throw new Error(`Create failed (${res.status})`)
      const created = await res.json()
      setFolders(prev => (prev ? [...prev, created] : prev))
    } catch (e) {
      console.error(e)
      window.alert('Failed to create the folder. Please try again.')
    }
  }

  async function moveSlide(slideId: string, folderId: string) {
    try {
      const res = await fetch(`/api/slides/${slideId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId }),
      })
      if (!res.ok) throw new Error(`Move failed (${res.status})`)
      setSlides(prev => (prev ? prev.map(s => (s.id === slideId ? { ...s, folderId } : s)) : prev))
    } catch (e) {
      console.error(e)
      window.alert('Failed to move the slide. Please try again.')
    }
  }

  async function handleMovePick(folderId: string) {
    const slideId = movingSlideId
    setMovingSlideId(null)
    if (!slideId) return
    await moveSlide(slideId, folderId)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white" style={{ fontFamily: "'Theinhardt', sans-serif" }}>
      {showNewFlow && (
        <NewSlideFlow initialScreenType="projector" folderId={selectedFolderId ?? rootId ?? undefined} onClose={() => setShowNewFlow(false)} />
      )}

      {movingSlideId && folders && (
        <FolderPickerModal folders={folders} onPick={handleMovePick} onClose={() => setMovingSlideId(null)} />
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

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search all slides, every folder…"
            className="flex-1 max-w-md bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
          />
          <div className="ml-auto flex items-center gap-2">
            {!isSearching && (
              <button
                onClick={handleNewFolder}
                className="text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                New Folder
              </button>
            )}
            <button
              onClick={() => setShowNewFlow(true)}
              className="text-sm font-medium bg-white text-black px-4 py-2 rounded-lg hover:bg-zinc-200 transition-colors"
            >
              + New
            </button>
          </div>
        </div>

        {isSearching ? (
          searchResults === null ? (
            <p className="text-sm text-zinc-500">Searching…</p>
          ) : searchResults.length === 0 ? (
            <p className="text-sm text-zinc-500">No slides match your search.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {searchResults.map(slide => (
                <SlideCard
                  key={slide.id}
                  id={slide.id}
                  title={slide.title}
                  orientation={slide.orientation}
                  updatedAt={slide.updatedAt}
                  subtitle={folders ? buildFolderPath(folders, slide.folderId) : undefined}
                  onDeleted={handleDeleted}
                />
              ))}
            </div>
          )
        ) : loading || !folders || !slides || !rootId ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          <FolderTreeView
            folders={folders}
            slides={slides}
            rootId={rootId}
            selectedFolderId={selectedFolderId}
            onSelectFolder={setSelectedFolderId}
            onRequestMove={setMovingSlideId}
            onDeleteSlide={handleDeleted}
            onMoveSlide={moveSlide}
          />
        )}
      </main>
    </div>
  )
}
