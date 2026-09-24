import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import SlideCanvas from '@/components/SlideCanvas'
import { DEFAULT_SLIDE_DATA } from '@/lib/defaults'
import { SlideData, Orientation } from '@/lib/types'

// Series Name is pinned to its own fixed footer slot (directly above
// Listening Credit), entirely outside blockOrder -- this file covers that
// it renders regardless of blockOrder/Listening Credit's presence, and
// that reordering the actual stack never moves it.
afterEach(cleanup)

function baseData(overrides: Partial<SlideData> = {}): SlideData {
  return {
    ...DEFAULT_SLIDE_DATA,
    label: 'TONIGHT', title: 'A Talk', presenters: 'Jane Doe', programTitle: 'Some Work',
    showSeriesName: true, seriesName: 'SERIES', showListeningCredit: true, listeningCredit: 'Credit line',
    ...overrides,
  }
}

function styleOf(text: string) {
  return screen.getByText((_, n) => n?.textContent === text && n?.childElementCount === 0).style
}

function renderAt(data: SlideData, orientation: Orientation) {
  return render(<SlideCanvas data={data} orientation={orientation} />)
}

describe('Series Name: pinned above Listening Credit, independent of blockOrder', () => {
  it('renders even when Listening Credit is off -- not collapsed or repositioned by its absence', () => {
    renderAt(baseData({ showListeningCredit: false, listeningCredit: '' }), 'landscape')
    expect(screen.getByText('SERIES')).toBeInTheDocument()
  })

  it('renders directly above Listening Credit when both are present, regardless of DOM order elsewhere', () => {
    renderAt(baseData(), 'landscape')
    const series = screen.getByText('SERIES')
    const credit = screen.getByText('Credit line')
    // Both live inside the same fixed footer container; Series Name is its
    // first child (comes before Listening Credit in source order, and the
    // footer stacks children top-to-bottom).
    const footer = series.parentElement!
    expect(footer).toBe(credit.parentElement)
    const children = Array.from(footer.children)
    expect(children.indexOf(series)).toBeLessThan(children.indexOf(credit))
  })

  it('stays in its fixed slot no matter how blockOrder is arranged', () => {
    const reordered = baseData({
      blockOrder: ['programTitle', 'presenters', 'subtitle2', 'subtitle', 'title', 'label'],
    })
    renderAt(reordered, 'landscape')
    const series = screen.getByText('SERIES')
    const credit = screen.getByText('Credit line')
    expect(series.parentElement).toBe(credit.parentElement)
  })

  it('holds in portrait too', () => {
    renderAt(baseData(), 'portrait')
    expect(screen.getByText('SERIES')).toBeInTheDocument()
    expect(screen.getByText('SERIES').parentElement).toBe(screen.getByText('Credit line').parentElement)
  })

  it('holds with Flip (imageSide right) active, in both orientations', () => {
    renderAt(baseData({ imageSide: 'right' }), 'landscape')
    expect(screen.getByText('SERIES').parentElement).toBe(screen.getByText('Credit line').parentElement)
    cleanup()
    renderAt(baseData({ imageSide: 'right' }), 'portrait')
    expect(screen.getByText('SERIES').parentElement).toBe(screen.getByText('Credit line').parentElement)
  })

  it('its own margin-top control still works: overriding it changes only its own gap, not Listening Credit\'s fixed position', () => {
    const { unmount: u1 } = renderAt(baseData(), 'landscape')
    const baselineCreditTop = styleOf('Credit line').marginTop
    u1()

    renderAt(baseData({ seriesNameMarginTop: 5 }), 'landscape')
    expect(styleOf('SERIES').marginTop).toBe('5px')
    // Listening Credit's own marginTop (its gap from Series Name via the
    // footer's fixed small flex gap) is untouched by Series Name's margin.
    expect(styleOf('Credit line').marginTop).toBe(baselineCreditTop)
  })

  it('defaults to the auto value (undefined override) rather than a hardcoded number', () => {
    renderAt(baseData(), 'landscape')
    const seriesTop = styleOf('SERIES').marginTop
    expect(seriesTop).not.toBe('0px')
    expect(seriesTop).not.toBe('')
  })
})
