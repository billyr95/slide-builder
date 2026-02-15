'use client'

import { useState, useRef } from 'react'
import ReactCrop, {
  Crop,
  PixelCrop,
  centerCrop,
  makeAspectCrop,
} from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

interface CropModalProps {
  imageSrc: string
  onComplete: (croppedDataUrl: string) => void
  onCancel: () => void
}

async function getCroppedImg(image: HTMLImageElement, pixelCrop: PixelCrop): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height
  const ctx = canvas.getContext('2d')!

  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height

  ctx.drawImage(
    image,
    pixelCrop.x * scaleX,
    pixelCrop.y * scaleY,
    pixelCrop.width * scaleX,
    pixelCrop.height * scaleY,
    0, 0,
    pixelCrop.width,
    pixelCrop.height,
  )
  return canvas.toDataURL('image/png')
}

const ASPECT_OPTIONS = [
  { label: 'Free',   value: undefined },
  { label: 'Native', value: 'native' as const },
  { label: '1:1',    value: 1 },
  { label: '4:3',    value: 4 / 3 },
  { label: '16:9',   value: 16 / 9 },
  { label: '3:4',    value: 3 / 4 },
]

export default function CropModal({ imageSrc, onComplete, onCancel }: CropModalProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [activeLabel, setActiveLabel] = useState('Free')
  const [aspect, setAspect] = useState<number | undefined>(undefined)
  const [nativeAspect, setNativeAspect] = useState<number | undefined>(undefined)

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth, naturalHeight, width, height } = e.currentTarget
    setNativeAspect(naturalWidth / naturalHeight)
    // Start with a free centered crop at 80%
    setCrop(centerCrop({ unit: '%', width: 80, height: 80 }, width, height))
  }

  function selectAspect(label: string) {
    setActiveLabel(label)
    const img = imgRef.current
    if (!img) return

    if (label === 'Free') {
      setAspect(undefined)
    } else {
      const num = label === 'Native'
        ? nativeAspect
        : (ASPECT_OPTIONS.find(a => a.label === label)?.value as number | undefined)
      if (!num) return
      setAspect(num)
      setCrop(centerCrop(
        makeAspectCrop({ unit: '%', width: 80 }, num, img.width, img.height),
        img.width, img.height,
      ))
    }
  }

  async function handleApply() {
    if (!completedCrop || !imgRef.current) return
    const cropped = await getCroppedImg(imgRef.current, completedCrop)
    onComplete(cropped)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-700 shadow-2xl flex flex-col overflow-hidden"
        style={{ width: 640, maxHeight: '92vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 flex-shrink-0">
          <h2 className="text-sm font-semibold text-white">Crop Image</h2>
          <button onClick={onCancel} className="text-zinc-500 hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>

        {/* Crop canvas */}
        <div className="flex-1 overflow-auto flex items-center justify-center bg-zinc-950 p-4" style={{ minHeight: 0 }}>
          <ReactCrop
            crop={crop}
            onChange={c => setCrop(c)}
            onComplete={c => setCompletedCrop(c)}
            aspect={aspect}
            keepSelection
            style={{ maxHeight: '100%', maxWidth: '100%' }}
          >
            <img
              ref={imgRef}
              src={imageSrc}
              onLoad={onImageLoad}
              style={{ maxHeight: 420, maxWidth: '100%', display: 'block' }}
              alt="Crop"
            />
          </ReactCrop>
        </div>

        {/* Controls */}
        <div className="px-5 py-4 border-t border-zinc-800 flex flex-col gap-4 flex-shrink-0">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Aspect Ratio</p>
            <div className="flex gap-1.5">
              {ASPECT_OPTIONS.map(a => (
                <button
                  key={a.label}
                  onClick={() => selectAspect(a.label)}
                  disabled={a.label === 'Native' && !nativeAspect}
                  className={`flex-1 text-xs py-1.5 rounded-md border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                    activeLabel === a.label
                      ? 'bg-white text-black border-white font-medium'
                      : 'bg-transparent text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={onCancel}
              className="flex-1 py-2 text-sm text-zinc-400 border border-zinc-700 rounded-lg hover:border-zinc-500 transition-colors">
              Cancel
            </button>
            <button onClick={handleApply} disabled={!completedCrop}
              className="flex-1 py-2 text-sm font-medium bg-white text-black rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Apply Crop
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}