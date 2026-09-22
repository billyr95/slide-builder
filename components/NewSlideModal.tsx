'use client'

// Field-based "New Slide" intake: separate inputs matching the manual
// editor's own fields, read directly on Build -- no text parsing involved.
// This could later be replaced or supplemented with a single freeform paste
// box parsed via an LLM call, if fully-unlabeled input parsing is wanted --
// that would need a server-side API route and would carry a small per-use
// cost, unlike this field-based version, which stays free and instant.

import { useRef, useState } from 'react'
import { ScreenType } from '@/lib/trainTypes'
import { PresentersFont, TheinhardtWeight } from '@/lib/types'
import { resizeImageDataUrl } from '@/lib/resizeImage'
import { DEFAULT_SLIDE_DATA } from '@/lib/defaults'
import ColorPalette from '@/components/ColorPalette'

const MAX_IMAGE_DIM = 1600

export interface DroppedImage {
  id: string
  url: string
  name: string
  // Per-image override for face-detection auto-crop (lib/faceDetect.ts),
  // default true. Settable right after the image is added and up until
  // Build is clicked, since that's when the crop actually runs here (see
  // handleBuild) -- there's no pre-existing per-slot UI in this drop-first
  // flow to make it settable before the image even exists the way
  // EditorPanel's fixed upload slots could.
  autoCropEnabled: boolean
}

