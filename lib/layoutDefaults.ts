// Single source of truth for the "image <-> text gap" and "outer content
// margin" controls -- shared by SlideCanvas.tsx (what actually renders) and
// EditorPanel.tsx (what those sliders show before they've been touched),
// same reasoning as lib/textStackGap.ts: a value duplicated into both files
// is a value that can quietly drift out of sync.
import { SlideData, staggerCount } from './types'

// Landscape default depends on imageMode: today's rendered gap is the SUM
// of the image column's own inward-facing padding and the text column's
// own inward-facing padding, which (before this control existed) differed
// between single-image mode (80 + 20 = 100) and stagger/triangle/squared
// mode (60 + 20 = 80, since stagger images use a tighter 60px cluster
// inset). This preserves both exactly.
export function effectiveImageTextGapLandscape(data: SlideData): number {
  if (data.imageTextGapLandscape !== undefined) return data.imageTextGapLandscape
  return staggerCount(data.imageMode) > 0 ? 80 : 100
}

// Portrait's image and text are stacked vertically (image, then text in
// document flow) -- today's rendered gap is entirely the text section's own
// top padding (60px), which this replaces.
export function effectiveImageTextGapPortrait(data: SlideData): number {
  return data.imageTextGapPortrait ?? 60
}

// The outer content margin is genuinely NOT one uniform number today --
// e.g. portrait's bottom margin (60) differs from its top (80), and
// landscape's bottom shrinks/grows to clear the footer when one is present.
// Each call site passes its own correct current-default as `fallback`, so
// leaving contentMargin unset reproduces today's exact (non-uniform)
// rendering; setting it overrides every call site with that SAME value,
// which is what makes it behave as one genuinely shared "all four sides"
// control once touched.
export function effectiveContentMargin(data: SlideData, fallback: number): number {
  return data.contentMargin ?? fallback
}

const SIDE_FIELD = {
  top: 'contentMarginTop',
  right: 'contentMarginRight',
  bottom: 'contentMarginBottom',
  left: 'contentMarginLeft',
} as const

export type MarginSide = keyof typeof SIDE_FIELD

// The side-aware version of effectiveContentMargin above: a side's own
// per-side override (set once a user touches that specific control, or all
// four at once via the linked control) wins first, then the legacy single
// `contentMargin` value (an old slide that predates the four-sided
// controls), then that side's own context-dependent fallback -- same
// precedence/fallback shape used everywhere else in this app ("own override
// -> legacy/shared value -> contextual default"). contentMarginLinked is
// deliberately NOT consulted here: it only tells EditorPanel.tsx whether to
// show one control or four, never how rendering interprets the stored
// values, so toggling it can't retroactively change what's on screen.
export function effectiveContentMarginSide(data: SlideData, side: MarginSide, fallback: number): number {
  const sideValue = data[SIDE_FIELD[side]]
  if (sideValue !== undefined) return sideValue
  return data.contentMargin ?? fallback
}
