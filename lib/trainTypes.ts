import { TheinhardtWeight, TitleFont, PresentersFont, Orientation } from './types'

export type ScreenType = 'projector' | 'lobby'
// 'upload' = hand-entered via /train from an old/scanned slide (style values
// need vision-model estimation). 'live' = captured automatically from a real
// export in the main editor (style values are exact, known editor state).
export type EntrySource = 'upload' | 'live'

export interface TrainImage {
  id: string
  url: string        // data: URL (base64)
  mediaType: string  // e.g. 'image/png', detected from the uploaded file
  name: string        // original filename, for display only
}

export interface TrainEntry {
  id: string
  createdAt: string
  source: EntrySource

  screenType: ScreenType
  orientation: Orientation  // needed to know the slide's real pixel dimensions (1920x1080 vs 1080x1920)
  hasLabel: boolean
  hasLogos: boolean

  label: string
  title: string
  titleFont: TitleFont  // hardlocked to the same options the main editor offers
  titleItalic: boolean
  subtitle: string
  subtitleWeight: TheinhardtWeight
  subtitle2: string
  presenters: string
  presentersFont: PresentersFont  // hardlocked to the same options the main editor offers
  presentersItalic: boolean

  // Book/film/show title distinct from presenter names (e.g. "American
  // Caprices"), rendered directly after presenters. No weight field here --
  // /train's ground-truth schema doesn't ask for presenters' weight either.
  programTitle: string
  programTitleFont: PresentersFont
  programTitleItalic: boolean

  seriesName: string       // '' = unused
  hasQrCode: boolean
  listeningCredit: string  // '' = unused; not restricted to a screen type

  backgroundColor: string  // '' = unset, let the model estimate
  textColor: string        // '' = unset, let the model estimate

  images: TrainImage[]
  // How many images actually appeared on the original slide, as stated by
  // the user — independent of how many image files are attached above.
  // Lets old slides whose source images no longer exist still be labeled
  // with an accurate count instead of silently reporting 0.
  imageCount: number

  // Populated only for source: 'live' entries — ground truth read directly
  // from the editor's real slider values at export time, no vision-model
  // estimation needed (unlike 'upload' entries, where these same-named
  // concepts only exist inside the model's JSON response). Pixel values,
  // matching the /train batch prompt's title_font_size_px-style schema.
  titleFontSizePx?: number
  subtitleFontSizePx?: number   // only set if a subtitle is present
  subtitle2FontSizePx?: number  // only set if a subtitle2 is present

  // What the heuristic would suggest right now for these same inputs
  // (title/subtitle text, screen_type, has_subtitle), vs. the real final
  // value above, so later analysis can see exactly where the heuristic was
  // wrong without re-deriving it. wasOverridden is just suggested !==
  // final -- a reasonable proxy for "did the user manually move the
  // slider," not literal override tracking (which would require lifting
  // EditorPanel's local override state up to this call). Known edge case:
  // if the user changes screen_type or presence-of-subtitle AFTER the
  // slider already got its value, the recomputed suggestion can differ
  // from the stored final value even though nothing was manually touched.
  titleFontSizeSuggestedPx?: number
  titleFontSizeWasOverridden?: boolean
  subtitleFontSizeSuggestedPx?: number
  subtitleFontSizeWasOverridden?: boolean

  // Approximate image_1 position, derived from the editor's actual size
  // controls (imageSize % for single mode, scale px for stagger mode) and,
  // for height, the image's own natural aspect ratio. x/y position and crop
  // are NOT included here: this app has no absolute image-position control
  // in either image mode (single mode has no x/y at all; stagger's "y" is a
  // manual nudge off an algorithmic default, not an absolute position), and
  // crop is baked into the image's pixels via the crop tool rather than
  // stored as separate top/bottom/left/right metadata — so there's nothing
  // real to report for those, and faking a value would be worse than
  // omitting it. image_1_type is also omitted: the app doesn't classify
  // uploaded images by content (same TODO as the manual-upload heuristic
  // auto-fill path).
  imageWidthRatio?: number
  imageHeightRatio?: number
  // Same suggested-vs-final proxy as the font sizes above, applied to the
  // image's width ratio (the only piece of suggestImagePosition's output
  // this app actually has a control for -- see the comment above).
  imagePositionWasOverridden?: boolean

  // Extra known style data, populated only for source: 'live' entries
  // (remaining sizes, image placement, font choices, footer content, etc.)
  // — /train's manual-entry schema has no equivalent for these, so they're
  // carried as a free-form bag rather than forcing every field onto the
  // shared type.
  liveStyle?: Record<string, unknown>
}

export function createBlankEntry(overrides?: Partial<Pick<TrainEntry, 'screenType' | 'orientation' | 'hasLabel' | 'hasLogos' | 'hasQrCode'>>): TrainEntry {
  return {
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    createdAt: new Date().toISOString(),
    source: 'upload',
    screenType: overrides?.screenType ?? 'projector',
    orientation: overrides?.orientation ?? 'landscape',
    hasLabel: overrides?.hasLabel ?? false,
    hasLogos: overrides?.hasLogos ?? false,
    hasQrCode: overrides?.hasQrCode ?? false,
    label: '',
    title: '',
    titleFont: '92NY',
    titleItalic: false,
    subtitle: '',
    subtitleWeight: 'regular',
    subtitle2: '',
    presenters: '',
    presentersFont: 'Theinhardt',
    presentersItalic: false,
    programTitle: '',
    programTitleFont: 'Theinhardt',
    programTitleItalic: true,
    seriesName: '',
    listeningCredit: '',
    backgroundColor: '',
    textColor: '',
    images: [{ id: Math.random().toString(36).slice(2), url: '', mediaType: '', name: '' }],
    imageCount: 0,
  }
}
