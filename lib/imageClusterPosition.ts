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
import { SlideData, Orientation, staggerCount } from './types'
import { CANVAS_WIDTH, effectiveImageSizePx } from './imageSizing'
import { effectiveContentMarginSide, effectiveImageTextGapLandscape } from './layoutDefaults'
import { computeStaggerLayout } from './staggerLayout'

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

// The image column's own facing-side (toward the text) padding caps at its
// usual default but SHRINKS once the requested image<->text gap asks for
// less, so the two sides' padding together can actually reach a genuine 0
// gap instead of floors bottoming out at the default -- see
// SlideCanvas.tsx's identical comment for the full reasoning. Shared by
// SlideCanvas.tsx's own rendering and naturalImageClusterX below so this
// cap-and-shrink rule can't drift between what renders and what the X
// control shows as its default.
export function imageFacingInset(defaultInsetPx: number, requestedGapPx: number): { imageFacingPx: number; textFacingPx: number } {
  const imageFacingPx = Math.min(defaultInsetPx, requestedGapPx)
  const textFacingPx = Math.max(0, requestedGapPx - imageFacingPx)
  return { imageFacingPx, textFacingPx }
}

// Full "where would the image cluster sit if imageClusterX were never
// touched" calculation, at scale=1 (full slide resolution) -- the single
// source of truth EditorPanel.tsx's X position control reads to show/seed
// its AUTO value. SlideCanvas.tsx computes this same position at whatever
// render scale it's using via the lower-level pieces above (imageFacingInset
// + naturalLandscapeClusterX/naturalPortraitClusterX) rather than calling
// this directly, since it already needs several of those intermediate
// values (colW, leftPad/rightPad) for actual layout, not just position --
// but the FORMULA itself (stagger's fixed 60px cluster inset vs
// single-image's margin-derived one, the 40%-of-canvas column width, the
// facing-inset cap-and-shrink rule) only lives here and in
// lib/staggerLayout.ts, never restated a third time.
export function naturalImageClusterX(data: SlideData, orientation: Orientation): number {
  const canvasWidth = CANVAS_WIDTH[orientation]
  const imageOnRight = data.imageSide === 'right'
  const isStagger = staggerCount(data.imageMode) > 0

  if (orientation === 'portrait') {
    const contentWidth = isStagger
      ? computeStaggerLayout(data, data.imageMode, 1).groupW
      : effectiveImageSizePx(data, orientation)
    return naturalPortraitClusterX(canvasWidth, contentWidth)
  }

  const requestedGap = effectiveImageTextGapLandscape(data)

  if (isStagger) {
    const { groupW } = computeStaggerLayout(data, data.imageMode, 1)
    const colPad = 60
    const { imageFacingPx } = imageFacingInset(colPad, requestedGap)
    const colW = groupW + colPad + imageFacingPx
    const leftPad = imageOnRight ? imageFacingPx : colPad
    const rightPad = imageOnRight ? colPad : imageFacingPx
    return naturalLandscapeClusterX(canvasWidth, colW, leftPad, rightPad, groupW, imageOnRight)
  }

  const marginLeft = effectiveContentMarginSide(data, 'left', 80)
  const marginRight = effectiveContentMarginSide(data, 'right', 80)
  const outerMargin = imageOnRight ? marginRight : marginLeft
  const { imageFacingPx } = imageFacingInset(outerMargin, requestedGap)
  const imgW = effectiveImageSizePx(data, orientation)
  const colW = 0.4 * canvasWidth
  const leftPad = imageOnRight ? imageFacingPx : outerMargin
  const rightPad = imageOnRight ? outerMargin : imageFacingPx
  return naturalLandscapeClusterX(canvasWidth, colW, leftPad, rightPad, imgW, imageOnRight)
}
