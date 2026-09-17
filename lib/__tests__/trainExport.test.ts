import { describe, it, expect } from 'vitest'
import { buildBatchLine } from '@/lib/trainExport'
import { createBlankEntry, TrainEntry } from '@/lib/trainTypes'

// buildBatchLine's output is a JSONL line whose "prompt" is free-form text
// embedded in params.messages[0].content -- these tests parse that back out
// to check the actual facts a reader (human or model) would see, the same
// way merge_and_explore.py's parse_known_values does.
function promptTextOf(entry: TrainEntry): string {
  const line = JSON.parse(buildBatchLine(entry))
  const content = line.params.messages[0].content as { type: string; text?: string }[]
  return content.find(b => b.type === 'text')!.text!
}

function liveEntry(overrides: Partial<TrainEntry> = {}): TrainEntry {
  return {
    ...createBlankEntry({ screenType: 'projector', orientation: 'landscape', hasLabel: false, hasLogos: false, hasQrCode: false }),
    source: 'live',
    title: 'Some Title',
    backgroundColor: '#000000',
    textColor: '#ffffff',
    ...overrides,
  }
}

function uploadEntry(overrides: Partial<TrainEntry> = {}): TrainEntry {
  return {
    ...createBlankEntry({ screenType: 'projector', orientation: 'landscape', hasLabel: false, hasLogos: false, hasQrCode: false }),
    title: 'Some Title',
    ...overrides,
  }
}

describe('buildBatchLine -- live entries (buildConfirmPrompt)', () => {
  it('includes textAlign, imagesLinkedSize, and the match-title-size flags as ground truth', () => {
    const text = promptTextOf(liveEntry({
      textAlign: 'center',
      imagesLinkedSize: true,
      presentersMatchTitleSize: false,
      programTitleMatchTitleSize: true,
    }))
    expect(text).toContain('Text alignment: center')
    expect(text).toContain('Image 1 & 2 sizes linked: true')
    // false is a real, meaningful value here -- must not be silently dropped
    // by a falsy check the way `if (entry.presentersMatchTitleSize)` would.
    expect(text).toContain('Presenters font size matches Title: false')
    expect(text).toContain('Program title font size matches Title: true')
  })

  it('omits the match-title-size lines when unset (undefined), not when false', () => {
    const text = promptTextOf(liveEntry({ presentersMatchTitleSize: undefined }))
    expect(text).not.toContain('Presenters font size matches Title')
  })

  it('includes image width/height ratio using the same field names uploads get back from the model', () => {
    const text = promptTextOf(liveEntry({ imageWidthRatio: 0.4567, imageHeightRatio: 0.891 }))
    expect(text).toContain('Image 1 width ratio: 0.457')
    expect(text).toContain('Image 1 height ratio: 0.891')
  })

  it('lists each stagger image\'s y/scale/zIndex as individually labeled facts, not just inside the liveStyle blob', () => {
    const text = promptTextOf(liveEntry({
      imagePlacements: [
        { y: 10, scale: 300, zIndex: 2 },
        { y: -5, scale: 250, zIndex: 1 },
      ],
    }))
    expect(text).toContain('Image 1 vertical offset (px): 10')
    expect(text).toContain('Image 1 size override (px): 300')
    expect(text).toContain('Image 1 layer/z-index: 2')
    expect(text).toContain('Image 2 vertical offset (px): -5')
    expect(text).toContain('Image 2 size override (px): 250')
    expect(text).toContain('Image 2 layer/z-index: 1')
  })

  it('omits the layer/z-index line for a placement with no zIndex, but still reports y/scale', () => {
    const text = promptTextOf(liveEntry({ imagePlacements: [{ y: 0, scale: 300 }] }))
    expect(text).toContain('Image 1 vertical offset (px): 0')
    expect(text).toContain('Image 1 size override (px): 300')
    expect(text).not.toContain('Image 1 layer/z-index')
  })
})

describe('buildBatchLine -- upload entries (buildEstimatePrompt)', () => {
  it('asks for inferred_image_side only when an image is attached', () => {
    const withImage = promptTextOf(uploadEntry({
      images: [{ id: '1', url: 'data:image/png;base64,AAA', mediaType: 'image/png', name: 'a' }],
    }))
    expect(withImage).toContain('inferred_image_side')

    const withoutImage = promptTextOf(uploadEntry({ images: [] }))
    expect(withoutImage).not.toContain('inferred_image_side')
  })

  it('asks for inferred_sizes_appear_matched only when 2+ images are attached', () => {
    const oneImage = promptTextOf(uploadEntry({
      images: [{ id: '1', url: 'data:image/png;base64,AAA', mediaType: 'image/png', name: 'a' }],
    }))
    expect(oneImage).not.toContain('inferred_sizes_appear_matched')

    const twoImages = promptTextOf(uploadEntry({
      images: [
        { id: '1', url: 'data:image/png;base64,AAA', mediaType: 'image/png', name: 'a' },
        { id: '2', url: 'data:image/png;base64,BBB', mediaType: 'image/png', name: 'b' },
      ],
    }))
    expect(twoImages).toContain('inferred_sizes_appear_matched')
  })

  it('always asks for inferred_text_align, regardless of images', () => {
    const text = promptTextOf(uploadEntry({ images: [] }))
    expect(text).toContain('inferred_text_align')
  })

  it('asks for inferred_presenters_size_matches_title only when presenters text is present', () => {
    const withoutPresenters = promptTextOf(uploadEntry({ presenters: '' }))
    expect(withoutPresenters).not.toContain('inferred_presenters_size_matches_title')

    const withPresenters = promptTextOf(uploadEntry({ presenters: 'Jane Doe' }))
    expect(withPresenters).toContain('inferred_presenters_size_matches_title')
  })

  it('still estimates background/text color when left blank, unaffected by the new fields', () => {
    const text = promptTextOf(uploadEntry({ backgroundColor: '', textColor: '' }))
    expect(text).toContain('Background color (hex)')
    expect(text).toContain('Text color (hex)')
  })

  it('does not include live-only ground-truth lines for upload entries', () => {
    const text = promptTextOf(uploadEntry({ textAlign: 'center', imagesLinkedSize: true }))
    expect(text).not.toContain('Text alignment')
    expect(text).not.toContain('sizes linked')
  })
})
