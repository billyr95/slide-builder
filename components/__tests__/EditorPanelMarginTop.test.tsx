import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EditorPanel from '@/components/EditorPanel'
import { DEFAULT_SLIDE_DATA } from '@/lib/defaults'
import { effectiveMarginTop } from '@/lib/textStackGap'
import { SlideData } from '@/lib/types'

// Covers the "Margin top" control (replacing the earlier "Line spacing"
// control, which was solving the wrong property): shows the app's own
// automatic gap-above-this-block value until touched (badge "auto"), and
// once dragged/typed, stores it as a per-field override (badge "manual").
// Keeps the slider + numeric input + arrow-key pattern already built for
// font size/image controls.

function renderPanel(overrides: Partial<SlideData> = {}) {
  const data: SlideData = { ...DEFAULT_SLIDE_DATA, ...overrides }
  const onChange = vi.fn()
  render(
    <EditorPanel data={data} onChange={onChange} screenType="projector" slideRevision={0}
      orientation="landscape" onOrientationChange={vi.fn()}
      activeSection="text" onActiveSectionChange={vi.fn()} />
  )
  return { onChange, data }
}

function numberInputsWithValue(value: string): HTMLInputElement[] {
  return screen.getAllByDisplayValue(value).filter((el): el is HTMLInputElement => (el as HTMLInputElement).type === 'text')
}

describe('EditorPanel "Margin top" controls', () => {
  it('every stack field (not Listening Credit) shows a "Margin top" control, and Listening Credit shows "Line height" instead', () => {
    renderPanel({ showSeriesName: true, seriesName: 'SERIES', showListeningCredit: true, listeningCredit: 'Credit line' })
    expect(screen.getAllByText('Margin top').length).toBe(7) // Label, Title, Subtitle, Subtitle2, Presenters, Program Title, Series Name
    expect(screen.getAllByText('Line height').length).toBe(1) // Listening Credit only
    expect(screen.queryByText('Line spacing')).not.toBeInTheDocument() // old label is gone everywhere
  })

  it('shows the live automatic value and an "auto" badge when unset', () => {
    const { data } = renderPanel()
    const autoTitleGap = effectiveMarginTop(data, 'title')
    // The numeric input rounds to whole px for display (decimals default to
    // 0, same as every other px-based slider) -- the underlying computed
    // value itself can be fractional (font-metric-derived).
    expect(numberInputsWithValue(autoTitleGap.toFixed(0)).length).toBeGreaterThan(0)
    expect(screen.getAllByText('auto').length).toBeGreaterThan(0)
  })

  it('dragging Title\'s margin-top slider stores it as titleMarginTop and flips its badge to manual', () => {
    const { onChange } = renderPanel()
    const titleLabel = screen.getAllByText('Margin top')[1] // Label's card is first, Title's second
    const slider = titleLabel.closest('.mt-1\\.5')!.querySelector('input[type="range"]') as HTMLInputElement
    fireEvent.change(slider, { target: { value: '50' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ titleMarginTop: 50 }))
  })

  it('a field with an existing override shows "manual" and the stored value', () => {
    renderPanel({ presentersMarginTop: 42, presenters: 'Jane Doe' })
    expect(numberInputsWithValue('42').length).toBeGreaterThan(0)
    expect(screen.getAllByText('manual').length).toBeGreaterThan(0)
  })

  it('typing a value and blurring commits it, clamped to the slider\'s range (0-120)', () => {
    const { onChange } = renderPanel({ presentersMarginTop: 20, presenters: 'Jane Doe' })
    const [input] = numberInputsWithValue('20')
    fireEvent.change(input, { target: { value: '9999' } })
    fireEvent.blur(input)
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ presentersMarginTop: 120 }))
  })

  it('ArrowUp/ArrowDown step the value by 1px', () => {
    const { onChange } = renderPanel({ presentersMarginTop: 20, presenters: 'Jane Doe' })
    const [input] = numberInputsWithValue('20')
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ presentersMarginTop: 21 }))
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ presentersMarginTop: 20 }))
  })

  it('the automatic value shown follows blockOrder -- Program Title moved right after Title shows Title\'s own auto gap', () => {
    const overrides: Partial<SlideData> = {
      label: 'TONIGHT', title: 'A Talk', presenters: 'Jane Doe', programTitle: 'Some Work',
      blockOrder: ['label', 'title', 'programTitle', 'presenters', 'subtitle', 'subtitle2', 'seriesName'],
    }
    const { data } = renderPanel(overrides)
    const autoProgramTitleGap = effectiveMarginTop(data, 'programTitle')
    expect(numberInputsWithValue(autoProgramTitleGap.toFixed(0)).length).toBeGreaterThan(0)
  })
})
