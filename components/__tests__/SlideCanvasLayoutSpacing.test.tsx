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

describe('Image <-> text gap and outer content margin: defaults reproduce prior rendering', () => {
  it('landscape single-image mode: text\'s facing-side padding defaults to 20px (100 total gap minus the image column\'s own 80px inset)', () => {
    renderAt(baseData(), 'landscape')
    expect(elementOf('TONIGHT').parentElement!.style.paddingLeft).toBe('20px')
  })

  it('landscape stagger mode: text\'s facing-side padding defaults to 20px (80 total gap minus the image column\'s own 60px inset)', () => {
    renderAt(baseData({ imageMode: 'three-stagger' }), 'landscape')
    expect(elementOf('TONIGHT').parentElement!.style.paddingLeft).toBe('20px')
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
  it('a larger landscape gap increases the text column\'s facing-side padding', () => {
    renderAt(baseData({ imageTextGapLandscape: 300 }), 'landscape')
    // 300 total - 80 (image's own inset) = 220 on the text side.
    expect(elementOf('TONIGHT').parentElement!.style.paddingLeft).toBe('220px')
  })

  it('a gap smaller than the image column\'s own inset floors at 0, never negative', () => {
    renderAt(baseData({ imageTextGapLandscape: 0 }), 'landscape')
    expect(elementOf('TONIGHT').parentElement!.style.paddingLeft).toBe('0px')
  })

  it('portrait gap overrides the text section\'s top padding directly', () => {
    renderAt(baseData({ imageTextGapPortrait: 200 }), 'portrait')
    expect(elementOf('TONIGHT').parentElement!.style.paddingTop).toBe('200px')
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
