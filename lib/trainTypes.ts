import { TheinhardtWeight } from './types'

export type ScreenType = 'projector' | 'lobby'

export interface TrainImage {
  id: string
  url: string        // data: URL (base64)
  mediaType: string  // e.g. 'image/png', detected from the uploaded file
  name: string        // original filename, for display only
}

export interface TrainEntry {
  id: string
  createdAt: string

  screenType: ScreenType
  hasLabel: boolean

  label: string
  title: string
  titleWeight: TheinhardtWeight
  titleItalic: boolean
  subtitle: string
  subtitleWeight: TheinhardtWeight
  subtitle2: string
  presenters: string

  backgroundColor: string  // '' = unset, let the model estimate
  textColor: string        // '' = unset, let the model estimate

  images: TrainImage[]
}

export function createBlankEntry(overrides?: Partial<Pick<TrainEntry, 'screenType' | 'hasLabel'>>): TrainEntry {
  return {
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    createdAt: new Date().toISOString(),
    screenType: overrides?.screenType ?? 'projector',
    hasLabel: overrides?.hasLabel ?? false,
    label: '',
    title: '',
    titleWeight: 'regular',
    titleItalic: false,
    subtitle: '',
    subtitleWeight: 'regular',
    subtitle2: '',
    presenters: '',
    backgroundColor: '',
    textColor: '',
    images: [{ id: Math.random().toString(36).slice(2), url: '', mediaType: '', name: '' }],
  }
}
