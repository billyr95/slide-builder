'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { SlideData, SlideTemplate, Orientation, ImageMode } from '@/lib/types'
import { DEFAULT_SLIDE_DATA } from '@/lib/defaults'
import SlideCanvas from '@/components/SlideCanvas'
import EditorPanel from '@/components/EditorPanel'
import TemplatesSidebar from '@/components/TemplatesSidebar'
import NewSlideModal, { BuildResult } from '@/components/NewSlideModal'
import { exportSlideAsPng } from '@/lib/exportSlide'
import { useUndoableState } from '@/lib/useUndoableState'
import { useTrainQueue } from '@/lib/useTrainQueue'
import { buildLiveTrainEntry } from '@/lib/liveTrainCapture'
import { ScreenType } from '@/lib/trainTypes'
import { suggestTitleFontSize, suggestSubtitleFontSize, suggestImagePosition } from '@/lib/slideHeuristics'

// Real pixel dimensions the slide renders at -- needed to convert the image
// heuristic's width_ratio into an absolute pixel size for stagger mode.
const SLIDE_DIMS: Record<Orientation, { w: number; h: number }> = {
  landscape: { w: 1920, h: 1080 },
  portrait: { w: 1080, h: 1920 },
}

const LOGGING_PREF_KEY = 'slide-builder-live-logging-enabled'

const PREVIEW_SCALES = {
  landscape: 0.33,
  portrait: 0.28,
}

