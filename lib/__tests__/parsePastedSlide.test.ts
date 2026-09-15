import { describe, it, expect } from 'vitest'
import { parsePastedSlide } from '@/lib/parsePastedSlide'

describe('parsePastedSlide', () => {
  it('parses all recognized fields', () => {
    const text = [
      'Label: TONIGHT',
      'Title: An Evening with Jane Doe',
      'Subtitle: in Conversation with',
      'Subtitle2: John Smith',
      'Presenters: Jane Doe; John Smith',
      'Series: Recanati-Kaplan Talks',
    ].join('\n')

    expect(parsePastedSlide(text)).toEqual({
      label: 'TONIGHT',
      title: 'An Evening with Jane Doe',
      subtitle: 'in Conversation with',
      subtitle2: 'John Smith',
      presenters: 'Jane Doe\nJohn Smith',
      seriesName: 'Recanati-Kaplan Talks',
    })
  })

  it('ignores unrecognized lines', () => {
    const text = 'Some random pasted junk\nTitle: Real Title\nAnother stray line'
    expect(parsePastedSlide(text).title).toBe('Real Title')
    expect(parsePastedSlide(text).label).toBe('')
  })

  it('treats unlabeled lines right after Presenters: as one-per-line names', () => {
    const text = 'Title: X\nPresenters:\nJane Doe\nJohn Smith\n& Alex Lee'
    expect(parsePastedSlide(text).presenters).toBe('Jane Doe\nJohn Smith\n& Alex Lee')
  })

  it('stops presenter continuation at a blank line', () => {
    const text = 'Title: X\nPresenters:\nJane Doe\n\nSeries: Ignored because blank line ended presenters? no'
    const parsed = parsePastedSlide(text)
    expect(parsed.presenters).toBe('Jane Doe')
    // Series: still parses fine since it's its own recognized line regardless of the presenters state
    expect(parsed.seriesName).toBe('Ignored because blank line ended presenters? no')
  })

  it('is case-insensitive and tolerates missing fields', () => {
    const text = 'title: Just A Title'
    expect(parsePastedSlide(text)).toEqual({
      label: '',
      title: 'Just A Title',
      subtitle: '',
      subtitle2: '',
      presenters: '',
      seriesName: '',
    })
  })

  it('does not confuse Subtitle2 with Subtitle', () => {
    const text = 'Title: X\nSubtitle2: Second Line Only'
    const parsed = parsePastedSlide(text)
    expect(parsed.subtitle).toBe('')
    expect(parsed.subtitle2).toBe('Second Line Only')
  })

  it('returns all-empty fields for empty input', () => {
    expect(parsePastedSlide('')).toEqual({
      label: '', title: '', subtitle: '', subtitle2: '', presenters: '', seriesName: '',
    })
  })
})
