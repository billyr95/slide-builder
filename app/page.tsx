'use client'

import { useState, useEffect, useRef } from 'react'
import { SlideData, SlideTemplate, Orientation } from '@/lib/types'
import { DEFAULT_SLIDE_DATA } from '@/lib/defaults'
import SlideCanvas from '@/components/SlideCanvas'
import EditorPanel from '@/components/EditorPanel'
import TemplatesSidebar from '@/components/TemplatesSidebar'
import { exportSlideAsJpeg } from '@/lib/exportSlide'

const PREVIEW_SCALES = {
  landscape: 0.33,
  portrait: 0.28,
}

export default function Home() {
  const [data, setData] = useState<SlideData>(DEFAULT_SLIDE_DATA)
  const [orientation, setOrientation] = useState<Orientation>('landscape')
  const [templates, setTemplates] = useState<SlideTemplate[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [savedData, setSavedData] = useState<SlideData>(DEFAULT_SLIDE_DATA)
  const [exporting, setExporting] = useState<Orientation | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [slideName, setSlideName] = useState('Untitled Slide')
  const [savedName, setSavedName] = useState('Untitled Slide')
  const nameInputRef = useRef<HTMLInputElement>(null)

  const isDirty = JSON.stringify(data) !== JSON.stringify(savedData)
  const isNameDirty = slideName !== savedName

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  async function fetchTemplates() {
    const res = await fetch('/api/templates')
    const list = await res.json()
    setTemplates(list)
  }

  useEffect(() => {
    fetchTemplates()
    nameInputRef.current?.focus()
    nameInputRef.current?.select()
  }, [])

  function handleSaveName() {
    const name = slideName.trim() || 'Untitled Slide'
    setSlideName(name)
    setSavedName(name)
    showToast(`Slide named "${name}"`)
  }

  async function handleSaveNew(name: string) {
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, data }),
    })
    const saved: SlideTemplate = await res.json()
    setActiveId(saved.id)
    setSavedData(data)
    await fetchTemplates()
    showToast(`Saved "${name}"`)
  }

  async function handleUpdate() {
    if (!activeId) return
    await fetch(`/api/templates/${activeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    })
    setSavedData(data)
    await fetchTemplates()
    showToast('Template updated')
  }

  function handleLoad(template: SlideTemplate) {
    setData(template.data)
    setSavedData(template.data)
    setActiveId(template.id)
    setSlideName(template.name)
    setSavedName(template.name)
  }

  async function handleDelete(id: string) {
    await fetch(`/api/templates/${id}`, { method: 'DELETE' })
    if (activeId === id) {
      setActiveId(null)
      setSavedData(data)
    }
    await fetchTemplates()
    showToast('Template deleted')
  }

  function handleNew() {
    setData(DEFAULT_SLIDE_DATA)
    setSavedData(DEFAULT_SLIDE_DATA)
    setActiveId(null)
    setSlideName('Untitled Slide')
    setSavedName('Untitled Slide')
    setTimeout(() => {
      nameInputRef.current?.focus()
      nameInputRef.current?.select()
    }, 50)
  }

  async function handleExport(orient: Orientation) {
    setExporting(orient)
    const safeName = savedName.replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 60)
    const filename = `${safeName}_${orient}.jpg`
    try {
      await exportSlideAsJpeg(orient, data, filename)
      showToast(`Exported "${savedName}"`)
    } catch (e) {
      console.error(e)
      showToast('Export failed')
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ fontFamily: "'Theinhardt', sans-serif" }}>

      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-zinc-950 flex-shrink-0">

        {/* Left: Logo */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-6 h-6 bg-white rounded" />
          <span className="text-sm font-semibold text-white tracking-wide">Slide Builder</span>
        </div>

        {/* Center: Slide name input */}
        <div className="flex items-center gap-2 flex-1 mx-6 max-w-xl">
          <input
            ref={nameInputRef}
            type="text"
            value={slideName}
            onChange={e => setSlideName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSaveName() }}
            className="flex-1 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 focus:border-zinc-400 rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors text-center"
            placeholder="Untitled Slide"
          />
          <button
            onClick={handleSaveName}
            disabled={!isNameDirty}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white"
          >
            Save name
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleNew}
            className="text-sm text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            + New
          </button>
          <button
            onClick={() => handleExport('landscape')}
            disabled={!!exporting}
            className="text-sm bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {exporting === 'landscape' ? (
              <><span className="animate-spin inline-block">⟳</span> Exporting…</>
            ) : (
              '↓ 1920×1080'
            )}
          </button>
          <button
            onClick={() => handleExport('portrait')}
            disabled={!!exporting}
            className="text-sm bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {exporting === 'portrait' ? (
              <><span className="animate-spin inline-block">⟳</span> Exporting…</>
            ) : (
              '↓ 1080×1920'
            )}
          </button>
          <button
            onClick={() => handleExport(orientation)}
            disabled={!!exporting}
            className="text-sm bg-white hover:bg-zinc-200 text-black font-medium px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {exporting === orientation ? 'Exporting…' : `Export ${orientation === 'landscape' ? '16:9' : '9:16'}`}
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">

        {/* Left: Templates sidebar */}
        <aside className="w-56 flex-shrink-0 border-r border-zinc-800 bg-zinc-950 p-4 overflow-hidden flex flex-col">
          <TemplatesSidebar
            templates={templates}
            activeId={activeId}
            onLoad={handleLoad}
            onDelete={handleDelete}
            onSaveNew={handleSaveNew}
            onUpdate={handleUpdate}
            isDirty={isDirty}
            activeTemplateName={templates.find(t => t.id === activeId)?.name ?? ''}
          />
        </aside>

        {/* Center: Preview */}
        <main className="flex-1 flex flex-col items-center justify-center bg-zinc-900 overflow-auto p-8 gap-6">

          {/* Orientation toggle */}
          <div className="flex gap-1 bg-zinc-800 p-1 rounded-lg flex-shrink-0">
            {(['landscape', 'portrait'] as Orientation[]).map(o => (
              <button
                key={o}
                onClick={() => setOrientation(o)}
                className={`text-xs px-4 py-1.5 rounded-md transition-colors font-medium ${
                  orientation === o ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {o === 'landscape' ? '⬛ 16:9' : '▬ 9:16'}
              </button>
            ))}
          </div>

          {/* Preview area */}
          <div className="flex-shrink-0">
            {orientation === 'landscape' ? (
              <div
                className="rounded-lg overflow-hidden shadow-2xl"
                style={{
                  width: 1920 * PREVIEW_SCALES.landscape,
                  height: 1080 * PREVIEW_SCALES.landscape,
                }}
              >
                <div style={{ transform: `scale(${PREVIEW_SCALES.landscape})`, transformOrigin: 'top left' }}>
                  <SlideCanvas data={data} orientation="landscape" scale={1} />
                </div>
              </div>
            ) : (
              <div
                className="rounded-lg overflow-hidden shadow-2xl"
                style={{
                  width: 1080 * PREVIEW_SCALES.portrait,
                  height: 1920 * PREVIEW_SCALES.portrait,
                }}
              >
                <div style={{ transform: `scale(${PREVIEW_SCALES.portrait})`, transformOrigin: 'top left' }}>
                  <SlideCanvas data={data} orientation="portrait" scale={1} />
                </div>
              </div>
            )}
          </div>

          {/* Dimension label */}
          <p className="text-xs text-zinc-600 flex-shrink-0">
            {orientation === 'landscape' ? '1920 × 1080 px' : '1080 × 1920 px'} — JPEG export at full resolution
          </p>
        </main>

        {/* Right: Editor */}
        <aside className="w-72 flex-shrink-0 border-l border-zinc-800 bg-zinc-950 p-4 overflow-y-auto">
          <p className="text-xs font-semibold text-zinc-300 uppercase tracking-widest mb-4">Edit</p>
          <EditorPanel data={data} onChange={setData} />
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