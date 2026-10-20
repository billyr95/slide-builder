'use client'

// Non-destructive per-image photo adjustments (contrast/saturation/
// shadows/black & white point/black & white) -- see lib/photoAdjust.ts for
// the shared pixel pipeline and why this modal's own live preview uses a
// direct canvas redraw (not the <img data-adjust> swap SlideCanvas and PNG
// export use) specifically to stay flicker-free while dragging.

import { useEffect, useRef, useState } from 'react'
import { PhotoAdjustments, DEFAULT_PHOTO_ADJUSTMENTS, processPhotoAdjustments } from '@/lib/photoAdjust'

const WORKING_MAX_DIM = 1000

interface PhotoEditorModalProps {
  imageUrl: string
  adjustments: PhotoAdjustments | undefined
  onApply: (adjustments: PhotoAdjustments) => void
  onCancel: () => void
}

function AdjustSlider({ label, value, onChange, min, max, step = 1, suffix = '' }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; suffix?: string
}) {
  const [text, setText] = useState(String(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(String(value))
  }, [value, focused])

  function commit(raw: string) {
    const parsed = Math.round(Number(raw))
    const clamped = Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : value
    setText(String(clamped))
    if (clamped !== value) onChange(clamped)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const stepAmount = e.shiftKey ? step * 10 : step
      const current = Number(text)
      const base = Number.isFinite(current) ? current : value
      const next = Math.max(min, Math.min(max, base + (e.key === 'ArrowUp' ? stepAmount : -stepAmount)))
      setText(String(next))
      if (next !== base) onChange(next)
    } else if (e.key === 'Enter') {
      commit(text)
      e.currentTarget.blur()
    }
  }

  return (
    <div className="mt-3 first:mt-0">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-zinc-400">{label}</span>
        <input
          type="text"
          inputMode="numeric"
          value={text}
          onFocus={() => setFocused(true)}
          onChange={e => setText(e.target.value.replace(/[^0-9-]/g, ''))}
          onKeyDown={handleKeyDown}
          onBlur={() => { setFocused(false); commit(text) }}
          className="w-14 text-xs font-mono text-zinc-300 bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-right focus:outline-none focus:border-zinc-500"
        />
        {suffix && <span className="text-xs text-zinc-500 ml-1">{suffix}</span>}
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-white" />
    </div>
  )
}

export default function PhotoEditorModal({ imageUrl, adjustments, onApply, onCancel }: PhotoEditorModalProps) {
  const [draft, setDraft] = useState<PhotoAdjustments>(adjustments ?? DEFAULT_PHOTO_ADJUSTMENTS)
  const [comparing, setComparing] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sourceRef = useRef<ImageData | null>(null)

  // Loads the ORIGINAL (unmodified) image once per imageUrl, decoded into a
  // downscaled working copy (~1000px) so dragging a slider stays responsive
  // regardless of the photo's real resolution -- this working copy is only
  // ever used for this modal's own live preview; SlideCanvas, the dashboard
  // thumbnail, and PNG export all process the full-resolution original
  // instead (see lib/photoAdjust.ts's applyPhotoAdjustmentsInDom).
  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (cancelled) return
      let w = img.naturalWidth
      let h = img.naturalHeight
      if (Math.max(w, h) > WORKING_MAX_DIM) {
        const ratio = WORKING_MAX_DIM / Math.max(w, h)
        w = Math.round(w * ratio)
        h = Math.round(h * ratio)
      }
      const offscreen = document.createElement('canvas')
      offscreen.width = w
      offscreen.height = h
      const octx = offscreen.getContext('2d')
      if (!octx) return
      octx.drawImage(img, 0, 0, w, h)
      sourceRef.current = octx.getImageData(0, 0, w, h)
      if (canvasRef.current) {
        canvasRef.current.width = w
        canvasRef.current.height = h
      }
      setLoaded(true)
    }
    img.src = imageUrl
    return () => { cancelled = true }
  }, [imageUrl])

  // Redraws the visible preview directly from the cached working copy --
  // no <img>/data-URL round-trip, so there's no per-frame flash while
  // dragging a slider (see this file's own top comment).
  useEffect(() => {
    if (!loaded || !sourceRef.current || !canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return
    const src = sourceRef.current
    const clone = new ImageData(new Uint8ClampedArray(src.data), src.width, src.height)
    if (!comparing) processPhotoAdjustments(clone.data, draft)
    ctx.putImageData(clone, 0, 0)
  }, [draft, comparing, loaded])

  function patch(p: Partial<PhotoAdjustments>) {
    setDraft(d => {
      const next = { ...d, ...p }
      // White point always stays above black point.
      if (next.whitePoint <= next.blackPoint) {
        if ('blackPoint' in p) next.whitePoint = Math.min(255, next.blackPoint + 1)
        else next.blackPoint = Math.max(0, next.whitePoint - 1)
      }
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-700 shadow-2xl flex overflow-hidden" style={{ width: 880, maxHeight: '90vh' }}>
        <div className="flex-1 flex items-center justify-center bg-black p-6 min-w-0">
          {!loaded && <p className="text-sm text-zinc-500">Loading…</p>}
          <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: loaded ? 'block' : 'none' }} />
        </div>

        <div className="w-72 flex-shrink-0 border-l border-zinc-800 flex flex-col">
          <div className="px-4 py-4 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-white">Edit photo</h2>
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar px-4 py-4">
            <AdjustSlider label="Contrast" value={draft.contrast} onChange={v => patch({ contrast: v })} min={-100} max={100} />
            <AdjustSlider label="Saturation" value={draft.saturation} onChange={v => patch({ saturation: v })} min={-100} max={100} />
            <AdjustSlider label="Shadows" value={draft.shadows} onChange={v => patch({ shadows: v })} min={-100} max={100} />
            <AdjustSlider label="Black point" value={draft.blackPoint} onChange={v => patch({ blackPoint: v })} min={0} max={254} />
            <AdjustSlider label="White point" value={draft.whitePoint} onChange={v => patch({ whitePoint: v })} min={1} max={255} />

            <label className="mt-4 flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={draft.blackAndWhite} onChange={e => patch({ blackAndWhite: e.target.checked })} className="rounded" />
              Black &amp; white
            </label>

            <button
              onClick={() => setDraft(DEFAULT_PHOTO_ADJUSTMENTS)}
              className="mt-4 w-full text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg py-1.5 transition-colors"
            >
              Reset all
            </button>

            <button
              onMouseDown={() => setComparing(true)}
              onMouseUp={() => setComparing(false)}
              onMouseLeave={() => setComparing(false)}
              onTouchStart={() => setComparing(true)}
              onTouchEnd={() => setComparing(false)}
              className="mt-2 w-full text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg py-1.5 transition-colors select-none"
            >
              {comparing ? 'Showing original…' : 'Hold to compare'}
            </button>
          </div>

          <div className="px-4 py-4 border-t border-zinc-800 flex gap-2">
            <button onClick={onCancel}
              className="flex-1 py-2 text-sm text-zinc-400 border border-zinc-700 rounded-lg hover:border-zinc-500 transition-colors">
              Cancel
            </button>
            <button onClick={() => onApply(draft)}
              className="flex-1 py-2 text-sm font-medium bg-white text-black rounded-lg hover:bg-zinc-200 transition-colors">
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
