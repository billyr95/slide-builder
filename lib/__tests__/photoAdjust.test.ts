import { describe, it, expect } from 'vitest'
import { processPhotoAdjustments, hasNonDefaultAdjustments, DEFAULT_PHOTO_ADJUSTMENTS, PhotoAdjustments, applyPhotoAdjustmentsInDom } from '../photoAdjust'

function pixelArray(...pixels: [number, number, number, number][]): Uint8ClampedArray {
  const d = new Uint8ClampedArray(pixels.length * 4)
  pixels.forEach(([r, g, b, a], i) => {
    d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = a
  })
  return d
}

describe('hasNonDefaultAdjustments', () => {
  it('is false for undefined and for the exact default object', () => {
    expect(hasNonDefaultAdjustments(undefined)).toBe(false)
    expect(hasNonDefaultAdjustments({ ...DEFAULT_PHOTO_ADJUSTMENTS })).toBe(false)
  })

  it('is true when any single field differs from default', () => {
    expect(hasNonDefaultAdjustments({ ...DEFAULT_PHOTO_ADJUSTMENTS, contrast: 1 })).toBe(true)
    expect(hasNonDefaultAdjustments({ ...DEFAULT_PHOTO_ADJUSTMENTS, saturation: -1 })).toBe(true)
    expect(hasNonDefaultAdjustments({ ...DEFAULT_PHOTO_ADJUSTMENTS, shadows: 1 })).toBe(true)
    expect(hasNonDefaultAdjustments({ ...DEFAULT_PHOTO_ADJUSTMENTS, blackPoint: 1 })).toBe(true)
    expect(hasNonDefaultAdjustments({ ...DEFAULT_PHOTO_ADJUSTMENTS, whitePoint: 254 })).toBe(true)
    expect(hasNonDefaultAdjustments({ ...DEFAULT_PHOTO_ADJUSTMENTS, blackAndWhite: true })).toBe(true)
  })
})

