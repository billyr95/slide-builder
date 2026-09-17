import { SlideData, ImageMode } from './types'
import { DEFAULT_SLIDE_DATA } from './defaults'
import { ScreenType } from './trainTypes'
import { BuildResult } from '@/components/NewSlideModal'
import { suggestTitleFontSize, suggestSubtitleFontSize, suggestImagePosition } from './slideHeuristics'

// Shared by the Dashboard and the editor's own "+ New" button -- both open
// the same NewSlideModal and need the exact same content-to-SlideData
// construction (including the heuristic auto-fill) before creating the row.
export function buildNewSlideData({ screenType, fields, images }: BuildResult): SlideData {
  const hasSubtitle = !!fields.subtitle
  const titleLineCount = Math.max(1, fields.title.split('\n').length)

  const newData: SlideData = {
    ...DEFAULT_SLIDE_DATA,
    label: fields.label,
    title: fields.title,
    subtitle: fields.subtitle,
    subtitle2: fields.subtitle2,
    presenters: fields.presenters,
    presentersItalic: fields.presentersItalic,
    programTitle: fields.programTitle,
    programTitleFont: fields.programTitleFont,
    programTitleWeight: fields.programTitleWeight,
    programTitleItalic: fields.programTitleItalic,
    seriesName: fields.seriesName,
    showSeriesName: !!fields.seriesName,
    textAlign: fields.textAlign,
    titleSize: suggestTitleFontSize(fields.title.length, titleLineCount, screenType, hasSubtitle),
    subtitleSize: hasSubtitle ? suggestSubtitleFontSize(fields.subtitle.length) : DEFAULT_SLIDE_DATA.subtitleSize,
    imageMode: 'single',
    imageUrl: '',
    staggerImages: [],
  }

  // Assign uploaded images into slots, picking a stagger mode that fits how
  // many were dropped. Image-type classification isn't implemented (no
  // vision call on paste) -- "other" default TODO, same as the manual
  // upload path in EditorPanel.
  if (images.length > 0) {
    if (images.length === 1) {
      const suggestion = suggestImagePosition('other', screenType)
      newData.imageUrl = images[0].url
      newData.imageAlt = images[0].name
      newData.imageSize = Math.max(20, Math.min(200, Math.round(suggestion.width * 100)))
    } else {
      // No auto-sizing for stagger images (scale: 0 -> falls back to the
      // shared staggerSize default): the stagger layout's spacing in
      // SlideCanvas.tsx is computed from staggerSize alone, not from each
      // image's own scale, so applying suggestImagePosition's single-
      // image-sized width to individual stagger images made them render far
      // wider than the space the layout allocated for them. See the
      // matching comment in EditorPanel.tsx's handleCropComplete.
      const mode: ImageMode = images.length === 2 ? 'two-stagger' : images.length === 3 ? 'three-stagger' : 'four-stagger'
      newData.imageMode = mode
      newData.staggerImages = images.slice(0, 4).map((img, i) => ({ id: img.id, url: img.url, alt: img.name, y: 0, scale: 0, zIndex: i + 1 }))
    }
  }

  return newData
}
