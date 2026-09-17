'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { SlideData, Orientation } from '@/lib/types'
import { DEFAULT_SLIDE_DATA } from '@/lib/defaults'
import SlideCanvas from '@/components/SlideCanvas'
import EditorPanel from '@/components/EditorPanel'
import NewSlideFlow from '@/components/NewSlideFlow'
import { exportSlideAsPng } from '@/lib/exportSlide'
import { useUndoableState } from '@/lib/useUndoableState'
import { buildLiveTrainEntry } from '@/lib/liveTrainCapture'
import { ScreenType } from '@/lib/trainTypes'

const LOGGING_PREF_KEY = 'slide-builder-live-logging-enabled'
const AUTOSAVE_INTERVAL_MS = 60000

const PREVIEW_SCALES = {
  landscape: 0.33,
  portrait: 0.28,
}

type SaveStatus = 'loading' | 'idle' | 'saving' | 'saved' | 'error' | 'forbidden' | 'not-found'

export default function EditorPage() {
  const params = useParams<{ id: string }>()
  const slideId = params.id
  const router = useRouter()

  const { value: data, set: setData, undo, redo, reset: resetData, canUndo, canRedo } = useUndoableState<SlideData>(DEFAULT_SLIDE_DATA)
  const [orientation, setOrientation] = useState<Orientation>('landscape')
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<SaveStatus>('loading')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [exporting, setExporting] = useState<Orientation | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [showNewFlow, setShowNewFlow] = useState(false)

  const [screenType, setScreenType] = useState<ScreenType>('projector')
  const [loggingEnabled, setLoggingEnabled] = useState(true)
  const [loggingPrefLoaded, setLoggingPrefLoaded] = useState(false)
  // Bumped whenever a genuinely new slide/template is loaded (not on
  // ordinary field edits) — tells EditorPanel to reset its heuristic
  // "manually overridden" tracking so the fresh slide gets auto-suggestions.
  const [slideRevision, setSlideRevision] = useState(0)

  // Snapshot of what's actually persisted, for dirty-checking. Refs (not
  // state) for the autosave interval below, so its callback always reads
  // the latest values without needing to be torn down/recreated on every
  // keystroke (which would otherwise reset the 60s countdown constantly).
  const savedTitleRef = useRef('')
  const savedDataRef = useRef<SlideData>(DEFAULT_SLIDE_DATA)
  const savedOrientationRef = useRef<Orientation>('landscape')
  const dataRef = useRef(data)
  const titleRef = useRef(title)
  const orientationRef = useRef(orientation)
  dataRef.current = data
  titleRef.current = title
  orientationRef.current = orientation

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  function isDirty() {
    return titleRef.current !== savedTitleRef.current
      || orientationRef.current !== savedOrientationRef.current
      || JSON.stringify(dataRef.current) !== JSON.stringify(savedDataRef.current)
  }

  const saveNow = useCallback(async (force = false) => {
    if (!force && !isDirty()) return
    setStatus('saving')
    try {
      const res = await fetch(`/api/slides/${slideId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titleRef.current, orientation: orientationRef.current, data: dataRef.current }),
      })
      if (!res.ok) throw new Error(`Save failed (${res.status})`)
      const updated = await res.json()
      savedTitleRef.current = titleRef.current
      savedDataRef.current = dataRef.current
      savedOrientationRef.current = orientationRef.current
      setLastSavedAt(new Date(updated.updatedAt))
      setStatus('saved')
    } catch (e) {
      console.error(e)
      setStatus('error')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideId])

  // Initial load.
  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    fetch(`/api/slides/${slideId}`)
      .then(async res => {
        if (cancelled) return
        if (res.status === 403) { setStatus('forbidden'); return }
        if (res.status === 404) { setStatus('not-found'); return }
        if (!res.ok) throw new Error(`Load failed (${res.status})`)
        const slide = await res.json()
        resetData(slide.data)
        setTitle(slide.title)
        setOrientation(slide.orientation)
        savedTitleRef.current = slide.title
        savedDataRef.current = slide.data
        savedOrientationRef.current = slide.orientation
        setLastSavedAt(new Date(slide.updatedAt))
        setSlideRevision(r => r + 1)
        setStatus('saved')
      })
      .catch(e => {
        console.error(e)
        if (!cancelled) setStatus('error')
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideId])

  // Periodic autosave -- fixed 60s cadence (not recreated on every edit),
  // only actually saves if something changed since the last save.
  useEffect(() => {
    const interval = setInterval(() => {
      if (isDirty()) saveNow()
    }, AUTOSAVE_INTERVAL_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveNow])

  // Save on page unload if there's unsaved work (best-effort; browsers give
  // very little time here, so this is a courtesy, not a guarantee).
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty()) e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

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
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const isEditableField = !!target && (
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      )
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

  async function handleExport(orient: Orientation) {
    setExporting(orient)
    const safeName = titleRef.current.replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 60)
    const filename = `${safeName || 'slide'}_${orient}.png`
    try {
      await exportSlideAsPng(orient, data, filename)
      showToast(`Exported "${title}"`)
      await saveNow(true)
      if (loggingEnabled) {
        // Fire-and-forget — must never block or slow down the export the
        // user is already looking at, and a logging failure must never
        // surface to them either. buildLiveTrainEntry is async (it reads
        // the placed image's natural dimensions), so this is intentionally
        // NOT awaited here.
        buildLiveTrainEntry(data, orient, screenType)
          .then(entry => fetch('/api/training-entries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entry),
          }))
          .catch(e => console.warn('Failed to log training entry', e))
      }
    } catch (e) {
      console.error(e)
      showToast('Export failed')
    } finally {
      setExporting(null)
    }
  }

  const saveStatusText =
    status === 'saving' ? 'Saving…'
    : status === 'error' ? 'Save failed'
    : lastSavedAt ? `Saved ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : ''

  if (status === 'loading') {
    return <div className="h-screen flex items-center justify-center bg-zinc-950 text-zinc-500 text-sm">Loading…</div>
  }
  if (status === 'forbidden') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-zinc-950 text-white gap-3">
        <p className="text-sm text-zinc-400">You don't have access to this slide.</p>
        <Link href="/" className="text-sm text-white underline">Back to dashboard</Link>
      </div>
    )
  }
  if (status === 'not-found') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-zinc-950 text-white gap-3">
        <p className="text-sm text-zinc-400">This slide doesn't exist (it may have been deleted).</p>
        <Link href="/" className="text-sm text-white underline">Back to dashboard</Link>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ fontFamily: "'Theinhardt', sans-serif" }}>

      {showNewFlow && (
        <NewSlideFlow initialScreenType={screenType} onClose={() => setShowNewFlow(false)} />
      )}

      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-zinc-950 flex-shrink-0">

        {/* Left: Logo */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link href="/" className="flex items-center gap-3" title="Back to dashboard">
            <div className="w-6 h-6 bg-white rounded" />
            <span className="text-sm font-semibold text-white tracking-wide">Slide Builder</span>
          </Link>
          <Link
            href="/train"
            className="text-xs text-zinc-500 hover:text-white px-2 py-1 rounded-md hover:bg-zinc-800 transition-colors"
          >
            Training Bundler →
          </Link>
        </div>

        {/* Center: Slide name input + save status */}
        <div className="flex items-center gap-2 flex-1 mx-6 max-w-xl">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={() => { if (isDirty()) saveNow() }}
            className="flex-1 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 focus:border-zinc-400 rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors text-center"
            placeholder="Untitled Slide"
          />
          <button
            onClick={() => saveNow(true)}
            disabled={status === 'saving'}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white"
          >
            Save
          </button>
          <span className="text-xs text-zinc-500 w-28 flex-shrink-0">{saveStatusText}</span>
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
            onClick={() => setShowNewFlow(true)}
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
            slideRevision={slideRevision}
            orientation={orientation}
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
