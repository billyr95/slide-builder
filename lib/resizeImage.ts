// Downscales an image data URL so uploads (e.g. full-resolution phone photos)
// don't bloat SlideData/templates.json. Never upscales. Re-encodes as WebP,
// which keeps alpha transparency (needed for logos/cutouts) at a fraction of PNG's size.
export function resizeImageDataUrl(dataUrl: string, maxDim: number, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'))
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/webp', quality))
    }
    img.onerror = () => reject(new Error('Failed to load image for resizing'))
    img.src = dataUrl
  })
}
