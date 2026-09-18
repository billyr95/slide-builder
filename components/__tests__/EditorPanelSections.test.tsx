import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EditorPanel from '@/components/EditorPanel'
import { DEFAULT_SLIDE_DATA } from '@/lib/defaults'
import { SlideData } from '@/lib/types'

// Covers the tabbed right-panel sections + icon rail added in the editor UI
// redesign -- specifically the parts a type check alone wouldn't catch:
// that exactly one section is ever in the DOM at a time (not an accordion
// where several can be open together), that clicking a rail icon swaps
// which one is shown, and that each field renders inside its own bordered
// card.

function renderPanel(overrides: Partial<SlideData> = {}) {
  const data: SlideData = { ...DEFAULT_SLIDE_DATA, ...overrides }
  const onChange = vi.fn()
  render(<EditorPanel data={data} onChange={onChange} screenType="projector" slideRevision={0} orientation="landscape" onOrientationChange={vi.fn()} />)
  return { onChange }
}

describe('EditorPanel tabbed sections', () => {
  it('starts on the Background tab, with every other section entirely absent from the DOM', () => {
    renderPanel()
    expect(screen.getByText('Background color')).toBeInTheDocument()

    // Not just visually hidden -- genuinely not rendered.
    expect(screen.queryByPlaceholderText('TONIGHT')).not.toBeInTheDocument() // Content
    expect(screen.queryByText('92NY Text')).not.toBeInTheDocument() // Typography
    expect(screen.queryByPlaceholderText(/Name One/)).not.toBeInTheDocument() // Presenters
    expect(screen.queryByText('Series name')).not.toBeInTheDocument() // Footer
    expect(screen.queryByText('Text on Background')).not.toBeInTheDocument() // Accessibility
  })

  it('clicking a rail icon shows only that section, hiding whichever was showing before', () => {
    renderPanel()
    fireEvent.click(screen.getByTitle('Presenters (One per line)'))

    expect(screen.getByPlaceholderText(/Name One/)).toBeInTheDocument()
    // Background's own fields are gone now, not just Presenters added.
    expect(screen.queryByText('Background color')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Content'))
    expect(screen.getByPlaceholderText('TONIGHT')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/Name One/)).not.toBeInTheDocument()
  })

  it('every section is reachable via its own rail icon, including ones with no dedicated rail slot in the reference (Layout, Program Title, Logo Bar, Footer, Accessibility)', () => {
    renderPanel({ imageMode: 'none' })
    fireEvent.click(screen.getByTitle('Layout & Preview'))
    expect(screen.getByText('Text alignment')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Program / Work Title'))
    expect(screen.getByPlaceholderText(/American Caprices/)).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Logo Bar'))
    expect(screen.getByText('Upload logos')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Footer'))
    expect(screen.getByText('Series name')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Accessibility'))
    expect(screen.getByText('Text on Background')).toBeInTheDocument()
  })

  it('Background section exposes the color swatch and orientation toggle', () => {
    renderPanel()
    expect(screen.getByText('Background color')).toBeInTheDocument()
    expect(screen.getByText('16:9')).toBeInTheDocument()
    expect(screen.getByText('9:16')).toBeInTheDocument()
  })

  it('wraps each field in its own bordered, lighter-shaded card', () => {
    renderPanel()
    fireEvent.click(screen.getByTitle('Content'))
    const labelInput = screen.getByPlaceholderText('TONIGHT')
    const card = labelInput.closest('.bg-zinc-900')
    expect(card).not.toBeNull()
    expect(card?.className).toMatch(/border-zinc-800/)
    expect(card?.className).toMatch(/bg-zinc-900/)
  })

  it('there is no "Apply Changes" button anywhere -- everything applies live', () => {
    renderPanel()
    expect(screen.queryByText(/apply changes/i)).not.toBeInTheDocument()
  })
})
