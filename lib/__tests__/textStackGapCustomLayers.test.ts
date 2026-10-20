import { describe, it, expect } from 'vitest'
import { resolveBlockOrder, isBlockPopulated, visibleBlockOrder, effectiveMarginTop, computeStackGap } from '../textStackGap'
import { DEFAULT_SLIDE_DATA } from '../defaults'
import { SlideData, CustomTextLayer } from '../types'

// Custom text layers join the same blockOrder/gap system as the six fixed
// text fields (see SlideData.blockOrder and CustomTextLayer's comments) --
// these tests cover the behavior specific to that join: a fresh layer
// lands at the end of the stack, an empty one doesn't render/reorder, its
// own marginTop (not a fixed SlideData key) drives its manual override, and
// it shares the same uniform stack-gap formula as everything else.

function makeLayer(overrides: Partial<CustomTextLayer> = {}): CustomTextLayer {
  return { id: 'layer-1', text: 'Custom text', font: 'Theinhardt', weight: 'regular', italic: false, size: 48, ...overrides }
}

describe('textStackGap -- custom text layers', () => {
  it('resolveBlockOrder appends a layer id not yet in blockOrder, after the fixed fields', () => {
    const data: SlideData = { ...DEFAULT_SLIDE_DATA, customTextLayers: [makeLayer()] }
    const order = resolveBlockOrder(data)
    expect(order[order.length - 1]).toBe('layer-1')
    expect(order.slice(0, 6)).toEqual(['label', 'title', 'subtitle', 'subtitle2', 'presenters', 'programTitle'])
  })

  it('resolveBlockOrder keeps a layer id at its stored position once blockOrder includes it', () => {
    const data: SlideData = {
      ...DEFAULT_SLIDE_DATA,
      customTextLayers: [makeLayer()],
      blockOrder: ['label', 'layer-1', 'title', 'subtitle', 'subtitle2', 'presenters', 'programTitle'],
    }
    const order = resolveBlockOrder(data)
    expect(order).toEqual(['label', 'layer-1', 'title', 'subtitle', 'subtitle2', 'presenters', 'programTitle'])
  })

  it('isBlockPopulated: a layer with text is populated, an empty/whitespace-only one is not', () => {
    const withText: SlideData = { ...DEFAULT_SLIDE_DATA, customTextLayers: [makeLayer({ text: 'hello' })] }
    const empty: SlideData = { ...DEFAULT_SLIDE_DATA, customTextLayers: [makeLayer({ text: '   ' })] }
    expect(isBlockPopulated(withText, 'layer-1')).toBe(true)
    expect(isBlockPopulated(empty, 'layer-1')).toBe(false)
  })

  it('visibleBlockOrder excludes an empty layer entirely, same as an empty fixed field', () => {
    const data: SlideData = {
      ...DEFAULT_SLIDE_DATA,
      subtitle2: '',
      customTextLayers: [makeLayer({ text: '' })],
    }
    expect(visibleBlockOrder(data)).not.toContain('layer-1')
    expect(visibleBlockOrder(data)).not.toContain('subtitle2')
  })

  it('effectiveMarginTop uses the layer\'s own marginTop override, not a fixed SlideData key', () => {
    const data: SlideData = {
      ...DEFAULT_SLIDE_DATA,
      customTextLayers: [makeLayer({ marginTop: 123 })],
      blockOrder: [...(DEFAULT_SLIDE_DATA.blockOrder ?? []), 'layer-1'],
    }
    expect(effectiveMarginTop(data, 'layer-1')).toBe(123)
  })

  it('effectiveMarginTop falls back to the same uniform stack gap as every other block when unset', () => {
    const data: SlideData = {
      ...DEFAULT_SLIDE_DATA,
      customTextLayers: [makeLayer()],
      blockOrder: [...(DEFAULT_SLIDE_DATA.blockOrder ?? []), 'layer-1'],
    }
    expect(effectiveMarginTop(data, 'layer-1')).toBe(computeStackGap(data))
  })

  it('a deleted layer (removed from customTextLayers but still in a stale blockOrder) is dropped by resolveBlockOrder', () => {
    const data: SlideData = {
      ...DEFAULT_SLIDE_DATA,
      customTextLayers: [],
      blockOrder: [...(DEFAULT_SLIDE_DATA.blockOrder ?? []), 'layer-1'],
    }
    expect(resolveBlockOrder(data)).not.toContain('layer-1')
  })
})
