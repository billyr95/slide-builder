'use client'

// Field-based "New Slide" intake: separate inputs matching the manual
// editor's own fields, read directly on Build -- no text parsing involved.
// This could later be replaced or supplemented with a single freeform paste
// box parsed via an LLM call, if fully-unlabeled input parsing is wanted --
// that would need a server-side API route and would carry a small per-use
// cost, unlike this field-based version, which stays free and instant.

import { useRef, useState } from 'react'
import { ScreenType } from '@/lib/trainTypes'
import { resizeImageDataUrl } from '@/lib/resizeImage'

const MAX_IMAGE_DIM = 1600

export interface DroppedImage {
  id: string
  url: string
  name: string
}

export interface SlideFieldsInput {
  label: string
  title: string
  subtitle: string
  subtitle2: string
  presenters: string // newline-joined, one per line -- matches SlideData.presenters' own format
  seriesName: string
}

export interface BuildResult {
  screenType: ScreenType
  fields: SlideFieldsInput
  images: DroppedImage[]
}

interface NewSlideModalProps {
  initialScreenType: ScreenType
  onBuild: (result: BuildResult) => void
  onSkip: () => void
  onCancel: () => void
}

const inputCls = `w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500 transition-colors placeholder-zinc-500`
const fieldLabelCls = `block text-xs text-zinc-500 uppercase tracking-wider mb-1.5`

// Presenters accepts either one name per line or semicolon-separated names
// on one line (same convenience the old paste-box format offered) -- always
// normalized down to one-per-line before it's stored, matching what the
// manual editor's own presenters field expects.
function normalizePresenters(raw: string): string {
  return raw
    .split('\n')
    .flatMap(line => line.split(';'))
    .map(s => s.trim())
    .filter(Boolean)
    .join('\n')
}

export default function NewSlideModal({ initialScreenType, onBuild, onSkip, onCancel }: NewSlideModalProps) {
  const [screenType, setScreenType] = useState<ScreenType>(initialScreenType)
  const [label, setLabel] = useState('')
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [subtitle2, setSubtitle2] = useState('')
  const [presenters, setPresenters] = useState('')
  const [seriesName, setSeriesName] = useState('')
  const [images, setImages] = useState<DroppedImage[]>([])
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function addFiles(files: FileList | File[]) {
    const list = Array.from(files).filter(f => f.type.startsWith('image/'))
    const read = list.map(file => new Promise<DroppedImage>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async (ev) => {
        try {
          const raw = ev.target?.result as string
          const url = await resizeImageDataUrl(raw, MAX_IMAGE_DIM, 0.9)
          resolve({ id: Math.random().toString(36).slice(2), url, name: file.name.replace(/\.[^.]+$/, '') })
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    }))
    const newImages = await Promise.all(read)
    setImages(prev => [...prev, ...newImages])
  }

  function removeImage(id: string) {
    setImages(prev => prev.filter(i => i.id !== id))
  }

  function handleBuild() {
    onBuild({
      screenType,
      fields: {
        label,
        title,
        subtitle,
        subtitle2,
        presenters: normalizePresenters(presenters),
        seriesName,
      },
      images,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-700 shadow-2xl flex flex-col overflow-hidden"
        style={{ width: 640, maxHeight: '92vh' }}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 flex-shrink-0">
          <h2 className="text-sm font-semibold text-white">New Slide</h2>
          <button onClick={onCancel} className="text-zinc-500 hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-auto p-5 flex flex-col gap-4">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Screen type</p>
            <div className="flex gap-1 bg-zinc-800 p-1 rounded-lg">
              {(['projector', 'lobby'] as ScreenType[]).map(t => (
                <button key={t} onClick={() => setScreenType(t)}
                  className={`flex-1 text-xs px-3 py-1.5 rounded-md transition-colors font-medium ${
                    screenType === t ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                  }`}>
                  {t === 'projector' ? 'Projector' : 'Lobby'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={fieldLabelCls}>Label</label>
            <input className={inputCls} value={label} onChange={e => setLabel(e.target.value)} placeholder="TONIGHT" />
          </div>

          <div>
            <label className={fieldLabelCls}>Title (required)</label>
            <textarea className={inputCls + ' resize-none'} rows={3} value={title}
              onChange={e => setTitle(e.target.value)} placeholder="Event title" />
          </div>

          <div>
            <label className={fieldLabelCls}>Subtitle</label>
            <input className={inputCls} value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder='e.g. "with"' />
          </div>

          <div>
            <label className={fieldLabelCls}>Subtitle 2</label>
            <input className={inputCls} value={subtitle2} onChange={e => setSubtitle2(e.target.value)} placeholder="Optional second line" />
          </div>

          <div>
            <label className={fieldLabelCls}>Presenters (one per line, or semicolon-separated)</label>
            <textarea className={inputCls + ' resize-none font-mono'} rows={3} value={presenters}
              onChange={e => setPresenters(e.target.value)} placeholder={'Name One,\nName Two\n& Name Three'} />
          </div>

          <div>
            <label className={fieldLabelCls}>Series name</label>
            <input className={inputCls} value={seriesName} onChange={e => setSeriesName(e.target.value)} placeholder="RECANATI-KAPLAN TALKS" />
          </div>

          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Images</p>
            <div
              onDragOver={e => { e.preventDefault(); setDragActive(true) }}
              onDragLeave={() => setDragActive(false)}
              onDrop={e => {
                e.preventDefault()
                setDragActive(false)
                if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg py-6 text-center cursor-pointer transition-colors ${
                dragActive ? 'border-white bg-zinc-800' : 'border-zinc-700 hover:border-zinc-500'
              }`}
            >
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = '' }} />
              <p className="text-sm text-zinc-400">Drop images here, or click to browse</p>
              <p className="text-xs text-zinc-600 mt-1">Multiple images OK — assigned to slots in the order added</p>
            </div>
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {images.map((img, i) => (
                  <div key={img.id} className="relative group">
                    <div className="bg-zinc-800 rounded-lg p-1 border border-zinc-700">
                      <img src={img.url} alt={img.name} className="h-14 w-14 object-cover rounded" />
                    </div>
                    <span className="absolute -top-1.5 -left-1.5 bg-zinc-700 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                      {i + 1}
                    </span>
                    <button onClick={() => removeImage(img.id)}
                      className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-zinc-800 flex gap-2 flex-shrink-0">
          <button onClick={onSkip}
            className="flex-1 py-2 text-sm text-zinc-400 border border-zinc-700 rounded-lg hover:border-zinc-500 transition-colors">
            Skip / Start blank
          </button>
          <button onClick={handleBuild} disabled={!title.trim()}
            className="flex-1 py-2 text-sm font-medium bg-white text-black rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Build
          </button>
        </div>
      </div>
    </div>
  )
}
