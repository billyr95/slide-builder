import { SlideData, Orientation } from './types'
import { TrainEntry, ScreenType } from './trainTypes'
import { getImageDimensions } from './resizeImage'

const DIMS: Record<Orientation, { w: number; h: number }> = {
  landscape: { w: 1920, h: 1080 },
  portrait: { w: 1080, h: 1920 },
}

function imageCount(data: SlideData): number {
  if (data.imageMode === 'single') return data.imageUrl ? 1 : 0
  if (data.imageMode === 'none') return 0
  return (data.staggerImages || []).filter(img => img.url).length
}

// The first placed image's data URL and the approximate width ratio (0-1 of
// full slide width) implied by its current size control. Read-only, in
// memory here — never persisted onto the entry itself (see TrainEntry's
// comment on why no image file is attached by default).
function getFirstImage(data: SlideData, orientation: Orientation): { url: string; widthRatio: number } | null {
  const dims = DIMS[orientation]

  if (data.imageMode === 'single') {
    if (!data.imageUrl) return null
    // imageSize is a %-of-container width control, not a %-of-full-slide
    // one (the container itself is 40-66% of the slide depending on layout
    // variant) -- treated as an approximate stand-in for width_ratio, same
    // simplification used by the manual-upload heuristic auto-fill.
    return { url: data.imageUrl, widthRatio: Math.max(0, Math.min(1, (data.imageSize ?? 100) / 100)) }
  }

  if (data.imageMode === 'none') return null

  const first = (data.staggerImages || []).find(img => img.url)
  if (!first) return null
  const scalePx = first.scale || data.staggerSize || 250
  return { url: first.url, widthRatio: Math.max(0, Math.min(1, scalePx / dims.w)) }
}

export async function buildLiveTrainEntry(data: SlideData, orientation: Orientation, screenType: ScreenType): Promise<TrainEntry> {
  const dims = DIMS[orientation]
  const count = imageCount(data)
  const first = getFirstImage(data, orientation)

  let imageHeightRatio: number | undefined
  if (first) {
    try {
      const { width, height } = await getImageDimensions(first.url)
      if (width > 0) {
        // Rendered height follows the image's own aspect ratio at its
        // current width -- an approximation for single-image mode, which
        // also has a maxHeight clamp this doesn't account for.
        imageHeightRatio = (first.widthRatio * dims.w * (height / width)) / dims.h
      }
    } catch (e) {
      console.warn('Could not read image dimensions for training-data logging', e)
    }
  }

  return {
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    createdAt: new Date().toISOString(),
    source: 'live',

    screenType,
    orientation,
    hasLabel: !!data.label.trim(),
    hasLogos: (data.logos || []).length > 0,

    label: data.label,
    title: data.title,
    titleFont: data.titleFont,
    titleItalic: data.titleItalic,
    subtitle: data.subtitle,
    subtitleWeight: data.subtitleWeight,
    subtitle2: data.subtitle2,
    presenters: data.presenters,
    presentersFont: data.presentersFont,

    seriesName: data.showSeriesName ? data.seriesName : '',
    // TODO: the main editor has no QR code feature yet -- always false
    // until one exists.
    hasQrCode: false,
    listeningCredit: data.showListeningCredit ? data.listeningCredit : '',

    backgroundColor: data.backgroundColor,
    textColor: data.textColor,

    // No image file is attached by default -- these are the user's own
    // uploads, not something worth re-storing wholesale on every export.
    // imageCount alone (below) already captures the structural fact that
    // matters for training. Revisit if a rendered-slide snapshot ever
    // becomes useful instead of per-image file storage.
    images: [],
    imageCount: count,

    titleFontSizePx: data.titleSize,
    subtitleFontSizePx: data.subtitle ? data.subtitleSize : undefined,
    subtitle2FontSizePx: data.subtitle2 ? data.subtitle2Size : undefined,
    imageWidthRatio: first?.widthRatio,
    imageHeightRatio,

    liveStyle: {
      accentColor: data.accentColor,
      labelWeight: data.labelWeight,

      subtitleInline: data.subtitleInline,
      subtitle2Weight: data.subtitle2Weight,

      presentersWeight: data.presentersWeight,
      presentersSize: data.presentersSize,

      imageMode: data.imageMode,
      imageSize: data.imageSize,
      imageOverlap: data.imageOverlap,
      staggerSize: data.staggerSize,
      staggerImagePlacements: (data.staggerImages || [])
        .filter(img => img.url)
        .map(img => ({ y: img.y, scale: img.scale })),

      logoCount: (data.logos || []).length,
      logoSize: data.logoSize,

      showSeriesName: data.showSeriesName,
      showListeningCredit: data.showListeningCredit,
    },
  }
}
