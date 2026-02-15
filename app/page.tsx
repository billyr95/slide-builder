'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
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

  const landscapeRef = useRef<HTMLDivElement>(null)
  const portraitRef = useRef<HTMLDivElement>(null)

  const isDirty = JSON.stringify(data) !== JSON.stringify(savedData)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  async function fetchTemplates() {
    const res = await fetch('/api/templates')
    const list = await res.json()
    setTemplates(list)
  }

  useEffect(() => { fetchTemplates() }, [])

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
  }

  async function handleExport(orient: Orientation) {
    setExporting(orient)
    // Brief delay to allow re-render at full scale
    await new Promise(r => setTimeout(r, 100))
    const ref = orient === 'landscape' ? landscapeRef : portraitRef
    if (!ref.current) { setExporting(null); return }
    const title = data.title.replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 40)
    const filename = `slide_${orient}_${title}.jpg`
    await exportSlideAsJpeg(ref.current, orient, filename)
    setExporting(null)
    showToast(`Exported ${orient} JPEG`)
  }

  const scale = PREVIEW_SCALES[orientation]

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-zinc-950 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-white rounded" />
          <span className="text-sm font-semibold text-white tracking-wide">Slide Builder</span>
          {isDirty && <span className="text-xs text-zinc-500">● unsaved</span>}
        </div>
        <div className="flex items-center gap-2">
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
          <div className="flex-shrink-0" style={{ transform: 'none' }}>
            {orientation === 'landscape' ? (
              <div
                className="rounded-lg overflow-hidden shadow-2xl"
                style={{
                  width: 1920 * PREVIEW_SCALES.landscape,
                  height: 1080 * PREVIEW_SCALES.landscape,
                }}
              >
                <div style={{ transform: `scale(${PREVIEW_SCALES.landscape})`, transformOrigin: 'top left' }}>
                  <SlideCanvas ref={landscapeRef} data={data} orientation="landscape" scale={1} />
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
                  <SlideCanvas ref={portraitRef} data={data} orientation="portrait" scale={1} />
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

      {/* Hidden full-res canvases for export */}
      <div
        style={{
          position: 'fixed',
          top: '-99999px',
          left: '-99999px',
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <SlideCanvas ref={landscapeRef} data={data} orientation="landscape" scale={1} />
        <SlideCanvas ref={portraitRef} data={data} orientation="portrait" scale={1} />
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white text-black text-sm font-medium px-4 py-2 rounded-full shadow-xl z-50 animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  )
}
