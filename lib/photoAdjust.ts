// Non-destructive photo adjustments (contrast/saturation/shadows/black &
// white point/B&W) -- stored as parameters (SlideData.imagePhotoAdjustments
// / StaggerImage.photoAdjustments), never baked into the stored image url,
// so the original upload is never modified and a slot's adjustments survive
// replacing the photo underneath it (same convention as crop/size on
// replace -- see EditorPanel.tsx's handleImageUpload comment).
//
// `applyPhotoAdjustmentsInDom` is the ONE canonical processor for every
// place an adjusted image actually needs to appear on screen or in an
// export: SlideCanvas's own live preview (via a useEffect -- see its
// comment), the Photo Editor modal's own live preview (called directly,
// with a capped maxDim for responsiveness while dragging), and PNG export
// (lib/renderSlide.ts runs it inside the export's own headless-Chromium
// page via Puppeteer's page.evaluate, since that page is static markup with
// no React/hydration -- a useEffect never fires there). It MUST stay fully
// self-contained (no references to anything outside its own body, including
// other exports of this module) because page.evaluate serializes only the
// literal source text of the function it's given -- an external reference
// would be a ReferenceError in the page's own JS context. This is also
// exactly why the pixel math is nested inside it rather than a separate
// top-level export: one literal function body, reused verbatim in both the
// normal bundle and the injected-into-Puppeteer path, so there is no way
// for the two to drift apart and produce different pixels.

export interface PhotoAdjustments {
  contrast: number // -100 to 100
  saturation: number // -100 to 100
  shadows: number // -100 to 100 -- lifts (positive) or deepens (negative) dark areas
  blackPoint: number // 0 to 254
  whitePoint: number // 1 to 255, always > blackPoint
  blackAndWhite: boolean
}

export const DEFAULT_PHOTO_ADJUSTMENTS: PhotoAdjustments = {
  contrast: 0,
  saturation: 0,
  shadows: 0,
  blackPoint: 0,
  whitePoint: 255,
  blackAndWhite: false,
}

export function hasNonDefaultAdjustments(adj: PhotoAdjustments | undefined): boolean {
  if (!adj) return false
  return (
    adj.contrast !== 0 || adj.saturation !== 0 || adj.shadows !== 0 ||
    adj.blackPoint !== 0 || adj.whitePoint !== 255 || adj.blackAndWhite
  )
}

// The pixel pipeline itself, as a normal top-level export for callers that
// import this module the ordinary way (not through page.evaluate) -- today
// that's only PhotoEditorModal's own live preview, which redraws a cached
// ImageData directly via canvas on every slider change instead of going
// through an <img src> round-trip (an img-swap-per-tick would flash the
// unadjusted image on every drag frame, undermining "keep sliders
// responsive"). This function's BODY is intentionally duplicated verbatim
// inside applyPhotoAdjustmentsInDom below (nested, not called by
// reference) -- that function is handed directly to Puppeteer's
// page.evaluate, which serializes only the literal source text of the one
// function it's given, so a call out to this export would be a
// ReferenceError in the page's own JS context. lib/__tests__/
// photoAdjust.test.ts asserts both copies produce byte-identical output
// for the same input, specifically to catch the two drifting apart.
export function processPhotoAdjustments(d: Uint8ClampedArray, adj: PhotoAdjustments): void {
  const bp = adj.blackPoint
  const wp = Math.max(adj.whitePoint, bp + 1)
  const range = wp - bp
  const contrastFactor = 1 + adj.contrast / 100
  const shadowAmount = (adj.shadows / 100) * 100
  const satFactor = 1 + adj.saturation / 100
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i]
    let g = d[i + 1]
    let b = d[i + 2]

    // 1. Black/white point remap.
    r = ((r - bp) / range) * 255
    g = ((g - bp) / range) * 255
    b = ((b - bp) / range) * 255

    // 2. Shadows -- weighted toward darker input values, fading out toward
    // highlights, so lifting/deepening shadows doesn't flatten or blow out
    // the rest of the image.
    const wR = Math.pow(1 - Math.min(255, Math.max(0, r)) / 255, 2)
    const wG = Math.pow(1 - Math.min(255, Math.max(0, g)) / 255, 2)
    const wB = Math.pow(1 - Math.min(255, Math.max(0, b)) / 255, 2)
    r += shadowAmount * wR
    g += shadowAmount * wG
    b += shadowAmount * wB

    // 3. Contrast -- scale around the midpoint.
    r = (r - 128) * contrastFactor + 128
    g = (g - 128) * contrastFactor + 128
    b = (b - 128) * contrastFactor + 128

    // 4. Saturation -- scale each channel's distance from luminance.
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    r = lum + (r - lum) * satFactor
    g = lum + (g - lum) * satFactor
    b = lum + (b - lum) * satFactor

    // 5. Black & white -- overrides saturation entirely for this pixel.
    if (adj.blackAndWhite) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b
      r = gray; g = gray; b = gray
    }

    d[i] = Math.min(255, Math.max(0, r))
    d[i + 1] = Math.min(255, Math.max(0, g))
    d[i + 2] = Math.min(255, Math.max(0, b))
  }
}

