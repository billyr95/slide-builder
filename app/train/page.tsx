'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import TrainForm from '@/components/train/TrainForm'
import TrainQueuePanel, { QueueFilter, QueueScope } from '@/components/train/TrainQueuePanel'
import { TrainEntry } from '@/lib/trainTypes'

export default function TrainPage() {
  const [queue, setQueue] = useState<TrainEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState<QueueScope>('all')
  const [filter, setFilter] = useState<QueueFilter>('all')
  const [toast, setToast] = useState<string | null>(null)
  const [editingEntry, setEditingEntry] = useState<TrainEntry | null>(null)
  const mainRef = useRef<HTMLElement>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/training-entries?scope=${scope}`)
      if (!res.ok) throw new Error(`Fetch failed (${res.status})`)
      setQueue(await res.json())
    } catch (e) {
      console.error(e)
      showToast('Failed to load queue')
    } finally {
      setLoading(false)
    }
  }, [scope])

  useEffect(() => { refetch() }, [refetch])

  async function handleAdd(entry: TrainEntry) {
    try {
      const res = await fetch('/api/training-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      })
      if (!res.ok) throw new Error(`Create failed (${res.status})`)
      await refetch()
      showToast(`Added "${entry.title}" to queue`)
    } catch (e) {
      console.error(e)
      showToast('Failed to add entry')
    }
  }

  async function handleSave(entry: TrainEntry) {
    try {
      const res = await fetch(`/api/training-entries/${entry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      })
      if (!res.ok) throw new Error(`Update failed (${res.status})`)
      setEditingEntry(null)
      await refetch()
      showToast(`Updated "${entry.title}"`)
    } catch (e) {
      console.error(e)
      showToast('Failed to save changes')
    }
  }

  function handleEdit(entry: TrainEntry) {
    setEditingEntry(entry)
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleCancelEdit() {
    setEditingEntry(null)
  }

  async function handleRemove(id: string) {
    if (editingEntry?.id === id) setEditingEntry(null)
    try {
      const res = await fetch(`/api/training-entries/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`Delete failed (${res.status})`)
      setQueue(q => q.filter(e => e.id !== id))
    } catch (e) {
      console.error(e)
      showToast('Failed to remove entry')
    }
  }

  function handleExport() {
    const url = `/api/training-entries/export-batch?scope=${scope}`
    window.location.href = url
    showToast('Downloading export…')
  }

  async function handleClear() {
    // Deletes only what's currently visible under the active scope +
    // screen-type filter -- not a blanket wipe of the whole shared pool,
    // since "All users" scope holds everyone's pooled data.
    const filtered = filter === 'all' ? queue : queue.filter(e => e.screenType === filter)
    setEditingEntry(null)
    try {
      await Promise.all(filtered.map(e => fetch(`/api/training-entries/${e.id}`, { method: 'DELETE' })))
      await refetch()
      showToast('Queue cleared')
    } catch (e) {
      console.error(e)
      showToast('Failed to clear queue')
    }
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ fontFamily: "'Theinhardt', sans-serif" }}>
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-zinc-950 flex-shrink-0">
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-6 h-6 bg-white rounded" />
          <span className="text-sm font-semibold text-white tracking-wide">Training Data Bundler</span>
        </div>
        <Link
          href="/"
          className="text-sm text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          ← Slide Builder
        </Link>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Main: entry form */}
        <main ref={mainRef} className="flex-1 overflow-y-auto bg-zinc-900 p-6">
          <div className="max-w-xl mx-auto">
            <TrainForm
              editingEntry={editingEntry}
              onAdd={handleAdd}
              onSave={handleSave}
              onCancelEdit={handleCancelEdit}
            />
          </div>
        </main>

        {/* Right: queue panel */}
        <aside className="w-80 flex-shrink-0 border-l border-zinc-800 bg-zinc-950 p-4 overflow-hidden flex flex-col">
          {loading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : (
            <TrainQueuePanel
              queue={queue}
              filter={filter}
              onFilterChange={setFilter}
              scope={scope}
              onScopeChange={setScope}
              onEdit={handleEdit}
              onRemove={handleRemove}
              onExport={handleExport}
              onClear={handleClear}
              storageWarning={null}
              editingId={editingEntry?.id ?? null}
            />
          )}
        </aside>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white text-black text-sm font-medium px-4 py-2 rounded-full shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
