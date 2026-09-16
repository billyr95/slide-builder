'use client'

import { useState } from 'react'
import { TrainEntry, ScreenType } from '@/lib/trainTypes'

export type QueueFilter = 'all' | ScreenType
export type QueueScope = 'all' | 'mine'

interface TrainQueuePanelProps {
  queue: TrainEntry[]
  filter: QueueFilter
  onFilterChange: (f: QueueFilter) => void
  scope: QueueScope
  onScopeChange: (s: QueueScope) => void
  onEdit: (entry: TrainEntry) => void
  onRemove: (id: string) => void
  onExport: () => void
  onClear: () => void
  storageWarning: string | null
  editingId: string | null
}

function filterLabel(f: QueueFilter): string {
  if (f === 'projector') return 'Projector'
  if (f === 'lobby') return 'Lobby'
  return 'All'
}

export default function TrainQueuePanel({
  queue, filter, onFilterChange, scope, onScopeChange, onEdit, onRemove, onExport, onClear, storageWarning, editingId,
}: TrainQueuePanelProps) {
  const [confirmingClear, setConfirmingClear] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const projectorCount = queue.filter(e => e.screenType === 'projector').length
  const lobbyCount = queue.filter(e => e.screenType === 'lobby').length

  const filtered = filter === 'all' ? queue : queue.filter(e => e.screenType === filter)

  function confirmDelete(id: string) {
    if (deletingId === id) {
      onRemove(id)
      setDeletingId(null)
    } else {
      setDeletingId(id)
      setTimeout(() => setDeletingId(null), 3000)
    }
  }

  function handleClearClick() {
    if (confirmingClear) {
      onClear()
      setConfirmingClear(false)
    } else {
      setConfirmingClear(true)
      setTimeout(() => setConfirmingClear(false), 3000)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 mb-4">
        <p className="text-xs font-semibold text-zinc-300 uppercase tracking-widest mb-3">Queue</p>
        <p className="text-sm text-zinc-300 mb-3">
          <span className="font-semibold text-white">{projectorCount}</span> projector /{' '}
          <span className="font-semibold text-white">{lobbyCount}</span> lobby
        </p>

        {/* Ownership scope: everyone's pooled entries, or just this admin's own */}
        <div className="flex gap-1 bg-zinc-800 p-1 rounded-lg mb-2">
          {(['all', 'mine'] as QueueScope[]).map(s => (
            <button
              key={s}
              onClick={() => onScopeChange(s)}
              className={`flex-1 text-xs px-2 py-1.5 rounded-md transition-colors font-medium ${
                scope === s ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {s === 'all' ? 'All users' : 'Mine'}
            </button>
          ))}
        </div>

        {/* Filter toggle */}
        <div className="flex gap-1 bg-zinc-800 p-1 rounded-lg mb-3">
          {(['all', 'projector', 'lobby'] as QueueFilter[]).map(f => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={`flex-1 text-xs px-2 py-1.5 rounded-md transition-colors font-medium ${
                filter === f ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {filterLabel(f)}
            </button>
          ))}
        </div>

        {storageWarning && (
          <p className="text-xs text-amber-400 bg-amber-950/40 border border-amber-900 rounded-lg px-2.5 py-2 mb-3">
            {storageWarning}
          </p>
        )}

        <button
          onClick={onExport}
          disabled={filtered.length === 0}
          className="w-full bg-white hover:bg-zinc-200 text-black font-medium text-sm py-2.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed mb-2"
        >
          Export {filterLabel(filter)} (.jsonl) — {filtered.length}
        </button>
        <button
          onClick={handleClearClick}
          disabled={queue.length === 0}
          className={`w-full text-sm py-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
            confirmingClear ? 'bg-red-600 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white'
          }`}
        >
          {confirmingClear ? 'Confirm clear all?' : 'Clear queue'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
        {filtered.length === 0 && (
          <p className="text-zinc-600 text-sm text-center py-8">
            {queue.length === 0 ? 'No entries queued yet.' : 'No entries match this filter.'}
          </p>
        )}
        {filtered.map(entry => (
          <div
            key={entry.id}
            className={`group flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors ${
              editingId === entry.id ? 'bg-zinc-800 ring-1 ring-inset ring-zinc-500' : 'hover:bg-zinc-800'
            }`}
          >
            <div className="flex-shrink-0 flex -space-x-2">
              {entry.images.filter(img => img.url).slice(0, 2).map((img, i) => (
                <img key={img.id} src={img.url} alt="" className="w-8 h-8 rounded object-cover border border-zinc-700" style={{ zIndex: 2 - i }} />
              ))}
              {entry.images.filter(img => img.url).length === 0 && (
                <div className="w-8 h-8 rounded border border-dashed border-zinc-700 flex items-center justify-center text-zinc-600 text-xs">—</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-zinc-200 truncate">{entry.title || <span className="text-zinc-600 italic">Untitled</span>}</p>
              <p className="text-xs text-zinc-600 truncate">
                <span className={entry.screenType === 'projector' ? 'text-blue-400' : 'text-amber-400'}>
                  {entry.screenType === 'projector' ? 'Projector' : 'Lobby'}
                </span>
                {' · '}
                <span className={entry.source === 'live' ? 'text-emerald-400' : 'text-zinc-500'}>
                  {entry.source === 'live' ? 'Live' : 'Upload'}
                </span>
                {' · '}{entry.imageCount} img{entry.imageCount === 1 ? '' : 's'}
                {entry.images.filter(img => img.url).length !== entry.imageCount && (
                  <span className="text-zinc-500"> ({entry.images.filter(img => img.url).length} attached)</span>
                )}
                {editingId === entry.id && <span className="text-zinc-400"> · editing</span>}
              </p>
            </div>
            <div className={`flex-shrink-0 flex items-center gap-1 transition-opacity ${
              deletingId === entry.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}>
              <button
                onClick={() => onEdit(entry)}
                className="text-xs rounded px-1.5 py-0.5 text-zinc-500 hover:text-white transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => confirmDelete(entry.id)}
                className={`text-xs rounded px-1.5 py-0.5 transition-colors ${
                  deletingId === entry.id ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-red-400'
                }`}
              >
                {deletingId === entry.id ? 'Confirm' : '✕'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
