'use client'

import { useState } from 'react'
import { TheinhardtWeight, TitleFont, PresentersFont } from '@/lib/types'
import { TrainEntry, TrainImage, ScreenType, createBlankEntry } from '@/lib/trainTypes'
import ColorPalette from '@/components/ColorPalette'

interface TrainFormProps {
  onAdd: (entry: TrainEntry) => void
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
          style={{ fontWeight: w.fw }}
        >
          {w.label}
        </button>
      ))}
    </div>
  )
}

function FontPicker<T extends string>({ value, options, onChange }: { value: T; options: readonly T[]; onChange: (f: T) => void }) {
  return (
    <div className="flex gap-1.5">
      {options.map(font => (
        <button
          key={font}
          onClick={() => onChange(font)}
          className={`flex-1 text-xs py-1.5 rounded-md border transition-colors ${
            value === font
              ? 'bg-white text-black border-white font-medium'
              : 'bg-transparent text-zinc-400 border-zinc-700 hover:border-zinc-500'
          }`}
        >
          {font}
        </button>
      ))}
    </div>
  )
}

const TITLE_FONTS: readonly TitleFont[] = ['92NY', 'Theinhardt Heavy']
const PRESENTERS_FONTS: readonly PresentersFont[] = ['Theinhardt', '92NY']

async function readImageFile(file: File): Promise<{ url: string; mediaType: string; name: string }> {
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
  return { url, mediaType: file.type || 'image/png', name: file.name }
}

