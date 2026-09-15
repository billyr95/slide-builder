'use client'

import { useRef, useState } from 'react'
import { ScreenType } from '@/lib/trainTypes'
import { parsePastedSlide, ParsedSlideFields } from '@/lib/parsePastedSlide'
import { resizeImageDataUrl } from '@/lib/resizeImage'

const MAX_IMAGE_DIM = 1600

export interface DroppedImage {
  id: string
  url: string
  name: string
}

export interface BuildResult {
  screenType: ScreenType
  fields: ParsedSlideFields
  images: DroppedImage[]
}

interface NewSlideModalProps {
  initialScreenType: ScreenType
  onBuild: (result: BuildResult) => void
  onSkip: () => void
  onCancel: () => void
}

const PLACEHOLDER = `Label: TONIGHT
Title: An Evening with Jane Doe
Subtitle: in Conversation with
Subtitle2: John Smith
Presenters: Jane Doe; John Smith
Series: Recanati-Kaplan Talks`

export default function NewSlideModal({ initialScreenType, onBuild, onSkip, onCancel }: NewSlideModalProps) {
  const [screenType, setScreenType] = useState<ScreenType>(initialScreenType)
  const [text, setText] = useState('')
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
    onBuild({ screenType, fields: parsePastedSlide(text), images })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-700 shadow-2xl flex flex-col overflow-hidden"
        style={{ width: 640, maxHeight: '92vh' }}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 flex-shrink-0">
          <h2 className="text-sm font-semibold text-white">New Slide</h2>
          <button onClick={onCancel} className="text-zinc-500 hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-auto p-5 flex flex-col gap-5">
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
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Paste content</p>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={7}
              placeholder={PLACEHOLDER}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-zinc-500 resize-none placeholder-zinc-600"
            />
            <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed">
              One field per line — <span className="font-mono text-zinc-400">Label:</span>{' '}
              <span className="font-mono text-zinc-400">Title:</span>{' '}
              <span className="font-mono text-zinc-400">Subtitle:</span>{' '}
              <span className="font-mono text-zinc-400">Subtitle2:</span>{' '}
              <span className="font-mono text-zinc-400">Presenters:</span>{' '}
              <span className="font-mono text-zinc-400">Series:</span>{' '}
              — unrecognized lines are ignored. Only Title is required.
            </p>
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
          <button onClick={handleBuild}
            className="flex-1 py-2 text-sm font-medium bg-white text-black rounded-lg hover:bg-zinc-200 transition-colors">
            Build
          </button>
        </div>
      </div>
    </div>
  )
}
