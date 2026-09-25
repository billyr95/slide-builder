'use client'

import { SlideData, TheinhardtWeight, PresentersFont, LogoItem, StaggerImage, ImageMode, Orientation, FaceCropBox, TextBlockKey, staggerCount } from '@/lib/types'
import { ScreenType } from '@/lib/trainTypes'
import { useRef, useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { resizeImageDataUrl } from '@/lib/resizeImage'
import ColorPalette from './ColorPalette'
import { suggestTitleFontSize, suggestSubtitleFontSize, suggestImagePosition } from '@/lib/slideHeuristics'
import { DEFAULT_LISTENING_CREDIT_LINE_HEIGHT } from '@/lib/defaults'
import { resolveBlockOrder, isBlockPopulated, effectiveMarginTop, effectiveSeriesNameMarginTop } from '@/lib/textStackGap'
import { effectiveImageTextGapLandscape, effectiveImageTextGapPortrait, effectiveContentMargin } from '@/lib/layoutDefaults'
import { effectiveImageSizePx, CANVAS_WIDTH, MIN_IMAGE_SIZE_PX, MAX_IMAGE_SIZE_PX } from '@/lib/imageSizing'

const TEXT_BLOCK_LABELS: Record<TextBlockKey, string> = {
  label: 'Label',
  title: 'Title',
  subtitle: 'Subtitle',
  subtitle2: 'Subtitle 2',
  presenters: 'Presenters',
  programTitle: 'Program / Work Title',
}

const MAX_LOGO_DIM = 400

// Purely positional -- describes where in the layout each slot sits, not
// stacking depth (that's StaggerImage.zIndex, set independently via its own
// "layer" slider below).
function staggerSlotLabel(mode: ImageMode, i: number): string {
  if (mode === 'three-triangle') return ['(top-left)', '(top-right)', '(bottom)'][i] ?? ''
  if (mode === 'four-squared') return ['(top-left)', '(top-right)', '(bottom-left)', '(bottom-right)'][i] ?? ''
  return `(${i + 1})`
}

const CropModal = dynamic(() => import('./CropModal'), { ssr: false })

interface EditorPanelProps {
  data: SlideData
  onChange: (data: SlideData) => void
  // Also parameterizes the heuristic auto-fill calls below. The control for
  // setting it lives in this panel's Background section (moved out of the
  // top bar to declutter it) -- still slide-level metadata needed for every
  // slide regardless of whether live training-logging happens to be on.
  screenType: ScreenType
  onScreenTypeChange: (t: ScreenType) => void
  // Bumped by the parent whenever a genuinely new slide/template is loaded
  // (not on ordinary field edits) — resets the heuristic "manually
  // overridden" flags below so a fresh slide gets auto-suggestions again.
  slideRevision: number
  // Needed to word the Flip control correctly -- portrait's outer container
  // is a column flex, so imageSide there swaps top/bottom, not left/right.
  orientation: Orientation
  // The Background section mirrors the top bar's 16:9/9:16 toggle inline
  // (matching the reference layout, which shows it inside that section) --
  // both control the same page-level state.
  onOrientationChange: (o: Orientation) => void
  // Which tab is showing -- lifted to the parent so the icon rail can live
  // outside this component (page.tsx renders it as its own leftmost column,
  // not tucked inside this panel) while staying in sync with it.
  activeSection: SectionId
  onActiveSectionChange: (id: SectionId) => void
}

// Section ids for the tabbed right-panel layout + the icon rail that
// switches between them. Purely a navigation/visual grouping -- every field
// and its onChange wiring below is unchanged from before this
// reorganization, just relocated into one of these containers. Grouped by
// input type rather than one tab per field: every typed field (Label,
// Title, Subtitle, Presenters, Program Title, Series Name, Listening
// Credit) lives under "text", and every uploaded-image field (the main
// image slot(s) and the logo bar) lives under "image".
export type SectionId = 'background' | 'text' | 'image' | 'layout' | 'accessibility'

function TextGlyph({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={`font-semibold leading-none ${className ?? ''}`}>{children}</span>
}

function BackgroundGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
      <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.5 11L5 7.5l2.2 2.2L11 6l3.5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ImageGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="5.2" cy="6" r="1.1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 12l3.5-3.5L8 11l2.5-2.5L14 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function GridGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

function AccessibilityGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 5.5v6M5.5 7h5M6 12l2-2 2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// `title` is the full name (used for the rail button's hover tooltip);
// `label` is the short form that actually fits printed under the icon in
// the rail itself without wrapping or widening it.
export const SECTION_META: Record<SectionId, { title: string; label: string; glyph: React.ReactNode }> = {
  background: { title: 'Background', label: 'Background', glyph: <BackgroundGlyph /> },
  text: { title: 'Text', label: 'Text', glyph: <TextGlyph className="text-[13px]">T</TextGlyph> },
  image: { title: 'Image', label: 'Image', glyph: <ImageGlyph /> },
  layout: { title: 'Layout & Preview', label: 'Layout', glyph: <GridGlyph /> },
  accessibility: { title: 'Accessibility', label: 'Access', glyph: <AccessibilityGlyph /> },
}

// One rail icon per input TYPE, not per field -- every typed field (Label,
// Title, Subtitle, Presenters, Program Title, Series Name, Listening
// Credit) lives under "text", every uploaded-image field (the main image
// slot(s) and the logo bar) lives under "image". Clicking an icon shows
// ONLY that section (a tab, not an accordion item).
export const SECTION_ORDER: SectionId[] = ['background', 'text', 'image', 'layout', 'accessibility']

function Section({ id, headerExtra, children }: {
  id: SectionId
  // Rendered inline in the section's own header row -- currently only
  // Background uses this (its color swatch + orientation toggle).
  headerExtra?: React.ReactNode
  children: React.ReactNode
}) {
  const { title, glyph } = SECTION_META[id]
  return (
    <div>
      <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-zinc-800">
        <span className="w-5 h-5 flex items-center justify-center text-zinc-400 flex-shrink-0">{glyph}</span>
        <span className="text-xs font-semibold text-zinc-300 uppercase tracking-widest flex-1">{title}</span>
        {headerExtra && <span className="flex items-center gap-2 flex-shrink-0">{headerExtra}</span>}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

// Wraps one editable field (or tightly-related cluster of controls for one
// field, e.g. Title's text + its font/weight/color) in its own bordered
// card with a background one shade lighter than the panel behind it --
// gives each thing you're editing a visible boundary instead of everything
// blurring into one continuous column.
function FieldCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">{children}</div>
}

const inputCls = `w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500 transition-colors placeholder-zinc-500`
const labelCls = `block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider`

// 92NY Text has no separate weight variants (unlike Theinhardt) -- disabled
// rather than hidden so the control's presence (and its stored value) stays
// consistent regardless of which font is picked.
function WeightPicker({ value, onChange, disabled }: { value: TheinhardtWeight; onChange: (w: TheinhardtWeight) => void; disabled?: boolean }) {
  const weights: { value: TheinhardtWeight; label: string; fw: number }[] = [
    { value: 'regular', label: 'Regular', fw: 400 },
    { value: 'bold', label: 'Bold', fw: 700 },
    { value: 'heavy', label: 'Heavy', fw: 900 },
  ]
  return (
    <div className="flex gap-1.5">
      {weights.map(w => (
        <button
          key={w.value}
          disabled={disabled}
          onClick={() => onChange(w.value)}
          className={`flex-1 py-1.5 px-2 rounded-md text-xs border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
            value === w.value ? 'bg-white text-black border-white' : 'bg-transparent text-zinc-400 border-zinc-700 hover:border-zinc-500'
          }`}
          style={{ fontFamily: "'Theinhardt', sans-serif", fontWeight: w.fw }}
        >
          {w.label}
        </button>
      ))}
    </div>
  )
}

// Paired numeric input for a FontSizeSlider -- own component so its typing
// state (the raw text being edited) doesn't get clobbered mid-keystroke by
// the `value` prop re-rendering, but still stays in sync with it whenever
// the slider (or a linked field) changes it from outside.
function SliderNumberInput({ value, onChange, min, max, disabled, step = 1, decimals = 0 }: {
  value: number; onChange: (v: number) => void; min: number; max: number; disabled?: boolean
  // Arrow-key increment and the precision the typed/committed value rounds
  // to -- default to whole numbers (every original caller: image size/
  // position/z-index/overlap); line-height sliders pass a fractional step
  // (e.g. 0.01) and decimals=2 so both the arrow-key nudge and manual
  // typing land on the same grid the range slider itself steps by.
  step?: number
  decimals?: number
}) {
  const round = (n: number) => {
    const factor = Math.pow(10, decimals)
    return Math.round(n * factor) / factor
  }

  const [text, setText] = useState(value.toFixed(decimals))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(value.toFixed(decimals))
  }, [value, focused, decimals])

  function commit(raw: string) {
    const parsed = round(Number(raw))
    const clamped = Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : value
    setText(clamped.toFixed(decimals))
    if (clamped !== value) onChange(clamped)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      // Step immediately on each press (not on blur) -- each arrow press is
      // a complete, atomic change, unlike free typing which should only
      // commit once the user is done.
      e.preventDefault()
      const current = round(Number(text))
      const base = Number.isFinite(current) ? current : value
      const next = round(Math.max(min, Math.min(max, base + (e.key === 'ArrowUp' ? step : -step))))
      setText(next.toFixed(decimals))
      if (next !== base) onChange(next)
    } else if (e.key === 'Enter') {
      commit(text)
      e.currentTarget.blur()
    }
  }

  return (
    <input
      type="text"
      inputMode={decimals > 0 ? 'decimal' : 'numeric'}
      value={text}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onChange={e => setText(e.target.value.replace(decimals > 0 ? /[^0-9.-]/g : /[^0-9-]/g, ''))}
      onKeyDown={handleKeyDown}
      onBlur={() => { setFocused(false); commit(text) }}
      className="w-12 text-xs font-mono text-zinc-300 bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-right focus:outline-none focus:border-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed"
    />
  )
}

