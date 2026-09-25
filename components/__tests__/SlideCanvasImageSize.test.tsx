import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import SlideCanvas from '@/components/SlideCanvas'
import { DEFAULT_SLIDE_DATA } from '@/lib/defaults'
import { SlideData, Orientation } from '@/lib/types'

// Regression coverage for two bugs, fixed in sequence:
// 1. imageSize > 100% updated state correctly but the rendered <img> never
//    visibly grew past 100% -- caused by a percentage max-width/max-height
//    clamping the image right back down to its container's own box, and
//    (even after removing that) the browser's default flex-shrink:1 on a
//    flex-row child squeezing it back down to fit the column's fixed
//    width. Both had to go for imageSize to actually work above 100%.
// 2. That whole percentage-of-container relationship was itself the wrong
//    model -- imageSize is now a genuine absolute pixel width (see
//    lib/imageSizing.ts), matching stagger mode's own pixel-based `scale`.
//    A slide saved before that change has no imageSizeIsPixels marker and
//    its stored value is still the old percentage, converted purely at
//    render time against the column width it was ACTUALLY relative to
//    (0.4 * canvas landscape, 0.66 * canvas portrait -- not the raw full
//    canvas width, which would inflate most real slides 2-4x past their
//    current appearance) -- covered below alongside the new pixel-native
//    path.
afterEach(cleanup)

function baseData(overrides: Partial<SlideData> = {}): SlideData {
  return { ...DEFAULT_SLIDE_DATA, imageUrl: 'data:image/png;base64,AAAA', imageAlt: 'test', ...overrides }
}

function imgStyle(orientation: Orientation, data: Partial<SlideData>) {
  render(<SlideCanvas data={baseData(data)} orientation={orientation} />)
  return (screen.getByAltText('test') as HTMLImageElement).style
}

describe('Image size is a genuine pixel width, and actually scales the rendered image past 100px', () => {
  it('landscape: renders at the exact requested pixel width, no percentage max-width/max-height clamp', () => {
    const style = imgStyle('landscape', { imageSize: 300, imageSizeIsPixels: true })
    expect(style.width).toBe('300px')
    expect(style.maxWidth).toBe('')
    expect(style.maxHeight).toBe('')
  })

  it('landscape: flexShrink is disabled so the flex row can\'t silently squeeze it back to fit the column', () => {
    expect(imgStyle('landscape', { imageSize: 300, imageSizeIsPixels: true }).flexShrink).toBe('0')
  })

  it('portrait: same pixel width, no percentage max-width clamp (maxHeight is a deliberate, unrelated half-slide-height cap)', () => {
    const style = imgStyle('portrait', { imageSize: 300, imageSizeIsPixels: true })
    expect(style.width).toBe('300px')
    expect(style.maxWidth).toBe('')
  })

  it('portrait: flexShrink is disabled here too', () => {
    expect(imgStyle('portrait', { imageSize: 300, imageSizeIsPixels: true }).flexShrink).toBe('0')
  })

  it('the width style genuinely reflects whatever imageSize is set to, including values up near the 800px ceiling', () => {
    for (const size of [100, 300, 500, 800]) {
      cleanup()
      expect(imgStyle('landscape', { imageSize: size, imageSizeIsPixels: true }).width).toBe(`${size}px`)
    }
  })
})

describe('Legacy percentage imageSize (no imageSizeIsPixels marker) converts against its ACTUAL column width on read', () => {
  it('landscape: a stored percentage converts against 40% of the 1920px canvas (the single-image column\'s own width)', () => {
    // 50% -> 0.5 * 0.4 * 1920 = 384px. imageSizeIsPixels explicitly false
    // here to simulate a pre-existing slide -- DEFAULT_SLIDE_DATA itself
    // now sets it true (every field created after this change is
    // pixel-native), so a real "legacy" slide has to override that back
    // off to reproduce.
    expect(imgStyle('landscape', { imageSize: 50, imageSizeIsPixels: false }).width).toBe('384px')
  })

  it('portrait: the SAME stored percentage converts against 66% of the 1080px canvas instead', () => {
    // 50% -> 0.5 * 0.66 * 1080 = 356px (rounded) -- same stored value,
    // different orientation, different real column width, so a different
    // converted pixel result.
    expect(imgStyle('portrait', { imageSize: 50, imageSizeIsPixels: false }).width).toBe('356px')
  })

  it('matches real production data: a stored 200% (this app\'s actual max before the pixel-based control) fits within the canvas instead of ballooning past it', () => {
    // 200% -> 2.0 * 0.4 * 1920 = 1536px -- comfortably within the 1920px
    // canvas, vs. 3840px (literally double the canvas) if this were wrongly
    // converted against the full canvas width instead of the column width.
    expect(imgStyle('landscape', { imageSize: 200, imageSizeIsPixels: false }).width).toBe('1536px')
  })

  it('a slide with no imageSize at all falls back to the fixed default pixel width, not a bogus percentage conversion', () => {
    const data = baseData({ imageSize: undefined as unknown as number })
    render(<SlideCanvas data={data} orientation="landscape" />)
    expect((screen.getByAltText('test') as HTMLImageElement).style.width).toBe('768px')
  })
})
