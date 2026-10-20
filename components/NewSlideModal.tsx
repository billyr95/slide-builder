'use client'

// Field-based "New Slide" intake: separate inputs matching the manual
// editor's own fields, read directly on Build -- no text parsing involved.
// This could later be replaced or supplemented with a single freeform paste
// box parsed via an LLM call, if fully-unlabeled input parsing is wanted --
// that would need a server-side API route and would carry a small per-use
// cost, unlike this field-based version, which stays free and instant.
//
// This component is CONTROLLED: every form field lives in `draft`, owned by
// NewSlideFlow (see lib/newSlideDraft.ts), not in local useState here. That
// used to be the opposite -- every field was local state, which meant
// clicking "Build" (unmounting this component in favor of the naming step)
// or just closing the modal threw every typed field and dropped image away
// for good. Lifting the data up (this component now only owns ephemeral,
// not-worth-persisting UI state: drag-over highlighting, the Building…
// spinner, auto-crop-in-progress) is what makes Back from naming, and an
// accidental close/refresh, both restore exactly what was there.

import { useRef, useState } from 'react'
import { ScreenType } from '@/lib/trainTypes'
import { PresentersFont, TheinhardtWeight, FaceCropBox } from '@/lib/types'
import { resizeImageDataUrl } from '@/lib/resizeImage'
import { NewSlideDraft } from '@/lib/newSlideDraft'
import ColorPalette from '@/components/ColorPalette'
import EditHtmlLink from '@/components/EditHtmlField'

const MAX_IMAGE_DIM = 1600

export interface DroppedImage {
  id: string
  url: string
  name: string
  // Set only once the "Auto-crop face" button (see runAutoCropFace) has
  // been run on this image -- face detection no longer runs automatically
  // on drop or at Build time, matching EditorPanel's own on-demand model.
  faceCropSuggested?: FaceCropBox
  faceCropFinal?: FaceCropBox
  faceCropWasOverridden?: boolean
}

export interface SlideFieldsInput {
  backgroundColor: string
  label: string
  labelColor: string
  labelRichText?: string
  title: string
  titleColor: string // maps to SlideData.accentColor -- see buildNewSlideData.ts
  titleRichText?: string
  subtitle: string
  subtitleColor: string
  subtitleRichText?: string
  subtitle2: string
  subtitle2Color: string
  subtitle2RichText?: string
  presenters: string // newline-joined, one per line -- matches SlideData.presenters' own format
  presentersFont: PresentersFont
  presentersWeight: TheinhardtWeight
  presentersItalic: boolean
  presentersColor: string
  presentersRichText?: string
  programTitle: string
  programTitleFont: PresentersFont
  programTitleWeight: TheinhardtWeight
  programTitleItalic: boolean
  programTitleColor: string
  programTitleRichText?: string
  seriesName: string
  seriesNameColor: string
  seriesNameRichText?: string
  textAlign: 'left' | 'center'
}

export interface BuildResult {
  screenType: ScreenType
  fields: SlideFieldsInput
  images: DroppedImage[]
}

interface NewSlideModalProps {
  draft: NewSlideDraft
  onDraftChange: (patch: Partial<NewSlideDraft>) => void
  onBuild: (result: BuildResult) => void
  onSkip: () => void
  onCancel: () => void
  onDiscard: () => void
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

export default function NewSlideModal({ draft, onDraftChange, onBuild, onSkip, onCancel, onDiscard }: NewSlideModalProps) {
  const [dragActive, setDragActive] = useState(false)
  const [building, setBuilding] = useState(false)
  const [autoCroppingId, setAutoCroppingId] = useState<string | null>(null)
  const [autoCropNotice, setAutoCropNotice] = useState<{ id: string; text: string } | null>(null)
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
    onDraftChange({ images: [...draft.images, ...newImages] })
  }

  function removeImage(id: string) {
    onDraftChange({ images: draft.images.filter(i => i.id !== id) })
  }

