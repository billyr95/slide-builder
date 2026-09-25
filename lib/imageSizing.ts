// Single source of truth for interpreting SlideData.imageSize (single-image
// mode's size control) correctly regardless of vintage -- shared by
// SlideCanvas.tsx (what actually renders), EditorPanel.tsx (what the slider
// shows/writes), and lib/liveTrainCapture.ts (training-data ground truth),
// so the percentage->pixel conversion can't drift by being re-derived
// separately in each (the exact class of bug lib/textStackGap.ts and
// lib/layoutDefaults.ts already exist to prevent elsewhere in this app).
import { SlideData, Orientation } from './types'

export const CANVAS_WIDTH: Record<Orientation, number> = { landscape: 1920, portrait: 1080 }

// The single-image mode column's own width, as a fraction of the full
// canvas (see SlideCanvas.tsx's landscape branch: `width: '40%'`, and its
// portrait branch: `width: '66%'`) -- this is what the LEGACY percentage
// control was actually a percentage OF, not the full canvas. Only relevant
// to the legacy-percentage conversion below; the current pixel-native
// control has no notion of "column width" at all (it's a literal pixel
// value the image can bleed past the column with, same as stagger mode's
// own pixel-based `scale`).
const LEGACY_COLUMN_WIDTH_FRACTION: Record<Orientation, number> = { landscape: 0.4, portrait: 0.66 }

// Matches the historical "100%" look in landscape single-image mode (100%
// of that mode's 40%-wide image column: 0.4 * 1920) -- the fallback for a
// slide that somehow has no imageSize at all (predates the field entirely).
export const DEFAULT_IMAGE_SIZE_PX = 768

export const MIN_IMAGE_SIZE_PX = 20
export const MAX_IMAGE_SIZE_PX = 800

// The single-image control used to be a percentage of its own column's
// width (and confusingly labeled "px" despite that) -- it's now a genuine
// absolute pixel width. A slide saved before this change has no
// imageSizeIsPixels marker and its stored imageSize is still that legacy
// percentage (typically 20-200); this converts it against the column width
// the percentage was ACTUALLY relative to (0.4 * canvas landscape, 0.66 *
// canvas portrait) -- NOT the raw full canvas width, which would inflate
// most real slides' images to 2-4x the canvas size (verified against this
// app's actual production data before picking this formula: e.g. a stored
// 200% would become 3840px -- twice the 1920px canvas -- under a
// full-canvas conversion, vs. a canvas-fitting 1536px under this one). So
// an old slide keeps rendering at (very close to) its original visual size
// the moment it's opened, without ever needing a batch DB migration -- the
// conversion only gets written back permanently once the user actually
// touches the slider (see EditorPanel's onChange, which sets
// imageSizeIsPixels: true at that point).
export function effectiveImageSizePx(data: SlideData, orientation: Orientation): number {
  if (data.imageSize === undefined) return DEFAULT_IMAGE_SIZE_PX
  if (data.imageSizeIsPixels) return data.imageSize
  return Math.round((data.imageSize / 100) * LEGACY_COLUMN_WIDTH_FRACTION[orientation] * CANVAS_WIDTH[orientation])
}
