import { describe, it, expect } from 'vitest'
import { trainEntryToRow, rowToTrainEntry } from '@/lib/db/trainingEntryMapping'
import { createBlankEntry, TrainEntry } from '@/lib/trainTypes'

// trainEntryToRow/rowToTrainEntry round-trip a TrainEntry through the DB's
// flattened image1../image4.. columns. The compaction logic (imagePlacements
// is a dense array; the DB stores fixed numbered slots) is the one part of
// this mapping that isn't a straight 1:1 field copy, so it's worth pinning
// down explicitly rather than trusting it only via manual testing.

function baseEntry(overrides: Partial<TrainEntry> = {}): TrainEntry {
  return {
    ...createBlankEntry({ screenType: 'projector', orientation: 'landscape', hasLabel: false, hasLogos: false, hasQrCode: false }),
    source: 'live',
    title: 'Some Title',
    ...overrides,
  }
}

describe('trainingEntryMapping -- imagePlacements flatten/unflatten', () => {
  it('round-trips a full 4-image entry through the flattened columns', () => {
    const entry = baseEntry({
      imagePlacements: [
        { y: 1, scale: 100, zIndex: 4 },
        { y: 2, scale: 200, zIndex: 3 },
        { y: 3, scale: 300, zIndex: 2 },
        { y: 4, scale: 400, zIndex: 1 },
      ],
    })
    const row = trainEntryToRow(entry, 'user-1')
    expect(row.image1Y).toBe(1)
    expect(row.image1Scale).toBe(100)
    expect(row.image1ZIndex).toBe(4)
    expect(row.image4Y).toBe(4)
    expect(row.image4Scale).toBe(400)
    expect(row.image4ZIndex).toBe(1)

    const roundTripped = rowToTrainEntry({ ...row, id: 'x', createdAt: new Date() } as any)
    expect(roundTripped.imagePlacements).toEqual(entry.imagePlacements)
  })

  it('round-trips a 2-image entry without leaving stray data in slots 3/4', () => {
    const entry = baseEntry({
      imagePlacements: [
        { y: 10, scale: 300, zIndex: 1 },
        { y: -10, scale: 300, zIndex: 2 },
      ],
    })
    const row = trainEntryToRow(entry, 'user-1')
    expect(row.image3Y).toBeNull()
    expect(row.image3Scale).toBeNull()
    expect(row.image4Y).toBeNull()

    const roundTripped = rowToTrainEntry({ ...row, id: 'x', createdAt: new Date() } as any)
    expect(roundTripped.imagePlacements).toEqual(entry.imagePlacements)
  })

  it('preserves a placement with no zIndex (older data) as undefined, not null or 0', () => {
    const entry = baseEntry({ imagePlacements: [{ y: 5, scale: 250 }] })
    const row = trainEntryToRow(entry, 'user-1')
    expect(row.image1ZIndex).toBeNull()

    const roundTripped = rowToTrainEntry({ ...row, id: 'x', createdAt: new Date() } as any)
    expect(roundTripped.imagePlacements).toEqual([{ y: 5, scale: 250, zIndex: undefined }])
  })

  it('returns undefined imagePlacements (not an empty array) when there are no images', () => {
    const entry = baseEntry({ imagePlacements: undefined })
    const row = trainEntryToRow(entry, 'user-1')
    const roundTripped = rowToTrainEntry({ ...row, id: 'x', createdAt: new Date() } as any)
    expect(roundTripped.imagePlacements).toBeUndefined()
  })
})

describe('trainingEntryMapping -- new scalar layout ground-truth fields', () => {
  it('round-trips textAlign, imagesLinkedSize, and the match-title-size flags, including false', () => {
    const entry = baseEntry({
      textAlign: 'center',
      imagesLinkedSize: false,
      presentersMatchTitleSize: true,
      programTitleMatchTitleSize: false,
    })
    const row = trainEntryToRow(entry, 'user-1')
    expect(row.textAlign).toBe('center')
    expect(row.imagesLinkedSize).toBe(false)
    expect(row.presentersMatchTitleSize).toBe(true)
    expect(row.programTitleMatchTitleSize).toBe(false)

    const roundTripped = rowToTrainEntry({ ...row, id: 'x', createdAt: new Date() } as any)
    expect(roundTripped.textAlign).toBe('center')
    expect(roundTripped.imagesLinkedSize).toBe(false)
    expect(roundTripped.presentersMatchTitleSize).toBe(true)
    expect(roundTripped.programTitleMatchTitleSize).toBe(false)
  })

  it('leaves the inferred_* columns null on write -- nothing populates them yet', () => {
    const row = trainEntryToRow(baseEntry(), 'user-1')
    expect(row.inferredImageSide).toBeNull()
    expect(row.inferredTextAlign).toBeNull()
    expect(row.inferredSizesAppearMatched).toBeNull()
    expect(row.inferredPresentersSizeMatchesTitle).toBeNull()
  })
})
