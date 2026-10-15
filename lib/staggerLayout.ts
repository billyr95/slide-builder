// Extracted from SlideCanvas.tsx so EditorPanel.tsx can also compute a
// stagger group's overall bounding width (groupW) -- needed for the image
// cluster's default X-position calculation (lib/imageClusterPosition.ts) --
// without duplicating this cascade/triangle/squared placement math a
// second time.
import { SlideData, ImageMode, Orientation, StaggerImage, staggerCount } from './types'

export interface StaggerLayout {
  images: (StaggerImage | undefined)[]
  widths: number[]
  heights: number[]
  lefts: number[]
  tops: number[]
  groupW: number
  groupH: number
}

// Orientation-specific per-image overrides (xLandscape/Portrait,
// yLandscape/Portrait, scaleLandscape/Portrait) take precedence once set,
// falling back to the legacy shared field (x/y/scale) so a stagger image
// that hasn't been repositioned since this split shipped renders
// identically in both orientations, same as it always has. The only place
// these three fields should be read -- see lib/types.ts's StaggerImage
// comment.
export function effectiveStaggerScale(img: StaggerImage | undefined, orientation: Orientation): number {
  if (!img) return 0
  const override = orientation === 'landscape' ? img.scaleLandscape : img.scalePortrait
  return override ?? img.scale
}

export function effectiveStaggerX(img: StaggerImage | undefined, orientation: Orientation): number {
  if (!img) return 0
  const override = orientation === 'landscape' ? img.xLandscape : img.xPortrait
  return override ?? (img.x ?? 0)
}

export function effectiveStaggerY(img: StaggerImage | undefined, orientation: Orientation): number {
  if (!img) return 0
  const override = orientation === 'landscape' ? img.yLandscape : img.yPortrait
  return override ?? img.y
}

// Same fallback shape as above, for the group's shared default width
// (SlideData.staggerSizeLandscape/Portrait, falling back to the legacy
// shared staggerSize).
export function effectiveStaggerSize(data: SlideData, orientation: Orientation): number {
  const override = orientation === 'landscape' ? data.staggerSizeLandscape : data.staggerSizePortrait
  return override ?? (data.staggerSize ?? 250)
}

// Lays out a mode's images in one of three arrangements:
//  - cascade (two/three/four-stagger): each subsequent image steps right and down from the previous one
//  - triangle (three-triangle): two images side by side on top, one centered below overlapping both
//  - squared (four-squared): a 2x2 grid, each quadrant nudged toward its neighbors
// Callers render this result's `images` array with `zIndex: img?.zIndex
// ?? (i + 1)` per slot -- stacking depth is an explicit, user-set value
// per image (a "layer" slider in EditorPanel writes StaggerImage.zIndex
// directly), not something inferred from array/DOM order -- zIndex itself
// stays shared across orientations (it's the same uploaded image either
// way, only its position/size within the cluster is orientation-specific).
export function computeStaggerLayout(data: SlideData, mode: ImageMode, scale: number, orientation: Orientation): StaggerLayout {
  const count = staggerCount(mode)
  const overlapPct = (data.imageOverlap ?? 30) / 100
  const baseSize = effectiveStaggerSize(data, orientation)
  const offsetX = baseSize * (1 - overlapPct) * scale
  const shiftStep = baseSize * 0.12 * scale

  const images: (StaggerImage | undefined)[] = Array.from({ length: count }, (_, i) => data.staggerImages?.[i])
  const widths = images.map(img => (effectiveStaggerScale(img, orientation) || baseSize) * scale)
  const heights = widths.map(w => w * 1.35) // fallback box estimate; actual <img> keeps its natural aspect ratio
  const rowH = heights[0] ?? baseSize * 1.35 * scale
  const rowDrop = rowH * (1 - overlapPct)

  let baseLefts: number[]
  let baseTops: number[]
  if (mode === 'three-triangle') {
    baseLefts = [0, offsetX, offsetX / 2]
    baseTops = [0, shiftStep, rowDrop + shiftStep]
  } else if (mode === 'four-squared') {
    baseLefts = [0, offsetX, shiftStep, offsetX + shiftStep]
    baseTops = [0, shiftStep, rowDrop, rowDrop + shiftStep]
  } else {
    baseLefts = widths.map((_, i) => i * offsetX)
    baseTops = widths.map((_, i) => i * shiftStep)
  }
  const lefts = baseLefts.map((l, i) => l + effectiveStaggerX(images[i], orientation) * scale)
  const tops = baseTops.map((t, i) => t + effectiveStaggerY(images[i], orientation) * scale)

  const groupW = Math.max(...lefts.map((l, i) => l + widths[i]))
  const groupH = Math.max(...tops.map((t, i) => t + heights[i]))

  return { images, widths, heights, lefts, tops, groupW, groupH }
}