function FontSizeSlider({ label, value, onChange, min = 24, max = 160, unit = 'px', badge, disabled, numberInput, step = 1, decimals = 0 }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number
  // Displayed after the value (e.g. "px" for a real pixel size, "%" for a
  // percentage-based control like single-image mode's size) — defaults to
  // "px" since that's what most callers are.
  unit?: string
  // Small, unobtrusive indicator of whether `value` came from the heuristic,
  // a manual override, or a "match another field's size" link — omit to
  // render no badge at all.
  badge?: 'auto' | 'manual' | 'linked'
  // Greys out the slider when its value is being driven by something else
  // (e.g. linked to Title's size) rather than adjustable directly here.
  disabled?: boolean
  // Swaps the plain "value + unit" readout for an editable numeric input
  // (type-to-set, Up/Down arrow keys to step by 1, clamped to min/max) --
  // opt-in per caller rather than on by default, since it's currently only
  // requested for image-related controls (size/position/z-index/overlap),
  // not every slider in the panel.
  numberInput?: boolean
  // Range input step -- defaults to 1 (every existing caller is a whole-px
  // or whole-percent control); line-height sliders pass a fractional step.
  step?: number
  // Decimal places shown in the plain (non-numberInput) readout -- defaults
  // to 0 (existing integer callers); line-height sliders pass 2.
  decimals?: number
}) {
  return (
    <div className="mt-1.5">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-zinc-500 flex items-center gap-1.5">
          {label}
          {badge && (
            <span
              title={badge === 'auto' ? 'Auto-suggested from training data' : badge === 'linked' ? 'Linked to another control\'s value' : 'Manually set'}
              className={`text-[9px] uppercase tracking-wide px-1 py-px rounded ${
                badge === 'auto' ? 'text-zinc-500 bg-zinc-800' : badge === 'linked' ? 'text-blue-300 bg-blue-950' : 'text-zinc-300 bg-zinc-700'
              }`}
            >
              {badge}
            </span>
          )}
        </span>
        {numberInput ? (
          <span className="flex items-center gap-1">
            <SliderNumberInput value={value} onChange={onChange} min={min} max={max} disabled={disabled} step={step} decimals={decimals} />
            {unit && <span className="text-xs text-zinc-500">{unit}</span>}
          </span>
        ) : (
          <span className="text-xs font-mono text-zinc-400">{value.toFixed(decimals)}{unit}</span>
        )}
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-white disabled:opacity-40 disabled:cursor-not-allowed" />
    </div>
  )
}

// The gap ABOVE a text block (in the reorderable stack -- Label, Title,
// Subtitle, Subtitle2, Presenters, Program Title, Series Name), relative to
// whichever block currently precedes it in blockOrder. `value` is that
// field's EFFECTIVE margin-top (its own stored override if set, else
// lib/textStackGap.ts's computeAutoMarginTop -- the exact same function
// SlideCanvas.tsx itself calls to render, so this can't silently disagree
// with what's actually on the canvas), so dragging it away from that
// starting point is the ONLY way its badge ever flips from "auto" to
// "manual" -- there's no separate recomputation to track the way font-size
// heuristics need, since the automatic value only ever changes if the
// field's OWN position (or its predecessor) changes, and this always
// re-reads live. NOT the same thing as "Line height" below -- this never
// touches a field's own internal wrapped-line spacing, only the space
// before it.
function MarginTopSlider({ label, value, onChange, badge }: {
  label: string; value: number; onChange: (v: number) => void; badge?: 'auto' | 'manual'
}) {
  return <FontSizeSlider label={label} value={value} onChange={onChange} min={0} max={120} unit="px" badge={badge} numberInput />
}

// Shared by the Layout tab's "Image ↔ Text gap" and "Outer margin" controls
// -- same slider+number-input+arrow-key pattern as font size/margin-top,
// just a wider range (these span whole layout regions, not a single text
// block's own spacing).
function SpacingSlider({ label, value, onChange, badge }: {
  label: string; value: number; onChange: (v: number) => void; badge?: 'auto' | 'manual'
}) {
  return <FontSizeSlider label={label} value={value} onChange={onChange} min={0} max={300} unit="px" badge={badge} numberInput />
}

// Listening Credit's own internal line-height (the gap between ITS OWN
// wrapped lines -- it's often a long paragraph). Distinct from Margin Top
// above: Listening Credit lives in the fixed footer, outside blockOrder
// entirely, so "margin relative to whichever block precedes it" doesn't
// apply to it -- this is a genuinely separate control, not a renamed
// duplicate, which is why it's the one field that still gets a line-height
// slider instead of a margin-top one.
function LineHeightSlider({ label, value, onChange, badge }: {
  label: string; value: number; onChange: (v: number) => void; badge?: 'auto' | 'manual'
}) {
  return <FontSizeSlider label={label} value={value} onChange={onChange} min={0.7} max={1.8} step={0.01} decimals={2} unit="" badge={badge} numberInput />
}