export default function TrainForm({ onAdd }: TrainFormProps) {
  const [screenType, setScreenType] = useState<ScreenType>('projector')
  const [hasLabel, setHasLabel] = useState(false)
  const [hasLogos, setHasLogos] = useState(false)
  const [hasQrCode, setHasQrCode] = useState(false)
  const [entry, setEntry] = useState<TrainEntry>(() => createBlankEntry({ screenType: 'projector', hasLabel: false, hasLogos: false, hasQrCode: false }))
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof TrainEntry>(key: K, value: TrainEntry[K]) {
    setEntry(e => ({ ...e, [key]: value }))
  }

  function updateImage(index: number, patch: Partial<TrainImage>) {
    setEntry(e => {
      const images = [...e.images]
      images[index] = { ...images[index], ...patch }
      return { ...e, images }
    })
  }

  function addImageSlot() {
    setEntry(e => ({ ...e, images: [...e.images, { id: Math.random().toString(36).slice(2), url: '', mediaType: '', name: '' }] }))
  }

  function removeImageSlot(index: number) {
    setEntry(e => ({ ...e, images: e.images.filter((_, i) => i !== index) }))
  }

  async function handleImageUpload(index: number, file: File | undefined) {
    if (!file) return
    const { url, mediaType, name } = await readImageFile(file)
    updateImage(index, { url, mediaType, name })
  }

  function handleAddToQueue() {
    if (!entry.title.trim()) {
      setError('Title is required.')
      return
    }
    setError(null)
    onAdd({ ...entry, screenType, hasLabel, hasLogos, hasQrCode, id: entry.id, createdAt: new Date().toISOString() })
    // Reset content fields for the next entry, but keep screen type / has-label
    // sticky — batches of old slides are usually entered a screen-type at a time.
    setEntry(createBlankEntry({ screenType, hasLabel, hasLogos, hasQrCode }))
  }

  return (
    <div className="flex flex-col gap-0 text-white">
      {/* Screen type + has-label */}
      <div className={sectionCls}>
        <p className="text-xs font-semibold text-zinc-300 uppercase tracking-widest mb-4">Entry</p>

        <div className="mb-4">
          <label className={labelCls}>Screen type</label>
          <div className="flex gap-1 bg-zinc-800 p-1 rounded-lg">
            {(['projector', 'lobby'] as ScreenType[]).map(t => (
              <button
                key={t}
                onClick={() => setScreenType(t)}
                className={`flex-1 text-xs px-4 py-1.5 rounded-md transition-colors font-medium ${
                  screenType === t ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {t === 'projector' ? 'Projector' : 'Lobby'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <input type="checkbox" id="hasLabel" checked={hasLabel} onChange={e => setHasLabel(e.target.checked)} className="rounded" />
          <label htmlFor="hasLabel" className="text-sm text-zinc-300">Has label/kicker line above title</label>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <input type="checkbox" id="hasLogos" checked={hasLogos} onChange={e => setHasLogos(e.target.checked)} className="rounded" />
          <label htmlFor="hasLogos" className="text-sm text-zinc-300">Has logos on the slide</label>
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="hasQrCode" checked={hasQrCode} onChange={e => setHasQrCode(e.target.checked)} className="rounded" />
          <label htmlFor="hasQrCode" className="text-sm text-zinc-300">Has QR code</label>
        </div>
      </div>

      {/* Images */}
      <div className={sectionCls}>
        <p className="text-xs font-semibold text-zinc-300 uppercase tracking-widest mb-4">Images</p>
        <div className="flex flex-col gap-3">
          {entry.images.map((img, i) => (
            <div key={img.id}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-zinc-500">Image {i + 1}</p>
                {entry.images.length > 0 && (
                  <button onClick={() => removeImageSlot(i)} className="text-xs text-zinc-500 hover:text-red-400">
                    Remove slot
                  </button>
                )}
              </div>
              {img.url ? (
                <div className="rounded-lg overflow-hidden border border-zinc-700 bg-zinc-900 relative group">
                  <img src={img.url} alt={img.name} className="max-h-28 mx-auto object-contain p-2" />
                  <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <span className="text-white text-xs font-medium">Replace</span>
                    <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(i, e.target.files?.[0])} />
                  </label>
                </div>
              ) : (
                <label className="flex items-center justify-center w-full bg-zinc-700 hover:bg-zinc-600 text-white text-sm py-2 px-3 rounded-lg transition-colors cursor-pointer">
                  Upload image
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(i, e.target.files?.[0])} />
                </label>
              )}
            </div>
          ))}
          <button
            onClick={addImageSlot}
            className="text-sm text-zinc-400 hover:text-white border border-dashed border-zinc-700 hover:border-zinc-500 rounded-lg py-2 transition-colors"
          >
            + Add image
          </button>
        </div>
      </div>

      {/* Text content */}
      <div className={sectionCls}>
        <p className="text-xs font-semibold text-zinc-300 uppercase tracking-widest mb-4">Content</p>

        {hasLabel && (
          <div className="mb-3">
            <label className={labelCls}>Label (e.g. THE JOHN WATERS SCREENPLAYS)</label>
            <input className={inputCls} value={entry.label} onChange={e => set('label', e.target.value)} placeholder="Label" />
          </div>
        )}

        <div className="mb-3">
          <label className={labelCls}>Title</label>
          <textarea className={inputCls + ' resize-none'} rows={3} value={entry.title} onChange={e => set('title', e.target.value)} placeholder="Event title" />
          <div className="mt-1.5"><FontPicker value={entry.titleFont} options={TITLE_FONTS} onChange={v => set('titleFont', v)} /></div>
          <div className="mt-2 flex items-center gap-2">
            <input type="checkbox" id="titleItalic" checked={entry.titleItalic} onChange={e => set('titleItalic', e.target.checked)} className="rounded" />
            <label htmlFor="titleItalic" className="text-sm text-zinc-300">Italic</label>
          </div>
        </div>

        <div className="mb-3">
          <label className={labelCls}>Subtitle</label>
          <input className={inputCls} value={entry.subtitle} onChange={e => set('subtitle', e.target.value)} placeholder='e.g. "with"' />
          <div className="mt-1.5"><WeightPicker value={entry.subtitleWeight} onChange={v => set('subtitleWeight', v)} /></div>
        </div>

        <div className="mb-3">
          <label className={labelCls}>Subtitle 2</label>
          <input className={inputCls} value={entry.subtitle2} onChange={e => set('subtitle2', e.target.value)} placeholder="Optional second line" />
        </div>

        <div className="mb-0">
          <label className={labelCls}>Presenters (one per line)</label>
          <textarea className={inputCls + ' resize-none font-mono'} rows={4} value={entry.presenters}
            onChange={e => set('presenters', e.target.value)} placeholder={"Name One,\nName Two\n& Name Three"} />
          <div className="mt-1.5"><FontPicker value={entry.presentersFont} options={PRESENTERS_FONTS} onChange={v => set('presentersFont', v)} /></div>
        </div>
      </div>

      {/* Footer / extras */}
      <div className={sectionCls}>
        <p className="text-xs font-semibold text-zinc-300 uppercase tracking-widest mb-4">Footer</p>

        <div className="mb-3">
          <label className={labelCls}>Series name</label>
          <input className={inputCls} value={entry.seriesName} onChange={e => set('seriesName', e.target.value)} placeholder="e.g. Recanati-Kaplan Talks" />
        </div>

        <div className="mb-0">
          <label className={labelCls}>Listening credit</label>
          <textarea className={inputCls + ' resize-none'} rows={3} value={entry.listeningCredit}
            onChange={e => set('listeningCredit', e.target.value)} placeholder="Assistive listening devices, sponsor credits, etc." />
        </div>
      </div>

      {/* Colors */}
      <div className={sectionCls}>
        <p className="text-xs font-semibold text-zinc-300 uppercase tracking-widest mb-4">
          Colors <span className="normal-case text-zinc-600 tracking-normal">— hardlocked to the app's palette; leave unset ("Auto") to let the model estimate</span>
        </p>
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>Background</label>
            <ColorPalette value={entry.backgroundColor} onChange={v => set('backgroundColor', v)} clearable />
          </div>
          <div>
            <label className={labelCls}>Text</label>
            <ColorPalette value={entry.textColor} onChange={v => set('textColor', v)} clearable />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

      <button
        onClick={handleAddToQueue}
        className="w-full bg-white hover:bg-zinc-200 text-black font-medium text-sm py-2.5 rounded-lg transition-colors"
      >
        Add to queue
      </button>
    </div>
  )
}
