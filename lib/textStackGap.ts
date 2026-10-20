// Single source of truth for the text stack's block-to-block gap system --
// shared by SlideCanvas.tsx (what actually renders) and EditorPanel.tsx
// (what a field's "Margin top" control shows/starts at before it's been
// manually overridden). Every one of these helpers used to be duplicated
// (or subtly re-derived) separately in both files, which is exactly what
// produced two real bugs this session: a `resolveBlockOrder` fallback that
// disagreed with itself when data.blockOrder was undefined (duplicating
// every block), and a STACK_GAP formula that briefly read Title's own
// overridden line-height (leaking a field-internal setting into the shared
// gap). Putting the whole system in one place removes the ability for that
// class of bug to happen a third time.
import { SlideData, TextBlockKey, CustomTextLayer } from './types'
import { DEFAULT_BLOCK_ORDER, DEFAULT_STACK_LINE_HEIGHT } from './defaults'

// A blockOrder entry is either a fixed TextBlockKey or a customTextLayers[]
// entry's own id (see SlideData.blockOrder/CustomTextLayer's comments) --
// every function below that used to take a TextBlockKey now takes this
// wider type and branches on isTextBlockKey/getCustomLayer internally.
export type BlockKey = string

function isTextBlockKey(key: BlockKey): key is TextBlockKey {
  return (DEFAULT_BLOCK_ORDER as readonly string[]).includes(key)
}

export function getCustomLayer(data: SlideData, key: BlockKey): CustomTextLayer | undefined {
  return data.customTextLayers?.find(l => l.id === key)
}

// A diacritic/accent mark that extends ABOVE the base letter (acute,
// grave, circumflex, tilde, diaeresis, ring, macron, breve, caron, dot
// above, double acute -- essentially all common Latin accents: á é í ó ú à
// è ì ò ù â ê î ô û ã õ ñ ü ö ä å ý č š ž, etc.) collides with whatever
// text sits above it once that text's own gap has been trimmed down to its
// cap-height -- there's no room left for an ascender-topping mark that a
// plain capital letter wouldn't have needed. Marks that sit BELOW the base
// letter (cedilla, ogonek, dot below, etc.) don't cause that collision, so
// they're excluded here.
const BELOW_BASE_MARKS = new Set([
  0x0316, 0x0317, 0x0318, 0x0319, 0x031C, 0x031D, 0x031E, 0x031F, 0x0320,
  0x0321, 0x0322, 0x0323, 0x0324, 0x0325, 0x0326, 0x0327, 0x0328, 0x0329,
  0x032A, 0x032B, 0x032C, 0x032D, 0x032E, 0x032F, 0x0330, 0x0331, 0x0332,
  0x0333, 0x0339, 0x033A, 0x033B, 0x033C, 0x0345,
])

// Detects an upward-extending accent on the FIRST LINE of `text` --
// Unicode-general rather than a hardcoded letter list: NFD-normalizing
// splits any precomposed accented letter (e.g. "Á") into its base letter
// plus a separate combining-mark codepoint (U+0301 COMBINING ACUTE ACCENT),
// which a plain range check over the Combining Diacritical Marks block
// (U+0300-U+036F) then catches regardless of which specific letter or
// accent it is.
export function hasLeadingUpwardAccent(text: string): boolean {
  const firstLine = text.split('\n')[0] ?? ''
  const decomposed = firstLine.normalize('NFD')
  for (const ch of decomposed) {
    const code = ch.codePointAt(0)
    if (code === undefined) continue
    if (code >= 0x0300 && code <= 0x036F && !BELOW_BASE_MARKS.has(code)) return true
  }
  return false
}

// Empirically measured (real Chromium render, text-box-trim'd single-line
// all-caps sample, box height / font-size): cap-height as a fraction of
// em. Identical across Theinhardt's weights and italic -- only 92NY Text
// differs.
export function capHeightRatio(font: string): number {
  return font === '92NY Text' ? 0.70 : 0.68
}

// Empirically measured (real Chromium render, cap-alphabetic-trimmed
// "VÁCLAV" vs "VACLAV", pixel-scanned): how far an upward accent's own ink
// extends above the trimmed box's top edge (which sits at cap-height --
// accents on capitals always overshoot it), as a fraction of em.
export function accentClearanceRatio(font: string): number {
  return font === '92NY Text' ? 0.16 : 0.20
}

// User-controlled render order (EditorPanel's drag list edits
// data.blockOrder directly) -- falls back to the historical fixed order
// for a slide with no blockOrder of its own, and defensively appends any
// known block key missing from a stored order (forward-compatible if a
// future block type ships after some slides already have an order saved)
// while dropping anything unrecognized. `base` is computed once and reused
// for both the keep-filter and the missing-filter -- computing the
// fallback twice (once per filter) previously let the two disagree on what
// "the base order" even was whenever data.blockOrder was undefined,
// duplicating every single key.
// `data` (not just the stored array) is needed now so a customTextLayers
// entry with no blockOrder position yet (just added) gets appended at the
// end, same treatment DEFAULT_BLOCK_ORDER's own missing-key fallback below
// already gives a fixed field.
export function resolveBlockOrder(data: SlideData): BlockKey[] {
  const customIds = (data.customTextLayers ?? []).map(l => l.id)
  const known = new Set<BlockKey>([...DEFAULT_BLOCK_ORDER, ...customIds])
  const base = data.blockOrder ?? DEFAULT_BLOCK_ORDER
  return [
    ...base.filter(k => known.has(k)),
    ...DEFAULT_BLOCK_ORDER.filter(k => !base.includes(k)),
    ...customIds.filter(id => !base.includes(id)),
  ]
}

