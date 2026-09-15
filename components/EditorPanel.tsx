'use client'

import { SlideData, TheinhardtWeight, LogoItem, StaggerImage, ImageMode, staggerCount, Orientation } from '@/lib/types'
import { ScreenType } from '@/lib/trainTypes'
import { useRef, useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { resizeImageDataUrl } from '@/lib/resizeImage'
import ColorPalette from './ColorPalette'
import { suggestTitleFontSize, suggestSubtitleFontSize, suggestImagePosition } from '@/lib/slideHeuristics'

const MAX_LOGO_DIM = 400

// Real pixel dimensions the slide renders at — needed to convert the image
// heuristic's width_ratio (0-1 of full slide width) into an absolute pixel
// size for stagger mode's "scale" control.
const DIMS: Record<Orientation, { w: number; h: number }> = {
  landscape: { w: 1920, h: 1080 },
  portrait: { w: 1080, h: 1920 },
}

function staggerSlotLabel(mode: ImageMode, i: number): string {
  if (mode === 'three-triangle') return ['(top-left)', '(top-right)', '(bottom)'][i] ?? ''
  if (mode === 'four-squared') return ['(top-left)', '(top-right)', '(bottom-left)', '(bottom-right)'][i] ?? ''
  const count = staggerCount(mode)
  return i === 0 ? '(back)' : i === count - 1 ? '(front)' : `(${i + 1})`
}

const CropModal = dynamic(() => import('./CropModal'), { ssr: false })

interface EditorPanelProps {
  data: SlideData
  onChange: (data: SlideData) => void
  // Read-only here -- used only to parameterize the heuristic auto-fill
  // calls below. The control for setting it lives near the Export buttons
  // in page.tsx now, since that's what it actually affects (training-data
  // logging on export), not anything in this panel.
  screenType: ScreenType
  orientation: Orientation
  // Bumped by the parent whenever a genuinely new slide/template is loaded
  // (not on ordinary field edits) — resets the heuristic "manually
  // overridden" flags below so a fresh slide gets auto-suggestions again.
  slideRevision: number
}

const inputCls = `w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500 transition-colors placeholder-zinc-500`
const labelCls = `block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider`
const sectionCls = `border-b border-zinc-800 pb-5 mb-5`

function WeightPicker({ value, onChange }: { value: TheinhardtWeight; onChange: (w: TheinhardtWeight) => void }) {
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
          onClick={() => onChange(w.value)}
          className={`flex-1 py-1.5 px-2 rounded-md text-xs border transition-colors ${
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

function FontSizeSlider({ label, value, onChange, min = 24, max = 160, unit = 'px', badge }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number
  // Displayed after the value (e.g. "px" for a real pixel size, "%" for a
  // percentage-based control like single-image mode's size) — defaults to
  // "px" since that's what most callers are.
  unit?: string
  // Small, unobtrusive indicator of whether `value` came from the heuristic
  // or a manual override — omit to render no badge at all.
  badge?: 'auto' | 'manual'
}) {
  return (
    <div className="mt-1.5">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-zinc-500 flex items-center gap-1.5">
          {label}
          {badge && (
            <span
              title={badge === 'auto' ? 'Auto-suggested from training data' : 'Manually set'}
              className={`text-[9px] uppercase tracking-wide px-1 py-px rounded ${
                badge === 'auto' ? 'text-zinc-500 bg-zinc-800' : 'text-zinc-300 bg-zinc-700'
              }`}
            >
              {badge}
            </span>
          )}
        </span>
        <span className="text-xs font-mono text-zinc-400">{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={1} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-white" />
    </div>
  )
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

export default function EditorPanel({
  data, onChange, screenType, orientation, slideRevision,
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
  function handleTitleChange(value: string) {
    const patch: Partial<SlideData> = { title: value }
    if (!titleSizeOverridden) {
      const lineCount = Math.max(1, value.split('\n').length)
      patch.titleSize = suggestTitleFontSize(value.length, lineCount, screenType, !!data.subtitle)
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
      y: existing?.y ?? 0,
      scale: existing?.scale ?? 0,
      ...patch,
    }
    set('staggerImages', images)
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>, target: number = -1) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setCropTarget(target)
      setCropSrc(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function clearImage() {
    set('imageUrl', '')
    setImageSizeOverridden(prev => ({ ...prev, [-1]: false }))
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  function handleCropComplete(croppedUrl: string) {
    // TODO: the app doesn't classify uploaded images by content yet (e.g. a
    // quick vision API call to detect a face/book-cover/poster/etc.) — until
    // it does, every upload gets the generic "other" default rather than a
    // more accurate type-specific one.
    const suggestion = suggestImagePosition('other', screenType)

    if (cropTarget >= 0) {
      const patch: Partial<StaggerImage> = { url: croppedUrl }
      if (!imageSizeOverridden[cropTarget]) {
        patch.scale = Math.max(80, Math.min(800, Math.round(suggestion.width * DIMS[orientation].w)))
      }
      updateStaggerImage(cropTarget, patch)
    } else {
      const patch: Partial<SlideData> = { imageUrl: croppedUrl }
      if (!imageSizeOverridden[-1]) {
        patch.imageSize = Math.max(20, Math.min(200, Math.round(suggestion.width * 100)))
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

      <div className="flex flex-col gap-0 text-white">

        {/* Content */}
        <div className={sectionCls}>
          <p className="text-xs font-semibold text-zinc-300 uppercase tracking-widest mb-4">Content</p>

          <div className="mb-3">
            <label className={labelCls}>Label (e.g. TONIGHT)</label>
            <input className={inputCls} value={data.label} onChange={e => set('label', e.target.value)} placeholder="TONIGHT" />
            <div className="mt-1.5"><WeightPicker value={data.labelWeight} onChange={v => set('labelWeight', v)} /></div>
          </div>

          <div className="mb-3">
            <label className={labelCls}>Title</label>
            <textarea className={inputCls + ' resize-none'} rows={4} value={data.title} onChange={e => handleTitleChange(e.target.value)} placeholder="Event title" />
            <div className="mt-1.5 flex gap-1.5">
              {(['92NY', 'Theinhardt Heavy'] as const).map(font => (
                <button key={font}
                  onClick={() => set('titleFont', font)}
                  className={`flex-1 text-xs py-1.5 rounded-md border transition-colors ${
                    (data.titleFont ?? '92NY') === font
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
            <FontSizeSlider label="Font size" value={data.titleSize}
              onChange={v => { setTitleSizeOverridden(true); set('titleSize', v) }}
              min={24} max={250} badge={titleSizeOverridden ? 'manual' : 'auto'} />
          </div>

          <div className="mb-3">
            <label className={labelCls}>Subtitle</label>
            <input className={inputCls} value={data.subtitle} onChange={e => handleSubtitleChange(e.target.value)} placeholder='e.g. "with"' />
            <div className="mt-1.5"><WeightPicker value={data.subtitleWeight} onChange={v => set('subtitleWeight', v)} /></div>
            <div className="mt-2 flex items-center gap-2">
              <input type="checkbox" id="subtitleInline" checked={data.subtitleInline} onChange={e => set('subtitleInline', e.target.checked)} className="rounded" />
              <label htmlFor="subtitleInline" className="text-sm text-zinc-300">
                Inline before first presenter <span className="text-zinc-500">(75% size)</span>
              </label>
            </div>
            <FontSizeSlider label="Font size" value={data.subtitleSize}
              onChange={v => { setSubtitleSizeOverridden(true); set('subtitleSize', v) }}
              min={16} max={120} badge={subtitleSizeOverridden ? 'manual' : 'auto'} />
          </div>

          <div className="mb-3">
            <label className={labelCls}>Subtitle 2</label>
            <input className={inputCls} value={data.subtitle2} onChange={e => set('subtitle2', e.target.value)} placeholder="Optional second line" />
            <div className="mt-1.5"><WeightPicker value={data.subtitle2Weight} onChange={v => set('subtitle2Weight', v)} /></div>
            <FontSizeSlider label="Font size" value={data.subtitle2Size} onChange={v => set('subtitle2Size', v)} min={16} max={120} />
          </div>

          <div className="mb-0">
            <label className={labelCls}>Presenters / Program (one per line)</label>
            <textarea className={inputCls + ' resize-none font-mono'} rows={4} value={data.presenters}
              onChange={e => set('presenters', e.target.value)} placeholder={"Name One,\nName Two\n& Name Three"} />
            <div className="mt-1.5 flex gap-1.5">
              {(['Theinhardt', '92NY'] as const).map(font => (
                <button key={font}
                  onClick={() => set('presentersFont', font)}
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
            <div className="mt-1.5"><WeightPicker value={data.presentersWeight} onChange={v => set('presentersWeight', v)} /></div>
            <FontSizeSlider label="Font size" value={data.presentersSize} onChange={v => set('presentersSize', v)} min={24} max={160} />
          </div>
        </div>

        {/* Image */}
        <div className={sectionCls}>
          <p className="text-xs font-semibold text-zinc-300 uppercase tracking-widest mb-4">Image</p>

          {/* Mode selector */}
          <div className="grid grid-cols-3 gap-1.5 mb-4">
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

          {data.imageMode === 'none' && (
            <p className="text-xs text-zinc-500">No image — all text is centered on the slide.</p>
          )}

          {data.imageMode === 'single' && (
            <>
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
                <div className="mt-2 rounded-lg overflow-hidden border border-zinc-700 bg-zinc-900 group relative cursor-pointer"
                  onClick={() => { setCropTarget(-1); setCropSrc(data.imageUrl) }}>
                  <img src={data.imageUrl} alt="Preview" className="max-h-20 mx-auto object-contain p-2" />
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white text-xs font-medium">Edit crop</span>
                  </div>
                </div>
              )}
              {data.imageUrl && (
                <div className="mt-2">
                  <FontSizeSlider label="Image size" value={data.imageSize ?? 100}
                    onChange={v => { setImageSizeOverridden(prev => ({ ...prev, [-1]: true })); set('imageSize', v) }}
                    min={20} max={200} unit="%" badge={imageSizeOverridden[-1] ? 'manual' : 'auto'} />
                </div>
              )}
            </>
          )}

          {staggerCount(data.imageMode) > 0 && (
            <>
              {Array.from({ length: staggerCount(data.imageMode) }).map((_, i) => {
                const img = data.staggerImages?.[i]
                const position = staggerSlotLabel(data.imageMode, i)
                return (
                  <div key={i} className={i > 0 ? 'mt-4' : ''}>
                    <p className="text-xs text-zinc-500 mb-1.5">Image {i + 1} {position}</p>
                    <div className="flex gap-2">
                      <label className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white text-sm py-2 px-3 rounded-lg transition-colors text-center cursor-pointer">
                        {img?.url ? 'Replace' : 'Upload'}
                        <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, i)} />
                      </label>
                      {img?.url && (
                        <button onClick={() => {
                          updateStaggerImage(i, { url: '' })
                          setImageSizeOverridden(prev => ({ ...prev, [i]: false }))
                        }}
                          className="bg-zinc-800 hover:bg-red-900 text-zinc-400 hover:text-white text-sm py-2 px-3 rounded-lg transition-colors">
                          Remove
                        </button>
                      )}
                    </div>
                    {img?.url && (
                      <div className="mt-2 rounded-lg overflow-hidden border border-zinc-700 bg-zinc-900 group relative cursor-pointer"
                        onClick={() => { setCropTarget(i); setCropSrc(img.url) }}>
                        <img src={img.url} alt="Preview" className="max-h-20 mx-auto object-contain p-2" />
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-white text-xs font-medium">Edit crop</span>
                        </div>
                      </div>
                    )}
                    <div className="mt-2">
                      <FontSizeSlider label={`Image ${i + 1} size (override)`} value={img?.scale || data.staggerSize || 250}
                        onChange={v => { setImageSizeOverridden(prev => ({ ...prev, [i]: true })); updateStaggerImage(i, { scale: v }) }}
                        min={80} max={800} badge={imageSizeOverridden[i] ? 'manual' : 'auto'} />
                    </div>
                    <div className="mt-2">
                      <FontSizeSlider label={`Image ${i + 1} Y`} value={img?.y ?? 0} onChange={v => updateStaggerImage(i, { y: v })} min={-600} max={600} />
                    </div>
                  </div>
                )
              })}
              <div className="mt-4">
                <FontSizeSlider label="Image width" value={data.staggerSize ?? 250} onChange={v => set('staggerSize', v)} min={80} max={800} />
              </div>
              <div className="mt-2">
                <FontSizeSlider label="Overlap" value={data.imageOverlap ?? 30} onChange={v => set('imageOverlap', v)} min={0} max={60} />
              </div>
            </>
          )}
        </div>

        {/* Style */}
        <div className={sectionCls}>
          <p className="text-xs font-semibold text-zinc-300 uppercase tracking-widest mb-4">Style</p>
          <div className="flex flex-col gap-4">
            {([
              ['backgroundColor', 'Background'],
              ['textColor', 'Text'],
              ['accentColor', 'Accent (title)'],
            ] as [keyof SlideData, string][]).map(([key, label]) => (
              <div key={key}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-sm flex-shrink-0 border border-zinc-600" style={{ backgroundColor: data[key] as string }} />
                  <label className={labelCls + ' mb-0'}>{label}</label>
                </div>
                <ColorPalette value={data[key] as string} onChange={v => set(key, v)} />
              </div>
            ))}
          </div>
        </div>

        {/* Logos */}
        <div className={sectionCls}>
          <p className="text-xs font-semibold text-zinc-300 uppercase tracking-widest mb-4">Logo Bar</p>
          <LogoUploader logos={data.logos || []} onChange={logos => set('logos', logos)} />
          <FontSizeSlider label="Logo height" value={data.logoSize || 60} onChange={v => set('logoSize', v)} min={30} max={200} />
        </div>

        {/* Footer */}
        <div className={sectionCls}>
          <p className="text-xs font-semibold text-zinc-300 uppercase tracking-widest mb-4">Footer</p>

          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <input type="checkbox" id="showSeriesName" checked={data.showSeriesName}
                onChange={e => set('showSeriesName', e.target.checked)} className="rounded" />
              <label htmlFor="showSeriesName" className="text-sm text-zinc-300 font-medium">Series name</label>
            </div>
            {data.showSeriesName && (
              <input className={inputCls} value={data.seriesName}
                onChange={e => set('seriesName', e.target.value)}
                placeholder="RECANATI-KAPLAN TALKS" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <input type="checkbox" id="showListeningCredit" checked={data.showListeningCredit}
                onChange={e => set('showListeningCredit', e.target.checked)} className="rounded" />
              <label htmlFor="showListeningCredit" className="text-sm text-zinc-300 font-medium">Listening credit</label>
            </div>
            {data.showListeningCredit && (
              <textarea className={inputCls + ' resize-none'} rows={4}
                value={data.listeningCredit}
                onChange={e => set('listeningCredit', e.target.value)}
                placeholder="Assistive listening devices..." />
            )}
          </div>
        </div>

        {/* Accessibility */}
        <div className={sectionCls}>
          <p className="text-xs font-semibold text-zinc-300 uppercase tracking-widest mb-3">Accessibility</p>
          <WcagChecker bg={data.backgroundColor} text={data.textColor} accent={data.accentColor} />
        </div>

      </div>
    </>
  )
}