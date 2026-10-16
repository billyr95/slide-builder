import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import EditorPanel from '@/components/EditorPanel'
import { DEFAULT_SLIDE_DATA } from '@/lib/defaults'
import { SlideData, Orientation } from '@/lib/types'

// Regression coverage for a real bug: manually set image Size/X/Y values
// were getting silently dropped. Two distinct root causes, both covered
// here:
//
// 1. (Single-image mode) Never actually reproduced in EditorPanel itself --
//    this locks in that re-rendering, toggling orientation, and toggling
//    Flip never fire an unsolicited onChange that could reset a manually
//    set Size/X. If this ever regresses (e.g. a future effect keyed on the
//    wrong dependency), this test catches it immediately.
// 2. (Stagger mode, the actual bug) updateStaggerImage -- the function
//    backing the per-image X/Y/layer sliders -- rebuilt each StaggerImage
//    object from a fixed field list that never included
//    xLandscape/xPortrait/yLandscape/yPortrait/scaleLandscape/
//    scalePortrait (added later, when Size/X became orientation-specific).
//    Its sibling updateStaggerScale (backing the size slider) already
//    preserved them correctly -- updateStaggerImage was the one spot that
//    didn't, so touching Y (or layer, or replacing the photo) silently
//    dropped whatever X had been set. Fixed in components/EditorPanel.tsx.

afterEach(cleanup)

// Per-image X/Y/layer sliders for stagger mode live on the Image tab
// (alongside each slot's own upload/crop UI); the grouped Size/X position
// controls for single-image mode live on the Layout tab -- see
// EditorPanel.tsx's SECTION_* constants.
function renderPanel(data: SlideData, orientation: Orientation = 'landscape', onChange = vi.fn(), activeSection: 'layout' | 'image' = 'layout') {
  const utils = render(
    <EditorPanel
      data={data}
      onChange={onChange}
      screenType="projector"
      onScreenTypeChange={vi.fn()}
      slideRevision={0}
      orientation={orientation}
      onOrientationChange={vi.fn()}
      activeSection={activeSection}
      onActiveSectionChange={vi.fn()}
    />
  )
  return { onChange, ...utils }
}

// The label span's own text is immediately followed by a nested badge span
// ("auto"/"manual"), so its combined textContent is e.g. "Image 1 Yauto" --
// a prefix match (not RTL's default exact match) against the DOM directly
// is simpler here than fighting getByText's text-matching rules over a
// node with mixed text-and-element children.
function numberInputNear(label: string): HTMLInputElement {
  // The label span may also wrap a nested badge span and/or a "reset"
  // button, so its full textContent is e.g. "Sizemanualreset" -- a prefix
  // match. Picks the shortest match (there can be more than one label
  // starting with the same prefix, e.g. "X position" vs. none here, but
  // "Image 1 X" vs. "Image 1 X" alone is exact) so a longer, unrelated
  // label can't shadow it.
  const candidates = Array.from(document.querySelectorAll('span')).filter(el => el.textContent?.startsWith(label))
  const span = candidates.sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0))[0]
  if (!span) throw new Error(`No span found starting with "${label}"`)
  const row = span.closest('.mt-1\\.5')!
  return row.querySelector('input[type="text"]') as HTMLInputElement
}

