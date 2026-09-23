import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EditorPanel from '@/components/EditorPanel'
import { DEFAULT_SLIDE_DATA, DEFAULT_STACK_LINE_HEIGHT } from '@/lib/defaults'
import { SlideData } from '@/lib/types'

// Covers the "Line spacing" control added to every text field: it shows
// the app's own automatic default until touched (badge "auto"), and once
// dragged, stores that as a per-field override (badge "manual") -- same
// pattern already used for font size.

function renderPanel(overrides: Partial<SlideData> = {}) {
  const data: SlideData = { ...DEFAULT_SLIDE_DATA, ...overrides }
  const onChange = vi.fn()
  render(
    <EditorPanel data={data} onChange={onChange} screenType="projector" slideRevision={0}
      orientation="landscape" onOrientationChange={vi.fn()}
      activeSection="text" onActiveSectionChange={vi.fn()} />
  )
  return { onChange }
}

describe('EditorPanel line-spacing controls', () => {
  it('shows the shared automatic default and an "auto" badge when unset', () => {
    renderPanel()
    const sliders = screen.getAllByText('Line spacing')
    expect(sliders.length).toBeGreaterThan(0)
    // At least Title's own line-spacing readout should show the shared default.
    expect(screen.getAllByText(DEFAULT_STACK_LINE_HEIGHT.toFixed(2)).length).toBeGreaterThan(0)
    expect(screen.getAllByText('auto').length).toBeGreaterThan(0)
  })

  it('dragging Title\'s line-spacing slider stores it as titleLineHeight and flips its badge to manual', () => {
    const { onChange } = renderPanel()
    const titleLineSpacingLabel = screen.getAllByText('Line spacing')[1] // Label's card is first, Title's second
    const slider = titleLineSpacingLabel.closest('.mt-1\\.5')!.querySelector('input[type="range"]') as HTMLInputElement
    fireEvent.change(slider, { target: { value: '1.10' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ titleLineHeight: 1.1 }))
  })

  it('a field with an existing override shows "manual" and the stored value, not the default', () => {
    renderPanel({ presentersLineHeight: 1.42, presenters: 'Jane Doe' })
    expect(screen.getAllByText('1.42').length).toBeGreaterThan(0)
    expect(screen.getAllByText('manual').length).toBeGreaterThan(0)
  })
})
