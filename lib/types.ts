import { PhotoAdjustments } from './photoAdjust'

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
  x?: number     // horizontal offset (px); undefined/0 = algorithmic default -- LEGACY/fallback, see xLandscape/xPortrait
  y: number      // vertical offset (px) -- LEGACY/fallback, see yLandscape/yPortrait
  scale: number  // width override (px); 0 means use staggerSize -- LEGACY/fallback, see scaleLandscape/scalePortrait
  // Orientation-specific layout overrides -- the image's own identity
  // (id/url/alt) and stacking depth (zIndex) stay shared across both
  // orientations (it's the same uploaded image either way), but its
  // position/size within the cluster is independent per orientation, same
  // reasoning as imageSizeLandscape/Portrait on SlideData. Each falls back
  // to its legacy field above (x/y/scale) when unset, then to the
  // algorithmic default -- see lib/staggerLayout.ts's effectiveStagger*
  // functions, the only place these should be read.
  xLandscape?: number
  xPortrait?: number
  yLandscape?: number
  yPortrait?: number
  scaleLandscape?: number
  scalePortrait?: number
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
  // Non-destructive photo adjustments (lib/photoAdjust.ts) -- undefined or
  // all-default means unadjusted. Applied before crop in processing order
  // (crop/face-detection act on this slot's own `url`, which is whatever
  // was uploaded/cropped; adjustments are a separate, non-destructive
  // overlay never baked into `url` itself) and persists when replacing the
  // photo in this slot, same convention as crop/size on replace.
  photoAdjustments?: PhotoAdjustments
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

