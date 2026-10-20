// The New Slide flow's in-progress form state, lifted out of NewSlideModal
// (see its own comment) so NewSlideFlow can hold it across the content/name
// step transition -- Back from naming no longer loses anything, since the
// modal that owns the fields is never actually unmounted-and-reset, just
// re-rendered with the same draft. Also persisted to IndexedDB (not
// localStorage -- images are base64 data URLs that can comfortably exceed
// localStorage's ~5-10MB synchronous quota) so an accidental tab close or
// refresh mid-entry restores it the next time the New Slide flow is opened.
import { ScreenType } from './trainTypes'
import { SlideFieldsInput, DroppedImage } from '@/components/NewSlideModal'
import { DEFAULT_SLIDE_DATA } from './defaults'

export interface NewSlideDraft extends SlideFieldsInput {
  screenType: ScreenType
  images: DroppedImage[]
}

export function blankDraft(screenType: ScreenType): NewSlideDraft {
  return {
    screenType,
    backgroundColor: DEFAULT_SLIDE_DATA.backgroundColor,
    label: '',
    labelColor: DEFAULT_SLIDE_DATA.labelColor ?? DEFAULT_SLIDE_DATA.textColor,
    labelRichText: undefined,
    title: '',
    titleColor: DEFAULT_SLIDE_DATA.accentColor,
    titleRichText: undefined,
    subtitle: '',
    subtitleColor: DEFAULT_SLIDE_DATA.subtitleColor ?? DEFAULT_SLIDE_DATA.textColor,
    subtitleRichText: undefined,
    subtitle2: '',
    subtitle2Color: DEFAULT_SLIDE_DATA.subtitle2Color ?? DEFAULT_SLIDE_DATA.textColor,
    subtitle2RichText: undefined,
    presenters: '',
    presentersFont: 'Theinhardt',
    presentersWeight: 'regular',
    presentersItalic: false,
    presentersColor: DEFAULT_SLIDE_DATA.presentersColor ?? DEFAULT_SLIDE_DATA.textColor,
    presentersRichText: undefined,
    programTitle: '',
    programTitleFont: 'Theinhardt',
    programTitleWeight: 'regular',
    programTitleItalic: true,
    programTitleColor: DEFAULT_SLIDE_DATA.programTitleColor ?? DEFAULT_SLIDE_DATA.textColor,
    programTitleRichText: undefined,
    seriesName: '',
    seriesNameColor: DEFAULT_SLIDE_DATA.seriesNameColor ?? DEFAULT_SLIDE_DATA.textColor,
    seriesNameRichText: undefined,
    textAlign: 'left',
    images: [],
  }
}

// Whether the draft has anything a user would be upset to lose -- gates
// whether Discard needs a confirm prompt.
export function draftHasContent(draft: NewSlideDraft): boolean {
  return !!(
    draft.label || draft.title || draft.subtitle || draft.subtitle2 ||
    draft.presenters || draft.programTitle || draft.seriesName ||
    draft.images.length > 0
  )
}

const DB_NAME = 'slide-builder-drafts'
const DB_VERSION = 1
const STORE_NAME = 'newSlideDraft'
const DRAFT_KEY = 'current'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// Best-effort everywhere below: a draft is a convenience, not critical
// state -- IndexedDB being unavailable (private browsing, blocked storage,
// an old browser) should never break the New Slide flow itself, just
// silently skip the save-for-later behavior.
export async function saveDraft(draft: NewSlideDraft): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(draft, DRAFT_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch (e) {
    console.warn('Failed to save New Slide draft', e)
  }
}

export async function loadDraft(): Promise<NewSlideDraft | null> {
  try {
    const db = await openDb()
    const result = await new Promise<NewSlideDraft | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(DRAFT_KEY)
      req.onsuccess = () => resolve((req.result as NewSlideDraft | undefined) ?? null)
      req.onerror = () => reject(req.error)
    })
    db.close()
    return result
  } catch (e) {
    console.warn('Failed to load New Slide draft', e)
    return null
  }
}

export async function clearDraft(): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(DRAFT_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch (e) {
    console.warn('Failed to clear New Slide draft', e)
  }
}
