import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import EditorPanel from '@/components/EditorPanel'
import { DEFAULT_SLIDE_DATA } from '@/lib/defaults'
import { SlideData } from '@/lib/types'

// Covers the custom-text-layer add/edit/delete wiring in EditorPanel.tsx --
// the real jsdom render exercises the generic blockOrder/resolveBlockOrder
// machinery (lib/textStackGap.ts, covered on its own in
// lib/__tests__/textStackGapCustomLayers.test.ts) through the actual UI
// instead of calling those functions directly.

afterEach(cleanup)

function renderPanel(data: SlideData, onChange = vi.fn()) {
  const utils = render(
    <EditorPanel
      data={data}
      onChange={onChange}
      screenType="projector"
      onScreenTypeChange={vi.fn()}
      slideRevision={0}
      orientation="landscape"
      onOrientationChange={vi.fn()}
      activeSection="text"
      onActiveSectionChange={vi.fn()}
    />
  )
  return { onChange, ...utils }
}

describe('EditorPanel custom text layers', () => {
  it('"+ Add text layer" appends a new empty layer and its id to the end of blockOrder', () => {
    const data: SlideData = { ...DEFAULT_SLIDE_DATA }
    const onChange = vi.fn()
    renderPanel(data, onChange)

    fireEvent.click(screen.getByText('+ Add text layer'))

    expect(onChange).toHaveBeenCalledTimes(1)
    const patch = onChange.mock.calls[0][0]
    expect(patch.customTextLayers).toHaveLength(1)
    const layer = patch.customTextLayers[0]
    expect(layer.text).toBe('')
    expect(layer.font).toBe('Theinhardt')
    expect(layer.weight).toBe('regular')
    expect(patch.blockOrder[patch.blockOrder.length - 1]).toBe(layer.id)
  })

  it('is capped at 10 layers -- the add button disables and stops adding past the cap', () => {
    const layers = Array.from({ length: 10 }, (_, i) => ({
      id: `layer-${i}`, text: `Layer ${i}`, font: 'Theinhardt' as const, weight: 'regular' as const, italic: false, size: 48,
    }))
    const data: SlideData = { ...DEFAULT_SLIDE_DATA, customTextLayers: layers, blockOrder: [...(DEFAULT_SLIDE_DATA.blockOrder ?? []), ...layers.map(l => l.id)] }
    const onChange = vi.fn()
    renderPanel(data, onChange)

    const addButton = screen.getByText('Maximum 10 text layers') as HTMLButtonElement
    expect(addButton.disabled).toBe(true)
    fireEvent.click(addButton)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('editing a layer\'s text updates only that layer, leaving others and blockOrder untouched', () => {
    const layers = [
      { id: 'a', text: 'First', font: 'Theinhardt' as const, weight: 'regular' as const, italic: false, size: 48 },
      { id: 'b', text: 'Second', font: 'Theinhardt' as const, weight: 'regular' as const, italic: false, size: 48 },
    ]
    const data: SlideData = { ...DEFAULT_SLIDE_DATA, customTextLayers: layers, blockOrder: [...(DEFAULT_SLIDE_DATA.blockOrder ?? []), 'a', 'b'] }
    const onChange = vi.fn()
    renderPanel(data, onChange)

    const textareas = screen.getAllByPlaceholderText('Custom text')
    fireEvent.change(textareas[1], { target: { value: 'Second edited' } })

    const patch = onChange.mock.calls[0][0]
    expect(patch.customTextLayers[0].text).toBe('First')
    expect(patch.customTextLayers[1].text).toBe('Second edited')
    expect(patch.blockOrder).toEqual(data.blockOrder)
  })

  it('switching a layer to 92NY Text resets a non-regular weight to regular (same rule as Presenters/Program Title)', () => {
    const layers = [{ id: 'a', text: 'Hi', font: 'Theinhardt' as const, weight: 'bold' as const, italic: false, size: 48 }]
    const data: SlideData = { ...DEFAULT_SLIDE_DATA, customTextLayers: layers, blockOrder: [...(DEFAULT_SLIDE_DATA.blockOrder ?? []), 'a'] }
    const onChange = vi.fn()
    renderPanel(data, onChange)

    const ny92Buttons = screen.getAllByText('92NY Text')
    fireEvent.click(ny92Buttons[ny92Buttons.length - 1])

    const patch = onChange.mock.calls[0][0]
    expect(patch.customTextLayers[0].font).toBe('92NY Text')
    expect(patch.customTextLayers[0].weight).toBe('regular')
  })

  it('deleting a layer (after confirming) removes it from customTextLayers and blockOrder together', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const layers = [{ id: 'a', text: 'Hi', font: 'Theinhardt' as const, weight: 'regular' as const, italic: false, size: 48 }]
    const data: SlideData = { ...DEFAULT_SLIDE_DATA, customTextLayers: layers, blockOrder: [...(DEFAULT_SLIDE_DATA.blockOrder ?? []), 'a'] }
    const onChange = vi.fn()
    renderPanel(data, onChange)

    fireEvent.click(screen.getByText('Delete'))

    const patch = onChange.mock.calls[0][0]
    expect(patch.customTextLayers).toEqual([])
    expect(patch.blockOrder).not.toContain('a')
    vi.restoreAllMocks()
  })

  it('declining the delete confirmation leaves the layer untouched', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const layers = [{ id: 'a', text: 'Hi', font: 'Theinhardt' as const, weight: 'regular' as const, italic: false, size: 48 }]
    const data: SlideData = { ...DEFAULT_SLIDE_DATA, customTextLayers: layers, blockOrder: [...(DEFAULT_SLIDE_DATA.blockOrder ?? []), 'a'] }
    const onChange = vi.fn()
    renderPanel(data, onChange)

    fireEvent.click(screen.getByText('Delete'))

    expect(onChange).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})