  // On-demand face crop -- run per image via its "Auto-crop face" button.
  // Detection runs on whatever's in the slot right now (freshly dropped, or
  // a previous auto-crop result); no toggle and no automatic run at drop or
  // Build time any more.
  async function runAutoCropFace(id: string) {
    const img = draft.images.find(i => i.id === id)
    if (!img) return
    setAutoCroppingId(id)
    setAutoCropNotice(null)
    try {
      const [{ detectFaceCropBox }, { cropImageByRatioBox }] = await Promise.all([
        import('@/lib/faceDetect'),
        import('@/lib/cropImage'),
      ])
      const detection = await detectFaceCropBox(img.url).catch((e: unknown) => {
        console.warn('Face detection failed', e)
        return null
      })
      if (detection) {
        const url = await cropImageByRatioBox(img.url, detection.cropBox)
        onDraftChange({
          images: draft.images.map(i => i.id === id
            ? { ...i, url, faceCropSuggested: detection.cropBox, faceCropFinal: detection.cropBox, faceCropWasOverridden: false }
            : i),
        })
      } else {
        setAutoCropNotice({ id, text: 'No face detected' })
      }
    } finally {
      setAutoCroppingId(null)
    }
  }

  // Swaps this slot's image in place (same id, same position in the array)
  // rather than removing it and adding a new one -- that would move it to
  // the end (breaking the "assigned in the order added" slot ordering).
  // Keeps whatever face-crop fields this slot already had, matching the
  // same replace-image rule EditorPanel uses (see its handleImageUpload
  // comment): swapping the photo underneath doesn't re-run detection or
  // discard an existing crop automatically.
  function replaceImage(id: string, file: File) {
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const raw = ev.target?.result as string
        const url = await resizeImageDataUrl(raw, MAX_IMAGE_DIM, 0.9)
        onDraftChange({ images: draft.images.map(img => img.id === id ? { ...img, url, name: file.name.replace(/\.[^.]+$/, '') } : img) })
      } catch (err) {
        console.error('Failed to replace image', err)
      }
    }
    reader.readAsDataURL(file)
  }

  function handleBuild() {
    setBuilding(true)
    try {
      // Images are built exactly as they sit in draft.images -- uncropped
      // unless the user explicitly ran "Auto-crop face" on a given slot
      // (see runAutoCropFace), which already applied the crop and recorded
      // its faceCrop* fields at that point. No detection runs here any more.
      const normalizedPresenters = normalizePresenters(draft.presenters)
      onBuild({
        screenType: draft.screenType,
        fields: {
          backgroundColor: draft.backgroundColor,
          label: draft.label,
          labelColor: draft.labelColor,
          labelRichText: draft.labelRichText,
          title: draft.title,
          titleColor: draft.titleColor,
          titleRichText: draft.titleRichText,
          subtitle: draft.subtitle,
          subtitleColor: draft.subtitleColor,
          subtitleRichText: draft.subtitleRichText,
          subtitle2: draft.subtitle2,
          subtitle2Color: draft.subtitle2Color,
          subtitle2RichText: draft.subtitle2RichText,
          presenters: normalizedPresenters,
          presentersFont: draft.presentersFont,
          presentersWeight: draft.presentersWeight,
          presentersItalic: draft.presentersItalic,
          presentersColor: draft.presentersColor,
          // normalizePresenters can reshape the text (splitting on ';',
          // trimming, dropping empties) -- a rich override's markup
          // positions only still make sense if normalizing was a no-op.
          presentersRichText: normalizedPresenters === draft.presenters ? draft.presentersRichText : undefined,
          programTitle: draft.programTitle,
          programTitleFont: draft.programTitleFont,
          programTitleWeight: draft.programTitleWeight,
          programTitleItalic: draft.programTitleItalic,
          programTitleColor: draft.programTitleColor,
          programTitleRichText: draft.programTitleRichText,
          seriesName: draft.seriesName,
          seriesNameColor: draft.seriesNameColor,
          seriesNameRichText: draft.seriesNameRichText,
          textAlign: draft.textAlign,
        },
        images: draft.images,
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
          <div className="flex items-center gap-3">
            <button onClick={onDiscard} className="text-xs text-zinc-500 hover:text-red-400 transition-colors">
              Discard
            </button>
            <button onClick={onCancel} title="Close (your draft is kept)" className="text-zinc-500 hover:text-white transition-colors text-xl leading-none">✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar p-5 flex flex-col gap-4">
          <div>
            <label className={fieldLabelCls}>Background</label>
            <ColorPalette value={draft.backgroundColor} onChange={v => onDraftChange({ backgroundColor: v })} inline />
          </div>

          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Screen type</p>
            <div className="flex gap-1 bg-zinc-800 p-1 rounded-lg">
              {(['projector', 'lobby'] as ScreenType[]).map(t => (
                <button key={t} onClick={() => onDraftChange({ screenType: t })}
                  className={`flex-1 text-xs px-3 py-1.5 rounded-md transition-colors font-medium ${
                    draft.screenType === t ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                  }`}>
                  {t === 'projector' ? 'Projector' : 'Lobby'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={fieldLabelCls}>Label</label>
            <input className={inputCls} value={draft.label} onChange={e => onDraftChange({ label: e.target.value, labelRichText: undefined })} placeholder="TONIGHT" />
            <EditHtmlLink fieldLabel="Label" plainValue={draft.label} richValue={draft.labelRichText} allowBold
              onApply={(plain, rich) => onDraftChange({ label: plain, labelRichText: rich })} />
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs text-zinc-500">Color</span>
              <ColorPalette value={draft.labelColor} onChange={v => onDraftChange({ labelColor: v })} />
            </div>
          </div>

          <div>
            <label className={fieldLabelCls}>Title (required)</label>
            <textarea className={inputCls + ' resize-none'} rows={3} value={draft.title}
              onChange={e => onDraftChange({ title: e.target.value, titleRichText: undefined })} placeholder="Event title" />
            {/* Title's font isn't pickable here (always starts as
                DEFAULT_SLIDE_DATA.titleFont, '92NY Text', which has no bold
                face) -- bold becomes available once the user changes it in
                the main editor afterward. */}
            <EditHtmlLink fieldLabel="Title" plainValue={draft.title} richValue={draft.titleRichText} allowBold={false}
              onApply={(plain, rich) => onDraftChange({ title: plain, titleRichText: rich })} />
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs text-zinc-500">Color</span>
              <ColorPalette value={draft.titleColor} onChange={v => onDraftChange({ titleColor: v })} />
            </div>
          </div>

          <div>
            <label className={fieldLabelCls}>Subtitle</label>
            <input className={inputCls} value={draft.subtitle} onChange={e => onDraftChange({ subtitle: e.target.value, subtitleRichText: undefined })} placeholder='e.g. "with"' />
            <EditHtmlLink fieldLabel="Subtitle" plainValue={draft.subtitle} richValue={draft.subtitleRichText} allowBold
              onApply={(plain, rich) => onDraftChange({ subtitle: plain, subtitleRichText: rich })} />
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs text-zinc-500">Color</span>
              <ColorPalette value={draft.subtitleColor} onChange={v => onDraftChange({ subtitleColor: v })} />
            </div>
          </div>

          <div>
            <label className={fieldLabelCls}>Subtitle 2</label>
            <input className={inputCls} value={draft.subtitle2} onChange={e => onDraftChange({ subtitle2: e.target.value, subtitle2RichText: undefined })} placeholder="Optional second line" />
            <EditHtmlLink fieldLabel="Subtitle 2" plainValue={draft.subtitle2} richValue={draft.subtitle2RichText} allowBold
              onApply={(plain, rich) => onDraftChange({ subtitle2: plain, subtitle2RichText: rich })} />
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs text-zinc-500">Color</span>
              <ColorPalette value={draft.subtitle2Color} onChange={v => onDraftChange({ subtitle2Color: v })} />
            </div>
          </div>

          <div>
            <label className={fieldLabelCls}>Presenters (one per line, or semicolon-separated)</label>
            <textarea className={inputCls + ' resize-none font-mono'} rows={3} value={draft.presenters}
              onChange={e => onDraftChange({ presenters: e.target.value, presentersRichText: undefined })} placeholder={'Name One,\nName Two\n& Name Three'} />
            <EditHtmlLink fieldLabel="Presenters" plainValue={draft.presenters} richValue={draft.presentersRichText} allowBold={draft.presentersFont !== '92NY Text'}
              onApply={(plain, rich) => onDraftChange({ presenters: plain, presentersRichText: rich })} />
            <div className="mt-1.5">
              <FontPicker value={draft.presentersFont} onChange={f => onDraftChange({
                presentersFont: f,
                ...(f === '92NY Text' && draft.presentersWeight !== 'regular' ? { presentersWeight: 'regular' as TheinhardtWeight } : {}),
              })} />
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <input type="checkbox" id="newSlidePresentersItalic" checked={draft.presentersItalic}
                onChange={e => onDraftChange({ presentersItalic: e.target.checked })} className="rounded" />
              <label htmlFor="newSlidePresentersItalic" className="text-sm text-zinc-300">Italic</label>
            </div>
            <div className="mt-1.5">
              <WeightPicker value={draft.presentersWeight} onChange={w => onDraftChange({ presentersWeight: w })} disabled={draft.presentersFont === '92NY Text'} />
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs text-zinc-500">Color</span>
              <ColorPalette value={draft.presentersColor} onChange={v => onDraftChange({ presentersColor: v })} />
            </div>
          </div>

          <div>
            <label className={fieldLabelCls}>Program / Work Title</label>
            <input className={inputCls} value={draft.programTitle} onChange={e => onDraftChange({ programTitle: e.target.value, programTitleRichText: undefined })} placeholder='e.g. "American Caprices"' />
            <EditHtmlLink fieldLabel="Program / Work Title" plainValue={draft.programTitle} richValue={draft.programTitleRichText} allowBold={draft.programTitleFont !== '92NY Text'}
              onApply={(plain, rich) => onDraftChange({ programTitle: plain, programTitleRichText: rich })} />
            <div className="mt-1.5">
              <FontPicker value={draft.programTitleFont} onChange={f => onDraftChange({
                programTitleFont: f,
                ...(f === '92NY Text' && draft.programTitleWeight !== 'regular' ? { programTitleWeight: 'regular' as TheinhardtWeight } : {}),
              })} />
            </div>
            <div className="mt-1.5">
              <WeightPicker value={draft.programTitleWeight} onChange={w => onDraftChange({ programTitleWeight: w })} disabled={draft.programTitleFont === '92NY Text'} />
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <input type="checkbox" id="newSlideProgramTitleItalic" checked={draft.programTitleItalic}
                onChange={e => onDraftChange({ programTitleItalic: e.target.checked })} className="rounded" />
              <label htmlFor="newSlideProgramTitleItalic" className="text-sm text-zinc-300">Italic</label>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs text-zinc-500">Color</span>
              <ColorPalette value={draft.programTitleColor} onChange={v => onDraftChange({ programTitleColor: v })} />
            </div>
          </div>

          <div>
            <label className={fieldLabelCls}>Series name</label>
            <input className={inputCls} value={draft.seriesName} onChange={e => onDraftChange({ seriesName: e.target.value, seriesNameRichText: undefined })} placeholder="RECANATI-KAPLAN TALKS" />
            <EditHtmlLink fieldLabel="Series name" plainValue={draft.seriesName} richValue={draft.seriesNameRichText} allowBold
              onApply={(plain, rich) => onDraftChange({ seriesName: plain, seriesNameRichText: rich })} />
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs text-zinc-500">Color</span>
              <ColorPalette value={draft.seriesNameColor} onChange={v => onDraftChange({ seriesNameColor: v })} />
            </div>
          </div>

          <div>
            <label className={fieldLabelCls}>Text alignment</label>
            <div className="flex gap-1 bg-zinc-800 p-1 rounded-lg">
              {(['left', 'center'] as const).map(align => (
                <button key={align} type="button" onClick={() => onDraftChange({ textAlign: align })}
                  className={`flex-1 text-xs px-3 py-1.5 rounded-md transition-colors font-medium ${
                    draft.textAlign === align ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
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
            {draft.images.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {draft.images.map((img, i) => (
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
                    <button
                      type="button"
                      onClick={() => runAutoCropFace(img.id)}
                      disabled={autoCroppingId === img.id}
                      title="Run face detection and crop to a headshot"
                      className="mt-1 w-full text-center text-[9px] text-zinc-500 hover:text-white leading-none py-0.5 disabled:opacity-60"
                    >
                      {autoCroppingId === img.id ? 'Detecting…' : 'Auto-crop face'}
                    </button>
                    {autoCropNotice?.id === img.id && (
                      <p className="text-[9px] text-zinc-600 text-center leading-tight">{autoCropNotice.text}</p>
                    )}
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
          <button onClick={handleBuild} disabled={!draft.title.trim() || building}
            className="flex-1 py-2 text-sm font-medium bg-white text-black rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {building ? 'Building…' : 'Build'}
          </button>
        </div>
      </div>
    </div>
  )
}
