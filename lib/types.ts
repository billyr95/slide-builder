export type TheinhardtWeight = 'regular' | 'bold' | 'heavy'
export type Orientation = 'landscape' | 'portrait'
export type ImageMode =
  | 'single'
  | 'two-stagger'
  | 'three-stagger'
  | 'three-triangle'
  | 'four-stagger'
  | 'four-squared'
  | 'none'
export type TitleFont = '92NY Text' | 'Theinhardt Heavy'
export type PresentersFont = 'Theinhardt' | '92NY Text'

export interface LogoItem {
  id: string
  url: string
  alt: string
}

// Ratios (0-1) of how much is trimmed off each edge of an image's full
// natural size -- same shape the vision model already returns for uploaded
// images (lib/trainExport.ts's "crop" schema) and lib/db/schema.ts's
// image1Crop, so face-detection auto-crop (lib/faceDetect.ts) produces
// directly comparable data.
export interface FaceCropBox {
  top: number
  bottom: number
  left: number
  right: number
}

export interface StaggerImage {
  id: string
  url: string
  alt: string
  x?: number     // horizontal offset (px); undefined/0 = algorithmic default
  y: number      // vertical offset (px)
  scale: number  // width override (px); 0 means use staggerSize
  // Explicit stacking depth, user-controlled via a per-image slider in
  // EditorPanel -- replaces relying on array order/DOM paint order to infer
  // front/back. Undefined (e.g. a slide saved before this field existed)
  // falls back to slot order (index + 1) in SlideCanvas.
  zIndex?: number
  // Face-detection auto-crop correction tracking (lib/faceDetect.ts).
  // `faceCropSuggested` is the box computed from the detected face at
  // upload time; `faceCropFinal` is whatever crop the image actually ended
  // up with (equal to suggested until the user re-crops it manually via
  // CropModal, at which point faceCropWasOverridden flips true). All
  // undefined for images with no detected face (no auto-crop ran) or that
  // predate this feature.
  faceCropSuggested?: FaceCropBox
  faceCropFinal?: FaceCropBox
  faceCropWasOverridden?: boolean
}

// Number of images used by a given stagger mode (0 for non-stagger modes).
export function staggerCount(mode: ImageMode): number {
  if (mode === 'two-stagger') return 2
  if (mode === 'three-stagger' || mode === 'three-triangle') return 3
  if (mode === 'four-stagger' || mode === 'four-squared') return 4
  return 0
}

// Every text block SlideCanvas can render in the main vertical stack, in
// the user-controllable order EditorPanel's drag list edits (see
// SlideData.blockOrder below). Series Name and Listening Credit are BOTH
// excluded -- they're pinned to their own fixed footer slots (Series Name
// directly above Listening Credit), never reorderable and never affected
// by where the other blocks sit in blockOrder. See seriesNameMarginTop's
// own comment below for how Series Name's gap control works now that it's
// outside this system.
export const TEXT_BLOCK_KEYS = ['label', 'title', 'subtitle', 'subtitle2', 'presenters', 'programTitle'] as const
export type TextBlockKey = typeof TEXT_BLOCK_KEYS[number]

// Optional per-field MARGIN-TOP overrides -- the gap ABOVE that field,
// relative to whichever block currently renders before it in blockOrder
// (see lib/textStackGap.ts, the single shared source of truth for both
// what SlideCanvas.tsx renders and what EditorPanel.tsx's "Margin top"
// sliders show before they've been touched). Undefined means "use whatever
// the uniform stack-gap system already computes automatically for the gap
// above this field right now" -- since blockOrder is dynamic, that
// automatic value is evaluated from CURRENT position, not a hardcoded
// "Title's gap" vs. "Presenters' gap", so it naturally follows a field if
// it's reordered. Setting one overrides the automatic calculation for THAT
// gap specifically (the space above this field) and nothing else -- it has
// no effect on this field's own internal wrapped-line spacing (an entirely
// separate, non-overridable concern; see DEFAULT_STACK_LINE_HEIGHT) or on
// the gap below it (owned by whichever field renders after this one, via
// that field's OWN margin-top). Listening Credit has no margin-top field:
// it lives in the fixed footer, outside blockOrder, so "the block before
// it in blockOrder" doesn't apply -- it keeps a genuinely separate
// listeningCreditLineHeight instead, for its own (often long, multi-line)
// paragraph's internal spacing.
export interface SlideData {
  // Content
  label: string
  labelWeight: TheinhardtWeight
  labelColor?: string
  labelMarginTop?: number
  title: string
  titleFont: TitleFont
  titleItalic: boolean
  titleSize: number
  titleMarginTop?: number
  subtitle: string
  subtitleWeight: TheinhardtWeight
  subtitleSize: number
  subtitleInline: boolean
  subtitleColor?: string
  subtitleMarginTop?: number
  subtitle2: string
  subtitle2Weight: TheinhardtWeight
  subtitle2Size: number
  subtitle2Color?: string
  subtitle2MarginTop?: number
  presenters: string
  presentersFont: PresentersFont
  presentersItalic: boolean
  presentersWeight: TheinhardtWeight
  presentersSize: number
  presentersColor?: string
  presentersMarginTop?: number
  // When true, presentersSize is kept equal to titleSize instead of being
  // independently adjustable -- toggled from a checkbox near Title.
  presentersMatchTitleSize: boolean
  // Book/film/show title distinct from presenter names (e.g. "American
  // Caprices" following a list of performers) -- rendered directly after
  // presenters, styled fully independently.
  programTitle: string
  programTitleFont: PresentersFont
  programTitleWeight: TheinhardtWeight
  programTitleItalic: boolean
  programTitleSize: number
  programTitleColor?: string
  programTitleMarginTop?: number
  programTitleMatchTitleSize: boolean

