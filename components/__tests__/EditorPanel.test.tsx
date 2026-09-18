import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EditorPanel from '@/components/EditorPanel'
import { DEFAULT_SLIDE_DATA } from '@/lib/defaults'
import { SlideData } from '@/lib/types'

// Covers the new numeric-input pairing on image-related sliders (typing +
// blur/Enter to commit, Up/Down arrow keys to step by 1, clamped to the
// slider's own min/max) -- these are real keyboard interactions that a type
// check alone wouldn't catch if the commit/clamp logic were subtly wrong.

function renderPanel(overrides: Partial<SlideData> = {}) {
  const data: SlideData = { ...DEFAULT_SLIDE_DATA, imageMode: 'two-stagger', ...overrides }
  const onChange = vi.fn()
  // Which tab shows is a controlled prop now (the icon rail that sets it
  // lives in page.tsx, outside this component) -- render straight onto the
  // Image tab rather than clicking a rail button that isn't part of this
  // component anymore.
  render(<EditorPanel data={data} onChange={onChange} screenType="projector" slideRevision={0} orientation="landscape" onOrientationChange={vi.fn()} activeSection="image" onActiveSectionChange={vi.fn()} />)
  return { onChange }
}

// The paired numeric input and its range slider both report the same
// "display value", so a plain getByDisplayValue is ambiguous -- narrow to
// the text input specifically (the range input is type="range").
function numberInputsWithValue(value: string): HTMLInputElement[] {
  return screen.getAllByDisplayValue(value).filter((el): el is HTMLInputElement => (el as HTMLInputElement).type === 'text')
}

describe('EditorPanel image numeric inputs', () => {
  it('typing a value and blurring commits the clamped value ("Overlap")', () => {
    // "Overlap" (default 30, max 60) is used instead of a size field --
    // stagger mode renders identical-default size sliders for every image
    // slot plus the global "Image width" control, so a shared default value
    // like 250 isn't unique enough to select by; Overlap is.
    const { onChange } = renderPanel()
    const [input] = numberInputsWithValue('30')
    fireEvent.change(input, { target: { value: '9999' } })
    fireEvent.blur(input)
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ imageOverlap: 60 })) // clamped to max
  })

  it('ArrowUp/ArrowDown step the value by 1 and clamp at the bounds ("Overlap", 0-60)', () => {
    const { onChange } = renderPanel({ imageOverlap: 60 })
    const [input] = numberInputsWithValue('60')
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    // Already at max (60) -- stepping up must not exceed it.
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ imageOverlap: 59 }))
  })

  it('Enter commits the typed value immediately without needing a separate blur', () => {
    const { onChange } = renderPanel()
    const [input] = numberInputsWithValue('30') // imageOverlap default
    fireEvent.change(input, { target: { value: '45' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ imageOverlap: 45 }))
  })

  it('disables Image 2\'s size input (and mirrors Image 1) while sizes are linked', () => {
    renderPanel({
      imagesLinkedSize: true,
      staggerImages: [
        { id: '1', url: 'data:image/png;base64,AAA', alt: 'Image 1', y: 0, scale: 300, zIndex: 1 },
        { id: '2', url: 'data:image/png;base64,BBB', alt: 'Image 2', y: 0, scale: 300, zIndex: 2 },
      ],
    })
    const inputs = numberInputsWithValue('300')
    expect(inputs).toHaveLength(2)
    // Image 1's input (first) stays enabled; Image 2's (second) is disabled.
    expect(inputs[0]).not.toBeDisabled()
    expect(inputs[1]).toBeDisabled()
  })
})
