'use client'

import { useState } from 'react'

interface NameSlideModalProps {
  onConfirm: (name: string) => void
  onCancel: () => void
}

// The required checkpoint between building a new slide's content and it
// actually persisting anywhere: no DB row is created until a real name is
// given here, so autosave never has anything meaningless to attach to.
export default function NameSlideModal({ onConfirm, onCancel }: NameSlideModalProps) {
  const [name, setName] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed) onConfirm(trimmed)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="bg-zinc-900 rounded-2xl border border-zinc-700 shadow-2xl p-6 w-full max-w-sm flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-white">Name this slide</h2>
        <p className="text-xs text-zinc-500">This is the project name shown on your dashboard, not the slide's headline text.</p>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Fall Author Series — Sept 20"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
        />
        <div className="flex gap-2">
          <button type="button" onClick={onCancel}
            className="flex-1 py-2 text-sm text-zinc-400 border border-zinc-700 rounded-lg hover:border-zinc-500 transition-colors">
            Back
          </button>
          <button type="submit" disabled={!name.trim()}
            className="flex-1 py-2 text-sm font-medium bg-white text-black rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Create
          </button>
        </div>
      </form>
    </div>
  )
}
