// Single source of truth for the image cluster's (single image, or the
// whole stagger group treated as one unit) horizontal position -- shared by
// SlideCanvas.tsx (what actually renders) and EditorPanel.tsx (what the
// X-position control shows/writes before it's been touched).
//
// Previously, horizontal position was never an explicit value at all: the
// image column used `justifyContent: 'center'`, so an image (or stagger
// group) smaller than its available column space just sat centered with
// slack split evenly on both sides. That's what made a large imageSize
// LOOK like it wasn't fully "taking effect" -- growing it larger only
// extended the visible (facing/text-side) edge by HALF of the increase,
// since the other half silently bled further off-canvas on the outer side
// due to that centering. There was never a literal margin/gap-based clamp
// on the image's own width (SlideCanvas.tsx always set `width` directly to
// the exact requested pixel value) -- the perceived "auto-shrink" was this
// centering behavior. Replacing centering with an explicit X coordinate
// (this module) removes that ambiguity entirely: the cluster's position is
// now a real, independent number, defaulting to wherever centering used to
// place it so nothing shifts until a user actually sets it.
import { SlideData } from './types'

// data.imageClusterX overrides BOTH orientations uniformly once set (same
// "one field, per-context auto default, uniform override" pattern as
// contentMargin) -- undefined means "wherever the old centering logic
// would have placed it," computed by the two functions below from values
// the caller already has on hand (column width/padding for landscape,
// nothing extra needed for portrait's simple full-width centering).
export function effectiveImageClusterX(data: SlideData, naturalDefaultX: number): number {
  return data.imageClusterX ?? naturalDefaultX
}

// Landscape: the image sits in a column alongside the text (left or right,
// per Flip). `colWidth` is that column's own total width (a fixed 40% of
// canvas for single-image mode, or the content-fitted stagger column width
// -- both already computed by the caller), `leftPad`/`rightPad` are its
// current padding on each side (outer margin vs. the image<->text gap's
// facing inset, already resolved for Flip by the caller), and
// `contentWidth` is the cluster's own rendered width (effectiveImageSizePx
// for single-image, or the stagger layout's groupW). All units must be
// consistent (either all scaled-for-thumbnail or all full-resolution) --
// the result is in whatever unit the inputs were.
export function naturalLandscapeClusterX(
  canvasWidth: number, colWidth: number, leftPad: number, rightPad: number, contentWidth: number, imageOnRight: boolean
): number {
  const naturalRelX = leftPad + (colWidth - leftPad - rightPad - contentWidth) / 2
  const columnLeftX = imageOnRight ? canvasWidth - colWidth : 0
  return columnLeftX + naturalRelX
}

// Portrait: the image sits above the text, horizontally centered across
// the FULL slide width (no left/right column split the way landscape has,
// and Flip there only swaps top/bottom order, never horizontal position).
export function naturalPortraitClusterX(canvasWidth: number, contentWidth: number): number {
  return (canvasWidth - contentWidth) / 2
}
