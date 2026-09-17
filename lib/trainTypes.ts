import { TheinhardtWeight, TitleFont, PresentersFont, Orientation, FaceCropBox } from './types'

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

  // Which side the image sits on vs. the text block -- a real layout
  // decision, not just a style tweak, so it's worth its own training signal.
  imageSide: 'left' | 'right'

  // Slide-level layout ground truth, populated only for 'live' entries (the
  // editor is the only place these are ever actually set -- 'upload' has no
  // manual-entry equivalent for any of these). For 'upload' entries, the
  // model estimates its own best guess instead (trainExport.ts's
  // inferred_image_side/inferred_text_align/etc.), which is a genuinely
  // separate, vision-based signal rather than a value that belongs on this
  // shared request-time type.
  textAlign?: 'left' | 'center'
  imagesLinkedSize?: boolean
  presentersMatchTitleSize?: boolean
  programTitleMatchTitleSize?: boolean

  seriesName: string       // '' = unused
  hasQrCode: boolean
  listeningCredit: string  // '' = unused; not restricted to a screen type

  backgroundColor: string  // '' = unset, let the model estimate
  // Legacy single "all text" color -- superseded by the per-field colors
  // below for 'live' entries (always populated there, via the same
  // fallback-to-textColor chain SlideCanvas.tsx renders with, so it's never
  // missing); kept as '' = unset/let-the-model-estimate for 'upload'
  // entries, which have no per-field equivalent.
  textColor: string
  // Populated only for source: 'live' entries -- ground truth for each
  // field's own color, replacing the single textColor line in the batch
  // prompt (see trainExport.ts's buildConfirmPrompt) since these are always
  // exact and never missing for a 'live' entry.
  labelColor?: string
  titleColor?: string  // SlideData.accentColor -- title's own dedicated color field, not a new concept
  subtitleColor?: string
  subtitle2Color?: string
  presentersColor?: string
  programTitleColor?: string
  seriesNameColor?: string
  listeningCreditColor?: string

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
  // for height, the image's own natural aspect ratio. Sent to the model as
  // labeled ground-truth facts (trainExport.ts's buildConfirmPrompt), using
  // the same width_ratio/height_ratio names 'upload' entries get back from
  // the model's own estimate, so both sources are directly comparable.
  // Absolute x/y position and crop are still NOT included here: single-image
  // mode has no x/y control at all, and crop is baked into the image's
  // pixels via the crop tool rather than stored as separate
  // top/bottom/left/right metadata — so there's nothing real to report for
  // those, and faking a value would be worse than omitting it. image_1_type
  // is also omitted: the app doesn't classify uploaded images by content
  // (same TODO as the manual-upload heuristic auto-fill path).
  imageWidthRatio?: number
  imageHeightRatio?: number
  // Same suggested-vs-final proxy as the font sizes above, applied to the
  // image's width ratio (the only piece of suggestImagePosition's output
  // this app actually has a control for -- see the comment above).
  imagePositionWasOverridden?: boolean

  // Client-side face-detection results (lib/faceDetect.ts), scoped to image
  // 1 -- same convention as imageWidthRatio/imageHeightRatio above.
  // faceDetected: whether a face was found at all, captured directly by
  // this app (unlike inferred_image_side etc., which need a full batch
  // round-trip) -- true ground truth for both sources, since /train also
  // runs real client-side detection on upload, not a manual guess.
  faceDetected?: boolean
  // 'live' only: the auto-computed headshot crop box, and whatever the user
  // ultimately ended up with after any manual re-crop (equal to suggested
  // until they override it) -- same suggested/final/wasOverridden shape as
  // the font-size fields above, so this can eventually be used the same way
  // to refit lib/faceDetect.ts's padding multipliers from real corrections.
  // DB-only: not sent to the vision model prompt (see trainExport.ts).
  faceCropSuggested?: FaceCropBox
  faceCropFinal?: FaceCropBox
  faceCropWasOverridden?: boolean
  // Not yet computable by this app (needs the model's own image_type from
  // its batch response, which nothing here parses back in yet -- see
  // inferred_image_side's own comment) -- reserved for a future step that
  // flags entries where faceDetected and the model's "face" classification
  // disagree. Always undefined for now.
  faceDetectionMismatch?: boolean

  // Per-stagger-image placement ground truth ('live' only, up to 4 slots --
  // single-image mode has no equivalent, see imageWidthRatio above instead).
  // Individually labeled facts in the batch prompt and their own DB columns
  // (image_1_y, image_1_scale, image_1_z_index, ...) rather than values a
  // model has to read back out of a stringified JSON blob. Index 0 = Image 1.
  imagePlacements?: { y: number; scale: number; zIndex?: number }[]

  // Extra known style data, populated only for source: 'live' entries
  // (remaining sizes, font choices, footer content, etc.) — /train's
  // manual-entry schema has no equivalent for these, so they're carried as a
  // free-form bag rather than forcing every field onto the shared type. Only
  // for style that isn't otherwise worth a first-class field/column; prefer
  // promoting something out of here (like imagePlacements above did) once it
  // turns out to matter.
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
    titleFont: '92NY Text',
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
    imageSide: 'left',
    seriesName: '',
    listeningCredit: '',
    backgroundColor: '',
    textColor: '',
    images: [{ id: Math.random().toString(36).slice(2), url: '', mediaType: '', name: '' }],
    imageCount: 0,
  }
}
