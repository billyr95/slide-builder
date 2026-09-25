import { SlideData, Orientation } from './types'
import { TrainEntry, TrainImage, ScreenType } from './trainTypes'
import { getImageDimensions, resizeImageDataUrl } from './resizeImage'
import { suggestTitleFontSize, suggestSubtitleFontSize, suggestImagePosition } from './slideHeuristics'
import { effectiveImageSizePx } from './imageSizing'

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
    // imageSize is a genuine absolute pixel width now (see
    // lib/imageSizing.ts) -- this is an exact ratio, not the approximation
    // it used to be back when imageSize was a %-of-container value.
    return Math.max(0, Math.min(1, effectiveImageSizePx(data, orientation) / dims.w))
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

  // Recompute what the heuristic would suggest right now for the same
  // inputs, and compare against the real final value -- see TrainEntry's
  // comment on titleFontSizeSuggestedPx for why this is a proxy for "was
  // this manually overridden," not literal tracking.
  const titleLineCount = Math.max(1, data.title.split('\n').length)
  const titleFontSizeSuggestedPx = suggestTitleFontSize(data.title.length, titleLineCount, screenType, !!data.subtitle)
  const titleSuggestion = {
    titleFontSizeSuggestedPx,
    titleFontSizeWasOverridden: data.titleSize !== titleFontSizeSuggestedPx,
  }

  const subtitleSuggestion = data.subtitle
    ? (() => {
        const subtitleFontSizeSuggestedPx = suggestSubtitleFontSize(data.subtitle.length)
        return {
          subtitleFontSizeSuggestedPx,
          subtitleFontSizeWasOverridden: data.subtitleSize !== subtitleFontSizeSuggestedPx,
        }
      })()
    : {}

  const imagePositionWasOverridden = widthRatio !== undefined
    ? Math.abs(widthRatio - suggestImagePosition('other', screenType).width) > 0.005
    : undefined

  // Mirrors SlideCanvas.tsx's own historicalAlign fallback exactly, so this
  // reports what's actually rendered (a slide saved before textAlign existed
  // has data.textAlign === undefined but still renders with a real,
  // mode-dependent alignment) rather than the possibly-unset raw field.
  const historicalAlign = data.imageMode !== 'none' && orientation === 'landscape' ? 'left' : 'center'
  const textAlign = data.textAlign ?? historicalAlign

  const imagePlacements = (data.staggerImages || [])
    .filter(img => img.url)
    .map(img => ({ y: img.y, scale: img.scale, zIndex: img.zIndex }))

  // Image 1's face-detection auto-crop tracking (lib/faceDetect.ts) -- same
  // image-1-only convention as imageWidthRatio/imageHeightRatio above.
  const firstStaggerImage = (data.staggerImages || []).find(img => img.url)
  const image1FaceCrop = data.imageMode === 'single'
    ? { suggested: data.imageFaceCropSuggested, final: data.imageFaceCropFinal, wasOverridden: data.imageFaceCropWasOverridden }
    : { suggested: firstStaggerImage?.faceCropSuggested, final: firstStaggerImage?.faceCropFinal, wasOverridden: firstStaggerImage?.faceCropWasOverridden }

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
    programTitle: data.programTitle,
    programTitleFont: data.programTitleFont,
    programTitleItalic: data.programTitleItalic,
    imageSide: data.imageSide,
    textAlign,
    imagesLinkedSize: data.imagesLinkedSize,
    presentersMatchTitleSize: data.presentersMatchTitleSize,
    programTitleMatchTitleSize: data.programTitleMatchTitleSize,
    blockOrder: data.blockOrder,

    seriesName: data.showSeriesName ? data.seriesName : '',
    // TODO: the main editor has no QR code feature yet -- always false
    // until one exists.
    hasQrCode: false,
    listeningCredit: data.showListeningCredit ? data.listeningCredit : '',

    backgroundColor: data.backgroundColor,
    textColor: data.textColor,
    // Per-field colors, always populated for 'live' entries via the same
    // fallback-to-textColor chain SlideCanvas.tsx renders with (so these are
    // never missing even for a slide saved before per-field colors
    // existed). titleColor is accentColor -- title's own pre-existing
    // dedicated color field, not a new concept.
    labelColor: data.labelColor ?? data.textColor,
    titleColor: data.accentColor,
    subtitleColor: data.subtitleColor ?? data.textColor,
    subtitle2Color: data.subtitle2Color ?? data.textColor,
    presentersColor: data.presentersColor ?? data.textColor,
    programTitleColor: data.programTitleColor ?? data.textColor,
    seriesNameColor: data.seriesNameColor ?? data.textColor,
    listeningCreditColor: data.listeningCreditColor ?? data.textColor,

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
    ...titleSuggestion,
    ...subtitleSuggestion,
    imageWidthRatio: widthRatio,
    imageHeightRatio,
    imagePositionWasOverridden,
    imagePlacements,
    faceDetected: image1FaceCrop.suggested !== undefined,
    faceCropSuggested: image1FaceCrop.suggested,
    faceCropFinal: image1FaceCrop.final,
    faceCropWasOverridden: image1FaceCrop.wasOverridden,

    liveStyle: {
      labelWeight: data.labelWeight,

      subtitleInline: data.subtitleInline,
      subtitle2Weight: data.subtitle2Weight,

      presentersWeight: data.presentersWeight,
      presentersSize: data.presentersSize,
      programTitleWeight: data.programTitleWeight,
      programTitleSize: data.programTitleSize,

      imageMode: data.imageMode,
      // The effective (converted, if this slide predates the pixel-based
      // control) pixel width -- never the possibly-legacy raw stored value,
      // consistent with how stagger mode's own pixel-based `scale` is
      // already captured here.
      imageSize: data.imageMode === 'single' ? effectiveImageSizePx(data, orientation) : undefined,
      imageOverlap: data.imageOverlap,
      staggerSize: data.staggerSize,

      // Image<->text gap and outer content margin -- undefined for either
      // means the slide is still on SlideCanvas's own computed default (see
      // lib/layoutDefaults.ts); orientation-specific since landscape and
      // portrait use structurally different layouts for this gap.
      imageTextGapLandscape: data.imageTextGapLandscape,
      imageTextGapPortrait: data.imageTextGapPortrait,
      contentMargin: data.contentMargin,

      logoCount: (data.logos || []).length,
      logoSize: data.logoSize,

      showSeriesName: data.showSeriesName,
      showListeningCredit: data.showListeningCredit,

      // Per-field margin-top overrides -- the gap ABOVE that field relative
      // to whichever block currently precedes it in blockOrder; undefined
      // for any field still on its automatic value (see SlideData's own
      // comment on these, and lib/textStackGap.ts for the shared formula).
      labelMarginTop: data.labelMarginTop,
      titleMarginTop: data.titleMarginTop,
      subtitleMarginTop: data.subtitleMarginTop,
      subtitle2MarginTop: data.subtitle2MarginTop,
      presentersMarginTop: data.presentersMarginTop,
      programTitleMarginTop: data.programTitleMarginTop,
      seriesNameMarginTop: data.seriesNameMarginTop,
      // Listening Credit isn't part of blockOrder (fixed footer), so it
      // keeps a genuinely separate internal-line-height override instead.
      listeningCreditLineHeight: data.listeningCreditLineHeight,
    },
  }
}
