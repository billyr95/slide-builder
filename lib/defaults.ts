import { SlideData } from './types'

// Text defaults to black on every field (per-field colors below) since the
// slide background now defaults to periwinkle (from lib/palette.ts's fixed
// brand palette), not black -- black text stays legible against it out of
// the box, unlike against the old black-on-black default.
const DEFAULT_TEXT_COLOR = '#000000'

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
  imageMode: 'single' as const,
  imageUrl: '',
  imageAlt: '',
  imageSize: 100,
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