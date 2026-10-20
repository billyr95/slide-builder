import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SlideCanvas from '@/components/SlideCanvas'
import { DEFAULT_SLIDE_DATA } from '@/lib/defaults'
import { SlideData } from '@/lib/types'

// Regression coverage for a real bug: resolvedBlockOrder's fallback (when
// data.blockOrder is undefined -- e.g. any slide saved before this field
// existed) computed "what's the base order" two different ways in two
// different places (`data.blockOrder ?? DEFAULT_BLOCK_ORDER` vs
// `data.blockOrder ?? []`), which made every single block key look
// "missing" and get appended a second time -- Title, Presenters, and
// Program Title all rendered twice on the actual canvas.

function withoutBlockOrder(overrides: Partial<SlideData> = {}): SlideData {
  const data: SlideData = { ...DEFAULT_SLIDE_DATA, ...overrides }
  delete (data as { blockOrder?: unknown }).blockOrder
  return data
}

describe('SlideCanvas blockOrder rendering', () => {
  it('renders each populated block exactly once when data.blockOrder is undefined (a pre-existing slide)', () => {
    const data = withoutBlockOrder({ label: 'TONIGHT', title: 'A Talk', presenters: 'Jane Doe', programTitle: 'Some Work' })
    render(<SlideCanvas data={data} orientation="landscape" />)

    expect(screen.getAllByText('TONIGHT')).toHaveLength(1)
    expect(screen.getAllByText('A Talk')).toHaveLength(1)
    expect(screen.getAllByText('Some Work')).toHaveLength(1)
    // Presenters renders via a wrapping div containing "Jane Doe" as text --
    // query by the whole block's container text instead of an exact string.
    expect(screen.getAllByText((_, el) => el?.textContent === 'Jane Doe')).toHaveLength(1)
  })

  it('renders each block exactly once with an explicit, fully-populated blockOrder too', () => {
    const data: SlideData = {
      ...DEFAULT_SLIDE_DATA,
      label: 'TONIGHT', title: 'A Talk', presenters: 'Jane Doe', programTitle: 'Some Work',
      blockOrder: ['label', 'title', 'programTitle', 'presenters', 'subtitle', 'subtitle2'],
    }
    render(<SlideCanvas data={data} orientation="landscape" />)

    expect(screen.getAllByText('TONIGHT')).toHaveLength(1)
    expect(screen.getAllByText('A Talk')).toHaveLength(1)
    expect(screen.getAllByText('Some Work')).toHaveLength(1)
  })

  it('actually reorders: Program Title moved right after Title renders before Presenters', () => {
    const data: SlideData = {
      ...DEFAULT_SLIDE_DATA,
      label: '', title: 'A Talk', subtitle: '', subtitle2: '', presenters: 'Jane Doe', programTitle: 'Some Work',
      blockOrder: ['label', 'title', 'programTitle', 'presenters', 'subtitle', 'subtitle2'],
    }
    const { container } = render(<SlideCanvas data={data} orientation="landscape" />)
    const text = container.textContent || ''
    expect(text.indexOf('Some Work')).toBeLessThan(text.indexOf('Jane Doe'))
  })

  it('renders each block exactly once with a blockOrder missing a key (defensive append, not duplication)', () => {
    const data: SlideData = {
      ...DEFAULT_SLIDE_DATA,
      label: 'TONIGHT', title: 'A Talk', presenters: 'Jane Doe', programTitle: 'Some Work',
      blockOrder: ['title', 'label'], // missing subtitle/subtitle2/presenters/programTitle/seriesName
    }
    render(<SlideCanvas data={data} orientation="landscape" />)

    expect(screen.getAllByText('TONIGHT')).toHaveLength(1)
    expect(screen.getAllByText('A Talk')).toHaveLength(1)
    expect(screen.getAllByText('Some Work')).toHaveLength(1)
  })

  it('renders a custom text layer at its own position in blockOrder, in its own font/size/color', () => {
    const data: SlideData = {
      ...DEFAULT_SLIDE_DATA,
      label: 'TONIGHT', title: 'A Talk', presenters: 'Jane Doe', programTitle: '', subtitle: '', subtitle2: '',
      customTextLayers: [{ id: 'layer-1', text: 'Custom layer text', font: '92NY Text', weight: 'bold', italic: true, color: '#ff0000', size: 33 }],
      blockOrder: ['label', 'title', 'layer-1', 'presenters', 'subtitle', 'subtitle2', 'programTitle'],
    }
    const { container } = render(<SlideCanvas data={data} orientation="landscape" />)

    const el = screen.getByText('Custom layer text')
    expect(el).toBeInTheDocument()
    const style = (el.closest('div') as HTMLElement).style
    expect(style.fontSize).toBe('33px')
    expect(style.color).toBe('rgb(255, 0, 0)')
    expect(style.fontStyle).toBe('italic')

    // Position: between Title and Presenters, per blockOrder above.
    const text = container.textContent || ''
    expect(text.indexOf('A Talk')).toBeLessThan(text.indexOf('Custom layer text'))
    expect(text.indexOf('Custom layer text')).toBeLessThan(text.indexOf('Jane Doe'))
  })

  it('an empty custom text layer is not rendered and is excluded from the reorderable stack', () => {
    const data: SlideData = {
      ...DEFAULT_SLIDE_DATA,
      customTextLayers: [{ id: 'layer-1', text: '   ', font: 'Theinhardt', weight: 'regular', italic: false, size: 48 }],
      blockOrder: [...(DEFAULT_SLIDE_DATA.blockOrder ?? []), 'layer-1'],
    }
    render(<SlideCanvas data={data} orientation="landscape" />)
    expect(screen.queryByText('layer-1')).not.toBeInTheDocument()
  })
})
