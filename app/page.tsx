'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import NewSlideFlow from '@/components/NewSlideFlow'
import SlideCard from '@/components/SlideCard'
import FolderCard from '@/components/FolderCard'
import FolderPickerModal from '@/components/FolderPickerModal'
import { buildFolderPath, FolderFlat } from '@/lib/folderPath'
import { Orientation } from '@/lib/types'

interface SlideSummary {
  id: string
  title: string
  orientation: Orientation
  createdAt: string
  updatedAt: string
  userId: string
  ownerEmail: string
  folderId?: string
}

interface FolderSummary {
  id: string
  name: string
  createdAt: string
}

interface FolderContents {
  folder: { id: string; name: string; parentFolderId: string | null }
  breadcrumb: { id: string; name: string }[]
  subfolders: FolderSummary[]
  slides: SlideSummary[]
}

export default function Dashboard() {
  const { data: session } = useSession()

  const [contents, setContents] = useState<FolderContents | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showNewFlow, setShowNewFlow] = useState(false)
  const [movingSlideId, setMovingSlideId] = useState<string | null>(null)

  // Loaded lazily (once each) the first time global search actually needs
  // them -- normal folder browsing never touches either of these.
  const [allSlides, setAllSlides] = useState<SlideSummary[] | null>(null)
  const [allFolders, setAllFolders] = useState<FolderFlat[] | null>(null)

  const loadFolder = useCallback((id: string) => {
    setLoading(true)
    fetch(`/api/folders/${id}`)
      .then(res => res.json())
      .then(setContents)
      .finally(() => setLoading(false))
  }, [])

  // Initial load -- resolve and open the seeded root ("All Slides") folder.
  useEffect(() => {
    setLoading(true)
    fetch('/api/folders/root')
      .then(res => res.json())
      .then(setContents)
      .finally(() => setLoading(false))
  }, [])

  const isSearching = search.trim().length > 0

  // Global search intentionally looks across every folder, not just the
  // one currently open -- lazily fetches the full flat slide/folder lists
  // (needed to filter by title and to build each result's folder path) the
  // first time the search box is actually used.
  useEffect(() => {
    if (!isSearching) return
    if (!allSlides) fetch('/api/slides').then(res => res.json()).then(setAllSlides)
    if (!allFolders) fetch('/api/folders').then(res => res.json()).then(setAllFolders)
  }, [isSearching, allSlides, allFolders])

  const searchResults = useMemo(() => {
    if (!isSearching || !allSlides) return null
    const q = search.toLowerCase()
    return allSlides.filter(s => s.title.toLowerCase().includes(q))
  }, [isSearching, allSlides, search])

  function handleDeleted(id: string) {
    setContents(prev => (prev ? { ...prev, slides: prev.slides.filter(s => s.id !== id) } : prev))
    setAllSlides(prev => (prev ? prev.filter(s => s.id !== id) : prev))
  }

  async function handleNewFolder() {
    if (!contents) return
    const name = window.prompt('Folder name:')
    if (!name || !name.trim()) return
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), parentFolderId: contents.folder.id }),
      })
      if (!res.ok) throw new Error(`Create failed (${res.status})`)
      const created = await res.json()
      setContents(prev =>
        prev
          ? { ...prev, subfolders: [...prev.subfolders, { id: created.id, name: created.name, createdAt: created.createdAt }].sort((a, b) => a.name.localeCompare(b.name)) }
          : prev
      )
      setAllFolders(prev => (prev ? [...prev, { id: created.id, name: created.name, parentFolderId: created.parentFolderId }] : prev))
    } catch (e) {
      console.error(e)
      window.alert('Failed to create the folder. Please try again.')
    }
  }

  async function handleMovePick(folderId: string) {
    const slideId = movingSlideId
    setMovingSlideId(null)
    if (!slideId) return
    try {
      const res = await fetch(`/api/slides/${slideId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId }),
      })
      if (!res.ok) throw new Error(`Move failed (${res.status})`)
      // Moved out of the folder currently open -- drop it from this view.
      setContents(prev => (prev ? { ...prev, slides: prev.slides.filter(s => s.id !== slideId) } : prev))
      setAllSlides(prev => (prev ? prev.map(s => (s.id === slideId ? { ...s, folderId } : s)) : prev))
    } catch (e) {
      console.error(e)
      window.alert('Failed to move the slide. Please try again.')
    }
  }

  const currentFolderId = contents?.folder.id

  return (
    <div className="min-h-screen bg-zinc-950 text-white" style={{ fontFamily: "'Theinhardt', sans-serif" }}>
      {showNewFlow && (
        <NewSlideFlow initialScreenType="projector" folderId={currentFolderId} onClose={() => setShowNewFlow(false)} />
      )}

      {movingSlideId && allFolders && (
        <FolderPickerModal folders={allFolders} currentFolderId={currentFolderId} onPick={handleMovePick} onClose={() => setMovingSlideId(null)} />
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
        <div className="flex items-center gap-3 mb-4">
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

        {!isSearching && contents && (
          <div className="flex items-center gap-1.5 text-sm text-zinc-400 mb-6 flex-wrap">
            {contents.breadcrumb.map((crumb, i) => (
              <span key={crumb.id} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-zinc-700">/</span>}
                {i === contents.breadcrumb.length - 1 ? (
                  <span className="text-white font-medium">{crumb.name}</span>
                ) : (
                  <button onClick={() => loadFolder(crumb.id)} className="hover:text-white transition-colors">
                    {crumb.name}
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

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
                  subtitle={allFolders ? buildFolderPath(allFolders, slide.folderId) : undefined}
                  onDeleted={handleDeleted}
                />
              ))}
            </div>
          )
        ) : loading || !contents ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : contents.subfolders.length === 0 && contents.slides.length === 0 ? (
          <p className="text-sm text-zinc-500">This folder is empty — click "+ New" or "New Folder" to add something.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {contents.subfolders.map(folder => (
              <FolderCard key={folder.id} name={folder.name} onOpen={() => loadFolder(folder.id)} />
            ))}
            {contents.slides.map(slide => (
              <SlideCard
                key={slide.id}
                id={slide.id}
                title={slide.title}
                orientation={slide.orientation}
                updatedAt={slide.updatedAt}
                subtitle={`Created by ${slide.ownerEmail}`}
                onDeleted={handleDeleted}
                onMove={() => {
                  setMovingSlideId(slide.id)
                  if (!allFolders) fetch('/api/folders').then(res => res.json()).then(setAllFolders)
                }}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
