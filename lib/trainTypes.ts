import { TheinhardtWeight, TitleFont } from './types'

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

  seriesName: string       // '' = unused
  hasQrCode: boolean
  listeningCredit: string  // '' = unused; not restricted to a screen type

  backgroundColor: string  // '' = unset, let the model estimate
  textColor: string        // '' = unset, let the model estimate

  images: TrainImage[]

  // Extra known style data, populated only for source: 'live' entries
  // (exact numeric sizes/ratios, image placement, font choices, footer
  // content, etc.) — /train's manual-entry schema has no equivalent for
  // these, so they're carried as a free-form bag rather than forcing every
  // field onto the shared type.
  liveStyle?: Record<string, unknown>
}

export function createBlankEntry(overrides?: Partial<Pick<TrainEntry, 'screenType' | 'hasLabel' | 'hasLogos' | 'hasQrCode'>>): TrainEntry {
  return {
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    createdAt: new Date().toISOString(),
    source: 'upload',
    screenType: overrides?.screenType ?? 'projector',
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
    seriesName: '',
    listeningCredit: '',
    backgroundColor: '',
    textColor: '',
    images: [{ id: Math.random().toString(36).slice(2), url: '', mediaType: '', name: '' }],
  }
}
