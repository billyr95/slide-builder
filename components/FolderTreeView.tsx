'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FolderFlat } from '@/lib/folderPath'
import { timeAgo } from '@/lib/timeAgo'
import { formatBytes } from '@/lib/formatBytes'
import { Orientation } from '@/lib/types'

export interface SlideRow {
  id: string
  title: string
  orientation: Orientation
  updatedAt: string
  ownerEmail: string
  folderId?: string
  sizeBytes: number
}

interface FolderTreeViewProps {
  folders: FolderFlat[]
  slides: SlideRow[]
  rootId: string
  selectedFolderId: string | null
  onSelectFolder: (id: string | null) => void
  onRequestMove: (slideId: string) => void
  onDeleteSlide: (id: string) => void
  onMoveSlide: (slideId: string, folderId: string) => void
}

type Row =
  | { kind: 'folder'; folder: FolderFlat; depth: number }
  | { kind: 'slide'; slide: SlideRow; depth: number }

const INDENT_PX = 20
const BASE_PAD_PX = 10

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  )
}

function SlideIcon({ className }: { className?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
    </svg>
  )
}

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
      className={`transition-transform flex-shrink-0 text-zinc-500 ${expanded ? 'rotate-90' : ''}`}
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  )
}

// A macOS Finder list-view-style expandable tree: folders and slides both
// live in one flat table, built from the full org-wide flat lists (not
// fetched per-folder), since several folders can be expanded at once --
// expand state is purely a client-side Set, so toggling never needs a
// round trip.
export default function FolderTreeView({ folders, slides, rootId, selectedFolderId, onSelectFolder, onRequestMove, onDeleteSlide, onMoveSlide }: FolderTreeViewProps) {
  const router = useRouter()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { childFoldersByParent, slidesByFolder } = useMemo(() => {
    const childFoldersByParent = new Map<string, FolderFlat[]>()
    for (const f of folders) {
      if (!f.parentFolderId) continue
      const list = childFoldersByParent.get(f.parentFolderId) ?? []
      list.push(f)
      childFoldersByParent.set(f.parentFolderId, list)
    }
    for (const list of Array.from(childFoldersByParent.values())) list.sort((a, b) => a.name.localeCompare(b.name))

    const slidesByFolder = new Map<string, SlideRow[]>()
    for (const s of slides) {
      if (!s.folderId) continue
      const list = slidesByFolder.get(s.folderId) ?? []
      list.push(s)
      slidesByFolder.set(s.folderId, list)
    }
    for (const list of Array.from(slidesByFolder.values())) list.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))

    return { childFoldersByParent, slidesByFolder }
  }, [folders, slides])

  const rows = useMemo(() => {
    const out: Row[] = []
    function walk(folderId: string, depth: number) {
      for (const f of childFoldersByParent.get(folderId) ?? []) {
        out.push({ kind: 'folder', folder: f, depth })
        if (expanded.has(f.id)) walk(f.id, depth + 1)
      }
      for (const s of slidesByFolder.get(folderId) ?? []) {
        out.push({ kind: 'slide', slide: s, depth })
      }
    }
    walk(rootId, 0)
    return out
  }, [rootId, childFoldersByParent, slidesByFolder, expanded])

  function toggleExpanded(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleDelete(slide: SlideRow, e: React.MouseEvent) {
    e.stopPropagation()
    if (deletingId) return
    if (!window.confirm(`Delete "${slide.title}"? This can't be undone.`)) return
    setDeletingId(slide.id)
    try {
      const res = await fetch(`/api/slides/${slide.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`Delete failed (${res.status})`)
      onDeleteSlide(slide.id)
    } catch (err) {
      console.error(err)
      window.alert('Failed to delete the slide. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  function handleDrop(folderId: string, e: React.DragEvent) {
    e.preventDefault()
    setDragOverFolderId(null)
    const slideId = e.dataTransfer.getData('text/slide-id')
    if (slideId) onMoveSlide(slideId, folderId)
  }

  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">This folder is empty — click "+ New" or "New Folder" to add something.</p>
  }

  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="text-left text-xs text-zinc-500 border-b border-zinc-800">
          <th className="font-medium py-2 pr-4">Name</th>
          <th className="font-medium py-2 pr-4 w-40">Date Modified</th>
          <th className="font-medium py-2 pr-4 w-24">Size</th>
          <th className="font-medium py-2 w-32">Type</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => {
          if (row.kind === 'folder') {
            const isSelected = selectedFolderId === row.folder.id
            const isDragOver = dragOverFolderId === row.folder.id
            const isExpanded = expanded.has(row.folder.id)
            return (
              <tr
                key={`folder-${row.folder.id}`}
                onClick={() => onSelectFolder(row.folder.id)}
                onDragOver={e => { e.preventDefault(); setDragOverFolderId(row.folder.id) }}
                onDragLeave={() => setDragOverFolderId(prev => (prev === row.folder.id ? null : prev))}
                onDrop={e => handleDrop(row.folder.id, e)}
                className={`cursor-pointer border-b border-zinc-900 transition-colors ${
                  isDragOver ? 'bg-blue-900/50 ring-1 ring-inset ring-blue-500' : isSelected ? 'bg-blue-900/40' : 'hover:bg-zinc-900'
                }`}
              >
                <td className="py-1.5 pr-4">
                  <div className="flex items-center gap-1.5" style={{ paddingLeft: BASE_PAD_PX + row.depth * INDENT_PX }}>
                    <button onClick={e => toggleExpanded(row.folder.id, e)} className="w-4 h-4 flex items-center justify-center flex-shrink-0 hover:text-white">
                      <Chevron expanded={isExpanded} />
                    </button>
                    <FolderIcon className="text-zinc-400 flex-shrink-0" />
                    <span className="truncate text-zinc-200">{row.folder.name}</span>
                  </div>
                </td>
                <td className="py-1.5 pr-4 text-zinc-500">{timeAgo(new Date(row.folder.createdAt ?? Date.now()).toISOString())}</td>
                <td className="py-1.5 pr-4 text-zinc-600">--</td>
                <td className="py-1.5 text-zinc-500">Folder</td>
              </tr>
            )
          }

          const slide = row.slide
          return (
            <tr
              key={`slide-${slide.id}`}
              draggable
              onDragStart={e => e.dataTransfer.setData('text/slide-id', slide.id)}
              onClick={() => router.push(`/editor/${slide.id}`)}
              className="group cursor-pointer border-b border-zinc-900 hover:bg-zinc-900 transition-colors"
            >
              <td className="py-1.5 pr-4">
                <div className="flex items-center gap-1.5 justify-between" style={{ paddingLeft: BASE_PAD_PX + row.depth * INDENT_PX + 20 }}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <SlideIcon className="text-zinc-500 flex-shrink-0" />
                    <span className="truncate text-zinc-300">{slide.title}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0 pr-2">
                    <button
                      onClick={e => { e.stopPropagation(); onRequestMove(slide.id) }}
                      title="Move to…"
                      className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-700 hover:text-white transition-colors"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 8a2 2 0 0 1 2-2h4l2 2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8Z" />
                      </svg>
                    </button>
                    <button
                      onClick={e => handleDelete(slide, e)}
                      disabled={deletingId === slide.id}
                      title="Delete slide"
                      className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-500 hover:bg-red-900 hover:text-white transition-colors disabled:opacity-60"
                    >
                      {deletingId === slide.id ? '…' : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18" />
                          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </td>
              <td className="py-1.5 pr-4 text-zinc-500">{timeAgo(slide.updatedAt)}</td>
              <td className="py-1.5 pr-4 text-zinc-500">{formatBytes(slide.sizeBytes)}</td>
              <td className="py-1.5 text-zinc-500">{slide.orientation === 'landscape' ? '16:9 Slide' : '9:16 Slide'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
