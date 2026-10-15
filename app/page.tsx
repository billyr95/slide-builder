'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import NewSlideFlow from '@/components/NewSlideFlow'
import SlideCard from '@/components/SlideCard'
import FolderTreeView, { SlideRow, TreeSelection, GroupFlat } from '@/components/FolderTreeView'
import SlidePreviewPanel, { PreviewSelection } from '@/components/SlidePreviewPanel'
import { buildFolderPath, FolderFlat } from '@/lib/folderPath'

export default function Dashboard() {
  const { data: session } = useSession()
  const router = useRouter()

  const [folders, setFolders] = useState<FolderFlat[] | null>(null)
  const [slides, setSlides] = useState<SlideRow[] | null>(null)
  const [groups, setGroups] = useState<GroupFlat[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showNewFlow, setShowNewFlow] = useState(false)
  const [selection, setSelection] = useState<TreeSelection>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/folders'),
      fetch('/api/slides'),
      fetch('/api/slide-groups'),
    ])
      .then(async ([folderRes, slideRes, groupRes]) => {
        // A 401 here means the server rejected this session (e.g. a stale
        // sign-in whose user row no longer exists -- see lib/session.ts) --
        // next-auth's own client-side useSession() doesn't know that yet,
        // so without this check the error body (not an array) would get
        // set as state and crash the folders/slides .find()/.filter() calls
        // below instead of just sending them back to a fresh sign-in.
        if (folderRes.status === 401 || slideRes.status === 401 || groupRes.status === 401) {
          await signOut({ callbackUrl: '/login' })
          return
        }
        const [f, s, g] = await Promise.all([folderRes.json(), slideRes.json(), groupRes.json()])
        setFolders(f)
        setSlides(s)
        setGroups(g)
      })
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
    setSelection(prev => (prev?.kind === 'slide' && prev.id === id ? null : prev))
  }

  // Where a new folder/slide is created: the currently selected folder, or
  // (if a slide is selected instead) that slide's own folder, or root if
  // nothing is selected.
  const targetFolderId = useMemo(() => {
    if (selection?.kind === 'folder') return selection.id
    if (selection?.kind === 'slide') return slides?.find(s => s.id === selection.id)?.folderId ?? rootId
    return rootId
  }, [selection, slides, rootId])

  async function handleNewFolder() {
    const name = window.prompt('Folder name:')
    if (!name || !name.trim()) return
    if (!targetFolderId) return
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), parentFolderId: targetFolderId }),
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

  // Moving a group between folders moves every member together.
  async function moveGroup(groupId: string, folderId: string) {
    const memberIds = (slides ?? []).filter(s => s.groupId === groupId).map(s => s.id)
    try {
      await Promise.all(memberIds.map(id =>
        fetch(`/api/slides/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderId }),
        }).then(res => { if (!res.ok) throw new Error(`Move failed (${res.status})`) })
      ))
      setSlides(prev => (prev ? prev.map(s => (memberIds.includes(s.id) ? { ...s, folderId } : s)) : prev))
    } catch (e) {
      console.error(e)
      window.alert('Failed to move the group. Please try again.')
    }
  }

  // Re-fetches slides + groups (not folders -- nothing here changes those)
  // after a group-mutating action in SlidePreviewPanel, so the tree and
  // preview panel both pick up the result without a full page reload.
  async function refreshSlidesAndGroups() {
    const [slideRes, groupRes] = await Promise.all([fetch('/api/slides'), fetch('/api/slide-groups')])
    if (slideRes.ok) setSlides(await slideRes.json())
    if (groupRes.ok) setGroups(await groupRes.json())
  }

  // Maps the tree's lightweight {kind,id} selection into the full record
  // SlidePreviewPanel needs to render (slide metadata, or a folder's
  // direct-child item count) -- computed here since Dashboard already
  // holds both flat lists.
  const previewSelection: PreviewSelection = useMemo(() => {
    if (!selection) return null
    if (selection.kind === 'slide') {
      const slide = slides?.find(s => s.id === selection.id)
      if (!slide) return null
      return {
        kind: 'slide',
        slide: {
          id: slide.id, title: slide.title, orientation: slide.orientation, screenType: slide.screenType,
          updatedAt: slide.updatedAt, ownerEmail: slide.ownerEmail, groupId: slide.groupId ?? null,
        },
      }
    }
    if (selection.kind === 'group') {
      const group = groups?.find(g => g.id === selection.id)
      if (!group) return null
      const members = (slides ?? []).filter(s => s.groupId === group.id)
      return { kind: 'group', group: { id: group.id, name: group.name, members } }
    }
    const folder = folders?.find(f => f.id === selection.id)
    if (!folder) return null
    const itemCount =
      (folders?.filter(f => f.parentFolderId === folder.id).length ?? 0) +
      (slides?.filter(s => s.folderId === folder.id).length ?? 0)
    return { kind: 'folder', folder: { id: folder.id, name: folder.name, createdAt: folder.createdAt, itemCount } }
  }, [selection, folders, slides, groups])

  return (
    <div className="min-h-screen bg-zinc-950 text-white" style={{ fontFamily: "'Theinhardt', sans-serif" }}>
      {showNewFlow && (
        <NewSlideFlow initialScreenType="projector" folderId={targetFolderId ?? undefined} onClose={() => setShowNewFlow(false)} />
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
              {searchResults.map(slide => {
                const folderPath = folders ? buildFolderPath(folders, slide.folderId) : undefined
                const groupName = slide.groupId ? groups?.find(g => g.id === slide.groupId)?.name : undefined
                const subtitle = [folderPath, groupName].filter(Boolean).join(' · ') || undefined
                return (
                  <SlideCard
                    key={slide.id}
                    id={slide.id}
                    title={slide.title}
                    orientation={slide.orientation}
                    updatedAt={slide.updatedAt}
                    subtitle={subtitle}
                    onDeleted={handleDeleted}
                  />
                )
              })}
            </div>
          )
        ) : loading || !folders || !slides || !groups || !rootId ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          <div className="flex gap-6 items-start">
            <div className="flex-1 min-w-0">
              <FolderTreeView
                folders={folders}
                slides={slides}
                groups={groups ?? []}
                rootId={rootId}
                selection={selection}
                onSelect={setSelection}
                onOpenSlide={id => router.push(`/editor/${id}`)}
                onMoveSlide={moveSlide}
                onMoveGroup={moveGroup}
              />
            </div>
            <SlidePreviewPanel
              selection={previewSelection}
              onDeleted={handleDeleted}
              allSlides={slides.map(s => ({ id: s.id, title: s.title, groupId: s.groupId ?? null }))}
              onGroupsChanged={refreshSlidesAndGroups}
              onSelectSlide={id => setSelection({ kind: 'slide', id })}
            />
          </div>
        )}
      </main>
    </div>
  )
}
