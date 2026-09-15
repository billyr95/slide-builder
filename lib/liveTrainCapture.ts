import { SlideData, Orientation } from './types'
import { TrainEntry, TrainImage, ScreenType } from './trainTypes'
import { getImageDimensions, resizeImageDataUrl } from './resizeImage'

const DIMS: Record<Orientation, { w: number; h: number }> = {
  landscape: { w: 1920, h: 1080 },
  portrait: { w: 1080, h: 1920 },
}

// Matches the compression already applied to /train uploads (see
// components/train/TrainForm.tsx's own TRAIN_IMAGE_MAX_DIM/QUALITY) --
// downscaled + re-encoded as JPEG so these live-logged entries store the
// same shape and don't blow through IndexedDB on every export.
const LIVE_IMAGE_MAX_DIM = 1000
const LIVE_IMAGE_QUALITY = 0.8

function collectRawImages(data: SlideData): { url: string; name: string }[] {
  if (data.imageMode === 'single') {
    return data.imageUrl ? [{ url: data.imageUrl, name: data.imageAlt || 'image' }] : []
  }
  if (data.imageMode === 'none') return []
  return (data.staggerImages || [])
    .filter(img => img.url)
    .map((img, i) => ({ url: img.url, name: img.alt || `image-${i + 1}` }))
}

async function toCompressedTrainImage(raw: { url: string; name: string }): Promise<TrainImage> {
  const url = await resizeImageDataUrl(raw.url, LIVE_IMAGE_MAX_DIM, LIVE_IMAGE_QUALITY, 'image/jpeg')
  return {
    id: Math.random().toString(36).slice(2),
    url,
    mediaType: 'image/jpeg',
    name: raw.name,
  }
}

// The approximate width ratio (0-1 of full slide width) implied by the
// first placed image's current size control.
function firstImageWidthRatio(data: SlideData, orientation: Orientation): number | undefined {
  const dims = DIMS[orientation]

  if (data.imageMode === 'single') {
    if (!data.imageUrl) return undefined
    // imageSize is a %-of-container width control, not a %-of-full-slide
    // one (the container itself is 40-66% of the slide depending on layout
    // variant) -- treated as an approximate stand-in for width_ratio, same
    // simplification used by the manual-upload heuristic auto-fill.
    return Math.max(0, Math.min(1, (data.imageSize ?? 100) / 100))
  }

  if (data.imageMode === 'none') return undefined

  const first = (data.staggerImages || []).find(img => img.url)
  if (!first) return undefined
  const scalePx = first.scale || data.staggerSize || 250
  return Math.max(0, Math.min(1, scalePx / dims.w))
}

export async function buildLiveTrainEntry(data: SlideData, orientation: Orientation, screenType: ScreenType): Promise<TrainEntry> {
  const dims = DIMS[orientation]
  const rawImages = collectRawImages(data)

  const images = (await Promise.all(
    rawImages.map(raw =>
      toCompressedTrainImage(raw).catch(e => {
        console.warn('Failed to compress an image for training-data logging, skipping it', e)
        return null
      })
    )
  )).filter((img): img is TrainImage => img !== null)

  const widthRatio = firstImageWidthRatio(data, orientation)

  let imageHeightRatio: number | undefined
  if (images[0] && widthRatio !== undefined) {
    try {
      // Measured off the already-compressed image -- resizeImageDataUrl
      // scales both dimensions equally, so its aspect ratio still matches
      // the original.
      const { width, height } = await getImageDimensions(images[0].url)
      if (width > 0) {
        // Rendered height follows the image's own aspect ratio at its
        // current width -- an approximation for single-image mode, which
        // also has a maxHeight clamp this doesn't account for.
        imageHeightRatio = (widthRatio * dims.w * (height / width)) / dims.h
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
    presentersItalic: data.presentersItalic,

    seriesName: data.showSeriesName ? data.seriesName : '',
    // TODO: the main editor has no QR code feature yet -- always false
    // until one exists.
    hasQrCode: false,
    listeningCredit: data.showListeningCredit ? data.listeningCredit : '',

    backgroundColor: data.backgroundColor,
    textColor: data.textColor,

    // Structural count of placed images, independent of whether any of
    // them individually failed to compress above (images.length can be
    // shorter in that rare case -- the queue UI already handles that
    // mismatch gracefully, same as an 'upload' entry whose source files no
    // longer exist).
    images,
    imageCount: rawImages.length,

    titleFontSizePx: data.titleSize,
    subtitleFontSizePx: data.subtitle ? data.subtitleSize : undefined,
    subtitle2FontSizePx: data.subtitle2 ? data.subtitle2Size : undefined,
    imageWidthRatio: widthRatio,
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
