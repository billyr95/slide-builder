import { SlideData, TextBlockKey } from './types'
import { DEFAULT_IMAGE_SIZE_PX } from './imageSizing'

// Text defaults to black on every field (per-field colors below) since the
// slide background now defaults to periwinkle (from lib/palette.ts's fixed
// brand palette), not black -- black text stays legible against it out of
// the box, unlike against the old black-on-black default.
const DEFAULT_TEXT_COLOR = '#000000'

// The historical fixed render order, preserved as the default for new
// slides and for any existing saved slide with no blockOrder of its own
// (see SlideData.blockOrder's comment) -- so this refactor to
// user-controlled ordering doesn't shift a single existing slide. Series
// Name is NOT part of this -- it's pinned to its own fixed footer slot
// (directly above Listening Credit), never reorderable.
export const DEFAULT_BLOCK_ORDER: TextBlockKey[] = ['label', 'title', 'subtitle', 'subtitle2', 'presenters', 'programTitle']

// The single source of truth for "what line-height does this field render
// at automatically, before anyone touches its line-spacing control" --
// shared by SlideCanvas.tsx (what actually renders) and EditorPanel.tsx
// (what a field's line-spacing slider shows/starts at before it's been
// manually overridden), so the two can't quietly drift out of sync the way
// a hardcoded constant copied into both files already has once before in
// this app. DEFAULT_STACK_LINE_HEIGHT covers every text block that's part
// of the reorderable stack (Label/Title/Subtitle/Subtitle2/Presenters/
// Program Title), plus Series Name's own internal line-height (fixed, not
// user-overridable, even though Series Name itself is pinned outside the
// stack in its own fixed footer slot). Listening Credit sits in that same
// fixed footer and has always used a looser value for its own body-text
// paragraph.
export const DEFAULT_STACK_LINE_HEIGHT = 0.88
export const DEFAULT_LISTENING_CREDIT_LINE_HEIGHT = 1.4

export const DEFAULT_SLIDE_DATA: SlideData = {
  label: 'TONIGHT',
  labelWeight: 'regular',
  labelColor: DEFAULT_TEXT_COLOR,
  title: 'Wuthering Heights through the Ages',
  titleFont: '92NY Text',
  titleItalic: false,
  titleSize: 72,
  subtitle: 'with',
  subtitleWeight: 'regular',
  subtitleSize: 48,
  subtitleInline: false,
  subtitleColor: DEFAULT_TEXT_COLOR,
  subtitle2: '',
  subtitle2Weight: 'regular',
  subtitle2Size: 48,
  subtitle2Color: DEFAULT_TEXT_COLOR,
  presenters: 'Vinson Cunningham,\nNaomi Fry\n& Alexandra Schwartz',
  presentersFont: 'Theinhardt',
  presentersItalic: false,
  presentersWeight: 'bold',
  presentersSize: 56,
  presentersColor: DEFAULT_TEXT_COLOR,
  presentersMatchTitleSize: false,
  programTitle: '',
  programTitleFont: 'Theinhardt',
  programTitleWeight: 'regular',
  programTitleItalic: true,
  programTitleSize: 48,
  programTitleColor: DEFAULT_TEXT_COLOR,
  programTitleMatchTitleSize: false,
  backgroundColor: '#8EAAE2', // Periwinkle, from lib/palette.ts's PALETTE
  textColor: '#ffffff', // Legacy -- see SlideData's own comment on this field
  accentColor: DEFAULT_TEXT_COLOR, // Title's own color
  imageSide: 'left',
  blockOrder: DEFAULT_BLOCK_ORDER,
  imageMode: 'single' as const,
  imageUrl: '',
  imageAlt: '',
  imageSize: DEFAULT_IMAGE_SIZE_PX,
  imageSizeIsPixels: true,
  staggerImages: [],
  imageOverlap: 30,
  staggerSize: 250,
  imagesLinkedSize: false,
  logos: [],
  logoSize: 60,
  showSeriesName: false,
  seriesName: 'RECANATI-KAPLAN TALKS',
  seriesNameColor: DEFAULT_TEXT_COLOR,
  showListeningCredit: false,
  listeningCredit: 'Assistive listening devices made possible by Helen S. Rubinstein in memory of her father, Jack Rubinstein. Please speak with the house manager to pick up a device. They will be happy to assist you!',
  listeningCreditColor: DEFAULT_TEXT_COLOR,
}