// Finds every <img data-adjust="..."> in the document (data-raw-src holds
// the untouched source url), processes each through the canvas/LUT
// pipeline below, and swaps the element's own src to the result --
// idempotent (clears both data attributes once done, so a second call
// finds nothing left to do, which keeps multiple mounted SlideCanvas
// instances -- e.g. a dashboard grid of thumbnails -- from redundantly
// reprocessing each other's images; see SlideCanvas.tsx's own comment).
// `maxDim`, when given, downscales the WORKING copy before processing (the
// Photo Editor modal's own live preview uses ~1000px for responsive
// dragging) -- SlideCanvas's own always-on rendering and PNG export both
// call this with no cap, so the slide itself and its export always show
// the full-resolution result; only the modal's in-progress preview is
// ever degraded, and only while it's open.
export function applyPhotoAdjustmentsInDom(maxDim?: number): Promise<void> {
  // Verbatim copy of processPhotoAdjustments above -- see this function's
  // own top comment for why it can't just call that export instead.
  function processImageData(d: Uint8ClampedArray, adj: PhotoAdjustments) {
    const bp = adj.blackPoint
    const wp = Math.max(adj.whitePoint, bp + 1)
    const range = wp - bp
    const contrastFactor = 1 + adj.contrast / 100
    const shadowAmount = (adj.shadows / 100) * 100
    const satFactor = 1 + adj.saturation / 100
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i]
      let g = d[i + 1]
      let b = d[i + 2]

      // 1. Black/white point remap.
      r = ((r - bp) / range) * 255
      g = ((g - bp) / range) * 255
      b = ((b - bp) / range) * 255

      // 2. Shadows -- weighted toward darker input values, fading out
      // toward highlights, so lifting/deepening shadows doesn't flatten or
      // blow out the rest of the image.
      const wR = Math.pow(1 - Math.min(255, Math.max(0, r)) / 255, 2)
      const wG = Math.pow(1 - Math.min(255, Math.max(0, g)) / 255, 2)
      const wB = Math.pow(1 - Math.min(255, Math.max(0, b)) / 255, 2)
      r += shadowAmount * wR
      g += shadowAmount * wG
      b += shadowAmount * wB

      // 3. Contrast -- scale around the midpoint.
      r = (r - 128) * contrastFactor + 128
      g = (g - 128) * contrastFactor + 128
      b = (b - 128) * contrastFactor + 128

      // 4. Saturation -- scale each channel's distance from luminance.
      const lum = 0.299 * r + 0.587 * g + 0.114 * b
      r = lum + (r - lum) * satFactor
      g = lum + (g - lum) * satFactor
      b = lum + (b - lum) * satFactor

      // 5. Black & white -- overrides saturation entirely for this pixel.
      if (adj.blackAndWhite) {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b
        r = gray; g = gray; b = gray
      }

      d[i] = Math.min(255, Math.max(0, r))
      d[i + 1] = Math.min(255, Math.max(0, g))
      d[i + 2] = Math.min(255, Math.max(0, b))
    }
  }

  const imgs = Array.from(document.querySelectorAll('img[data-adjust]')) as HTMLImageElement[]
  if (imgs.length === 0) return Promise.resolve()

  return Promise.all(imgs.map(img => new Promise<void>(resolve => {
    const adjJson = img.getAttribute('data-adjust')
    const rawSrc = img.getAttribute('data-raw-src')
    if (!adjJson || !rawSrc) { resolve(); return }
    let adj: PhotoAdjustments
    try { adj = JSON.parse(adjJson) } catch { resolve(); return }

    const source = new Image()
    source.crossOrigin = 'anonymous'
    source.onload = () => {
      let w = source.naturalWidth
      let h = source.naturalHeight
      if (maxDim && Math.max(w, h) > maxDim) {
        const ratio = maxDim / Math.max(w, h)
        w = Math.round(w * ratio)
        h = Math.round(h * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(); return }
      ctx.drawImage(source, 0, 0, w, h)
      const imageData = ctx.getImageData(0, 0, w, h)
      processImageData(imageData.data, adj)
      ctx.putImageData(imageData, 0, 0)
      img.removeAttribute('data-adjust')
      img.removeAttribute('data-raw-src')
      img.onload = () => resolve()
      img.src = canvas.toDataURL('image/png')
    }
    source.onerror = () => resolve()
    source.src = rawSrc
  }))).then(() => undefined)
}
