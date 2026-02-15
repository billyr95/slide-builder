'use client'

import { SlideData, FontFamily } from '@/lib/types'
import { useRef } from 'react'

interface EditorPanelProps {
  data: SlideData
  onChange: (data: SlideData) => void
}

const inputCls = `
  w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white
  focus:outline-none focus:border-zinc-500 transition-colors placeholder-zinc-500
`
const labelCls = `block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider`
const sectionCls = `border-b border-zinc-800 pb-5 mb-5`

export default function EditorPanel({ data, onChange }: EditorPanelProps) {
  const imageInputRef = useRef<HTMLInputElement>(null)

  function set<K extends keyof SlideData>(key: K, value: SlideData[K]) {
    onChange({ ...data, [key]: value })
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      set('imageUrl', ev.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  function clearImage() {
    set('imageUrl', '')
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  return (
    <div className="flex flex-col gap-0 text-white">

      {/* Content */}
      <div className={sectionCls}>
        <p className="text-xs font-semibold text-zinc-300 uppercase tracking-widest mb-4">Content</p>

        <div className="mb-3">
          <label className={labelCls}>Label (e.g. TONIGHT)</label>
          <input className={inputCls} value={data.label} onChange={e => set('label', e.target.value)} placeholder="TONIGHT" />
        </div>

        <div className="mb-3">
          <label className={labelCls}>Title</label>
          <textarea className={inputCls + ' resize-none'} rows={2} value={data.title} onChange={e => set('title', e.target.value)} placeholder="Event title" />
        </div>

        <div className="mb-3 flex items-center gap-2">
          <input
            type="checkbox"
            id="titleItalic"
            checked={data.titleItalic}
            onChange={e => set('titleItalic', e.target.checked)}
            className="rounded"
          />
          <label htmlFor="titleItalic" className="text-sm text-zinc-300">Title in italic</label>
        </div>

        <div className="mb-3">
          <label className={labelCls}>Subtitle (e.g. "with")</label>
          <input className={inputCls} value={data.subtitle} onChange={e => set('subtitle', e.target.value)} placeholder="with" />
        </div>

        <div className="mb-0">
          <label className={labelCls}>Presenters (one per line)</label>
          <textarea
            className={inputCls + ' resize-none font-mono'}
            rows={4}
            value={data.presenters}
            onChange={e => set('presenters', e.target.value)}
            placeholder={"Name One,\nName Two\n& Name Three"}
          />
        </div>
      </div>

      {/* Image */}
      <div className={sectionCls}>
        <p className="text-xs font-semibold text-zinc-300 uppercase tracking-widest mb-4">Image</p>
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        <div className="flex gap-2">
          <button
            onClick={() => imageInputRef.current?.click()}
            className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white text-sm py-2 px-3 rounded-lg transition-colors"
          >
            {data.imageUrl ? 'Replace image' : 'Upload image'}
          </button>
          {data.imageUrl && (
            <button
              onClick={clearImage}
              className="bg-zinc-800 hover:bg-red-900 text-zinc-400 hover:text-white text-sm py-2 px-3 rounded-lg transition-colors"
            >
              Remove
            </button>
          )}
        </div>
        {data.imageUrl && (
          <div className="mt-2 rounded-lg overflow-hidden border border-zinc-700 bg-zinc-900">
            <img src={data.imageUrl} alt="Preview" className="max-h-24 mx-auto object-contain p-2" />
          </div>
        )}
        <div className="mt-2">
          <label className={labelCls}>Alt text</label>
          <input className={inputCls} value={data.imageAlt} onChange={e => set('imageAlt', e.target.value)} placeholder="Image description" />
        </div>
      </div>

      {/* Style */}
      <div className={sectionCls}>
        <p className="text-xs font-semibold text-zinc-300 uppercase tracking-widest mb-4">Style</p>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <label className={labelCls}>Background</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={data.backgroundColor}
                onChange={e => set('backgroundColor', e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-zinc-600 bg-transparent"
              />
              <input
                className={inputCls + ' font-mono text-xs'}
                value={data.backgroundColor}
                onChange={e => set('backgroundColor', e.target.value)}
                maxLength={7}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Text</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={data.textColor}
                onChange={e => set('textColor', e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-zinc-600 bg-transparent"
              />
              <input
                className={inputCls + ' font-mono text-xs'}
                value={data.textColor}
                onChange={e => set('textColor', e.target.value)}
                maxLength={7}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Accent</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={data.accentColor}
                onChange={e => set('accentColor', e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-zinc-600 bg-transparent"
              />
              <input
                className={inputCls + ' font-mono text-xs'}
                value={data.accentColor}
                onChange={e => set('accentColor', e.target.value)}
                maxLength={7}
              />
            </div>
          </div>
        </div>

        <div>
          <label className={labelCls}>Font Family</label>
          <div className="flex gap-2">
            {(['serif', 'sans'] as FontFamily[]).map(f => (
              <button
                key={f}
                onClick={() => set('fontFamily', f)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm border transition-colors ${
                  data.fontFamily === f
                    ? 'bg-white text-black border-white'
                    : 'bg-transparent text-zinc-400 border-zinc-700 hover:border-zinc-500'
                }`}
                style={{ fontFamily: f === 'serif' ? "'Playfair Display', serif" : "'DM Sans', sans-serif" }}
              >
                {f === 'serif' ? 'Playfair Display' : 'DM Sans'}
              </button>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
