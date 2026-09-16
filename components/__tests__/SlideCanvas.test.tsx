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
      staggerImages: [
        { id: '1', url: 'data:image/png;base64,AAA', alt: 'Back image', y: 0, scale: 0 },
        { id: '2', url: 'data:image/png;base64,BBB', alt: 'Front image', y: 0, scale: 0 },
      ],
    })
    render(<SlideCanvas data={data} orientation={orientation} />)
    expect(screen.getByAltText('Back image')).toBeInTheDocument()
    expect(screen.getByAltText('Front image')).toBeInTheDocument()
  })

  it.each(ORIENTATIONS)('renders all four images in four-stagger mode in %s mode', (orientation) => {
    const data = withData({
      imageMode: 'four-stagger',
      staggerImages: [
        { id: '1', url: 'data:image/png;base64,AAA', alt: 'Image A', y: 0, scale: 0 },
        { id: '2', url: 'data:image/png;base64,BBB', alt: 'Image B', y: 0, scale: 0 },
        { id: '3', url: 'data:image/png;base64,CCC', alt: 'Image C', y: 0, scale: 0 },
        { id: '4', url: 'data:image/png;base64,DDD', alt: 'Image D', y: 0, scale: 0 },
      ],
    })
    render(<SlideCanvas data={data} orientation={orientation} />)
    expect(screen.getByAltText('Image A')).toBeInTheDocument()
    expect(screen.getByAltText('Image B')).toBeInTheDocument()
    expect(screen.getByAltText('Image C')).toBeInTheDocument()
    expect(screen.getByAltText('Image D')).toBeInTheDocument()
  })

  it.each(ORIENTATIONS)('renders all three images in three-triangle mode in %s mode', (orientation) => {
    const data = withData({
      imageMode: 'three-triangle',
      staggerImages: [
        { id: '1', url: 'data:image/png;base64,AAA', alt: 'Top left', y: 0, scale: 0 },
        { id: '2', url: 'data:image/png;base64,BBB', alt: 'Top right', y: 0, scale: 0 },
        { id: '3', url: 'data:image/png;base64,CCC', alt: 'Bottom', y: 0, scale: 0 },
      ],
    })
    render(<SlideCanvas data={data} orientation={orientation} />)
    expect(screen.getByAltText('Top left')).toBeInTheDocument()
    expect(screen.getByAltText('Top right')).toBeInTheDocument()
    expect(screen.getByAltText('Bottom')).toBeInTheDocument()
  })

  it.each(ORIENTATIONS)('renders all four images in four-squared mode in %s mode', (orientation) => {
    const data = withData({
      imageMode: 'four-squared',
      staggerImages: [
        { id: '1', url: 'data:image/png;base64,AAA', alt: 'Image A', y: 0, scale: 0 },
        { id: '2', url: 'data:image/png;base64,BBB', alt: 'Image B', y: 0, scale: 0 },
        { id: '3', url: 'data:image/png;base64,CCC', alt: 'Image C', y: 0, scale: 0 },
        { id: '4', url: 'data:image/png;base64,DDD', alt: 'Image D', y: 0, scale: 0 },
      ],
    })
    render(<SlideCanvas data={data} orientation={orientation} />)
    expect(screen.getByAltText('Image A')).toBeInTheDocument()
    expect(screen.getByAltText('Image B')).toBeInTheDocument()
    expect(screen.getByAltText('Image C')).toBeInTheDocument()
    expect(screen.getByAltText('Image D')).toBeInTheDocument()
  })

  it.each(ORIENTATIONS)('wraps long unbroken text instead of overflowing in %s mode', (orientation) => {
    const data = withData({ title: 'A'.repeat(200) })
    render(<SlideCanvas data={data} orientation={orientation} />)
    const titleEl = screen.getByText('A'.repeat(200))
    expect(titleEl).toHaveStyle({ overflowWrap: 'break-word' })
  })

  it.each(ORIENTATIONS)('renders without crashing when no image is set in %s mode', (orientation) => {
    const data = withData({ imageUrl: '', staggerImages: [] })
    expect(() => render(<SlideCanvas data={data} orientation={orientation} />)).not.toThrow()
  })

  it.each(ORIENTATIONS)('imageMode "none" renders no image placeholder in %s mode', (orientation) => {
    const data = withData({ imageMode: 'none', imageUrl: '', staggerImages: [] })
    render(<SlideCanvas data={data} orientation={orientation} />)
    expect(screen.queryByText('Image')).not.toBeInTheDocument()
    expect(screen.getByText(DEFAULT_SLIDE_DATA.title)).toBeInTheDocument()
  })

  it.each(ORIENTATIONS)('defaults the title to 92NY at weight 700 in %s mode', (orientation) => {
    render(<SlideCanvas data={DEFAULT_SLIDE_DATA} orientation={orientation} />)
    const titleEl = screen.getByText(DEFAULT_SLIDE_DATA.title)
    expect(titleEl).toHaveStyle({ fontFamily: "'92NY Text', sans-serif", fontWeight: '700' })
  })

  it.each(ORIENTATIONS)('switches the title to Theinhardt Heavy when selected in %s mode', (orientation) => {
    const data = withData({ titleFont: 'Theinhardt Heavy' })
    render(<SlideCanvas data={data} orientation={orientation} />)
    const titleEl = screen.getByText(DEFAULT_SLIDE_DATA.title)
    expect(titleEl).toHaveStyle({ fontFamily: "'Theinhardt', sans-serif", fontWeight: '900' })
  })

  it.each(ORIENTATIONS)('defaults presenters to Theinhardt in %s mode', (orientation) => {
    render(<SlideCanvas data={DEFAULT_SLIDE_DATA} orientation={orientation} />)
    const presentersEl = screen.getByText(/Vinson Cunningham/)
    expect(presentersEl).toHaveStyle({ fontFamily: "'Theinhardt', sans-serif" })
  })

  it.each(ORIENTATIONS)('switches presenters to 92NY when selected in %s mode', (orientation) => {
    const data = withData({ presentersFont: '92NY Text' })
    render(<SlideCanvas data={data} orientation={orientation} />)
    const presentersEl = screen.getByText(/Vinson Cunningham/)
    expect(presentersEl).toHaveStyle({ fontFamily: "'92NY Text', sans-serif" })
  })

  it.each(ORIENTATIONS)('imageMode "none" centers the text content in %s mode', (orientation) => {
    const data = withData({ imageMode: 'none' })
    render(<SlideCanvas data={data} orientation={orientation} />)
    const root = screen.getByText(DEFAULT_SLIDE_DATA.title).closest('#slide-canvas') as HTMLElement
    expect(root).toHaveStyle({ textAlign: 'center', justifyContent: 'center' })
  })
})