describe('Image placement controls: manual values are never silently reset', () => {
  it('single-image Size and X survive re-render, an orientation round-trip, and a Flip toggle -- no unsolicited onChange fires', () => {
    const data: SlideData = {
      ...DEFAULT_SLIDE_DATA,
      imageMode: 'single',
      imageUrl: 'data:image/png;base64,AAA',
      imageSizeLandscape: 555,
      imageClusterXLandscape: 222,
    }
    const onChange = vi.fn()
    const { rerender } = renderPanel(data, 'landscape', onChange)

    expect(numberInputNear('Size').value).toBe('555')
    expect(numberInputNear('X position').value).toBe('222')

    const props = (orientation: Orientation, overrides: Partial<SlideData> = {}) => (
      <EditorPanel
        data={{ ...data, ...overrides }}
        onChange={onChange}
        screenType="projector"
        onScreenTypeChange={vi.fn()}
        slideRevision={0}
        orientation={orientation}
        onOrientationChange={vi.fn()}
        activeSection="layout"
        onActiveSectionChange={vi.fn()}
      />
    )

    // Plain re-render with identical data (simulates a parent re-render,
    // or an autosave round-trip re-applying the same saved state).
    rerender(props('landscape'))
    // Orientation round-trip.
    rerender(props('portrait'))
    rerender(props('landscape'))
    // Flip.
    rerender(props('landscape', { imageSide: 'right' }))
    rerender(props('landscape', { imageSide: 'left' }))

    // None of the above should have ever called onChange on their own --
    // only a direct user edit through a control should.
    expect(onChange).not.toHaveBeenCalled()

    // And the landscape values are still exactly what was set.
    expect(numberInputNear('Size').value).toBe('555')
    expect(numberInputNear('X position').value).toBe('222')
  })

  it('stagger mode: setting Image 1\'s Y preserves its already-set X (regression)', () => {
    const data: SlideData = {
      ...DEFAULT_SLIDE_DATA,
      imageMode: 'two-stagger',
      staggerImages: [
        { id: 'a', url: 'data:image/png;base64,AAA', alt: 'Image 1', x: 0, y: 0, scale: 0, xLandscape: 150 },
      ],
    }
    const onChange = vi.fn()
    renderPanel(data, 'landscape', onChange, 'image')

    const yInput = numberInputNear('Image 1 Y')
    fireEvent.change(yInput, { target: { value: '80' } })
    fireEvent.blur(yInput)

    expect(onChange).toHaveBeenCalled()
    const patch = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(patch.staggerImages[0].xLandscape).toBe(150)
    expect(patch.staggerImages[0].yLandscape).toBe(80)
  })

  it('stagger mode: setting Image 1\'s layer (zIndex) preserves its already-set X, Y, and size', () => {
    const data: SlideData = {
      ...DEFAULT_SLIDE_DATA,
      imageMode: 'two-stagger',
      staggerImages: [
        { id: 'a', url: 'data:image/png;base64,AAA', alt: 'Image 1', x: 0, y: 0, scale: 0, xLandscape: 150, yLandscape: 80, scaleLandscape: 300 },
      ],
    }
    const onChange = vi.fn()
    renderPanel(data, 'landscape', onChange, 'image')

    const layerInput = numberInputNear('Image 1 layer')
    fireEvent.change(layerInput, { target: { value: '5' } })
    fireEvent.blur(layerInput)

    expect(onChange).toHaveBeenCalled()
    const patch = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(patch.staggerImages[0].xLandscape).toBe(150)
    expect(patch.staggerImages[0].yLandscape).toBe(80)
    expect(patch.staggerImages[0].scaleLandscape).toBe(300)
    expect(patch.staggerImages[0].zIndex).toBe(5)
  })

  it('stagger mode: a portrait-orientation X value is untouched by a landscape Y edit on the same image', () => {
    const data: SlideData = {
      ...DEFAULT_SLIDE_DATA,
      imageMode: 'two-stagger',
      staggerImages: [
        { id: 'a', url: 'data:image/png;base64,AAA', alt: 'Image 1', x: 0, y: 0, scale: 0, xLandscape: 150, xPortrait: 40, scalePortrait: 220 },
      ],
    }
    const onChange = vi.fn()
    renderPanel(data, 'landscape', onChange, 'image')

    const yInput = numberInputNear('Image 1 Y')
    fireEvent.change(yInput, { target: { value: '80' } })
    fireEvent.blur(yInput)

    const patch = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(patch.staggerImages[0].xLandscape).toBe(150)
    expect(patch.staggerImages[0].yLandscape).toBe(80)
    // The other orientation's own values, never touched by this edit.
    expect(patch.staggerImages[0].xPortrait).toBe(40)
    expect(patch.staggerImages[0].scalePortrait).toBe(220)
  })
})