function luminance(hex: string): number {
  const rgb = hex.replace('#', '').match(/.{2}/g)!.map(x => {
    const v = parseInt(x, 16) / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
}

function contrastRatio(a: string, b: string): number {
  const l1 = luminance(a), l2 = luminance(b)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

function WcagBadge({ ratio, label }: { ratio: number; label: string }) {
  const aaa = ratio >= 7, aa = ratio >= 4.5, aaLarge = ratio >= 3
  return (
    <div className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
      <span className="text-xs text-zinc-400">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-zinc-300">{ratio.toFixed(2)}:1</span>
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
          aaa ? 'bg-green-900 text-green-300' : aa ? 'bg-blue-900 text-blue-300' : aaLarge ? 'bg-yellow-900 text-yellow-300' : 'bg-red-900 text-red-300'
        }`}>
          {aaa ? 'AAA' : aa ? 'AA' : aaLarge ? 'AA Large' : 'Fail'}
        </span>
      </div>
    </div>
  )
}

function WcagChecker({ bg, text, accent }: { bg: string; text: string; accent: string }) {
  return (
    <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">
      <WcagBadge ratio={contrastRatio(text, bg)} label="Text on Background" />
      <WcagBadge ratio={contrastRatio(accent, bg)} label="Accent on Background" />
      <WcagBadge ratio={contrastRatio(text, accent)} label="Text on Accent" />
    </div>
  )
}


function LogoUploader({ logos, onChange }: { logos: LogoItem[]; onChange: (logos: LogoItem[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''

    Promise.all(files.map(file => new Promise<LogoItem>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async (ev) => {
        try {
          const rawUrl = ev.target?.result as string
          const url = await resizeImageDataUrl(rawUrl, MAX_LOGO_DIM, 0.9)
          resolve({ id: Math.random().toString(36).slice(2), url, alt: file.name.replace(/\.[^.]+$/, '') })
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    }))).then(newLogos => {
      onChange([...logos, ...newLogos])
    })
  }

  function removeLogo(id: string) {
    onChange(logos.filter(l => l.id !== id))
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
      {logos.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {logos.map(logo => (
            <div key={logo.id} className="relative group">
              <div className="bg-zinc-800 rounded-lg p-2 border border-zinc-700">
                <img src={logo.url} alt={logo.alt} className="h-10 max-w-24 object-contain" />
              </div>
              <button
                onClick={() => removeLogo(logo.id)}
                className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={() => inputRef.current?.click()}
        className="w-full bg-zinc-700 hover:bg-zinc-600 text-white text-sm py-2 px-3 rounded-lg transition-colors"
      >
        {logos.length === 0 ? 'Upload logos' : '+ Add another logo'}
      </button>
      {logos.length > 0 && (
        <p className="text-xs text-zinc-500 mt-1.5">Hover a logo to remove it</p>
      )}
    </div>
  )
}

// Drag-and-drop reorderable list for SlideData.blockOrder -- one row per
// currently-populated text block (an empty field has nothing to reorder,
// so it's left out of the list entirely, same as it's left out of
// SlideCanvas's own render). Reordering moves the dragged key within the
// FULL stored order (including any not-currently-populated blocks), not
// just the visible subset, so a hidden block's relative position is
// preserved rather than getting silently reshuffled the next time it's
// populated.
function BlockOrderList({ data, onChange }: { data: SlideData; onChange: (order: TextBlockKey[]) => void }) {
  const [draggedKey, setDraggedKey] = useState<TextBlockKey | null>(null)
  const [dragOverKey, setDragOverKey] = useState<TextBlockKey | null>(null)

  const fullOrder = resolveBlockOrder(data.blockOrder)
  const visibleKeys = fullOrder.filter(k => isBlockPopulated(data, k))

  // Both the drag handle and the up/down buttons below ultimately go
  // through this one function -- neither can desync from the other since
  // there's only one place that actually computes a new order.
  function moveBefore(key: TextBlockKey, targetKey: TextBlockKey) {
    if (key === targetKey) return
    const without = fullOrder.filter(k => k !== key)
    const targetIdx = without.indexOf(targetKey)
    without.splice(targetIdx, 0, key)
    onChange(without)
  }

  function handleDrop(targetKey: TextBlockKey) {
    setDragOverKey(null)
    if (!draggedKey) return
    moveBefore(draggedKey, targetKey)
    setDraggedKey(null)
  }

  // Moves `key` past its immediately-adjacent VISIBLE neighbor in the
  // given direction. Reuses moveBefore against the full order (not just
  // the visible subset), so a hidden/unpopulated block sitting between
  // them keeps its own relative position instead of getting shuffled.
  function moveStep(key: TextBlockKey, direction: -1 | 1) {
    const idx = visibleKeys.indexOf(key)
    const neighborIdx = idx + direction
    if (neighborIdx < 0 || neighborIdx >= visibleKeys.length) return
    const neighborKey = visibleKeys[neighborIdx]
    if (direction === -1) {
      // Moving up: land directly before the neighbor above.
      moveBefore(key, neighborKey)
    } else {
      // Moving down: land directly after the neighbor below -- i.e.
      // before whatever (visible or hidden) currently follows it, or at
      // the very end if the neighbor is currently last in the full order.
      const without = fullOrder.filter(k => k !== key)
      const neighborPos = without.indexOf(neighborKey)
      const after = without[neighborPos + 1]
      if (after !== undefined) moveBefore(key, after)
      else onChange([...without, key])
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {visibleKeys.map((key, i) => (
        <div
          key={key}
          draggable
          onDragStart={() => setDraggedKey(key)}
          onDragEnd={() => { setDraggedKey(null); setDragOverKey(null) }}
          onDragOver={e => { e.preventDefault(); if (dragOverKey !== key) setDragOverKey(key) }}
          onDrop={e => { e.preventDefault(); handleDrop(key) }}
          className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-sm cursor-grab active:cursor-grabbing transition-colors ${
            draggedKey === key ? 'opacity-40 border-zinc-700 bg-zinc-800'
              : dragOverKey === key ? 'border-white bg-zinc-800 text-white'
              : 'border-zinc-700 bg-zinc-800 text-zinc-300'
          }`}
        >
          <span className="text-zinc-500 select-none" aria-hidden>⠿</span>
          <span className="flex-1">{TEXT_BLOCK_LABELS[key]}</span>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              type="button"
              draggable={false}
              onDragStart={e => e.stopPropagation()}
              onClick={() => moveStep(key, -1)}
              disabled={i === 0}
              title={`Move ${TEXT_BLOCK_LABELS[key]} up`}
              className="w-6 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-zinc-700 disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
            >
              ▲
            </button>
            <button
              type="button"
              draggable={false}
              onDragStart={e => e.stopPropagation()}
              onClick={() => moveStep(key, 1)}
              disabled={i === visibleKeys.length - 1}
              title={`Move ${TEXT_BLOCK_LABELS[key]} down`}
              className="w-6 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-zinc-700 disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
            >
              ▼
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function EditorPanel({
  data, onChange, screenType, onScreenTypeChange, slideRevision, orientation, onOrientationChange,
  activeSection,
}: EditorPanelProps) {
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  // -1 = the single-image slot; >=0 = index into data.staggerImages
  const [cropTarget, setCropTarget] = useState<number>(-1)

  // Once the user manually drags a slider (or manually adjusts an image),
  // stop auto-updating that field for the rest of the session on this
  // slide. Image overrides are keyed by slot (-1 = single-image slot, >=0
  // = stagger index).
  const [titleSizeOverridden, setTitleSizeOverridden] = useState(false)
  const [subtitleSizeOverridden, setSubtitleSizeOverridden] = useState(false)
  const [imageSizeOverridden, setImageSizeOverridden] = useState<Record<number, boolean>>({})

  useEffect(() => {
    setTitleSizeOverridden(false)
    setSubtitleSizeOverridden(false)
    setImageSizeOverridden({})
  }, [slideRevision])

  function set<K extends keyof SlideData>(key: K, value: SlideData[K]) {
    onChange({ ...data, [key]: value })
  }

  // Title/subtitle text and their auto-suggested font size must land in the
  // same onChange call — two sequential `set()` calls here would each
  // spread the same stale `data` closure and the second call would clobber
  // the first's field.
  // Applies a new title size to the given patch, and propagates it to
  // presenters/programTitle too if their "match Title's size" checkbox is
  // on -- called from both the auto-fill path and the manual slider so
  // linked fields never lag behind by an edit.
  function applyTitleSize(patch: Partial<SlideData>, newTitleSize: number) {
    patch.titleSize = newTitleSize
    if (data.presentersMatchTitleSize) patch.presentersSize = newTitleSize
    if (data.programTitleMatchTitleSize) patch.programTitleSize = newTitleSize
  }

  // 92NY Text has no Bold/Heavy variant, so switching a field to it resets a
  // non-Regular weight rather than leaving a now-invalid value stored. Both
  // fields land in one onChange call for the same stale-closure reason as
  // applyTitleSize above.
  function setPresentersFont(font: PresentersFont) {
    const patch: Partial<SlideData> = { presentersFont: font }
    if (font === '92NY Text' && data.presentersWeight !== 'regular') patch.presentersWeight = 'regular'
    onChange({ ...data, ...patch })
  }

  function setProgramTitleFont(font: PresentersFont) {
    const patch: Partial<SlideData> = { programTitleFont: font }
    if (font === '92NY Text' && data.programTitleWeight !== 'regular') patch.programTitleWeight = 'regular'
    onChange({ ...data, ...patch })
  }

  function handleTitleChange(value: string) {
    const patch: Partial<SlideData> = { title: value }
    if (!titleSizeOverridden) {
      const lineCount = Math.max(1, value.split('\n').length)
      applyTitleSize(patch, suggestTitleFontSize(value.length, lineCount, screenType, !!data.subtitle))
    }
    onChange({ ...data, ...patch })
  }

  function handleSubtitleChange(value: string) {
    const patch: Partial<SlideData> = { subtitle: value }
    if (!subtitleSizeOverridden) {
      patch.subtitleSize = suggestSubtitleFontSize(value.length)
    }
    onChange({ ...data, ...patch })
  }

  function updateStaggerImage(index: number, patch: Partial<StaggerImage>) {
    const images = [...(data.staggerImages || [])]
    const existing = images[index]
    images[index] = {
      id: existing?.id ?? Math.random().toString(36).slice(2),
      url: existing?.url ?? '',
      alt: existing?.alt ?? `Image ${index + 1}`,
      x: existing?.x ?? 0,
      y: existing?.y ?? 0,
      scale: existing?.scale ?? 0,
      // Sensible default the first time this slot is created (increasing by
      // slot order); preserved as-is afterward so unrelated edits (moving,
      // resizing, replacing the image) never silently reset a manually-set
      // layer value.
      zIndex: existing?.zIndex ?? (index + 1),
      // Preserved as-is (undefined for images with no detected face) so
      // unrelated edits never silently drop face-crop correction tracking.
      faceCropSuggested: existing?.faceCropSuggested,
      faceCropFinal: existing?.faceCropFinal,
      faceCropWasOverridden: existing?.faceCropWasOverridden,
      ...patch,
    }
    set('staggerImages', images)
  }

  // Sets one stagger slot's scale. Image 1 is the source of truth while
  // linked: updating it also updates Image 2 to match, in the same
  // onChange call (two sequential updateStaggerImage calls would each
  // spread the same stale data.staggerImages closure and the second would
  // clobber the first -- same hazard applyTitleSize's comment above
  // describes). Image 2's own slider is disabled while linked (see render),
  // so this never runs the sync in the other direction.
  function updateStaggerScale(index: number, value: number) {
    const images = [...(data.staggerImages || [])]
    const targets = data.imagesLinkedSize && index === 0 ? [0, 1] : [index]
    for (const i of targets) {
      const existing = images[i]
      images[i] = {
        id: existing?.id ?? Math.random().toString(36).slice(2),
        url: existing?.url ?? '',
        alt: existing?.alt ?? `Image ${i + 1}`,
        x: existing?.x ?? 0,
        y: existing?.y ?? 0,
        scale: value,
        zIndex: existing?.zIndex ?? (i + 1),
        faceCropSuggested: existing?.faceCropSuggested,
        faceCropFinal: existing?.faceCropFinal,
        faceCropWasOverridden: existing?.faceCropWasOverridden,
      }
    }
    set('staggerImages', images)
  }

  // Swaps a slot's layout position with its neighbor (computeStaggerLayout's
  // per-index offsets, e.g. which corner an image lands in). Purely
  // positional -- each image's own zIndex travels with it (it's a field on
  // the StaggerImage object being swapped), so this no longer doubles as a
  // stacking control the way it did before z-index became its own explicit,
  // independently-set value.
  function moveStaggerImage(index: number, direction: -1 | 1) {
    const images = [...(data.staggerImages || [])]
    const target = index + direction
    if (target < 0 || target >= images.length) return
    const a = images[index]
    const b = images[target]
    images[index] = b
    images[target] = a
    set('staggerImages', images)
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>, target: number = -1) {
    const file = e.target.files?.[0]
    if (!file) return
    // A slot that already has an image is a REPLACE, not a fresh upload --
    // once a slot's crop has been set (by auto-detection or by hand), the
    // same "manual override" treatment the rest of this file already gives
    // font sizes/image positions applies here too: swapping the photo
    // underneath it keeps that slot's existing size/position/zIndex/crop
    // exactly as they are rather than re-running face-detection on the new
    // photo and silently overwriting them. (If the new image's aspect ratio
    // differs a lot from the old one, the retained crop may look off on it
    // -- an accepted tradeoff; "Edit crop" still re-opens to adjust it by
    // hand, same as always.)
    const existingUrl = target >= 0 ? data.staggerImages?.[target]?.url : data.imageUrl
    const isReplace = !!existingUrl
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const rawUrl = ev.target?.result as string
      if (isReplace) {
        if (target >= 0) {
          updateStaggerImage(target, { url: rawUrl })
        } else {
          set('imageUrl', rawUrl)
        }
        return
      }
      // Dynamically imported rather than a normal top-level import -- this
      // module pulls in @vladmandic/face-api (and, transitively,
      // @tensorflow/tfjs), which crashed Next's server-side page prerendering
      // for /train when it was statically imported (tfjs runs environment
      // setup at module-init time, which doesn't work in Next's server
      // runtime). A dynamic import keeps that whole dependency graph out of
      // any server-evaluated bundle, matching why CropModal is already
      // loaded via next/dynamic with ssr: false.
      const [{ detectFaceCropBox }, { cropImageByRatioBox }] = await Promise.all([
        import('@/lib/faceDetect'),
        import('@/lib/cropImage'),
      ])
      const detection = await detectFaceCropBox(rawUrl).catch((e: unknown) => {
        console.warn('Face detection failed, skipping auto-crop', e)
        return null
      })
      if (detection) {
        // A face was found -- auto-crop immediately with a standard headshot
        // framing, same "auto-applied but overridable" pattern as font size:
        // the user can still fine-tune via "Edit crop" afterward (which
        // shows this already-cropped result as its starting point), but
        // doesn't have to open the crop modal just to accept a sensible
        // default for the common case.
        const croppedUrl = await cropImageByRatioBox(rawUrl, detection.cropBox)
        applyAutoCroppedImage(target, croppedUrl, detection.cropBox)
      } else {
        // No face detected (book cover, poster, graphic, or detection
        // failed) -- unchanged from before this feature: open the crop
        // modal so the user frames it manually.
        setCropTarget(target)
        setCropSrc(rawUrl)
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function applyAutoCroppedImage(target: number, croppedUrl: string, cropBox: FaceCropBox) {
    if (target >= 0) {
      updateStaggerImage(target, {
        url: croppedUrl,
        faceCropSuggested: cropBox,
        faceCropFinal: cropBox,
        faceCropWasOverridden: false,
      })
    } else {
      // TODO: the app doesn't classify uploaded images by content beyond
      // face-or-not yet -- until it does, a detected face still gets the
      // generic "other" sizing suggestion rather than a face-specific one.
      const suggestion = suggestImagePosition('other', screenType)
      const patch: Partial<SlideData> = {
        imageUrl: croppedUrl,
        imageFaceCropSuggested: cropBox,
        imageFaceCropFinal: cropBox,
        imageFaceCropWasOverridden: false,
      }
      if (!imageSizeOverridden[-1]) {
        // suggestion.width is a ratio of the FULL slide width already, so
        // this is a direct pixel conversion, not the old percent-of-column
        // approximation.
        patch.imageSize = Math.max(MIN_IMAGE_SIZE_PX, Math.min(MAX_IMAGE_SIZE_PX, Math.round(suggestion.width * CANVAS_WIDTH[orientation])))
        patch.imageSizeIsPixels = true
      }
      onChange({ ...data, ...patch })
    }
  }

  function clearImage() {
    set('imageUrl', '')
    setImageSizeOverridden(prev => ({ ...prev, [-1]: false }))
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  function handleCropComplete(croppedUrl: string, cropBox: FaceCropBox) {
    if (cropTarget >= 0) {
      // Stagger mode intentionally gets NO auto-sizing here: the shared
      // layout math in SlideCanvas.tsx (offsetX/shiftStep/lefts/tops) spaces
      // images based only on data.staggerSize, while each image's own
      // rendered width falls back to img.scale when set. Auto-applying a
      // suggestFontSize-style width (fit for one large single-image slide)
      // to an individual stagger image's `scale` made it render far wider
      // than the space the layout allocated for it, badly overlapping its
      // neighbors. suggestImagePosition was fit on single-image_1 training
      // data only and has no valid mapping onto this shared-layout model, so
      // stagger images just keep using the existing staggerSize/manual-scale
      // behavior, unchanged from before auto-fill existed.
      const hadSuggestion = !!data.staggerImages?.[cropTarget]?.faceCropSuggested
      updateStaggerImage(cropTarget, {
        url: croppedUrl,
        faceCropFinal: cropBox,
        // Only a face-detected auto-crop counts as something to "override" --
        // a manual crop on an image that was never auto-cropped (no face
        // found) has nothing to compare against, so this stays unset rather
        // than false.
        ...(hadSuggestion ? { faceCropWasOverridden: true } : {}),
      })
    } else {
      // TODO: the app doesn't classify uploaded images by content yet (e.g.
      // a quick vision API call to detect a face/book-cover/poster/etc.) —
      // until it does, every upload gets the generic "other" default rather
      // than a more accurate type-specific one.
      const suggestion = suggestImagePosition('other', screenType)
      const patch: Partial<SlideData> = { imageUrl: croppedUrl, imageFaceCropFinal: cropBox }
      if (data.imageFaceCropSuggested) patch.imageFaceCropWasOverridden = true
      if (!imageSizeOverridden[-1]) {
        patch.imageSize = Math.max(MIN_IMAGE_SIZE_PX, Math.min(MAX_IMAGE_SIZE_PX, Math.round(suggestion.width * CANVAS_WIDTH[orientation])))
        patch.imageSizeIsPixels = true
      }
      onChange({ ...data, ...patch })
    }
    setCropSrc(null)
  }

  return (
    <>
      {cropSrc && (
        <CropModal
          imageSrc={cropSrc}
          onComplete={handleCropComplete}
          onCancel={() => setCropSrc(null)}
        />
      )}

      <div className="flex gap-0 text-white h-full min-h-0">

        {/* The one active section. The icon rail that picks it lives
            outside this component now (page.tsx renders it as its own
            leftmost column), so this is just the content pane. */}
        <div className="flex-1 min-w-0 overflow-y-auto custom-scrollbar pr-1">

          {activeSection === 'background' && (
            <Section id="background">
              <FieldCard>
                <p className="text-xs text-zinc-500 mb-2">Background color</p>
                <ColorPalette value={data.backgroundColor} onChange={v => set('backgroundColor', v)} inline />
              </FieldCard>
              <FieldCard>
                <p className="text-xs text-zinc-500 mb-2">Orientation</p>
                <div className="flex gap-1 bg-zinc-800 p-1 rounded-lg">
                  {(['landscape', 'portrait'] as Orientation[]).map(o => (
                    <button key={o}
                      onClick={() => onOrientationChange(o)}
                      className={`flex-1 text-xs px-3 py-1.5 rounded-md transition-colors font-medium ${
                        orientation === o ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {o === 'landscape' ? '16:9' : '9:16'}
                    </button>
                  ))}
                </div>
              </FieldCard>
              <FieldCard>
                <p className="text-xs text-zinc-500 mb-2">Screen type</p>
                <p className="text-xs text-zinc-600 mb-2">Which kind of screen this slide is meant for -- recorded as training-data ground truth on export.</p>
                <div className="flex gap-1 bg-zinc-800 p-1 rounded-lg">
                  {(['projector', 'lobby'] as ScreenType[]).map(t => (
                    <button key={t}
                      onClick={() => onScreenTypeChange(t)}
                      className={`flex-1 text-xs px-3 py-1.5 rounded-md transition-colors font-medium ${
                        screenType === t ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {t === 'projector' ? 'Projector' : 'Lobby'}
                    </button>
                  ))}
                </div>
              </FieldCard>
            </Section>
          )}

          {activeSection === 'text' && (
            <Section id="text">
              <FieldCard>
                <label className={labelCls}>Label (e.g. TONIGHT)</label>
                <input className={inputCls} value={data.label} onChange={e => set('label', e.target.value)} placeholder="TONIGHT" />
                <div className="mt-1.5"><WeightPicker value={data.labelWeight} onChange={v => set('labelWeight', v)} /></div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-xs text-zinc-500">Color</span>
                  <ColorPalette value={data.labelColor ?? data.textColor} onChange={v => set('labelColor', v)} />
                </div>
                <MarginTopSlider label="Margin top" value={effectiveMarginTop(data, 'label')}
                  onChange={v => set('labelMarginTop', v)} badge={data.labelMarginTop !== undefined ? 'manual' : 'auto'} />
              </FieldCard>

              <FieldCard>
                <label className={labelCls}>Title</label>
                <textarea className={inputCls + ' resize-none'} rows={4} value={data.title} onChange={e => handleTitleChange(e.target.value)} placeholder="Event title" />
                <div className="mt-1.5 flex gap-1.5">
                  {(['92NY Text', 'Theinhardt Heavy'] as const).map(font => (
                    <button key={font}
                      onClick={() => set('titleFont', font)}
                      className={`flex-1 text-xs py-1.5 rounded-md border transition-colors ${
                        (data.titleFont ?? '92NY Text') === font
                          ? 'bg-white text-black border-white font-medium'
                          : 'bg-transparent text-zinc-400 border-zinc-700 hover:border-zinc-500'
                      }`}>
                      {font}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <input type="checkbox" id="titleItalic" checked={data.titleItalic} onChange={e => set('titleItalic', e.target.checked)} className="rounded" />
                  <label htmlFor="titleItalic" className="text-sm text-zinc-300">Italic</label>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-xs text-zinc-500">Color</span>
                  <ColorPalette value={data.accentColor} onChange={v => set('accentColor', v)} />
                </div>
                <FontSizeSlider label="Font size" value={data.titleSize}
                  onChange={v => {
                    setTitleSizeOverridden(true)
                    const patch: Partial<SlideData> = {}
                    applyTitleSize(patch, v)
                    onChange({ ...data, ...patch })
                  }}
                  min={24} max={250} badge={titleSizeOverridden ? 'manual' : 'auto'} />
                <div className="mt-1.5 flex flex-col gap-1">
                  <label className="flex items-center gap-2 text-xs text-zinc-400">
                    <input type="checkbox" checked={data.presentersMatchTitleSize} className="rounded"
                      onChange={e => {
                        const checked = e.target.checked
                        const patch: Partial<SlideData> = { presentersMatchTitleSize: checked }
                        if (checked) patch.presentersSize = data.titleSize
                        onChange({ ...data, ...patch })
                      }} />
                    Match Presenters font size to Title
                  </label>
                  <label className="flex items-center gap-2 text-xs text-zinc-400">
                    <input type="checkbox" checked={data.programTitleMatchTitleSize} className="rounded"
                      onChange={e => {
                        const checked = e.target.checked
                        const patch: Partial<SlideData> = { programTitleMatchTitleSize: checked }
                        if (checked) patch.programTitleSize = data.titleSize
                        onChange({ ...data, ...patch })
                      }} />
                    Match Program / Work Title font size to Title
                  </label>
                </div>
                <MarginTopSlider label="Margin top" value={effectiveMarginTop(data, 'title')}
                  onChange={v => set('titleMarginTop', v)} badge={data.titleMarginTop !== undefined ? 'manual' : 'auto'} />
              </FieldCard>

              <FieldCard>
                <label className={labelCls}>Subtitle</label>
                <input className={inputCls} value={data.subtitle} onChange={e => handleSubtitleChange(e.target.value)} placeholder='e.g. "with"' />
                <div className="mt-1.5"><WeightPicker value={data.subtitleWeight} onChange={v => set('subtitleWeight', v)} /></div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-xs text-zinc-500">Color</span>
                  <ColorPalette value={data.subtitleColor ?? data.textColor} onChange={v => set('subtitleColor', v)} />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input type="checkbox" id="subtitleInline" checked={data.subtitleInline} onChange={e => set('subtitleInline', e.target.checked)} className="rounded" />
                  <label htmlFor="subtitleInline" className="text-sm text-zinc-300">
                    Inline before first presenter <span className="text-zinc-500">(75% size)</span>
                  </label>
                </div>
                <FontSizeSlider label="Font size" value={data.subtitleSize}
                  onChange={v => { setSubtitleSizeOverridden(true); set('subtitleSize', v) }}
                  min={16} max={120} badge={subtitleSizeOverridden ? 'manual' : 'auto'} />
                <MarginTopSlider label="Margin top" value={effectiveMarginTop(data, 'subtitle')}
                  onChange={v => set('subtitleMarginTop', v)} badge={data.subtitleMarginTop !== undefined ? 'manual' : 'auto'} />
              </FieldCard>

              <FieldCard>
                <label className={labelCls}>Subtitle 2</label>
                <input className={inputCls} value={data.subtitle2} onChange={e => set('subtitle2', e.target.value)} placeholder="Optional second line" />
                <div className="mt-1.5"><WeightPicker value={data.subtitle2Weight} onChange={v => set('subtitle2Weight', v)} /></div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-xs text-zinc-500">Color</span>
                  <ColorPalette value={data.subtitle2Color ?? data.textColor} onChange={v => set('subtitle2Color', v)} />
                </div>
                <FontSizeSlider label="Font size" value={data.subtitle2Size} onChange={v => set('subtitle2Size', v)} min={16} max={120} />
                <MarginTopSlider label="Margin top" value={effectiveMarginTop(data, 'subtitle2')}
                  onChange={v => set('subtitle2MarginTop', v)} badge={data.subtitle2MarginTop !== undefined ? 'manual' : 'auto'} />
              </FieldCard>

              <FieldCard>
                <label className={labelCls}>Presenters (one per line)</label>
                <textarea className={inputCls + ' resize-none font-mono'} rows={4} value={data.presenters}
                  onChange={e => set('presenters', e.target.value)} placeholder={"Name One,\nName Two\n& Name Three"} />
                <div className="mt-1.5 flex gap-1.5">
                  {(['Theinhardt', '92NY Text'] as const).map(font => (
                    <button key={font}
                      onClick={() => setPresentersFont(font)}
                      className={`flex-1 text-xs py-1.5 rounded-md border transition-colors ${
                        (data.presentersFont ?? 'Theinhardt') === font
                          ? 'bg-white text-black border-white font-medium'
                          : 'bg-transparent text-zinc-400 border-zinc-700 hover:border-zinc-500'
                      }`}>
                      {font}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <input type="checkbox" id="presentersItalic" checked={data.presentersItalic} onChange={e => set('presentersItalic', e.target.checked)} className="rounded" />
                  <label htmlFor="presentersItalic" className="text-sm text-zinc-300">Italic</label>
                </div>
                <div className="mt-1.5">
                  <WeightPicker value={data.presentersWeight} onChange={v => set('presentersWeight', v)}
                    disabled={(data.presentersFont ?? 'Theinhardt') === '92NY Text'} />
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-xs text-zinc-500">Color</span>
                  <ColorPalette value={data.presentersColor ?? data.textColor} onChange={v => set('presentersColor', v)} />
                </div>
                <FontSizeSlider label="Font size" value={data.presentersMatchTitleSize ? data.titleSize : data.presentersSize}
                  onChange={v => set('presentersSize', v)} min={24} max={250}
                  disabled={data.presentersMatchTitleSize} badge={data.presentersMatchTitleSize ? 'linked' : undefined} />
                <MarginTopSlider label="Margin top" value={effectiveMarginTop(data, 'presenters')}
                  onChange={v => set('presentersMarginTop', v)} badge={data.presentersMarginTop !== undefined ? 'manual' : 'auto'} />
              </FieldCard>

              <FieldCard>
                <label className={labelCls}>Program / Work Title</label>
                <input className={inputCls} value={data.programTitle} onChange={e => set('programTitle', e.target.value)} placeholder='e.g. "American Caprices"' />
                <div className="mt-1.5 flex gap-1.5">
                  {(['Theinhardt', '92NY Text'] as const).map(font => (
                    <button key={font}
                      onClick={() => setProgramTitleFont(font)}
                      className={`flex-1 text-xs py-1.5 rounded-md border transition-colors ${
                        (data.programTitleFont ?? 'Theinhardt') === font
                          ? 'bg-white text-black border-white font-medium'
                          : 'bg-transparent text-zinc-400 border-zinc-700 hover:border-zinc-500'
                      }`}>
                      {font}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <input type="checkbox" id="programTitleItalic" checked={data.programTitleItalic} onChange={e => set('programTitleItalic', e.target.checked)} className="rounded" />
                  <label htmlFor="programTitleItalic" className="text-sm text-zinc-300">Italic</label>
                </div>
                <div className="mt-1.5">
                  <WeightPicker value={data.programTitleWeight} onChange={v => set('programTitleWeight', v)}
                    disabled={(data.programTitleFont ?? 'Theinhardt') === '92NY Text'} />
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-xs text-zinc-500">Color</span>
                  <ColorPalette value={data.programTitleColor ?? data.textColor} onChange={v => set('programTitleColor', v)} />
                </div>
                <FontSizeSlider label="Font size" value={data.programTitleMatchTitleSize ? data.titleSize : data.programTitleSize}
                  onChange={v => set('programTitleSize', v)} min={24} max={250}
                  disabled={data.programTitleMatchTitleSize} badge={data.programTitleMatchTitleSize ? 'linked' : undefined} />
                <MarginTopSlider label="Margin top" value={effectiveMarginTop(data, 'programTitle')}
                  onChange={v => set('programTitleMarginTop', v)} badge={data.programTitleMarginTop !== undefined ? 'manual' : 'auto'} />
              </FieldCard>

              <FieldCard>
                <div className="flex items-center gap-2 mb-2">
                  <input type="checkbox" id="showSeriesName" checked={data.showSeriesName}
                    onChange={e => set('showSeriesName', e.target.checked)} className="rounded" />
                  <label htmlFor="showSeriesName" className="text-sm text-zinc-300 font-medium">Series name</label>
                </div>
                {data.showSeriesName && (
                  <>
                    <input className={inputCls} value={data.seriesName}
                      onChange={e => set('seriesName', e.target.value)}
                      placeholder="RECANATI-KAPLAN TALKS" />
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-xs text-zinc-500">Color</span>
                      <ColorPalette value={data.seriesNameColor ?? data.textColor} onChange={v => set('seriesNameColor', v)} />
                    </div>
                    <MarginTopSlider label="Margin top" value={effectiveSeriesNameMarginTop(data)}
                      onChange={v => set('seriesNameMarginTop', v)} badge={data.seriesNameMarginTop !== undefined ? 'manual' : 'auto'} />
                  </>
                )}
              </FieldCard>

              <FieldCard>
                <div className="flex items-center gap-2 mb-2">
                  <input type="checkbox" id="showListeningCredit" checked={data.showListeningCredit}
                    onChange={e => set('showListeningCredit', e.target.checked)} className="rounded" />
                  <label htmlFor="showListeningCredit" className="text-sm text-zinc-300 font-medium">Listening credit</label>
                </div>
                {data.showListeningCredit && (
                  <>
                    <textarea className={inputCls + ' resize-none'} rows={4}
                      value={data.listeningCredit}
                      onChange={e => set('listeningCredit', e.target.value)}
                      placeholder="Assistive listening devices..." />
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-xs text-zinc-500">Color</span>
                      <ColorPalette value={data.listeningCreditColor ?? data.textColor} onChange={v => set('listeningCreditColor', v)} />
                    </div>
                    <LineHeightSlider label="Line height" value={data.listeningCreditLineHeight ?? DEFAULT_LISTENING_CREDIT_LINE_HEIGHT}
                      onChange={v => set('listeningCreditLineHeight', v)} badge={data.listeningCreditLineHeight !== undefined ? 'manual' : 'auto'} />
                  </>
                )}
              </FieldCard>
            </Section>
          )}

          {activeSection === 'image' && (
            <Section id="image">
              <FieldCard>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    'single', 'two-stagger',
                    'three-stagger', 'three-triangle',
                    'four-stagger', 'four-squared',
                    'none',
                  ] as ImageMode[]).map(mode => (
                    <button key={mode}
                      onClick={() => set('imageMode', mode)}
                      className={`text-xs py-1.5 rounded-md border transition-colors ${
                        data.imageMode === mode
                          ? 'bg-white text-black border-white font-medium'
                          : 'bg-transparent text-zinc-400 border-zinc-700 hover:border-zinc-500'
                      }`}>
                      {mode === 'single' ? '1 image'
                        : mode === 'two-stagger' ? '2 staggered'
                        : mode === 'three-stagger' ? '3 staggered'
                        : mode === 'three-triangle' ? '3 triangle'
                        : mode === 'four-stagger' ? '4 staggered'
                        : mode === 'four-squared' ? '4 squared'
                        : 'No image'}
                    </button>
                  ))}
                </div>
              </FieldCard>

              {data.imageMode === 'none' && (
                <p className="text-xs text-zinc-500">No image — all text is centered on the slide.</p>
              )}

              {data.imageMode === 'single' && (
                <FieldCard>
                  <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, -1)} />
                  <p className="text-xs text-zinc-500 mb-1.5">Image</p>
                  <div className="flex gap-2">
                    <button onClick={() => imageInputRef.current?.click()}
                      className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white text-sm py-2 px-3 rounded-lg transition-colors">
                      {data.imageUrl ? 'Replace' : 'Upload'}
                    </button>
                    {data.imageUrl && (
                      <button onClick={clearImage} className="bg-zinc-800 hover:bg-red-900 text-zinc-400 hover:text-white text-sm py-2 px-3 rounded-lg transition-colors">
                        Remove
                      </button>
                    )}
                  </div>
                  {data.imageUrl && (
                    <div className="mt-2 rounded-lg overflow-hidden border border-zinc-700 bg-zinc-950 group relative cursor-pointer"
                      onClick={() => { setCropTarget(-1); setCropSrc(data.imageUrl) }}>
                      <img src={data.imageUrl} alt="Preview" className="max-h-20 mx-auto object-contain p-2" />
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-xs font-medium">Edit crop</span>
                      </div>
                    </div>
                  )}
                  {data.imageUrl && (
                    <div className="mt-2">
                      <FontSizeSlider label="Image size" value={effectiveImageSizePx(data, orientation)}
                        onChange={v => {
                          setImageSizeOverridden(prev => ({ ...prev, [-1]: true }))
                          onChange({ ...data, imageSize: v, imageSizeIsPixels: true })
                        }}
                        min={MIN_IMAGE_SIZE_PX} max={MAX_IMAGE_SIZE_PX} unit="px" badge={imageSizeOverridden[-1] ? 'manual' : 'auto'} numberInput />
                    </div>
                  )}
                </FieldCard>
              )}

              {staggerCount(data.imageMode) > 0 && (
                <>
                  {Array.from({ length: staggerCount(data.imageMode) }).map((_, i) => {
                    const img = data.staggerImages?.[i]
                    const position = staggerSlotLabel(data.imageMode, i)
                    const prevImg = data.staggerImages?.[i - 1]
                    const nextImg = data.staggerImages?.[i + 1]
                    return (
                      <FieldCard key={i}>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-xs text-zinc-500">Image {i + 1} {position}</p>
                          {img?.url && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => moveStaggerImage(i, -1)}
                                disabled={i === 0 || !prevImg?.url}
                                title="Swap layout position with the previous slot"
                                className="text-xs px-1.5 py-0.5 rounded text-zinc-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                              >
                                ◀
                              </button>
                              <button
                                onClick={() => moveStaggerImage(i, 1)}
                                disabled={!nextImg?.url}
                                title="Swap layout position with the next slot"
                                className="text-xs px-1.5 py-0.5 rounded text-zinc-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                              >
                                ▶
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <label className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white text-sm py-2 px-3 rounded-lg transition-colors text-center cursor-pointer">
                            {img?.url ? 'Replace' : 'Upload'}
                            <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, i)} />
                          </label>
                          {img?.url && (
                            <button onClick={() => updateStaggerImage(i, { url: '' })}
                              className="bg-zinc-800 hover:bg-red-900 text-zinc-400 hover:text-white text-sm py-2 px-3 rounded-lg transition-colors">
                              Remove
                            </button>
                          )}
                        </div>
                        {img?.url && (
                          <div className="mt-2 rounded-lg overflow-hidden border border-zinc-700 bg-zinc-950 group relative cursor-pointer"
                            onClick={() => { setCropTarget(i); setCropSrc(img.url) }}>
                            <img src={img.url} alt="Preview" className="max-h-20 mx-auto object-contain p-2" />
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-white text-xs font-medium">Edit crop</span>
                            </div>
                          </div>
                        )}
                        <div className="mt-2">
                          <FontSizeSlider label={`Image ${i + 1} size (override)`} value={img?.scale || data.staggerSize || 250}
                            onChange={v => updateStaggerScale(i, v)}
                            min={80} max={800}
                            disabled={data.imagesLinkedSize && i === 1}
                            badge={data.imagesLinkedSize && (i === 0 || i === 1) ? 'linked' : undefined}
                            numberInput />
                        </div>
                        {i === 1 && (
                          <label className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                            <input type="checkbox" checked={data.imagesLinkedSize} className="rounded"
                              onChange={e => {
                                const checked = e.target.checked
                                const patch: Partial<SlideData> = { imagesLinkedSize: checked }
                                if (checked) {
                                  const img0Scale = data.staggerImages?.[0]?.scale || data.staggerSize || 250
                                  const images = [...(data.staggerImages || [])]
                                  const existing1 = images[1]
                                  images[1] = {
                                    id: existing1?.id ?? Math.random().toString(36).slice(2),
                                    url: existing1?.url ?? '',
                                    alt: existing1?.alt ?? 'Image 2',
                                    x: existing1?.x ?? 0,
                                    y: existing1?.y ?? 0,
                                    scale: img0Scale,
                                    zIndex: existing1?.zIndex ?? 2,
                                    faceCropSuggested: existing1?.faceCropSuggested,
                                    faceCropFinal: existing1?.faceCropFinal,
                                    faceCropWasOverridden: existing1?.faceCropWasOverridden,
                                  }
                                  patch.staggerImages = images
                                }
                                onChange({ ...data, ...patch })
                              }} />
                            Link size (Image 1 &amp; 2)
                          </label>
                        )}
                        <div className="mt-2">
                          <FontSizeSlider label={`Image ${i + 1} X`} value={img?.x ?? 0} onChange={v => updateStaggerImage(i, { x: v })} min={-600} max={600} numberInput />
                        </div>
                        <div className="mt-2">
                          <FontSizeSlider label={`Image ${i + 1} Y`} value={img?.y ?? 0} onChange={v => updateStaggerImage(i, { y: v })} min={-600} max={600} numberInput />
                        </div>
                        <div className="mt-2">
                          <FontSizeSlider label={`Image ${i + 1} layer`} value={img?.zIndex ?? (i + 1)}
                            onChange={v => updateStaggerImage(i, { zIndex: v })}
                            min={1} max={10} unit="" numberInput />
                        </div>
                      </FieldCard>
                    )
                  })}
                  <FieldCard>
                    <FontSizeSlider label="Image width" value={data.staggerSize ?? 250} onChange={v => set('staggerSize', v)} min={80} max={800} numberInput />
                    <div className="mt-2">
                      <FontSizeSlider label="Overlap" value={data.imageOverlap ?? 30} onChange={v => set('imageOverlap', v)} min={0} max={60} numberInput />
                    </div>
                  </FieldCard>
                </>
              )}

              <FieldCard>
                <p className="text-xs text-zinc-500 mb-1.5">Logo bar</p>
                <LogoUploader logos={data.logos || []} onChange={logos => set('logos', logos)} />
                <div className="mt-2">
                  <FontSizeSlider label="Logo height" value={data.logoSize || 60} onChange={v => set('logoSize', v)} min={30} max={200} />
                </div>
              </FieldCard>
            </Section>
          )}

          {activeSection === 'layout' && (
            <Section id="layout">
              <FieldCard>
                <label className={labelCls}>{orientation === 'portrait' ? 'Image position' : 'Image side'}</label>
                <button
                  onClick={() => set('imageSide', data.imageSide === 'right' ? 'left' : 'right')}
                  className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm py-2 px-3 rounded-lg transition-colors"
                  title={orientation === 'portrait'
                    ? 'Swap whether the image sits on top of or below the text'
                    : 'Swap which side the image sits on vs. the text'}
                >
                  <span>⇄</span> {orientation === 'portrait'
                    ? `Flip (image ${data.imageSide === 'right' ? 'bottom' : 'top'})`
                    : `Flip (image ${data.imageSide === 'right' ? 'right' : 'left'})`}
                </button>
              </FieldCard>

              {data.imageMode !== 'none' && (
                <FieldCard>
                  <label className={labelCls}>Image ↔ Text gap</label>
                  {orientation === 'landscape' ? (
                    <SpacingSlider label="Gap" value={effectiveImageTextGapLandscape(data)}
                      onChange={v => set('imageTextGapLandscape', v)}
                      badge={data.imageTextGapLandscape !== undefined ? 'manual' : 'auto'} />
                  ) : (
                    <SpacingSlider label="Gap" value={effectiveImageTextGapPortrait(data)}
                      onChange={v => set('imageTextGapPortrait', v)}
                      badge={data.imageTextGapPortrait !== undefined ? 'manual' : 'auto'} />
                  )}
                </FieldCard>
              )}

              <FieldCard>
                <label className={labelCls}>Outer margin</label>
                <p className="text-xs text-zinc-500 mb-1">Space between the slide's edges and the image/text content, applied equally on all four sides.</p>
                <SpacingSlider label="Margin" value={effectiveContentMargin(data, 80)}
                  onChange={v => set('contentMargin', v)}
                  badge={data.contentMargin !== undefined ? 'manual' : 'auto'} />
              </FieldCard>

              <FieldCard>
                <label className={labelCls}>Text alignment</label>
                {/* Highlights against a plain 'left' fallback rather than the
                    canvas's actual mode-dependent historical default (which
                    needs orientation, not passed to this panel) -- purely
                    cosmetic until the user picks one explicitly, which this
                    button does immediately regardless. */}
                <div className="flex gap-1 bg-zinc-800 p-1 rounded-lg">
                  {(['left', 'center'] as const).map(align => (
                    <button
                      key={align}
                      onClick={() => set('textAlign', align)}
                      className={`flex-1 text-xs px-3 py-1.5 rounded-md transition-colors font-medium ${
                        (data.textAlign ?? 'left') === align ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {align === 'left' ? 'Left' : 'Center'}
                    </button>
                  ))}
                </div>
              </FieldCard>

              <FieldCard>
                <label className={labelCls}>Text block order</label>
                <p className="text-xs text-zinc-500 mb-2">Drag to reorder. Only fields with content are listed.</p>
                <BlockOrderList data={data} onChange={order => set('blockOrder', order)} />
              </FieldCard>
            </Section>
          )}

          {activeSection === 'accessibility' && (
            <Section id="accessibility">
              <WcagChecker bg={data.backgroundColor} text={data.textColor} accent={data.accentColor} />
            </Section>
          )}

        </div>

      </div>
    </>
  )
}