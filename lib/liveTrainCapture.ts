import { SlideData, Orientation } from './types'
import { TrainEntry, TrainImage, ScreenType } from './trainTypes'

const DIMS: Record<Orientation, { w: number; h: number }> = {
  landscape: { w: 1920, h: 1080 },
  portrait: { w: 1080, h: 1920 },
}

function mediaTypeFromDataUrl(url: string): string {
  const match = /^data:([^;]+);base64,/.exec(url)
  return match ? match[1] : 'image/png'
}

function toTrainImage(url: string, name: string): TrainImage {
  return {
    id: Math.random().toString(36).slice(2),
    url,
    mediaType: mediaTypeFromDataUrl(url),
    name,
  }
}

function collectImages(data: SlideData): TrainImage[] {
  if (data.imageMode === 'single') {
    return data.imageUrl ? [toTrainImage(data.imageUrl, data.imageAlt || 'image')] : []
  }
  if (data.imageMode === 'none') return []
  return (data.staggerImages || [])
    .filter(img => img.url)
    .map((img, i) => toTrainImage(img.url, img.alt || `image-${i + 1}`))
}

export function buildLiveTrainEntry(data: SlideData, orientation: Orientation, screenType: ScreenType): TrainEntry {
  const { h } = DIMS[orientation]

  return {
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    createdAt: new Date().toISOString(),
    source: 'live',

    screenType,
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

    backgroundColor: data.backgroundColor,
    textColor: data.textColor,

    images: collectImages(data),

    liveStyle: {
      orientation,
      accentColor: data.accentColor,
      labelWeight: data.labelWeight,

      titleSize: data.titleSize,
      titleSizeRatio: data.titleSize / h,

      subtitleInline: data.subtitleInline,
      subtitleSize: data.subtitleSize,
      subtitleSizeRatio: data.subtitleSize / h,

      subtitle2Weight: data.subtitle2Weight,
      subtitle2Size: data.subtitle2Size,
      subtitle2SizeRatio: data.subtitle2Size / h,

      presentersFont: data.presentersFont,
      presentersWeight: data.presentersWeight,
      presentersSize: data.presentersSize,
      presentersSizeRatio: data.presentersSize / h,

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
      seriesName: data.seriesName,
      showListeningCredit: data.showListeningCredit,
      listeningCredit: data.listeningCredit,
    },
  }
}
