import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import SlideCanvas from '@/components/SlideCanvas'
import { DEFAULT_SLIDE_DATA, DEFAULT_STACK_LINE_HEIGHT, DEFAULT_LISTENING_CREDIT_LINE_HEIGHT } from '@/lib/defaults'
import { SlideData } from '@/lib/types'

// This file renders several times with overlapping text content ("A Talk",
// "Credit line", etc.) across separate `it()` blocks -- explicit cleanup
// between tests (rather than relying on manual unmount() calls, which is
// easy to forget on any new test added here later) keeps those renders
// from colliding.
afterEach(cleanup)

// Covers the per-field Margin Top override -- the gap ABOVE a block,
// relative to whichever block currently precedes it in blockOrder. This
// replaced an earlier "line spacing" (internal line-height) control that
// was solving the wrong property; this file specifically re-verifies the
// two properties are fully decoupled, including for Title (which
// previously leaked into the shared inter-block gap once already this
// session).

function baseData(overrides: Partial<SlideData> = {}): SlideData {
  return {
    ...DEFAULT_SLIDE_DATA,
    label: 'TONIGHT', title: 'A Talk', presenters: 'Jane Doe', programTitle: 'Some Work',
    showSeriesName: true, seriesName: 'SERIES', showListeningCredit: true, listeningCredit: 'Credit line',
    ...overrides,
  }
}

// Matches only the leaf element carrying the text, not an ancestor wrapper
// whose textContent happens to equal the same string because this is its
// only child (e.g. Listening Credit's absolute-positioned wrapper div) --
// without the childElementCount check, getByText finds both and throws.
function styleOf(text: string) {
  return screen.getByText((_, n) => n?.textContent === text && n?.childElementCount === 0).style
}

describe('SlideCanvas: internal line-height stays fixed for stack fields', () => {
  it('every stack field always renders at DEFAULT_STACK_LINE_HEIGHT -- no longer user-overridable', () => {
    const { unmount } = render(<SlideCanvas data={baseData()} orientation="landscape" />)
    for (const text of ['TONIGHT', 'A Talk', 'Jane Doe', 'Some Work', 'SERIES']) {
      expect(styleOf(text).lineHeight).toBe(String(DEFAULT_STACK_LINE_HEIGHT))
    }
    unmount()
  })

  it('Listening Credit keeps its own separate, still-overridable internal line-height', () => {
    const { unmount } = render(<SlideCanvas data={baseData()} orientation="landscape" />)
    expect(styleOf('Credit line').lineHeight).toBe(String(DEFAULT_LISTENING_CREDIT_LINE_HEIGHT))
    unmount()

    render(<SlideCanvas data={baseData({ listeningCreditLineHeight: 1.6 })} orientation="landscape" />)
    expect(styleOf('Credit line').lineHeight).toBe('1.6')
  })
})

describe('SlideCanvas: Margin Top controls the gap above a block, and ONLY that', () => {
  it('defaults every field\'s margin-top to the automatic uniform-gap value when unset', () => {
    const data = baseData()
    const { unmount } = render(<SlideCanvas data={data} orientation="landscape" />)
    const titleTop = styleOf('A Talk').marginTop
    const presentersTop = styleOf('Jane Doe').marginTop
    // Both non-zero and (for two same-role transitions with no accent
    // exception in play) equal -- the uniform system, not a per-pair magic
    // number.
    expect(titleTop).not.toBe('0px')
    expect(titleTop).toBe(presentersTop)
    unmount()
  })

  it('a manual margin-top override on Title changes ONLY the gap above Title -- not its own internal spacing, not the gap below it', () => {
    const withoutOverride = baseData()
    const { unmount: u1 } = render(<SlideCanvas data={withoutOverride} orientation="landscape" />)
    const baselineTitleTop = styleOf('A Talk').marginTop
    const baselinePresentersTop = styleOf('Jane Doe').marginTop
    u1()

    const { unmount: u2 } = render(<SlideCanvas data={baseData({ titleMarginTop: 200 })} orientation="landscape" />)
    expect(styleOf('A Talk').marginTop).toBe('200px')
    // The gap AFTER Title (i.e. Presenters' own margin-top, since Presenters
    // directly follows Title here) is completely unaffected.
    expect(styleOf('Jane Doe').marginTop).toBe(baselinePresentersTop)
    expect(styleOf('Jane Doe').marginTop).toBe(baselinePresentersTop === baselineTitleTop ? baselineTitleTop : baselinePresentersTop)
    // Title's own internal line-height is unaffected too.
    expect(styleOf('A Talk').lineHeight).toBe(String(DEFAULT_STACK_LINE_HEIGHT))
    u2()
  })

  it('overriding Presenters\' margin-top does not change Title\'s gap or Program Title\'s gap', () => {
    const withoutOverride = baseData()
    const { unmount: u1 } = render(<SlideCanvas data={withoutOverride} orientation="landscape" />)
    const baselineTitleTop = styleOf('A Talk').marginTop
    const baselineProgramTop = styleOf('Some Work').marginTop
    u1()

    const { unmount: u2 } = render(<SlideCanvas data={baseData({ presentersMarginTop: 5 })} orientation="landscape" />)
    expect(styleOf('Jane Doe').marginTop).toBe('5px')
    expect(styleOf('A Talk').marginTop).toBe(baselineTitleTop)
    expect(styleOf('Some Work').marginTop).toBe(baselineProgramTop)
    u2()
  })

  it('margin-top follows a field when blockOrder is reordered (evaluated from CURRENT position, not a hardcoded pair)', () => {
    // Program Title moved to directly follow Title, before Presenters.
    const reordered = baseData({ blockOrder: ['label', 'title', 'programTitle', 'presenters', 'subtitle', 'subtitle2', 'seriesName'] })
    render(<SlideCanvas data={reordered} orientation="landscape" />)
    // Program Title (now right after Title) and Presenters (now right
    // after Program Title) both get the same uniform automatic gap --
    // nothing hardcoded to "Presenters always follows Title".
    expect(styleOf('Some Work').marginTop).toBe(styleOf('Jane Doe').marginTop)
    expect(styleOf('Some Work').marginTop).not.toBe('0px')
  })

  it('the first visible block gets no automatic margin-top (nothing renders above it)', () => {
    const data = baseData()
    render(<SlideCanvas data={data} orientation="landscape" />)
    expect(styleOf('TONIGHT').marginTop).toBe('')
  })
})