// A user-added text block, alongside the fixed TEXT_BLOCK_KEYS fields --
// unlike those (one hardcoded SlideData field per block), there can be any
// number of these (capped at 10 in EditorPanel), so each one carries its own
// full style on the object itself rather than a fixed `*Weight`/`*Size`/...
// field name. Joins blockOrder by `id` exactly like a TextBlockKey joins it
// by name (see lib/textStackGap.ts, which treats blockOrder entries as
// `string` for this reason) -- SlideCanvas/EditorPanel resolve a blockOrder
// entry to either a TextBlockKey or a customTextLayers[].id at render/list
// time. Same manual-margin-or-auto-stack-gap pattern as the fixed fields
// (see effectiveCustomLayerMarginTop in lib/textStackGap.ts).
export interface CustomTextLayer {
  id: string
  text: string
  richText?: string
  font: PresentersFont
  weight: TheinhardtWeight
  italic: boolean
  color?: string
  size: number
  marginTop?: number
}

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

  // Rare per-run italic override, one per text field -- lib/richText.ts is
  // the single source of truth for both producing and rendering these.
  // Undefined (the overwhelming majority of slides/fields) renders the
  // plain field exactly as before; once set, it's minimal sanitized HTML
  // (bare <i>/</i> only, nothing else ever allowed through) laid over that
  // SAME text, letting just part of a field be italicized without making
  // italics a field-wide toggle. The plain field alongside it always stays
  // the full, correct text (so search/heuristics/training-data reads of it
  // are unaffected) -- EditorPanel.tsx's rich-text editor keeps the two in
  // sync on every save, and clears this override if the plain field is
  // ever edited directly afterward (since the stored markup's positions
  // would no longer necessarily line up with the new text).
  labelRichText?: string
  titleRichText?: string
  subtitleRichText?: string
  subtitle2RichText?: string
  presentersRichText?: string
  programTitleRichText?: string

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
  // string rather than TextBlockKey[] specifically so a customTextLayers
  // entry's own `id` can sit in this same array (see CustomTextLayer above)
  // -- every TextBlockKey is still a valid string, so nothing about the
  // fixed-field path changes.
  blockOrder?: string[]
  // User-added text blocks beyond the fixed ones above (capped at 10 in
  // EditorPanel) -- see CustomTextLayer's own comment. A layer's position
  // in the stack comes from its `id` appearing in blockOrder, same as any
  // TextBlockKey; a freshly-added layer is appended to blockOrder (so it
  // lands at the end of the stack) rather than inserted anywhere else.
  customTextLayers?: CustomTextLayer[]

  // The horizontal gap between the image block and the text block, in
  // landscape mode (image and text sit side by side) vs. portrait mode
  // (image sits above text, in flow) -- two separate fields because those
  // two orientations use genuinely different layout structures in
  // SlideCanvas.tsx (a flex row with per-column padding vs. a flex column
  // where the gap is the text section's own top padding), not just two
  // instances of the same knob. Undefined uses today's rendered default
  // (see lib/layoutDefaults.ts's effectiveImageTextGapLandscape/Portrait);
  // has no effect at all when imageMode is 'none' (no image to have a gap
  // with). Flip-safe: applied as a real CSS gap between the two flex
  // siblings in landscape (flexbox gap doesn't care about row vs.
  // row-reverse), and portrait's image/text order doesn't change with Flip
  // in the first place (Flip there swaps top/bottom, not the gap).
  imageTextGapLandscape?: number
  imageTextGapPortrait?: number
  // Legacy single-value override, kept only as a fallback for a slide saved
  // before the four-sided controls below existed -- see
  // lib/layoutDefaults.ts's effectiveContentMarginSide, the one place that
  // resolves either format correctly. Never read directly for rendering;
  // once a slide's margin is touched again (even to re-link it), the new
  // per-side fields take over and this stops being read at all.
  contentMargin?: number
  // Four independent per-side overrides (px), each falling back to
  // `contentMargin` (if set) and then to that side's own context-dependent
  // default (lib/layoutDefaults.ts's effectiveContentMarginSide -- most are
  // 80px, but a couple of spots genuinely differ today, e.g. portrait's
  // bottom margin). contentMarginLinked is purely a UI affordance (does
  // EditorPanel's one slider write all four at once, or does each have its
  // own): true/undefined shows one linked control and keeps all four equal
  // whenever any of them changes; false reveals four independent controls.
  // Rendering itself never looks at the linked flag -- each side's value is
  // read independently either way, so flipping the flag back and forth
  // can't by itself change what's on screen. Doesn't reach into the handful
  // of paddings that serve a different, more specific purpose (the
  // footer's own fixed offsets, stagger images' own tighter cluster inset)
  // -- see lib/layoutDefaults.ts's comments for the exact scope.
  contentMarginTop?: number
  contentMarginRight?: number
  contentMarginBottom?: number
  contentMarginLeft?: number
  contentMarginLinked?: boolean

  // Images
  imageMode: ImageMode
  imageUrl: string       // single-image mode only
  imageAlt: string
  // Single-image mode's size, in the unit imageSizeIsPixels says it's in --
  // see lib/imageSizing.ts's effectiveImageSizePx, the single place that
  // interprets this correctly for either vintage. Never read this directly
  // for rendering/display; always go through that function. LEGACY/fallback
  // only now -- see imageSizeLandscape/imageSizePortrait below, which take
  // precedence once a slide's size has been touched since orientation-
  // specific sizing shipped.
  imageSize: number
  // true once this slide has been through the percentage->pixel conversion
  // (every slide created after that change, or an older one where the user
  // has since touched the Image size slider). Undefined/false means
  // `imageSize` is still a LEGACY percentage-of-its-column value (the
  // control's original, confusingly-mislabeled-as-"px" unit) that needs
  // converting against the actual canvas width before use -- never mutated
  // outside of actually setting a new imageSize, so a slide's raw stored
  // value only ever changes meaning when someone deliberately touches the
  // control.
  imageSizeIsPixels?: boolean
  // Orientation-specific size overrides (always pixels -- these are new
  // fields with no legacy percentage format to worry about, unlike
  // `imageSize` above). Undefined falls back to the legacy shared
  // `imageSize`/`imageSizeIsPixels` pair (so nothing shifts for a slide
  // that hasn't touched Size since this split shipped), then to
  // DEFAULT_IMAGE_SIZE_PX. Switching orientation in the editor shows and
  // edits only the matching one of these two -- changing one never touches
  // the other. See lib/imageSizing.ts's effectiveImageSizePx.
  imageSizeLandscape?: number
  imageSizePortrait?: number
  // The image cluster's (single image, or the whole stagger group treated
  // as one unit) horizontal position, as an absolute slide-relative pixel
  // X-coordinate -- see lib/imageClusterPosition.ts. Undefined uses
  // whatever position the outer-margin/gap-driven layout would place it at
  // (matching today's centered-in-its-column look exactly); once set, it's
  // a direct override independent of margin and gap entirely, and can push
  // the cluster past where either would otherwise have constrained it.
  // Works with Flip (the "natural" default itself already accounts for
  // which side the image is on). LEGACY/fallback only now -- see
  // imageClusterXLandscape/imageClusterXPortrait below.
  imageClusterX?: number
  // Orientation-specific X overrides, same fallback shape as
  // imageSizeLandscape/Portrait above: undefined falls back to the legacy
  // shared `imageClusterX`, then to each orientation's own computed
  // natural default (lib/imageClusterPosition.ts's naturalImageClusterX,
  // which already varies by orientation on its own).
  imageClusterXLandscape?: number
  imageClusterXPortrait?: number
  // Single-image-mode counterpart of StaggerImage's face-crop fields --
  // see the comment there.
  imageFaceCropSuggested?: FaceCropBox
  imageFaceCropFinal?: FaceCropBox
  imageFaceCropWasOverridden?: boolean
  // Single-image-mode counterpart of StaggerImage.photoAdjustments -- see
  // its own comment.
  imagePhotoAdjustments?: PhotoAdjustments
  staggerImages: StaggerImage[]  // used by all multi-image modes (stagger, triangle, squared)
  imageOverlap: number  // 0–60, percentage overlap between consecutive stagger images
  staggerSize: number   // pixels, default width of each image in stagger layout -- LEGACY/fallback, see staggerSizeLandscape/Portrait
  // Orientation-specific default stagger image width -- same fallback shape
  // as every other orientation-split field above.
  staggerSizeLandscape?: number
  staggerSizePortrait?: number
  // When true, Image 1 and Image 2's size sliders stay in sync -- adjusting
  // either one applies the same scale to both. Starts scoped to just the
  // first two slots (see EditorPanel's updateStaggerScale).
  imagesLinkedSize: boolean

  // Logos
  logos: LogoItem[]
  logoSize: number
  // The gap ABOVE the logo bar, relative to whatever renders directly above
  // it (the last visible text block, or the image in 'none' mode with no
  // text) -- same auto-until-touched/manual-override pattern as every other
  // margin-top field (lib/textStackGap.ts's effectiveLogoMarginTop), just a
  // flat default rather than blockOrder-relative, since the logo bar is
  // pinned after the text stack, never reorderable within it.
  logoMarginTop?: number

  // Footer -- Series Name and Listening Credit both live in their own
  // fixed slot here, never in blockOrder: Series Name always renders
  // directly above Listening Credit (whether or not Listening Credit is
  // actually present on a given slide -- that's a structural position, not
  // a dependency on Listening Credit existing).
  showSeriesName: boolean
  seriesName: string
  seriesNameColor?: string
  // Rare per-run italic override -- see the identical *RichText comment
  // near the top of this interface.
  seriesNameRichText?: string
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
  // Its own font size, same auto-until-touched/manual-override pattern as
  // every other sizable field -- mainly useful for shrinking it a notch so
  // a borderline-long credit doesn't spill its last word or two onto an
  // awkward third line.
  listeningCreditSize?: number
  // Rare per-run italic override -- see the identical *RichText comment
  // near the top of this interface.
  listeningCreditRichText?: string
}