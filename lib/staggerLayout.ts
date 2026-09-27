// Extracted from SlideCanvas.tsx so EditorPanel.tsx can also compute a
// stagger group's overall bounding width (groupW) -- needed for the image
// cluster's default X-position calculation (lib/imageClusterPosition.ts) --
// without duplicating this cascade/triangle/squared placement math a
// second time.
import { SlideData, ImageMode, StaggerImage, staggerCount } from './types'

export interface StaggerLayout {
  images: (StaggerImage | undefined)[]
  widths: number[]
  heights: number[]
  lefts: number[]
  tops: number[]
  groupW: number
  groupH: number
}

// Lays out a mode's images in one of three arrangements:
//  - cascade (two/three/four-stagger): each subsequent image steps right and down from the previous one
//  - triangle (three-triangle): two images side by side on top, one centered below overlapping both
//  - squared (four-squared): a 2x2 grid, each quadrant nudged toward its neighbors
// Callers render this result's `images` array with `zIndex: img?.zIndex
// ?? (i + 1)` per slot -- stacking depth is an explicit, user-set value
// per image (a "layer" slider in EditorPanel writes StaggerImage.zIndex
// directly), not something inferred from array/DOM order.
export function computeStaggerLayout(data: SlideData, mode: ImageMode, scale: number): StaggerLayout {
  const count = staggerCount(mode)
  const overlapPct = (data.imageOverlap ?? 30) / 100
  const baseSize = data.staggerSize ?? 250
  const offsetX = baseSize * (1 - overlapPct) * scale
  const shiftStep = baseSize * 0.12 * scale

  const images: (StaggerImage | undefined)[] = Array.from({ length: count }, (_, i) => data.staggerImages?.[i])
  const widths = images.map(img => ((img?.scale || baseSize)) * scale)
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
  const lefts = baseLefts.map((l, i) => l + (images[i]?.x ?? 0) * scale)
  const tops = baseTops.map((t, i) => t + (images[i]?.y ?? 0) * scale)

  const groupW = Math.max(...lefts.map((l, i) => l + widths[i]))
  const groupH = Math.max(...tops.map((t, i) => t + heights[i]))

  return { images, widths, heights, lefts, tops, groupW, groupH }
}
