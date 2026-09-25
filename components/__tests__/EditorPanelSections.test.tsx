import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import EditorPanel, { SectionId } from '@/components/EditorPanel'
import { DEFAULT_SLIDE_DATA } from '@/lib/defaults'
import { SlideData } from '@/lib/types'
import { PALETTE } from '@/lib/palette'

// Covers the tabbed right-panel layout: which tab is showing is a
// controlled prop now (the icon rail that sets it lives outside this
// component, in page.tsx), and the fields are grouped by input type --
// every typed field lives under "text", every uploaded-image field (main
// image slot(s) + logo bar) lives under "image" -- rather than one tab per
// field. This file checks that grouping and that switching the prop swaps
// which fields are actually in the DOM (not just visually hidden).

function renderPanel(activeSection: SectionId, overrides: Partial<SlideData> = {}) {
  const data: SlideData = { ...DEFAULT_SLIDE_DATA, ...overrides }
  const onChange = vi.fn()
  const utils = render(
    <EditorPanel data={data} onChange={onChange} screenType="projector" onScreenTypeChange={vi.fn()} slideRevision={0}
      orientation="landscape" onOrientationChange={vi.fn()}
      activeSection={activeSection} onActiveSectionChange={vi.fn()} />
  )
  return { onChange, ...utils }
}

describe('EditorPanel tabbed sections', () => {
  it('shows only the Background tab\'s fields when activeSection="background"', () => {
    renderPanel('background')
    expect(screen.getByText('Background color')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('TONIGHT')).not.toBeInTheDocument()
    expect(screen.queryByText('Text alignment')).not.toBeInTheDocument()
  })

  it('Background Color shows the full swatch grid inline, with no click-to-open trigger', () => {
    renderPanel('background')
    expect(screen.queryByRole('button', { name: 'Choose color' })).not.toBeInTheDocument()
    for (const { hex } of PALETTE) {
      expect(screen.getByRole('button', { name: hex })).toBeInTheDocument()
    }
  })

  it('the "text" tab groups every typed field together: Label, Title, Subtitle(s), Presenters, Program Title, Series Name, Listening Credit', () => {
    renderPanel('text')
    expect(screen.getByPlaceholderText('TONIGHT')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Event title')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/with/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Optional second line')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Name One/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/American Caprices/)).toBeInTheDocument()
    expect(screen.getByText('Series name')).toBeInTheDocument()
    expect(screen.getByText('Listening credit')).toBeInTheDocument()

    // Nothing from another group leaks in.
    expect(screen.queryByText('Upload logos')).not.toBeInTheDocument()
    expect(screen.queryByText('Text alignment')).not.toBeInTheDocument()
  })

  it('the "image" tab groups every uploaded-image field together: the main image mode selector and the logo bar', () => {
    renderPanel('image')
    expect(screen.getByText('1 image')).toBeInTheDocument() // image mode selector
    expect(screen.getByText('Upload logos')).toBeInTheDocument() // logo bar, merged in

    expect(screen.queryByPlaceholderText('TONIGHT')).not.toBeInTheDocument()
  })

  it('Layout & Preview and Accessibility remain their own tabs', () => {
    renderPanel('layout')
    expect(screen.getByText('Text alignment')).toBeInTheDocument()

    renderPanel('accessibility')
    expect(screen.getByText('Text on Background')).toBeInTheDocument()
  })

  it('Background exposes the color swatch and orientation toggle', () => {
    renderPanel('background')
    expect(screen.getByText('16:9')).toBeInTheDocument()
    expect(screen.getByText('9:16')).toBeInTheDocument()
  })

  it('wraps each field in its own bordered, lighter-shaded card', () => {
    renderPanel('text')
    const labelInput = screen.getByPlaceholderText('TONIGHT')
    const card = labelInput.closest('.bg-zinc-900')
    expect(card).not.toBeNull()
    expect(card?.className).toMatch(/border-zinc-800/)
    expect(card?.className).toMatch(/bg-zinc-900/)
  })

  it('there is no "Apply Changes" button anywhere -- everything applies live', () => {
    renderPanel('background')
    expect(screen.queryByText(/apply changes/i)).not.toBeInTheDocument()
  })
})
