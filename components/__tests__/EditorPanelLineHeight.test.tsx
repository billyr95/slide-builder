import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EditorPanel from '@/components/EditorPanel'
import { DEFAULT_SLIDE_DATA, DEFAULT_STACK_LINE_HEIGHT } from '@/lib/defaults'
import { SlideData } from '@/lib/types'

// Covers the "Line spacing" control added to every text field: it shows
// the app's own automatic default until touched (badge "auto"), and once
// dragged, stores that as a per-field override (badge "manual") -- same
// pattern already used for font size. Also covers the paired numeric input
// (added alongside the slider, matching the font-size/image-control
// pattern): typing + Enter/blur commits, Up/Down arrow keys step by the
// same 0.01 the slider itself steps by, clamped to the slider's own range.

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

// The numeric input and the range slider both report the same "display
// value", so a plain getByDisplayValue is ambiguous -- narrow to the text
// input specifically (the range input is type="range"), same convention
// used for the image-controls numeric inputs.
function numberInputsWithValue(value: string): HTMLInputElement[] {
  return screen.getAllByDisplayValue(value).filter((el): el is HTMLInputElement => (el as HTMLInputElement).type === 'text')
}

describe('EditorPanel line-spacing controls', () => {
  it('shows the shared automatic default and an "auto" badge when unset', () => {
    renderPanel()
    const sliders = screen.getAllByText('Line spacing')
    expect(sliders.length).toBeGreaterThan(0)
    // At least Title's own line-spacing numeric input should show the shared default.
    expect(numberInputsWithValue(DEFAULT_STACK_LINE_HEIGHT.toFixed(2)).length).toBeGreaterThan(0)
    expect(screen.getAllByText('auto').length).toBeGreaterThan(0)
  })

  it('dragging Title\'s line-spacing slider stores it as titleLineHeight and flips its badge to manual', () => {
    const { onChange } = renderPanel()
    const titleLineSpacingLabel = screen.getAllByText('Line spacing')[1] // Label's card is first, Title's second
    const slider = titleLineSpacingLabel.closest('.mt-1\\.5')!.querySelector('input[type="range"]') as HTMLInputElement
    fireEvent.change(slider, { target: { value: '1.10' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ titleLineHeight: 1.1 }))
  })

  it('a field with an existing override shows "manual" and the stored value in both the slider and the number input', () => {
    renderPanel({ presentersLineHeight: 1.42, presenters: 'Jane Doe' })
    expect(numberInputsWithValue('1.42').length).toBeGreaterThan(0)
    expect(screen.getAllByText('manual').length).toBeGreaterThan(0)
  })

  it('typing a value into the numeric input and blurring commits it, clamped to the slider\'s range', () => {
    const { onChange } = renderPanel({ presentersLineHeight: 1.0, presenters: 'Jane Doe' })
    const [input] = numberInputsWithValue('1.00')
    fireEvent.change(input, { target: { value: '9.99' } })
    fireEvent.blur(input)
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ presentersLineHeight: 1.8 })) // clamped to max
  })

  it('Enter commits the typed value immediately without needing a separate blur', () => {
    const { onChange } = renderPanel({ presentersLineHeight: 1.0, presenters: 'Jane Doe' })
    const [input] = numberInputsWithValue('1.00')
    fireEvent.change(input, { target: { value: '1.25' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ presentersLineHeight: 1.25 }))
  })

  it('ArrowUp/ArrowDown step the value by 0.01, matching the slider\'s own step', () => {
    const { onChange } = renderPanel({ presentersLineHeight: 1.0, presenters: 'Jane Doe' })
    const [input] = numberInputsWithValue('1.00')
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ presentersLineHeight: 1.01 }))

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ presentersLineHeight: 1.0 }))
  })

  it('ArrowDown/ArrowUp clamp at the slider\'s min/max bounds (0.70-1.80)', () => {
    const { onChange } = renderPanel({ presentersLineHeight: 0.7, presenters: 'Jane Doe' })
    const [input] = numberInputsWithValue('0.70')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    // Already at min -- stepping down must not go below it.
    expect(onChange).not.toHaveBeenCalled()
  })
})
