'use client'

import { useState } from 'react'
import Link from 'next/link'
import TrainForm from '@/components/train/TrainForm'
import TrainQueuePanel, { QueueFilter } from '@/components/train/TrainQueuePanel'
import { useTrainQueue } from '@/lib/useTrainQueue'
import { downloadJsonl } from '@/lib/trainExport'
import { TrainEntry } from '@/lib/trainTypes'

export default function TrainPage() {
  const { queue, storageWarning, addEntry, removeEntry, clearQueue } = useTrainQueue()
  const [filter, setFilter] = useState<QueueFilter>('all')
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  function handleAdd(entry: TrainEntry) {
    addEntry(entry)
    showToast(`Added "${entry.title}" to queue`)
  }

  function handleExport() {
    const entries = filter === 'all' ? queue : queue.filter(e => e.screenType === filter)
    if (entries.length === 0) return

    let tag: string = filter
    if (filter === 'all') {
      const types = Array.from(new Set(entries.map(e => e.screenType)))
      tag = types.length === 1 ? types[0] : 'mixed'
    }

    downloadJsonl(entries, tag)
    showToast(`Exported ${entries.length} ${tag === 'mixed' ? 'entries' : tag} entries`)
  }

  function handleClear() {
    clearQueue()
    showToast('Queue cleared')
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
        <main className="flex-1 overflow-y-auto bg-zinc-900 p-6">
          <div className="max-w-xl mx-auto">
            <TrainForm onAdd={handleAdd} />
          </div>
        </main>

        {/* Right: queue panel */}
        <aside className="w-80 flex-shrink-0 border-l border-zinc-800 bg-zinc-950 p-4 overflow-hidden flex flex-col">
          <TrainQueuePanel
            queue={queue}
            filter={filter}
            onFilterChange={setFilter}
            onRemove={removeEntry}
            onExport={handleExport}
            onClear={handleClear}
            storageWarning={storageWarning}
          />
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
