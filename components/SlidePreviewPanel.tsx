'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import SlideThumbnail from './SlideThumbnail'
import { SlideData, Orientation } from '@/lib/types'
import { ScreenType } from '@/lib/trainTypes'
import { timeAgo } from '@/lib/timeAgo'
import { createScreenTypeVersion, groupSlides, removeFromGroup } from '@/lib/slideGroupActions'

export interface PreviewSlide {
  id: string
  title: string
  orientation: Orientation
  screenType: ScreenType
  updatedAt: string
  ownerEmail: string
  groupId: string | null
}

export interface PreviewFolder {
  id: string
  name: string
  createdAt: string
  itemCount: number
}

export interface PreviewGroupMember {
  id: string
  title: string
  orientation: Orientation
  screenType: ScreenType
}

export interface PreviewGroup {
  id: string
  name: string
  members: PreviewGroupMember[]
}

export type PreviewSelection =
  | { kind: 'slide'; slide: PreviewSlide }
  | { kind: 'folder'; folder: PreviewFolder }
  | { kind: 'group'; group: PreviewGroup }
  | null

interface SlidePreviewPanelProps {
  selection: PreviewSelection
  onDeleted: (id: string) => void
  // All slides (lightweight rows), for the "Group with..." picker's search
  // -- Dashboard already holds this list for the tree, so it's passed down
  // rather than re-fetched here.
  allSlides: { id: string; title: string; groupId: string | null }[]
  // Re-fetches slides + groups after a group-mutating action (create
  // lobby/projector version, group with..., remove from group) so the tree
  // and this panel both pick up the result.
  onGroupsChanged: () => void
  // Selects a row in the tree -- used when a group's member thumbnail is
  // clicked, to switch the panel over to that member's own single-slide
  // view (with the usual View/Delete/group actions).
  onSelectSlide: (id: string) => void
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
// "Group with..." -- a small search-and-pick list over the Dashboard's own
// slide list (lightweight rows only, no thumbnails -- keeps this instant,
// no per-row fetches). Excludes the slide being grouped itself.
function GroupWithPicker({ excludeId, allSlides, onPick, onCancel }: {
  excludeId: string
  allSlides: { id: string; title: string; groupId: string | null }[]
  onPick: (slide: { id: string; title: string; groupId: string | null }) => void
  onCancel: () => void
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const results = allSlides
    .filter(s => s.id !== excludeId)
    .filter(s => !q || s.title.toLowerCase().includes(q))
    .slice(0, 50)

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm" onMouseDown={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="bg-zinc-900 rounded-2xl border border-zinc-700 shadow-2xl w-full max-w-sm p-5 flex flex-col gap-3" style={{ maxHeight: '70vh' }}>
        <h3 className="text-sm font-semibold text-white">Group with…</h3>
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search slides…"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
        />
        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          {results.length === 0 ? (
            <p className="text-xs text-zinc-500 py-4 text-center">No matching slides.</p>
          ) : (
            results.map(s => (
              <button
                key={s.id}
                onClick={() => onPick(s)}
                className="w-full text-left text-sm text-zinc-200 hover:bg-zinc-800 rounded-lg px-3 py-2 transition-colors truncate"
              >
                {s.title}
              </button>
            ))
          )}
        </div>
        <button onClick={onCancel} className="text-xs text-zinc-400 hover:text-white transition-colors self-end py-1 px-2">
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function SlidePreviewPanel({ selection, onDeleted, allSlides, onGroupsChanged, onSelectSlide }: SlidePreviewPanelProps) {
  const router = useRouter()
  const [data, setData] = useState<SlideData | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [creatingVersion, setCreatingVersion] = useState(false)
  const [grouping, setGrouping] = useState(false)
  const [showGroupPicker, setShowGroupPicker] = useState(false)

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

  if (selection.kind === 'group') {
    const { group } = selection
    return (
      <div className="w-72 flex-shrink-0 h-fit border border-zinc-800 rounded-xl p-4">
        <p className="text-sm font-medium truncate mb-3">{group.name}</p>
        <div className="grid grid-cols-2 gap-2">
          {group.members.map(member => (
            <button
              key={member.id}
              onClick={() => onSelectSlide(member.id)}
              className="rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-colors text-left"
            >
              <GroupMemberThumbnail id={member.id} orientation={member.orientation} />
              <div className="px-2 py-1.5">
                <p className="text-[11px] text-zinc-400 truncate">{member.title}</p>
                <p className="text-[10px] text-zinc-600">{member.screenType === 'lobby' ? 'Lobby' : 'Projector'}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const { slide } = selection
  const oppositeScreenType: ScreenType = slide.screenType === 'lobby' ? 'projector' : 'lobby'

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

  async function handleCreateVersion() {
    if (creatingVersion) return
    setCreatingVersion(true)
    try {
      await createScreenTypeVersion(slide.id, oppositeScreenType)
      onGroupsChanged()
    } catch (e) {
      console.error(e)
      window.alert(`Failed to create the ${oppositeScreenType} version. Please try again.`)
    } finally {
      setCreatingVersion(false)
    }
  }

  async function handleGroupPick(other: { id: string; title: string; groupId: string | null }) {
    setShowGroupPicker(false)
    setGrouping(true)
    try {
      await groupSlides({ id: slide.id, title: slide.title, groupId: slide.groupId }, other)
      onGroupsChanged()
    } catch (e) {
      console.error(e)
      window.alert('Failed to group these slides. Please try again.')
    } finally {
      setGrouping(false)
    }
  }

  async function handleRemoveFromGroup() {
    if (grouping) return
    setGrouping(true)
    try {
      await removeFromGroup(slide.id)
      onGroupsChanged()
    } catch (e) {
      console.error(e)
      window.alert('Failed to remove this slide from its group. Please try again.')
    } finally {
      setGrouping(false)
    }
  }

  return (
    <div className="w-72 flex-shrink-0 h-fit border border-zinc-800 rounded-xl p-4">
      {showGroupPicker && (
        <GroupWithPicker excludeId={slide.id} allSlides={allSlides} onPick={handleGroupPick} onCancel={() => setShowGroupPicker(false)} />
      )}
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

      <div className="flex flex-col gap-1.5 mt-2">
        <button
          onClick={handleCreateVersion}
          disabled={creatingVersion}
          className="text-xs text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg py-1.5 px-3 transition-colors disabled:opacity-60"
        >
          {creatingVersion ? 'Creating…' : `Create ${oppositeScreenType === 'lobby' ? 'lobby' : 'projector'} version`}
        </button>
        {slide.groupId ? (
          <button
            onClick={handleRemoveFromGroup}
            disabled={grouping}
            className="text-xs text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg py-1.5 px-3 transition-colors disabled:opacity-60"
          >
            {grouping ? 'Removing…' : 'Remove from group'}
          </button>
        ) : (
          <button
            onClick={() => setShowGroupPicker(true)}
            disabled={grouping}
            className="text-xs text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg py-1.5 px-3 transition-colors disabled:opacity-60"
          >
            Group with…
          </button>
        )}
      </div>
    </div>
  )
}

// A small, self-fetching thumbnail for one group member -- the group
// selection view shows several of these side by side, each independently
// loading its own slide data (same lazy-per-card pattern SlideCard already
// uses for the dashboard grid).
function GroupMemberThumbnail({ id, orientation }: { id: string; orientation: Orientation }) {
  const [data, setData] = useState<SlideData | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/slides/${id}`)
      .then(res => (res.ok ? res.json() : null))
      .then(slide => { if (!cancelled && slide) setData(slide.data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [id])

  if (!data) {
    return <div className="flex items-center justify-center text-[10px] text-zinc-600" style={{ aspectRatio: orientation === 'landscape' ? '1920 / 1080' : '1080 / 1920' }}>…</div>
  }
  return <SlideThumbnail data={data} orientation={orientation} />
}
