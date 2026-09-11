import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SlideCanvas from '@/components/SlideCanvas'
import { DEFAULT_SLIDE_DATA } from '@/lib/defaults'
import { SlideData, Orientation } from '@/lib/types'

// These scenarios mirror bugs previously found in a separate, hand-maintained
// export renderer that had drifted out of sync with this component (missing
// inline subtitle, missing footer/logos in portrait, text overlapping tall
// images). Now that export renders this component directly, these tests
// guard the single source of truth for both surfaces.

const ORIENTATIONS: Orientation[] = ['landscape', 'portrait']

function withData(overrides: Partial<SlideData>): SlideData {
  return { ...DEFAULT_SLIDE_DATA, ...overrides }
}

describe('SlideCanvas', () => {
  it.each(ORIENTATIONS)('renders label, title, and presenters in %s mode', (orientation) => {
    render(<SlideCanvas data={DEFAULT_SLIDE_DATA} orientation={orientation} />)
    expect(screen.getByText(DEFAULT_SLIDE_DATA.label)).toBeInTheDocument()
    expect(screen.getByText(DEFAULT_SLIDE_DATA.title)).toBeInTheDocument()
    expect(screen.getByText(/Vinson Cunningham/)).toBeInTheDocument()
  })

  it.each(ORIENTATIONS)('renders the inline subtitle before the first presenter in %s mode', (orientation) => {
    const data = withData({ subtitle: 'with', subtitleInline: true })
    render(<SlideCanvas data={data} orientation={orientation} />)
    expect(screen.getByText('with')).toBeInTheDocument()
  })

  it.each(ORIENTATIONS)('does not render a standalone subtitle line when inline in %s mode', (orientation) => {
    const data = withData({ subtitle: 'with', subtitleInline: true })
    const { container } = render(<SlideCanvas data={data} orientation={orientation} />)
    // "with" should appear exactly once (inline), not once inline + once standalone
    expect(container.textContent?.match(/with/g)?.length).toBe(1)
  })

  it.each(ORIENTATIONS)('renders the footer (series name + listening credit) in %s mode', (orientation) => {
    const data = withData({
      showSeriesName: true,
      seriesName: 'RECANATI-KAPLAN TALKS',
      showListeningCredit: true,
      listeningCredit: 'Assistive listening devices available.',
    })
    render(<SlideCanvas data={data} orientation={orientation} />)
    expect(screen.getByText('RECANATI-KAPLAN TALKS')).toBeInTheDocument()
    expect(screen.getByText('Assistive listening devices available.')).toBeInTheDocument()
  })

  it.each(ORIENTATIONS)('renders all logos in %s mode', (orientation) => {
    const data = withData({
      logos: [
        { id: '1', url: 'data:image/png;base64,AAA', alt: 'Logo One' },
        { id: '2', url: 'data:image/png;base64,BBB', alt: 'Logo Two' },
      ],
    })
    render(<SlideCanvas data={data} orientation={orientation} />)
    expect(screen.getByAltText('Logo One')).toBeInTheDocument()
    expect(screen.getByAltText('Logo Two')).toBeInTheDocument()
  })

  it.each(ORIENTATIONS)('renders both images in two-stagger mode in %s mode', (orientation) => {
    const data = withData({
      imageMode: 'two-stagger',
      imageUrl: 'data:image/png;base64,AAA',
      imageAlt: 'Back image',
      image2Url: 'data:image/png;base64,BBB',
      image2Alt: 'Front image',
    })
    render(<SlideCanvas data={data} orientation={orientation} />)
    expect(screen.getByAltText('Back image')).toBeInTheDocument()
    expect(screen.getByAltText('Front image')).toBeInTheDocument()
  })

  it.each(ORIENTATIONS)('wraps long unbroken text instead of overflowing in %s mode', (orientation) => {
    const data = withData({ title: 'A'.repeat(200) })
    render(<SlideCanvas data={data} orientation={orientation} />)
    const titleEl = screen.getByText('A'.repeat(200))
    expect(titleEl).toHaveStyle({ overflowWrap: 'break-word' })
  })

  it.each(ORIENTATIONS)('renders without crashing when no image is set in %s mode', (orientation) => {
    const data = withData({ imageUrl: '', image2Url: '' })
    expect(() => render(<SlideCanvas data={data} orientation={orientation} />)).not.toThrow()
  })
})