  // Style
  backgroundColor: string
  // Legacy single "all text" color -- superseded by the per-field *Color
  // properties above/below (each falls back to this when unset, e.g. for a
  // slide saved before those fields existed), kept on the type for that
  // migration path rather than actively driving rendering anywhere now.
  // Title's own color remains accentColor, unchanged (it already predates
  // and serves the same "this field's own color" role the new per-field
  // colors add everywhere else, so it isn't duplicated as a titleColor).
  textColor: string
  accentColor: string
  // Slide-level layout decisions, worth their own training signal --
  // imageSide mirrors which side the image(s) sit on vs. the text block (in
  // landscape: left/right; in portrait, reused as top/bottom), textAlign
  // applies to every text block uniformly rather than per-field.
  imageSide: 'left' | 'right'
  // Optional (not set in DEFAULT_SLIDE_DATA either): SlideCanvas falls back
  // to a mode-dependent historical default when unset, so both brand-new
  // slides and slides saved before this field existed render with their
  // traditional alignment until a user explicitly picks one via the toggle.
  textAlign?: 'left' | 'center'
  // Vertical render order of the text blocks within the text side of the
  // slide (Flip still swaps which SIDE the text sits on vs. the image --
  // this only controls order WITHIN that side). Optional so a slide saved
  // before this field existed has no stored order at all; SlideCanvas and
  // EditorPanel both fall back to DEFAULT_BLOCK_ORDER (lib/defaults.ts) in
  // that case, which matches the old hardcoded render order exactly, so
  // nothing shifts retroactively. A block not present in the array simply
  // isn't rendered/reorderable -- doesn't currently happen since every
  // known key ships in DEFAULT_BLOCK_ORDER, but keeps this forward-
  // compatible if a future block type needs the same append-only treatment
  // blockVisible-style flags already get elsewhere in this codebase.
  blockOrder?: TextBlockKey[]

  // Images
  imageMode: ImageMode
  imageUrl: string       // single-image mode only
  imageAlt: string
  imageSize: number
  // Single-image-mode counterpart of StaggerImage's face-crop fields --
  // see the comment there.
  imageFaceCropSuggested?: FaceCropBox
  imageFaceCropFinal?: FaceCropBox
  imageFaceCropWasOverridden?: boolean
  staggerImages: StaggerImage[]  // used by all multi-image modes (stagger, triangle, squared)
  imageOverlap: number  // 0–60, percentage overlap between consecutive stagger images
  staggerSize: number   // pixels, default width of each image in stagger layout
  // When true, Image 1 and Image 2's size sliders stay in sync -- adjusting
  // either one applies the same scale to both. Starts scoped to just the
  // first two slots (see EditorPanel's updateStaggerScale).
  imagesLinkedSize: boolean

  // Logos
  logos: LogoItem[]
  logoSize: number

  // Footer -- Series Name and Listening Credit both live in their own
  // fixed slot here, never in blockOrder: Series Name always renders
  // directly above Listening Credit (whether or not Listening Credit is
  // actually present on a given slide -- that's a structural position, not
  // a dependency on Listening Credit existing).
  showSeriesName: boolean
  seriesName: string
  seriesNameColor?: string
  // The gap ABOVE Series Name, i.e. how far above its fixed anchor point
  // (directly above Listening Credit) its own text sits. Same auto-until-
  // touched/manual-override pattern as every other field's margin-top
  // control (lib/textStackGap.ts's effectiveSeriesNameMarginTop), just not
  // blockOrder-relative like the reorderable stack's, since Series Name no
  // longer participates in blockOrder at all.
  seriesNameMarginTop?: number
  showListeningCredit: boolean
  listeningCredit: string
  listeningCreditColor?: string
  // Listening Credit keeps a genuinely separate internal-line-height
  // control (rather than a margin-top one) for its own, often long,
  // multi-line paragraph -- see this interface's own top comment.
  listeningCreditLineHeight?: number
}