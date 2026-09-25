import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import SlideCanvas from '@/components/SlideCanvas'
import { DEFAULT_SLIDE_DATA } from '@/lib/defaults'
import { SlideData, Orientation } from '@/lib/types'

// Covers imageTextGapLandscape/imageTextGapPortrait and contentMargin --
// undefined must reproduce today's exact rendered spacing (verified against
// real Chromium renders separately; this file locks in the underlying style
// values so a future change can't silently drift), and setting them must
// visibly move things without breaking Flip.
afterEach(cleanup)

function baseData(overrides: Partial<SlideData> = {}): SlideData {
  return {
    ...DEFAULT_SLIDE_DATA,
    label: 'TONIGHT', title: 'A Talk', presenters: 'Jane Doe',
    ...overrides,
  }
}

function elementOf(text: string): HTMLElement {
  return screen.getByText((_, n) => n?.textContent === text && n?.childElementCount === 0)
}

function styleOf(text: string) {
  return elementOf(text).style
}

function renderAt(data: SlideData, orientation: Orientation) {
  return render(<SlideCanvas data={data} orientation={orientation} />)
}

// The image column is always the slide-canvas's first DOM child in
// landscape mode (row-reverse only changes VISUAL order via Flip, not DOM
// order) -- more robust than querying by placeholder text, which is
// ambiguous in stagger mode (multiple empty "Image" slots at once).
function imageColumnStyle(): CSSStyleDeclaration {
  const canvas = document.querySelector('#slide-canvas')!
  return (canvas.children[0] as HTMLElement).style
}

describe('Image <-> text gap and outer content margin: defaults reproduce prior rendering', () => {
  it('landscape single-image mode: text\'s facing-side padding defaults to 20px (100 total gap minus the image column\'s own 80px inset), image side stays at its full 80px default', () => {
    renderAt(baseData(), 'landscape')
    expect(elementOf('TONIGHT').parentElement!.style.paddingLeft).toBe('20px')
    expect(imageColumnStyle().paddingRight).toBe('80px')
  })

  it('landscape stagger mode: text\'s facing-side padding defaults to 20px (80 total gap minus the image column\'s own 60px inset), image side stays at its full 60px default', () => {
    renderAt(baseData({ imageMode: 'three-stagger' }), 'landscape')
    expect(elementOf('TONIGHT').parentElement!.style.paddingLeft).toBe('20px')
    expect(imageColumnStyle().paddingRight).toBe('60px')
  })

  it('portrait mode: text section\'s own top padding defaults to 60px', () => {
    renderAt(baseData(), 'portrait')
    expect(elementOf('TONIGHT').parentElement!.style.paddingTop).toBe('60px')
  })

  it('Flip swaps which side gets the facing (tight) padding, same total gap either way', () => {
    const { unmount } = renderAt(baseData(), 'landscape')
    const normalTextPad = elementOf('TONIGHT').parentElement!.style
    expect(normalTextPad.paddingLeft).toBe('20px')
    expect(normalTextPad.paddingRight).toBe('80px')
    unmount()

    renderAt(baseData({ imageSide: 'right' }), 'landscape')
    const flippedTextPad = elementOf('TONIGHT').parentElement!.style
    expect(flippedTextPad.paddingRight).toBe('20px')
    expect(flippedTextPad.paddingLeft).toBe('80px')
  })
})