// Whether a block currently has something to show -- an empty/unpopulated
// field simply isn't part of the rendered (or reorderable) stack. A custom
// layer counts as populated once it has any non-whitespace text, same bar
// as every fixed text field's own `!!data.xyz` check.
export function isBlockPopulated(data: SlideData, key: BlockKey): boolean {
  const layer = getCustomLayer(data, key)
  if (layer) return !!layer.text.trim()
  switch (key as TextBlockKey) {
    case 'label': return !!data.label
    case 'title': return true
    case 'subtitle': return !!(data.subtitle && !data.subtitleInline)
    case 'subtitle2': return !!data.subtitle2
    case 'presenters': return !!data.presenters
    case 'programTitle': return !!data.programTitle
    default: return false
  }
}

// The currently-visible render order: resolveBlockOrder filtered down to
// populated blocks only.
export function visibleBlockOrder(data: SlideData): BlockKey[] {
  return resolveBlockOrder(data).filter(k => isBlockPopulated(data, k))
}

// The ONE gap value every block-to-block transition in the stack is based
// on -- deliberately anchored to DEFAULT_STACK_LINE_HEIGHT (the fixed
// shared constant) and Title's own font/size, NEVER to any field's own
// possibly-overridden setting. That's what makes "the gap after
// Presenters" pixel-identical to "the gap after Title" even though
// Presenters and Program Title can be completely different sizes,
// regardless of blockOrder position -- every inter-block gap points at
// this one constant-derived number unless a field's own Margin Top has
// been explicitly overridden (see effectiveMarginTop below).
export function computeStackGap(data: SlideData): number {
  const titleFont = data.titleFont ?? '92NY Text'
  return DEFAULT_STACK_LINE_HEIGHT * data.titleSize - capHeightRatio(titleFont) * data.titleSize
}

// The AUTOMATIC margin-top for `key` -- i.e. what it would be if the user
// had never touched that field's own Margin Top override. Based on
// whichever block CURRENTLY precedes `key` in the resolved order, so it
// naturally follows a field if blockOrder is reordered rather than being
// hardcoded to "Title's gap" vs. "Presenters' gap". Returns 0 for a block
// with nothing rendering above it (first in the visible order, or not
// visible at all).
export function computeAutoMarginTop(data: SlideData, key: BlockKey): number {
  const order = visibleBlockOrder(data)
  const idx = order.indexOf(key)
  if (idx <= 0) return 0
  const prevKey = order[idx - 1]
  const stackGap = computeStackGap(data)
  // Targeted exception, not a change to the general rule: Label->Title
  // needs extra clearance ONLY when Title's first line has an
  // upward-extending accent that would otherwise collide with Label above
  // it -- every other gap, including every other pair Label might now sit
  // next to after a manual reorder, stays exactly stackGap.
  if (prevKey === 'label' && key === 'title' && hasLeadingUpwardAccent(data.title)) {
    const titleFont = data.titleFont ?? '92NY Text'
    return stackGap + accentClearanceRatio(titleFont) * data.titleSize
  }
  return stackGap
}

// Which SlideData field holds `key`'s own margin-top override. A plain
// switch (not a template-string cast) so TypeScript's exhaustiveness check
// on TextBlockKey catches a missing case if a new block type is ever added.
export function marginTopField(key: TextBlockKey): keyof SlideData {
  switch (key) {
    case 'label': return 'labelMarginTop'
    case 'title': return 'titleMarginTop'
    case 'subtitle': return 'subtitleMarginTop'
    case 'subtitle2': return 'subtitle2MarginTop'
    case 'presenters': return 'presentersMarginTop'
    case 'programTitle': return 'programTitleMarginTop'
  }
}

// The margin-top that actually renders above `key` -- its own manual
// override if the user set one (takes precedence over the automatic
// calculation for THAT gap specifically), else the automatic value. A
// custom layer's override lives on the layer object itself (marginTop),
// not a fixed SlideData key -- see CustomTextLayer's comment.
export function effectiveMarginTop(data: SlideData, key: BlockKey): number {
  const layer = getCustomLayer(data, key)
  const override = layer ? layer.marginTop : (data[marginTopField(key as TextBlockKey)] as number | undefined)
  return override !== undefined ? override : computeAutoMarginTop(data, key)
}

// Series Name's own margin-top -- NOT a TextBlockKey (it's pinned to its
// own fixed footer slot, directly above Listening Credit, entirely outside
// blockOrder), so it doesn't go through marginTopField/effectiveMarginTop
// above. Same auto-until-touched/manual-override pattern as every other
// field though: undefined falls back to the same uniform stackGap every
// other block-to-block transition uses, just not evaluated relative to a
// blockOrder position (Series Name has none) -- it's the gap above its own
// fixed anchor point instead.
export function effectiveSeriesNameMarginTop(data: SlideData): number {
  return data.seriesNameMarginTop ?? computeStackGap(data)
}

// The logo bar's own gap above whatever renders directly above it --
// same auto-until-touched/manual-override pattern as every other
// margin-top field, but a flat default (24px, matching the fixed value
// every logo bar render site used before this control existed) rather
// than the font-metric-derived stackGap above, since the logo bar isn't
// text and has no font size of its own to derive a gap from.
export function effectiveLogoMarginTop(data: SlideData): number {
  return data.logoMarginTop ?? 24
}
