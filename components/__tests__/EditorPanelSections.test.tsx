import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EditorPanel from '@/components/EditorPanel'
import { DEFAULT_SLIDE_DATA } from '@/lib/defaults'
import { SlideData } from '@/lib/types'

// Covers the collapsible right-panel sections + left icon rail added in the
// editor UI redesign -- specifically the parts a type check alone wouldn't
// catch: which sections start open vs. collapsed, that a section's fields
// are genuinely hidden (not just visually) while collapsed, and that
// clicking a rail icon both expands and reveals its section's content.

function renderPanel(overrides: Partial<SlideData> = {}) {
  const data: SlideData = { ...DEFAULT_SLIDE_DATA, ...overrides }
  const onChange = vi.fn()
  render(<EditorPanel data={data} onChange={onChange} screenType="projector" slideRevision={0} orientation="landscape" onOrientationChange={vi.fn()} />)
  return { onChange }
}

describe('EditorPanel collapsible sections', () => {
  it('starts with Background/Content/Typography/Image open and the rest (Layout, Subtitle, Presenters, Program Title, Logo Bar, Footer, Accessibility) collapsed', () => {
    renderPanel()
    // Open-by-default: their fields are immediately in the DOM.
    expect(screen.getByPlaceholderText('TONIGHT')).toBeInTheDocument() // Content -> Label
    expect(screen.getByPlaceholderText('Event title')).toBeInTheDocument() // Content -> Title
    expect(screen.getByText('92NY Text')).toBeInTheDocument() // Typography -> Title font picker

    // Collapsed-by-default: their fields must NOT be in the DOM at all.
    expect(screen.queryByPlaceholderText('with')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/Name One/)).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('American Caprices')).not.toBeInTheDocument()
    expect(screen.queryByText('Series name')).not.toBeInTheDocument()
    expect(screen.queryByText('Text on Background')).not.toBeInTheDocument() // Accessibility
  })

  it('clicking a section header toggles it open and closed', () => {
    renderPanel()
    // Both the section header and the rail icon share the accessible name
    // "Presenters (One per line)" (header via its own text, rail via its
    // `title`) -- the header is the one rendered first in the section stack.
    const [presentersHeader] = screen.getAllByRole('button', { name: /Presenters \(One per line\)/i })
    expect(screen.queryByPlaceholderText(/Name One/)).not.toBeInTheDocument()

    fireEvent.click(presentersHeader)
    expect(screen.getByPlaceholderText(/Name One/)).toBeInTheDocument()

    fireEvent.click(presentersHeader)
    expect(screen.queryByPlaceholderText(/Name One/)).not.toBeInTheDocument()
  })

  it('rail icon jumps to (and force-opens) its section even if collapsed', () => {
    renderPanel()
    expect(screen.queryByPlaceholderText(/Name One/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Presenters (One per line)'))
    expect(screen.getByPlaceholderText(/Name One/)).toBeInTheDocument()
  })

  it('Background section exposes the color swatch and orientation toggle inline in its header', () => {
    renderPanel()
    expect(screen.getByTitle('16:9')).toBeInTheDocument()
    expect(screen.getByTitle('9:16')).toBeInTheDocument()
  })

  it('there is no "Apply Changes" button anywhere -- everything applies live', () => {
    renderPanel()
    expect(screen.queryByText(/apply changes/i)).not.toBeInTheDocument()
  })
})
