'use client'

import { SlideTemplate } from '@/lib/types'
import { useState } from 'react'

interface TemplatesSidebarProps {
  templates: SlideTemplate[]
  activeId: string | null
  onLoad: (template: SlideTemplate) => void
  onDelete: (id: string) => void
  onSaveNew: (name: string) => void
  onUpdate: () => void
  isDirty: boolean
  activeTemplateName: string
}

export default function TemplatesSidebar({
  templates,
  activeId,
  onLoad,
  onDelete,
  onSaveNew,
  onUpdate,
  isDirty,
  activeTemplateName,
}: TemplatesSidebarProps) {
  const [newName, setNewName] = useState('')
  const [showNameInput, setShowNameInput] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function handleSave() {
    if (activeId) {
      onUpdate()
    } else {
      setShowNameInput(true)
    }
  }

  function handleSaveNew() {
    if (!newName.trim()) return
    onSaveNew(newName.trim())
    setNewName('')
    setShowNameInput(false)
  }

  function confirmDelete(id: string) {
    if (deletingId === id) {
      onDelete(id)
      setDeletingId(null)
    } else {
      setDeletingId(id)
      setTimeout(() => setDeletingId(null), 3000)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 mb-4">
        <p className="text-xs font-semibold text-zinc-300 uppercase tracking-widest mb-3">Templates</p>

        {showNameInput ? (
          <div className="flex gap-2">
            <input
              autoFocus
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
              placeholder="Template name..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveNew(); if (e.key === 'Escape') setShowNameInput(false) }}
            />
            <button
              onClick={handleSaveNew}
              className="bg-white text-black text-sm px-3 rounded-lg hover:bg-zinc-200 transition-colors"
            >
              Save
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className={`flex-1 text-sm py-2 px-3 rounded-lg transition-colors font-medium ${
                isDirty
                  ? 'bg-white text-black hover:bg-zinc-200'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              }`}
              disabled={!isDirty}
            >
              {activeId ? 'Update template' : 'Save as template'}
            </button>
            {activeId && (
              <button
                onClick={() => setShowNameInput(true)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-sm py-2 px-3 rounded-lg transition-colors"
                title="Save as new template"
              >
                + New
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
        {templates.length === 0 && (
          <p className="text-zinc-600 text-sm text-center py-8">No templates yet.<br />Save your first one above.</p>
        )}
        {templates.map(t => (
          <div
            key={t.id}
            className={`group flex items-center gap-2 rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
              activeId === t.id ? 'bg-zinc-700' : 'hover:bg-zinc-800'
            }`}
            onClick={() => onLoad(t)}
          >
            <div className="flex-1 min-w-0">
              <p className={`text-sm truncate ${activeId === t.id ? 'text-white font-medium' : 'text-zinc-300'}`}>
                {t.name}
              </p>
              <p className="text-xs text-zinc-600 truncate">
                {new Date(t.updatedAt).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); confirmDelete(t.id) }}
              className={`flex-shrink-0 text-xs rounded px-1.5 py-0.5 transition-colors opacity-0 group-hover:opacity-100 ${
                deletingId === t.id
                  ? 'bg-red-600 text-white opacity-100'
                  : 'text-zinc-500 hover:text-red-400'
              }`}
            >
              {deletingId === t.id ? 'Confirm' : '✕'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