describe('processPhotoAdjustments -- pixel math', () => {
  it('is a no-op at default settings', () => {
    const d = pixelArray([10, 100, 200, 255], [255, 0, 128, 255])
    const before = Uint8ClampedArray.from(d)
    processPhotoAdjustments(d, { ...DEFAULT_PHOTO_ADJUSTMENTS })
    expect(Array.from(d)).toEqual(Array.from(before))
  })

  it('black/white point remap stretches the input range to full output range', () => {
    // blackPoint=50, whitePoint=200 -- a pixel AT blackPoint should map to
    // (near) 0, a pixel AT whitePoint should map to (near) 255.
    const d = pixelArray([50, 50, 50, 255], [200, 200, 200, 255])
    processPhotoAdjustments(d, { ...DEFAULT_PHOTO_ADJUSTMENTS, blackPoint: 50, whitePoint: 200 })
    expect(d[0]).toBeLessThanOrEqual(1)
    expect(d[4]).toBeGreaterThanOrEqual(254)
  })

  it('positive contrast pushes a value away from the midpoint, negative pulls it toward 128', () => {
    const high = pixelArray([200, 200, 200, 255])
    processPhotoAdjustments(high, { ...DEFAULT_PHOTO_ADJUSTMENTS, contrast: 50 })
    expect(high[0]).toBeGreaterThan(200)

    const low = pixelArray([200, 200, 200, 255])
    processPhotoAdjustments(low, { ...DEFAULT_PHOTO_ADJUSTMENTS, contrast: -50 })
    expect(low[0]).toBeLessThan(200)
    expect(low[0]).toBeGreaterThan(128)
  })

  it('contrast=-100 flattens everything to the midpoint', () => {
    const d = pixelArray([10, 10, 10, 255], [240, 240, 240, 255])
    processPhotoAdjustments(d, { ...DEFAULT_PHOTO_ADJUSTMENTS, contrast: -100 })
    expect(d[0]).toBe(128)
    expect(d[4]).toBe(128)
  })

  it('saturation=-100 fully desaturates a saturated color to its luminance', () => {
    const d = pixelArray([255, 0, 0, 255]) // pure red
    processPhotoAdjustments(d, { ...DEFAULT_PHOTO_ADJUSTMENTS, saturation: -100 })
    // Fully desaturated -- r, g, b channels converge to the same gray value.
    expect(d[0]).toBe(d[1])
    expect(d[1]).toBe(d[2])
  })

  it('positive saturation increases channel spread away from luminance', () => {
    const base = pixelArray([200, 100, 100, 255])
    processPhotoAdjustments(base, { ...DEFAULT_PHOTO_ADJUSTMENTS, saturation: 50 })
    const spread = base[0] - base[1]
    expect(spread).toBeGreaterThan(100) // r-g spread was 100 before adjustment
  })

  it('positive shadows lifts a dark pixel more than contrast alone would', () => {
    const dark = pixelArray([20, 20, 20, 255])
    processPhotoAdjustments(dark, { ...DEFAULT_PHOTO_ADJUSTMENTS, shadows: 80 })
    expect(dark[0]).toBeGreaterThan(20)
  })

  it('shadows has a much smaller effect on a bright pixel than on a dark one', () => {
    const dark = pixelArray([10, 10, 10, 255])
    const bright = pixelArray([240, 240, 240, 255])
    processPhotoAdjustments(dark, { ...DEFAULT_PHOTO_ADJUSTMENTS, shadows: 80 })
    processPhotoAdjustments(bright, { ...DEFAULT_PHOTO_ADJUSTMENTS, shadows: 80 })
    const darkDelta = dark[0] - 10
    const brightDelta = bright[0] - 240
    expect(darkDelta).toBeGreaterThan(brightDelta)
  })

  it('black and white forces r=g=b via luminance, applied AFTER saturation (last in the fixed order)', () => {
    const d = pixelArray([255, 0, 0, 255])
    // Even with saturation cranked up, B&W wins since it's applied last.
    processPhotoAdjustments(d, { ...DEFAULT_PHOTO_ADJUSTMENTS, saturation: 100, blackAndWhite: true })
    expect(d[0]).toBe(d[1])
    expect(d[1]).toBe(d[2])
  })

  it('never produces out-of-range channel values for extreme combined settings', () => {
    const d = pixelArray([5, 250, 128, 255])
    processPhotoAdjustments(d, { contrast: 100, saturation: 100, shadows: 100, blackPoint: 0, whitePoint: 255, blackAndWhite: false })
    for (let i = 0; i < 3; i++) {
      expect(d[i]).toBeGreaterThanOrEqual(0)
      expect(d[i]).toBeLessThanOrEqual(255)
    }
  })

  it('an alpha channel (index 3) is left untouched', () => {
    const d = pixelArray([100, 100, 100, 137])
    processPhotoAdjustments(d, { ...DEFAULT_PHOTO_ADJUSTMENTS, contrast: 80, saturation: -60 })
    expect(d[3]).toBe(137)
  })
})

// Regression guard against the two copies (this export, and the nested
// duplicate inside applyPhotoAdjustmentsInDom -- see both functions' own
// comments for why the duplication exists at all) silently drifting apart.
// Reaches into the live function's own source text rather than re-running
// it (applyPhotoAdjustmentsInDom needs a real browser DOM/canvas, which
// jsdom doesn't meaningfully provide) -- a cheap, purely textual check that
// still catches the failure mode that actually matters: someone editing
// one copy's pixel math without updating the other.
describe('applyPhotoAdjustmentsInDom -- nested pixel math stays in sync', () => {
  it('its own source text contains processPhotoAdjustments\' exact pixel-math logic', () => {
    // Comments are allowed to be worded/wrapped differently between the two
    // copies (that's just explaining the duplication, not the duplicated
    // logic itself) -- stripped before comparing so only actual code is
    // checked, which is the part that must never drift.
    const stripComments = (s: string) => s.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ').trim()

    const outerSrc = processPhotoAdjustments.toString()
    const bodyStart = outerSrc.indexOf('{') + 1
    const bodyEnd = outerSrc.lastIndexOf('}')
    const sharedBody = stripComments(outerSrc.slice(bodyStart, bodyEnd))

    const innerSrc = stripComments(applyPhotoAdjustmentsInDom.toString())
    expect(innerSrc).toContain(sharedBody)
  })
})
