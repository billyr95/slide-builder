import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SlideCanvas from '@/components/SlideCanvas'
import { DEFAULT_SLIDE_DATA } from '@/lib/defaults'
import { DEFAULT_STACK_LINE_HEIGHT, DEFAULT_LISTENING_CREDIT_LINE_HEIGHT } from '@/lib/defaults'
import { SlideData } from '@/lib/types'

// Covers the per-field line-spacing override: undefined means "use the same
// automatic value the app already computed" (no behavior change for an
// untouched field), and a manual value renders as that field's own
// line-height without needing jsdom to resolve computed CSS (checking the
// inline style itself is the reliable, fast signal here -- the actual
// visual/gap-independence claims are verified separately with real
// Chromium renders, matching this app's established testing split).

function baseData(overrides: Partial<SlideData> = {}): SlideData {
  return {
    ...DEFAULT_SLIDE_DATA,
    label: 'TONIGHT', title: 'A Talk', presenters: 'Jane Doe', programTitle: 'Some Work',
    showSeriesName: true, seriesName: 'SERIES', showListeningCredit: true, listeningCredit: 'Credit line',
    ...overrides,
  }
}

describe('SlideCanvas per-field line-height', () => {
  it('defaults every stack field to DEFAULT_STACK_LINE_HEIGHT when unset', () => {
    render(<SlideCanvas data={baseData()} orientation="landscape" />)
    for (const text of ['TONIGHT', 'A Talk', 'Jane Doe', 'Some Work', 'SERIES']) {
      const el = screen.getByText((_, node) => node?.textContent === text)
      expect(el.style.lineHeight).toBe(String(DEFAULT_STACK_LINE_HEIGHT))
    }
  })

  it('defaults Listening Credit to DEFAULT_LISTENING_CREDIT_LINE_HEIGHT, not the stack default', () => {
    render(<SlideCanvas data={baseData()} orientation="landscape" />)
    const el = screen.getByText('Credit line')
    expect(el.style.lineHeight).toBe(String(DEFAULT_LISTENING_CREDIT_LINE_HEIGHT))
  })

  it('a manual override renders that exact value for only that field', () => {
    const data = baseData({ presentersLineHeight: 1.35 })
    render(<SlideCanvas data={data} orientation="landscape" />)
    expect(screen.getByText((_, n) => n?.textContent === 'Jane Doe').style.lineHeight).toBe('1.35')
    // Everything else stays on the shared default.
    expect(screen.getByText((_, n) => n?.textContent === 'A Talk').style.lineHeight).toBe(String(DEFAULT_STACK_LINE_HEIGHT))
    expect(screen.getByText((_, n) => n?.textContent === 'Some Work').style.lineHeight).toBe(String(DEFAULT_STACK_LINE_HEIGHT))
  })

  it('overrides for every field are independent of each other', () => {
    const data = baseData({
      labelLineHeight: 1.0, titleLineHeight: 1.1, subtitleLineHeight: 1.2,
      presentersLineHeight: 1.3, programTitleLineHeight: 1.4, seriesNameLineHeight: 1.5,
      listeningCreditLineHeight: 1.6,
    })
    render(<SlideCanvas data={data} orientation="landscape" />)
    expect(screen.getByText('TONIGHT').style.lineHeight).toBe('1')
    expect(screen.getByText((_, n) => n?.textContent === 'A Talk').style.lineHeight).toBe('1.1')
    expect(screen.getByText((_, n) => n?.textContent === 'Jane Doe').style.lineHeight).toBe('1.3')
    expect(screen.getByText((_, n) => n?.textContent === 'Some Work').style.lineHeight).toBe('1.4')
    expect(screen.getByText('SERIES').style.lineHeight).toBe('1.5')
    expect(screen.getByText('Credit line').style.lineHeight).toBe('1.6')
  })
})