export interface SlideFieldsInput {
  backgroundColor: string
  label: string
  labelColor: string
  title: string
  titleColor: string // maps to SlideData.accentColor -- see buildNewSlideData.ts
  subtitle: string
  subtitleColor: string
  subtitle2: string
  subtitle2Color: string
  presenters: string // newline-joined, one per line -- matches SlideData.presenters' own format
  presentersFont: PresentersFont
  presentersWeight: TheinhardtWeight
  presentersItalic: boolean
  presentersColor: string
  programTitle: string
  programTitleFont: PresentersFont
  programTitleWeight: TheinhardtWeight
  programTitleItalic: boolean
  programTitleColor: string
  seriesName: string
  seriesNameColor: string
  textAlign: 'left' | 'center'
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

function FontPicker({ value, onChange }: { value: PresentersFont; onChange: (f: PresentersFont) => void }) {
  return (
    <div className="flex gap-1.5">
      {(['Theinhardt', '92NY Text'] as const).map(font => (
        <button key={font} type="button" onClick={() => onChange(font)}
          className={`flex-1 text-xs py-1.5 rounded-md border transition-colors ${
            value === font ? 'bg-white text-black border-white font-medium' : 'bg-transparent text-zinc-400 border-zinc-700 hover:border-zinc-500'
          }`}>
          {font}
        </button>
      ))}
    </div>
  )
}

// 92NY Text has no separate weight variants (unlike Theinhardt) -- disabled
// rather than hidden so the control's presence (and its stored value) stays
// consistent regardless of which font is picked.
function WeightPicker({ value, onChange, disabled }: { value: TheinhardtWeight; onChange: (w: TheinhardtWeight) => void; disabled?: boolean }) {
  return (
    <div className="flex gap-1.5">
      {([['regular', 'Regular'], ['bold', 'Bold'], ['heavy', 'Heavy']] as [TheinhardtWeight, string][]).map(([w, wLabel]) => (
        <button key={w} type="button" disabled={disabled} onClick={() => onChange(w)}
          className={`flex-1 text-xs py-1.5 rounded-md border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
            value === w ? 'bg-white text-black border-white font-medium' : 'bg-transparent text-zinc-400 border-zinc-700 hover:border-zinc-500'
          }`}>
          {wLabel}
        </button>
      ))}
    </div>
  )
}

// 92NY Text has no Bold/Heavy variant, so switching to it resets a
// non-Regular weight rather than leaving a now-invalid value stored.
function selectFontWithWeightReset(
  font: PresentersFont, currentWeight: TheinhardtWeight,
  setFont: (f: PresentersFont) => void, setWeight: (w: TheinhardtWeight) => void,
) {
  setFont(font)
  if (font === '92NY Text' && currentWeight !== 'regular') setWeight('regular')
}

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
  const [backgroundColor, setBackgroundColor] = useState(DEFAULT_SLIDE_DATA.backgroundColor)
  const [label, setLabel] = useState('')
  const [labelColor, setLabelColor] = useState(DEFAULT_SLIDE_DATA.labelColor ?? DEFAULT_SLIDE_DATA.textColor)
  const [title, setTitle] = useState('')
  const [titleColor, setTitleColor] = useState(DEFAULT_SLIDE_DATA.accentColor)
  const [subtitle, setSubtitle] = useState('')
  const [subtitleColor, setSubtitleColor] = useState(DEFAULT_SLIDE_DATA.subtitleColor ?? DEFAULT_SLIDE_DATA.textColor)
  const [subtitle2, setSubtitle2] = useState('')
  const [subtitle2Color, setSubtitle2Color] = useState(DEFAULT_SLIDE_DATA.subtitle2Color ?? DEFAULT_SLIDE_DATA.textColor)
  const [presenters, setPresenters] = useState('')
  const [presentersFont, setPresentersFont] = useState<PresentersFont>('Theinhardt')
  const [presentersWeight, setPresentersWeight] = useState<TheinhardtWeight>('regular')
  const [presentersItalic, setPresentersItalic] = useState(false)
  const [presentersColor, setPresentersColor] = useState(DEFAULT_SLIDE_DATA.presentersColor ?? DEFAULT_SLIDE_DATA.textColor)
  const [programTitle, setProgramTitle] = useState('')
  const [programTitleFont, setProgramTitleFont] = useState<PresentersFont>('Theinhardt')
  const [programTitleWeight, setProgramTitleWeight] = useState<TheinhardtWeight>('regular')
  const [programTitleItalic, setProgramTitleItalic] = useState(true)
  const [programTitleColor, setProgramTitleColor] = useState(DEFAULT_SLIDE_DATA.programTitleColor ?? DEFAULT_SLIDE_DATA.textColor)
  const [seriesName, setSeriesName] = useState('')
  const [seriesNameColor, setSeriesNameColor] = useState(DEFAULT_SLIDE_DATA.seriesNameColor ?? DEFAULT_SLIDE_DATA.textColor)
  const [textAlign, setTextAlign] = useState<'left' | 'center'>('left')
  const [images, setImages] = useState<DroppedImage[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [building, setBuilding] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function addFiles(files: FileList | File[]) {
    const list = Array.from(files).filter(f => f.type.startsWith('image/'))
    const read = list.map(file => new Promise<DroppedImage>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async (ev) => {
        try {
          const raw = ev.target?.result as string
          const url = await resizeImageDataUrl(raw, MAX_IMAGE_DIM, 0.9)
          resolve({ id: Math.random().toString(36).slice(2), url, name: file.name.replace(/\.[^.]+$/, ''), autoCropEnabled: true })
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

  function toggleAutoCrop(id: string) {
    setImages(prev => prev.map(img => img.id === id ? { ...img, autoCropEnabled: !img.autoCropEnabled } : img))
  }

  // Swaps this slot's image in place (same id, same position in the array,
  // same autoCropEnabled toggle) rather than removing it and adding a new
  // one -- that would move it to the end (breaking the "assigned in the
  // order added" slot ordering) and silently reset autoCropEnabled back to
  // its default. No size/position/crop to carry over here (unlike the main
  // editor's slots) since none of that exists yet at this pre-Build stage --
  // it's only computed once Build actually runs.
  function replaceImage(id: string, file: File) {
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const raw = ev.target?.result as string
        const url = await resizeImageDataUrl(raw, MAX_IMAGE_DIM, 0.9)
        setImages(prev => prev.map(img => img.id === id ? { ...img, url, name: file.name.replace(/\.[^.]+$/, '') } : img))
      } catch (err) {
        console.error('Failed to replace image', err)
      }
    }
    reader.readAsDataURL(file)
  }

  async function handleBuild() {
    setBuilding(true)
    try {
      // Face-detection auto-crop (lib/faceDetect.ts) runs here, per image,
      // right before building the slide -- not at drop time -- specifically
      // so the "Auto-crop this image" toggle below has already had a chance
      // to be set. Images with it off pass through unchanged (covers movie
      // posters/promo art that happen to feature a face prominently but
      // shouldn't be cropped to a headshot). Dynamically imported: this
      // pulls in @vladmandic/face-api and, transitively, @tensorflow/tfjs,
      // which crashes Next's server-side page prerendering if statically
      // imported (see EditorPanel.tsx's matching comment).
      const [{ detectFaceCropBox }, { cropImageByRatioBox }] = await Promise.all([
        import('@/lib/faceDetect'),
        import('@/lib/cropImage'),
      ])
      const builtImages = await Promise.all(images.map(async img => {
        if (!img.autoCropEnabled) return img
        const detection = await detectFaceCropBox(img.url).catch((e: unknown) => {
          console.warn('Face detection failed, skipping auto-crop', e)
          return null
        })
        if (!detection) return img
        const url = await cropImageByRatioBox(img.url, detection.cropBox)
        return { ...img, url }
      }))

      onBuild({
        screenType,
        fields: {
          backgroundColor,
          label,
          labelColor,
          title,
          titleColor,
          subtitle,
          subtitleColor,
          subtitle2,
          subtitle2Color,
          presenters: normalizePresenters(presenters),
          presentersFont,
          presentersWeight,
          presentersItalic,
          presentersColor,
          programTitle,
          programTitleFont,
          programTitleWeight,
          programTitleItalic,
          programTitleColor,
          seriesName,
          seriesNameColor,
          textAlign,
        },
        images: builtImages,
      })
    } finally {
      setBuilding(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-700 shadow-2xl flex flex-col overflow-hidden"
        style={{ width: 640, maxHeight: '92vh' }}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 flex-shrink-0">
          <h2 className="text-sm font-semibold text-white">New Slide</h2>
          <button onClick={onCancel} className="text-zinc-500 hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <label className={fieldLabelCls + ' mb-0'}>Background</label>
            <ColorPalette value={backgroundColor} onChange={setBackgroundColor} />
          </div>

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
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs text-zinc-500">Color</span>
              <ColorPalette value={labelColor} onChange={setLabelColor} />
            </div>
          </div>

          <div>
            <label className={fieldLabelCls}>Title (required)</label>
            <textarea className={inputCls + ' resize-none'} rows={3} value={title}
              onChange={e => setTitle(e.target.value)} placeholder="Event title" />
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs text-zinc-500">Color</span>
              <ColorPalette value={titleColor} onChange={setTitleColor} />
            </div>
          </div>

          <div>
            <label className={fieldLabelCls}>Subtitle</label>
            <input className={inputCls} value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder='e.g. "with"' />
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs text-zinc-500">Color</span>
              <ColorPalette value={subtitleColor} onChange={setSubtitleColor} />
            </div>
          </div>

          <div>
            <label className={fieldLabelCls}>Subtitle 2</label>
            <input className={inputCls} value={subtitle2} onChange={e => setSubtitle2(e.target.value)} placeholder="Optional second line" />
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs text-zinc-500">Color</span>
              <ColorPalette value={subtitle2Color} onChange={setSubtitle2Color} />
            </div>
          </div>

          <div>
            <label className={fieldLabelCls}>Presenters (one per line, or semicolon-separated)</label>
            <textarea className={inputCls + ' resize-none font-mono'} rows={3} value={presenters}
              onChange={e => setPresenters(e.target.value)} placeholder={'Name One,\nName Two\n& Name Three'} />
            <div className="mt-1.5">
              <FontPicker value={presentersFont} onChange={f => selectFontWithWeightReset(f, presentersWeight, setPresentersFont, setPresentersWeight)} />
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <input type="checkbox" id="newSlidePresentersItalic" checked={presentersItalic}
                onChange={e => setPresentersItalic(e.target.checked)} className="rounded" />
              <label htmlFor="newSlidePresentersItalic" className="text-sm text-zinc-300">Italic</label>
            </div>
            <div className="mt-1.5">
              <WeightPicker value={presentersWeight} onChange={setPresentersWeight} disabled={presentersFont === '92NY Text'} />
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs text-zinc-500">Color</span>
              <ColorPalette value={presentersColor} onChange={setPresentersColor} />
            </div>
          </div>

          <div>
            <label className={fieldLabelCls}>Program / Work Title</label>
            <input className={inputCls} value={programTitle} onChange={e => setProgramTitle(e.target.value)} placeholder='e.g. "American Caprices"' />
            <div className="mt-1.5">
              <FontPicker value={programTitleFont} onChange={f => selectFontWithWeightReset(f, programTitleWeight, setProgramTitleFont, setProgramTitleWeight)} />
            </div>
            <div className="mt-1.5">
              <WeightPicker value={programTitleWeight} onChange={setProgramTitleWeight} disabled={programTitleFont === '92NY Text'} />
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <input type="checkbox" id="newSlideProgramTitleItalic" checked={programTitleItalic}
                onChange={e => setProgramTitleItalic(e.target.checked)} className="rounded" />
              <label htmlFor="newSlideProgramTitleItalic" className="text-sm text-zinc-300">Italic</label>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs text-zinc-500">Color</span>
              <ColorPalette value={programTitleColor} onChange={setProgramTitleColor} />
            </div>
          </div>

          <div>
            <label className={fieldLabelCls}>Series name</label>
            <input className={inputCls} value={seriesName} onChange={e => setSeriesName(e.target.value)} placeholder="RECANATI-KAPLAN TALKS" />
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs text-zinc-500">Color</span>
              <ColorPalette value={seriesNameColor} onChange={setSeriesNameColor} />
            </div>
          </div>

          <div>
            <label className={fieldLabelCls}>Text alignment</label>
            <div className="flex gap-1 bg-zinc-800 p-1 rounded-lg">
              {(['left', 'center'] as const).map(align => (
                <button key={align} type="button" onClick={() => setTextAlign(align)}
                  className={`flex-1 text-xs px-3 py-1.5 rounded-md transition-colors font-medium ${
                    textAlign === align ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                  }`}>
                  {align === 'left' ? 'Left' : 'Center'}
                </button>
              ))}
            </div>
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
                  <div key={img.id} className="w-14">
                    <div className="relative group">
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
                      <label
                        title="Replace image"
                        className="absolute inset-1 rounded flex items-center justify-center bg-black/60 text-white text-[9px] font-medium opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        Replace
                        <input type="file" accept="image/*" className="hidden"
                          onChange={e => { const file = e.target.files?.[0]; if (file) replaceImage(img.id, file); e.target.value = '' }} />
                      </label>
                    </div>
                    <label className="mt-1 flex items-center justify-center gap-1 cursor-pointer" title="Auto-crop this image (face detection)">
                      <input type="checkbox" checked={img.autoCropEnabled} onChange={() => toggleAutoCrop(img.id)} className="rounded w-3 h-3" />
                      <span className="text-[9px] text-zinc-500 leading-none">Auto-crop</span>
                    </label>
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
          <button onClick={handleBuild} disabled={!title.trim() || building}
            className="flex-1 py-2 text-sm font-medium bg-white text-black rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {building ? 'Building…' : 'Build'}
          </button>
        </div>
      </div>
    </div>
  )
}
