// Reads an image's natural pixel dimensions without rendering it anywhere.
// Used for deriving an approximate rendered height ratio for training-data
// logging, since the editor itself only stores a width-based size control,
// not the image's own aspect ratio.
export function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('Failed to load image for dimension check'))
    img.src = dataUrl
  })
}

// Downscales an image data URL so uploads (e.g. full-resolution phone photos)
// don't bloat storage. Never upscales. Defaults to WebP, which keeps alpha
// transparency (needed for logos/cutouts) at a fraction of PNG's size; pass
// 'image/jpeg' for callers that specifically want JPEG output instead.
export function resizeImageDataUrl(
  dataUrl: string,
  maxDim: number,
  quality = 0.85,
  format: 'image/webp' | 'image/jpeg' = 'image/webp'
): Promise<string> {
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
      if (format === 'image/jpeg') {
        // JPEG has no alpha channel — fill white first so transparent source
        // areas (e.g. a cutout PNG) don't render as black.
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, w, h)
      }
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL(format, quality))
    }
    img.onerror = () => reject(new Error('Failed to load image for resizing'))
    img.src = dataUrl
  })
}