export default function Home() {
  const { value: data, set: setData, undo, redo, reset: resetData, canUndo, canRedo } = useUndoableState<SlideData>(DEFAULT_SLIDE_DATA)
  const [orientation, setOrientation] = useState<Orientation>('landscape')
  const [templates, setTemplates] = useState<SlideTemplate[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [savedData, setSavedData] = useState<SlideData>(DEFAULT_SLIDE_DATA)
  const [exporting, setExporting] = useState<Orientation | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [slideName, setSlideName] = useState('Untitled Slide')
  const [savedName, setSavedName] = useState('Untitled Slide')
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [showNewSlideModal, setShowNewSlideModal] = useState(false)

  const { addEntry: addTrainEntry } = useTrainQueue()
  const [screenType, setScreenType] = useState<ScreenType>('projector')
  const [loggingEnabled, setLoggingEnabled] = useState(true)
  const [loggingPrefLoaded, setLoggingPrefLoaded] = useState(false)
  // Bumped whenever a genuinely new slide/template is loaded (not on
  // ordinary field edits) — tells EditorPanel to reset its heuristic
  // "manually overridden" tracking so the fresh slide gets auto-suggestions.
  const [slideRevision, setSlideRevision] = useState(0)

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

  // Load the logging preference once on mount, then persist changes after —
  // gated on `loggingPrefLoaded` (real state, not a ref) so the save effect
  // never fires with the pre-load default before the stored value arrives.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOGGING_PREF_KEY)
      if (raw !== null) setLoggingEnabled(raw === 'true')
    } catch (e) {
      console.warn('Failed to load logging preference', e)
    }
    setLoggingPrefLoaded(true)
  }, [])

  useEffect(() => {
    if (!loggingPrefLoaded) return
    try {
      localStorage.setItem(LOGGING_PREF_KEY, String(loggingEnabled))
    } catch (e) {
      console.warn('Failed to save logging preference', e)
    }
  }, [loggingEnabled, loggingPrefLoaded])

  useEffect(() => {
    fetchTemplates()
    nameInputRef.current?.focus()
    nameInputRef.current?.select()
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const isEditableField = !!target && (
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      )
      // Let native undo run inside text fields rather than fighting it with app-level undo.
      if (isEditableField) return
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key.toLowerCase() === 'z' && e.shiftKey) {
        e.preventDefault()
        redo()
      } else if (e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
      } else if (e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])

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
    resetData(template.data)
    setSavedData(template.data)
    setActiveId(template.id)
    setSlideName(template.name)
    setSavedName(template.name)
    setSlideRevision(r => r + 1)
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
    setShowNewSlideModal(true)
  }

  // The original "New" behavior -- now reached via the modal's "Skip /
  // Start blank" option instead of running directly on click.
  function handleStartBlank() {
    resetData(DEFAULT_SLIDE_DATA)
    setSavedData(DEFAULT_SLIDE_DATA)
    setActiveId(null)
    setSlideName('Untitled Slide')
    setSavedName('Untitled Slide')
    setSlideRevision(r => r + 1)
    setShowNewSlideModal(false)
    setTimeout(() => {
      nameInputRef.current?.focus()
      nameInputRef.current?.select()
    }, 50)
  }

  function handleBuildFromModal({ screenType: newScreenType, fields, images }: BuildResult) {
    const hasSubtitle = !!fields.subtitle
    const titleLineCount = Math.max(1, fields.title.split('\n').length)

    const newData: SlideData = {
      ...DEFAULT_SLIDE_DATA,
      label: fields.label,
      title: fields.title,
      subtitle: fields.subtitle,
      subtitle2: fields.subtitle2,
      presenters: fields.presenters,
      presentersItalic: fields.presentersItalic,
      seriesName: fields.seriesName,
      showSeriesName: !!fields.seriesName,
      titleSize: suggestTitleFontSize(fields.title.length, titleLineCount, newScreenType, hasSubtitle),
      subtitleSize: hasSubtitle ? suggestSubtitleFontSize(fields.subtitle.length) : DEFAULT_SLIDE_DATA.subtitleSize,
      imageMode: 'single',
      imageUrl: '',
      staggerImages: [],
    }

    // Assign uploaded images into slots, picking a stagger mode that fits
    // how many were dropped. Image-type classification isn't implemented
    // (no vision call on paste) -- same "other" default TODO as the manual
    // upload path in EditorPanel.
    if (images.length > 0) {
      const suggestion = suggestImagePosition('other', newScreenType)
      const dims = SLIDE_DIMS[orientation]

      if (images.length === 1) {
        newData.imageUrl = images[0].url
        newData.imageAlt = images[0].name
        newData.imageSize = Math.max(20, Math.min(200, Math.round(suggestion.width * 100)))
      } else {
        const mode: ImageMode = images.length === 2 ? 'two-stagger' : images.length === 3 ? 'three-stagger' : 'four-stagger'
        const scale = Math.max(80, Math.min(800, Math.round(suggestion.width * dims.w)))
        newData.imageMode = mode
        newData.staggerImages = images.slice(0, 4).map(img => ({ id: img.id, url: img.url, alt: img.name, y: 0, scale }))
      }
    }

    resetData(newData)
    setSavedData(newData)
    setActiveId(null)
    setSlideName('Untitled Slide')
    setSavedName('Untitled Slide')
    setScreenType(newScreenType)
    setSlideRevision(r => r + 1)
    setShowNewSlideModal(false)
  }

  async function handleExport(orient: Orientation) {
    setExporting(orient)
    const safeName = savedName.replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 60)
    const filename = `${safeName}_${orient}.png`
    try {
      await exportSlideAsPng(orient, data, filename)
      showToast(`Exported "${savedName}"`)
      if (loggingEnabled) {
        // Fire-and-forget — must never block or slow down the export the
        // user is already looking at, and a logging failure must never
        // surface to them either. buildLiveTrainEntry is async (it reads
        // the placed image's natural dimensions), so this is intentionally
        // NOT awaited here.
        buildLiveTrainEntry(data, orient, screenType)
          .then(entry => addTrainEntry(entry))
          .catch(e => console.warn('Failed to log training entry', e))
      }
    } catch (e) {
      console.error(e)
      showToast('Export failed')
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ fontFamily: "'Theinhardt', sans-serif" }}>

      {showNewSlideModal && (
        <NewSlideModal
          initialScreenType={screenType}
          onBuild={handleBuildFromModal}
          onSkip={handleStartBlank}
          onCancel={() => setShowNewSlideModal(false)}
        />
      )}

      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-zinc-950 flex-shrink-0">

        {/* Left: Logo */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-6 h-6 bg-white rounded" />
          <span className="text-sm font-semibold text-white tracking-wide">Slide Builder</span>
          <Link
            href="/train"
            className="text-xs text-zinc-500 hover:text-white px-2 py-1 rounded-md hover:bg-zinc-800 transition-colors"
          >
            Training Bundler →
          </Link>
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
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Cmd+Z)"
            className="text-sm text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            ↶ Undo
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Cmd+Shift+Z)"
            className="text-sm text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            ↷ Redo
          </button>
          <button
            onClick={handleNew}
            className="text-sm text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            + New
          </button>

          {/* Training-data logging -- lives right next to Export since
              that's the action it actually hooks into. */}
          <div className="flex items-center gap-1 mr-1">
            <button
              onClick={() => setLoggingEnabled(v => !v)}
              title={loggingEnabled
                ? 'Exports are logged as training data (click to turn off for a one-off export)'
                : 'Exports are NOT logged as training data (click to turn back on)'}
              className={`text-xs px-2 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                loggingEnabled ? 'bg-emerald-950 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${loggingEnabled ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
              Log
            </button>
            {loggingEnabled && (
              <div className="flex gap-0.5 bg-zinc-800 p-0.5 rounded-lg">
                {(['projector', 'lobby'] as ScreenType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setScreenType(t)}
                    title={`Log future exports as "${t}" screen type`}
                    className={`text-[11px] px-2 py-1 rounded-md transition-colors font-medium ${
                      screenType === t ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {t === 'projector' ? 'Proj' : 'Lobby'}
                  </button>
                ))}
              </div>
            )}
          </div>

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
            {orientation === 'landscape' ? '1920 × 1080 px' : '1080 × 1920 px'} — PNG export at full resolution
          </p>
        </main>

        {/* Right: Editor */}
        <aside className="w-72 flex-shrink-0 border-l border-zinc-800 bg-zinc-950 p-4 overflow-y-auto">
          <p className="text-xs font-semibold text-zinc-300 uppercase tracking-widest mb-4">Edit</p>
          <EditorPanel
            data={data}
            onChange={setData}
            screenType={screenType}
            orientation={orientation}
            slideRevision={slideRevision}
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