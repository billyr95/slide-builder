import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import SlideCanvas from '@/components/SlideCanvas'
import { DEFAULT_SLIDE_DATA } from '@/lib/defaults'
import { SlideData, Orientation } from '@/lib/types'

// Regression coverage for a bug where imageSize > 100% updated state
// correctly but the rendered <img> never visibly grew past 100% -- caused
// by two separate CSS issues stacked on top of each other: a percentage
// max-width/max-height clamping the image right back down to its
// container's own box, and (even after removing that) the browser's
// default flex-shrink:1 on a flex-row child squeezing it back down to fit
// the column's fixed width. Both had to go for imageSize to actually work
// above 100%.
afterEach(cleanup)

function baseData(overrides: Partial<SlideData> = {}): SlideData {
  return { ...DEFAULT_SLIDE_DATA, imageUrl: 'data:image/png;base64,AAAA', imageAlt: 'test', ...overrides }
}

function imgStyle(orientation: Orientation, imageSize: number) {
  render(<SlideCanvas data={baseData({ imageSize })} orientation={orientation} />)
  return (screen.getByAltText('test') as HTMLImageElement).style
}

describe('Image size slider actually scales the rendered image past 100%', () => {
  it('landscape: no percentage max-width/max-height clamp the width back down', () => {
    const style = imgStyle('landscape', 150)
    expect(style.width).toBe('150%')
    expect(style.maxWidth).toBe('')
    expect(style.maxHeight).toBe('')
  })

  it('landscape: flexShrink is disabled so the flex row can\'t silently squeeze it back to fit the column', () => {
    expect(imgStyle('landscape', 150).flexShrink).toBe('0')
  })

  it('portrait: no percentage max-width clamp either (maxHeight is a deliberate, unrelated half-slide-height cap, not a percentage)', () => {
    const style = imgStyle('portrait', 150)
    expect(style.width).toBe('150%')
    expect(style.maxWidth).toBe('')
  })

  it('portrait: flexShrink is disabled here too', () => {
    expect(imgStyle('portrait', 150).flexShrink).toBe('0')
  })

  it('the width style genuinely reflects whatever imageSize is set to, including values up to 200', () => {
    for (const size of [100, 116, 150, 200]) {
      cleanup()
      expect(imgStyle('landscape', size).width).toBe(`${size}%`)
    }
  })
})