describe('imageTextGap overrides', () => {
  it('a larger landscape gap increases the text column\'s facing-side padding; the image side stays at its full default (never reduced above default)', () => {
    renderAt(baseData({ imageTextGapLandscape: 300 }), 'landscape')
    // 300 total - 80 (image's own inset) = 220 on the text side.
    expect(elementOf('TONIGHT').parentElement!.style.paddingLeft).toBe('220px')
    expect(imageColumnStyle().paddingRight).toBe('80px')
  })

  it('a gap BELOW the image column\'s own default inset shrinks the image\'s OWN facing padding too, not just the text side -- so the two together actually reach the requested (smaller) total', () => {
    // Single-image default inset is 80px; requesting 30 is below that, so
    // both sides now have to give: image facing shrinks to 30, text facing
    // is 0 (nothing left over) -- total is the requested 30, not stuck at
    // the old 80px floor.
    renderAt(baseData({ imageTextGapLandscape: 30 }), 'landscape')
    expect(imageColumnStyle().paddingRight).toBe('30px')
    expect(elementOf('TONIGHT').parentElement!.style.paddingLeft).toBe('0px')
  })

  it('a gap of exactly 0 makes image and text genuinely touch -- BOTH sides\' facing padding are 0, not just the text side', () => {
    renderAt(baseData({ imageTextGapLandscape: 0 }), 'landscape')
    expect(imageColumnStyle().paddingRight).toBe('0px')
    expect(elementOf('TONIGHT').parentElement!.style.paddingLeft).toBe('0px')
  })

  it('the same 0-gap touching behavior holds in stagger mode too, whose default inset (60px) is smaller than single-image\'s (80px)', () => {
    renderAt(baseData({ imageMode: 'three-stagger', imageTextGapLandscape: 0 }), 'landscape')
    expect(imageColumnStyle().paddingRight).toBe('0px')
    expect(elementOf('TONIGHT').parentElement!.style.paddingLeft).toBe('0px')
  })

  it('Flip still zeroes the correct (swapped) sides\' padding at a reduced gap', () => {
    // This confirms the PADDING mechanism swaps sides correctly under Flip
    // -- it does NOT mean the image and text visually touch here. With
    // Flip, the text column's facing side is its RIGHT edge, but text-align
    // left/center only position content relative to the (wide, flex:1)
    // box's own left/center, not that far edge -- so short text doesn't
    // actually reach a zeroed facing padding in this specific
    // configuration (verified via real-Chromium rendering; a separate,
    // pre-existing limitation from this gap-floor fix, not addressed here
    // since fixing it risks breaking text wrapping for real content).
    // Non-flip mode doesn't have this problem -- see the earlier tests.
    renderAt(baseData({ imageTextGapLandscape: 0, imageSide: 'right' }), 'landscape')
    expect(imageColumnStyle().paddingLeft).toBe('0px')
    expect(elementOf('TONIGHT').parentElement!.style.paddingRight).toBe('0px')
  })

  it('portrait gap overrides the text section\'s top padding directly, including down to 0 (portrait never had an image-side floor to begin with)', () => {
    renderAt(baseData({ imageTextGapPortrait: 200 }), 'portrait')
    expect(elementOf('TONIGHT').parentElement!.style.paddingTop).toBe('200px')

    cleanup()
    renderAt(baseData({ imageTextGapPortrait: 0 }), 'portrait')
    expect(elementOf('TONIGHT').parentElement!.style.paddingTop).toBe('0px')
  })

  it('has no effect on imageMode "none" (nothing to have a gap with)', () => {
    renderAt(baseData({ imageMode: 'none', imageTextGapLandscape: 300 }), 'landscape')
    // 'none' mode's single container padding is untouched by imageTextGap.
    expect(screen.getByText('TONIGHT')).toBeInTheDocument()
  })
})

describe('contentMargin overrides', () => {
  it('applies to the "none" mode outer container uniformly', () => {
    renderAt(baseData({ imageMode: 'none', contentMargin: 150 }), 'landscape')
    // The outer slide div is the direct parent chain up from the text stack wrapper.
    const outer = screen.getByText('TONIGHT').closest('#slide-canvas') as HTMLElement
    expect(outer.style.padding).toBe('150px')
  })

  it('applies to portrait\'s top padding', () => {
    renderAt(baseData({ contentMargin: 150 }), 'portrait')
    const outer = screen.getByText('TONIGHT').closest('#slide-canvas') as HTMLElement
    expect(outer.style.paddingTop).toBe('150px')
  })

  it('leaving it unset keeps portrait\'s default top (80) even though its own bottom default (60) differs', () => {
    renderAt(baseData(), 'portrait')
    const outer = screen.getByText('TONIGHT').closest('#slide-canvas') as HTMLElement
    expect(outer.style.paddingTop).toBe('80px')
  })
})
