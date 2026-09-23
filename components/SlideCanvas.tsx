import React, { forwardRef } from 'react'
import { SlideData, Orientation, ImageMode, StaggerImage, staggerCount, TextBlockKey } from '@/lib/types'
import { DEFAULT_BLOCK_ORDER, DEFAULT_STACK_LINE_HEIGHT, DEFAULT_LISTENING_CREDIT_LINE_HEIGHT } from '@/lib/defaults'

// A diacritic/accent mark that extends ABOVE the base letter (acute,
// grave, circumflex, tilde, diaeresis, ring, macron, breve, caron, dot
// above, double acute -- essentially all common Latin accents: á é í ó ú à
// è ì ò ù â ê î ô û ã õ ñ ü ö ä å ý č š ž, etc.) collides with whatever
// text sits above it once that text's own gap has been trimmed down to its
// cap-height (see DEFAULT_STACK_LINE_HEIGHT's comment below) -- there's no room
// left for an ascender-topping mark that a plain capital letter wouldn't
// have needed. Marks that sit BELOW the base letter (cedilla, ogonek, dot
// below, etc.) don't cause that collision, so they're excluded here.
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
function hasLeadingUpwardAccent(text: string): boolean {
  const firstLine = text.split('\n')[0] ?? ''
  const decomposed = firstLine.normalize('NFD')
  for (const ch of decomposed) {
    const code = ch.codePointAt(0)
    if (code === undefined) continue
    if (code >= 0x0300 && code <= 0x036F && !BELOW_BASE_MARKS.has(code)) return true
  }
  return false
}

interface SlideCanvasProps {
  data: SlideData
  orientation: Orientation
  scale?: number
}

type TheinhardtWeight = 'regular' | 'bold' | 'heavy'

const THEINHARDT = "'Theinhardt', sans-serif"
const NY92 = "'92NY Text', sans-serif"

function theinhardtWeight(w: TheinhardtWeight): number {
  if (w === 'heavy') return 900
  if (w === 'bold') return 700
  return 400
}

const LANDSCAPE = { w: 1920, h: 1080 }
const PORTRAIT = { w: 1080, h: 1920 }

const SlideCanvas = forwardRef<HTMLDivElement, SlideCanvasProps>(
  ({ data, orientation, scale = 1 }, ref) => {
    const dim = orientation === 'landscape' ? LANDSCAPE : PORTRAIT

    // Text alignment is a single slide-level toggle applied uniformly --
    // text-align is CSS-inherited, so setting it once on each layout's text
    // container covers every text block inside (label/title/subtitle/
    // subtitle2/presenters/programTitle) without touching each one. The
    // historical default differs by layout (portrait and no-image slides
    // were always centered; landscape-with-image was always left-aligned
    // implicitly) so slides saved before this field existed keep their
    // exact prior appearance rather than jumping to a new default.
    const historicalAlign = data.imageMode !== 'none' && orientation === 'landscape' ? 'left' : 'center'
    const textAlign = data.textAlign ?? historicalAlign
    const textAlignItems = textAlign === 'center' ? 'center' : 'flex-start'
    const imageOnRight = data.imageSide === 'right'

    // Every gap BETWEEN separate blocks (Label->Title, Title->Presenters,
    // Presenters->Program Title, etc.) is driven by ONE shared default
    // (DEFAULT_STACK_LINE_HEIGHT, imported from lib/defaults.ts -- also
    // read by EditorPanel.tsx's per-field line-spacing sliders so the two
    // can't drift out of sync the way a constant copied into both files
    // already has once before), so there's no way for those gaps to drift
    // apart the way separate per-boundary values (the old
    // BLOCK_GAP/TITLE_BLOCK_GAP) already proved they could. Two fully
    // independent things read this same constant, and MUST stay
    // independent -- a field's line-spacing control (below) only ever
    // changes #1 for that one field, never #2 for anything:
    //  1. Each block's OWN line-height (the gap between that block's own
    //     wrapped lines) defaults to this shared value, but can be
    //     overridden per field (see labelLineHeight etc. below) -- doing so
    //     only changes that field's own internal wrapping, since trimEdges
    //     below trims a block's outer top/bottom to its font's cap-height/
    //     baseline regardless of whatever line-height it's using
    //     internally, which is what keeps the two independent.
    //  2. Title is this stack's visual anchor (always present, generally
    //     the largest text), so ONE reference gap (STACK_GAP) is computed
    //     from Title's own size/font using the exact same math that
    //     governs its own internal line gap -- `DEFAULT_STACK_LINE_HEIGHT *
    //     fontSize - capHeight(font)` (the next line's box, once trimmed,
    //     starts at its cap-height; `text-box-trim` below makes that a
    //     physical certainty, not an approximation -- verified with a real
    //     Chromium render) -- and that SAME reference value is then used as
    //     the marginBottom before every other block, regardless of that
    //     block's own size/font/line-height override. That's what makes
    //     "the gap after Presenters" pixel-identical to "the gap after
    //     Title" even though Presenters and Program Title can be
    //     completely different sizes: every inter-block gap points at the
    //     one constant-derived number, not a formula re-evaluated per pair
    //     -- and critically, it does NOT re-derive from Title's own
    //     line-height override, precisely so a manual line-spacing change
    //     on Title (or any field) can never leak into the gap before or
    //     after it.

    // Empirically measured (real Chromium render, text-box-trim'd
    // single-line all-caps sample, box height / font-size): cap-height as a
    // fraction of em. Identical across Theinhardt's weights and italic --
    // only 92NY Text differs.
    function capHeightRatio(font: string): number {
      return font === '92NY Text' ? 0.70 : 0.68
    }

    // Empirically measured (real Chromium render, cap-alphabetic-trimmed
    // "VÁCLAV" vs "VACLAV", pixel-scanned): how far an upward accent's own
    // ink extends above the trimmed box's top edge (which sits at
    // cap-height -- accents on capitals always overshoot it), as a fraction
    // of em. Used only for the targeted Label->Title exception above.
    function accentClearanceRatio(font: string): number {
      return font === '92NY Text' ? 0.16 : 0.20
    }

    // `text-box-trim` + `text-box-edge` (Baseline-supported in current
    // Chromium/Safari; unsupported browsers just ignore these two
    // properties and silently fall back to plain line-height spacing, since
    // unknown CSS properties on an inline style are no-ops, not errors)
    // trims a text box's own top edge to its font's cap-height and its
    // bottom edge to its alphabetic baseline. That's what makes the
    // reference-gap formula below exact rather than approximate: it removes
    // each block's own invisible leading padding entirely, so the box edge
    // really is the cap-height/baseline the formula assumes it is.
    const trimEdges = { textBoxTrim: 'trim-both', textBoxEdge: 'cap alphabetic' } as React.CSSProperties

    const labelSize = 48
    const titleSize = data.titleSize
    const presenterSize = data.presentersSize
    const titleFont = data.titleFont ?? '92NY Text'

    // Each field's actual rendered line-height: DEFAULT_STACK_LINE_HEIGHT
    // (or DEFAULT_LISTENING_CREDIT_LINE_HEIGHT for that one) until the user
    // sets their own via EditorPanel's per-field line-spacing control, at
    // which point that value takes over for THAT field's own wrapped-line
    // spacing only -- it doesn't touch the gap between blocks (see
    // SlideData's own comment on why text-box-trim makes those independent).
    const labelLineHeight = data.labelLineHeight ?? DEFAULT_STACK_LINE_HEIGHT
    const titleLineHeight = data.titleLineHeight ?? DEFAULT_STACK_LINE_HEIGHT
    const subtitleLineHeight = data.subtitleLineHeight ?? DEFAULT_STACK_LINE_HEIGHT
    const subtitle2LineHeight = data.subtitle2LineHeight ?? DEFAULT_STACK_LINE_HEIGHT
    const presentersLineHeightVal = data.presentersLineHeight ?? DEFAULT_STACK_LINE_HEIGHT
    const programTitleLineHeightVal = data.programTitleLineHeight ?? DEFAULT_STACK_LINE_HEIGHT
    const seriesNameLineHeight = data.seriesNameLineHeight ?? DEFAULT_STACK_LINE_HEIGHT
    const listeningCreditLineHeight = data.listeningCreditLineHeight ?? DEFAULT_LISTENING_CREDIT_LINE_HEIGHT

    // The ONE gap value for every block-to-block transition in the stack --
    // deliberately anchored to DEFAULT_STACK_LINE_HEIGHT (the fixed shared
    // constant), NEVER to `titleLineHeight` (Title's own, possibly
    // overridden, effective value). Block-to-block gaps and a block's own
    // internal line-spacing are two fully independent concerns: a field's
    // line-spacing control (including Title's) is only ever allowed to
    // change that field's OWN wrapped-line spacing, never the space before
    // or after it. Reading the override-aware variable here once made
    // Title's line-spacing slider silently reshape the Label->Title and
    // Title->Presenters gaps too -- exactly the coupling this constant
    // exists to prevent, and exactly the bug this comment is now here so
    // nobody re-introduces it.
    const STACK_GAP = DEFAULT_STACK_LINE_HEIGHT * titleSize - capHeightRatio(titleFont) * titleSize

    // User-controlled render order (EditorPanel's drag list in Layout &
    // Preview edits data.blockOrder directly) -- falls back to the historical
    // fixed order for a slide with no blockOrder of its own (see
    // SlideData.blockOrder's comment), and defensively appends any known
    // block key missing from a stored order (forward-compatible if a future
    // block type ships after some slides already have an order saved) while
    // dropping anything unrecognized. `base` is computed once and reused for
    // both the keep-filter and the missing-filter below -- computing the
    // fallback twice (once per line) let the two calls disagree on what
    // "the base order" even was whenever data.blockOrder was undefined
    // (`?? DEFAULT_BLOCK_ORDER` vs `?? []`), which duplicated every single
    // key: the first line correctly used DEFAULT_BLOCK_ORDER as the base,
    // but the second line's fallback-to-[] made every one of those same
    // keys look "missing" all over again and re-append itself.
    const base = data.blockOrder ?? DEFAULT_BLOCK_ORDER
    const resolvedBlockOrder: TextBlockKey[] = [
      ...base.filter((k): k is TextBlockKey => DEFAULT_BLOCK_ORDER.includes(k)),
      ...DEFAULT_BLOCK_ORDER.filter(k => !base.includes(k)),
    ]
    const blockVisible: Record<TextBlockKey, boolean> = {
      label: !!data.label,
      title: true,
      subtitle: !!(data.subtitle && !data.subtitleInline),
      subtitle2: !!data.subtitle2,
      presenters: !!data.presenters,
      programTitle: !!data.programTitle,
      seriesName: !!(data.showSeriesName && data.seriesName),
    }
    const visibleBlocks = resolvedBlockOrder.filter(k => blockVisible[k])

    function marginAfter(key: TextBlockKey) {
      const idx = visibleBlocks.indexOf(key)
      if (idx === -1 || idx === visibleBlocks.length - 1) return undefined
      const next = visibleBlocks[idx + 1]
      // Targeted exception, not a change to the general rule: Label->Title
      // needs extra clearance ONLY when Title's first line has an
      // upward-extending accent that would otherwise collide with Label
      // above it (see hasLeadingUpwardAccent's comment) -- every other gap,
      // including every other pair Label might now sit next to after a
      // manual reorder, stays exactly STACK_GAP.
      const accentClearance = (key === 'label' && next === 'title' && hasLeadingUpwardAccent(data.title))
        ? accentClearanceRatio(titleFont) * titleSize
        : 0
      return { marginBottom: `${(STACK_GAP + accentClearance) * scale}px` }
    }
    const titleWeight = titleFont === 'Theinhardt Heavy' ? 900 : 700
    const titleStyle = titleFont === 'Theinhardt Heavy'
      ? {
          fontFamily: THEINHARDT,
          fontStyle: data.titleItalic ? 'italic' : 'normal',
          letterSpacing: `${Math.max(-0.05, -20 / (data.titleSize * (1 / scale)))}em`,
          color: data.accentColor,
          overflowWrap: 'break-word' as const,
          wordBreak: 'break-word' as const,
        }
      : {
          fontFamily: NY92,
          fontStyle: data.titleItalic ? 'italic' : 'normal',
          fontKerning: 'normal' as const,
          fontFeatureSettings: '"kern" 1, "liga" 1',
          letterSpacing: '0',
          color: data.accentColor,
          overflowWrap: 'break-word' as const,
          wordBreak: 'break-word' as const,
        }

    function bodyStyle(weight: TheinhardtWeight, sizePx: number, color: string) {
      const trackingEm = Math.max(-0.05, -20 / (sizePx * (1 / scale)))
      return {
        fontFamily: THEINHARDT,
        fontWeight: theinhardtWeight(weight),
        letterSpacing: `${trackingEm}em`,
        color,
        overflowWrap: 'break-word' as const,
        wordBreak: 'break-word' as const,
      }
    }

    // Shared by presenters and programTitle -- both are "body text that can
    // switch to 92NY Text" fields with their own independent font/weight/italic.
    function fontSwitchableStyle(font: 'Theinhardt' | '92NY Text', italic: boolean, weight: TheinhardtWeight, sizePx: number, color: string) {
      const fontStyle = italic ? 'italic' : 'normal'
      if (font === '92NY Text') {
        return {
          fontFamily: NY92,
          fontWeight: theinhardtWeight(weight),
          fontStyle,
          fontKerning: 'normal' as const,
          fontFeatureSettings: '"kern" 1, "liga" 1',
          letterSpacing: '0',
          color,
          overflowWrap: 'break-word' as const,
          wordBreak: 'break-word' as const,
        }
      }
      return { ...bodyStyle(weight, sizePx, color), fontStyle }
    }

    function presentersStyle(weight: TheinhardtWeight, sizePx: number) {
      return fontSwitchableStyle(data.presentersFont ?? 'Theinhardt', data.presentersItalic, weight, sizePx, data.presentersColor ?? data.textColor)
    }

    function programTitleStyle(weight: TheinhardtWeight, sizePx: number) {
      return fontSwitchableStyle(data.programTitleFont ?? 'Theinhardt', data.programTitleItalic, weight, sizePx, data.programTitleColor ?? data.textColor)
    }

    // Renders whichever single block `key` refers to -- called identically
    // from all three layout branches below (imageMode 'none', landscape,
    // portrait) so blockOrder only has to be resolved once and each block's
    // markup exists in exactly one place, not triplicated per layout.
    function renderBlock(key: TextBlockKey): React.ReactNode {
      switch (key) {
        case 'label':
          return data.label ? (
            <div key="label" style={{ fontSize: `${labelSize * scale}px`, lineHeight: labelLineHeight, ...bodyStyle(data.labelWeight, labelSize, data.labelColor ?? data.textColor), ...trimEdges, ...marginAfter('label') }}>
              {data.label}
            </div>
          ) : null

        case 'title':
          return (
            <div key="title" style={{ fontSize: `${titleSize * scale}px`, fontWeight: titleWeight, lineHeight: titleLineHeight, whiteSpace: 'pre-line', ...titleStyle, ...trimEdges, ...marginAfter('title') }}>
              {data.title}
            </div>
          )

        case 'subtitle':
          return (data.subtitle && !data.subtitleInline) ? (
            <div key="subtitle" style={{ fontSize: `${data.subtitleSize * scale}px`, lineHeight: subtitleLineHeight, ...bodyStyle(data.subtitleWeight, data.subtitleSize, data.subtitleColor ?? data.textColor), ...trimEdges, ...marginAfter('subtitle') }}>
              {data.subtitle}
            </div>
          ) : null

        case 'subtitle2':
          return data.subtitle2 ? (
            <div key="subtitle2" style={{ fontSize: `${data.subtitle2Size * scale}px`, lineHeight: subtitle2LineHeight, ...bodyStyle(data.subtitle2Weight, data.subtitle2Size, data.subtitle2Color ?? data.textColor), ...trimEdges, ...marginAfter('subtitle2') }}>
              {data.subtitle2}
            </div>
          ) : null

        case 'presenters':
          return data.presenters ? (
            <div key="presenters" style={{ fontSize: `${presenterSize * scale}px`, lineHeight: presentersLineHeightVal, whiteSpace: 'pre-line', ...presentersStyle(data.presentersWeight, presenterSize), ...trimEdges, ...marginAfter('presenters') }}>
              {data.subtitleInline && data.subtitle
                ? (() => {
                    const lines = data.presenters.split('\n')
                    return (
                      <>
                        <span style={{ fontSize: `${presenterSize * scale * 0.75}px`, ...bodyStyle(data.subtitleWeight, presenterSize * 0.75, data.subtitleColor ?? data.textColor) }}>
                          {data.subtitle}{' '}
                        </span>
                        <span>{lines[0]}</span>
                        {lines.slice(1).join('\n') && <>{'\n'}{lines.slice(1).join('\n')}</>}
                      </>
                    )
                  })()
                : data.presenters
              }
            </div>
          ) : null

        case 'programTitle':
          return data.programTitle ? (
            <div key="programTitle" style={{ fontSize: `${data.programTitleSize * scale}px`, lineHeight: programTitleLineHeightVal, whiteSpace: 'pre-line', ...programTitleStyle(data.programTitleWeight, data.programTitleSize), ...trimEdges, ...marginAfter('programTitle') }}>
              {data.programTitle}
            </div>
          ) : null

        case 'seriesName':
          return (data.showSeriesName && data.seriesName) ? (
            <div key="seriesName" style={{
              fontSize: `${38 * scale}px`,
              lineHeight: seriesNameLineHeight,
              fontFamily: THEINHARDT,
              fontWeight: theinhardtWeight('heavy'),
              color: data.seriesNameColor ?? data.textColor,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              ...trimEdges,
              ...marginAfter('seriesName'),
            }}>
              {data.seriesName}
            </div>
          ) : null
      }
    }

    const placeholderBox = (w: number, h: number) => (
      <div style={{
        width: w, height: h,
        border: `${2 * scale}px dashed ${data.textColor}`,
        borderRadius: `${8 * scale}px`,
        opacity: 0.2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${18 * scale}px`,
        color: data.textColor,
        fontFamily: THEINHARDT,
      }}>
        Image
      </div>
    )

    // Lays out a mode's images in one of three arrangements:
    //  - cascade (two/three/four-stagger): each subsequent image steps right and down from the previous one
    //  - triangle (three-triangle): two images side by side on top, one centered below overlapping both
    //  - squared (four-squared): a 2x2 grid, each quadrant nudged toward its neighbors
    // Callers render this result's `images` array with `zIndex: img?.zIndex
    // ?? (i + 1)` per slot -- stacking depth is an explicit, user-set value
    // per image (a "layer" slider in EditorPanel writes StaggerImage.zIndex
    // directly), not something inferred from array/DOM order. The `i + 1`
    // fallback only covers images that predate this field or haven't been
    // touched yet, so slides still look reasonable before manual adjustment.
    // The group's own wrapper also needs `isolation: 'isolate'` (see both
    // call sites) -- position:relative alone does NOT create a stacking
    // context, so without it these positive z-indexes escape upward and
    // compare directly against the footer/text (which sit at the default
    // z-index:auto layer). Per the CSS stacking spec, ANY positive z-index
    // always paints above z-index:auto content in the same context
    // regardless of DOM order, so an un-isolated image could unexpectedly
    // paint over the footer/text if a large X/Y nudge, size, or manually-set
    // layer value ever pushed it into that space. Isolating contains the
    // ordering to *within* this group, so from the outside the whole group
    // is back to being one plain DOM-ordered box relative to its siblings.
    function computeStaggerLayout(mode: ImageMode) {
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

    // Series Name moved into the reorderable text stack (renderBlock's
    // 'seriesName' case) -- the fixed absolutely-positioned footer now only
    // ever holds Listening Credit.
    const hasFooter = data.showListeningCredit
    const footerH = hasFooter ? 80 : 0

    if (data.imageMode === 'none') {
      const maxTextW = dim.w * (orientation === 'landscape' ? 0.7 : 0.8)

      return (
        <div
          ref={ref}
          id="slide-canvas"
          style={{
            width: dim.w * scale,
            height: dim.h * scale,
            backgroundColor: data.backgroundColor,
            color: data.textColor,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            position: 'relative',
            flexShrink: 0,
            textAlign,
            padding: `${80 * scale}px`,
          }}
        >
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: textAlignItems,
            maxWidth: maxTextW * scale,
          }}>
            {visibleBlocks.map(key => renderBlock(key))}

            {/* Logo bar */}
            {data.logos && data.logos.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: `${32 * scale}px`, marginTop: `${24 * scale}px`, flexWrap: 'wrap' }}>
                {data.logos.map(logo => (
                  <img key={logo.id} src={logo.url} alt={logo.alt}
                    style={{ height: `${(data.logoSize || 60) * scale}px`, maxWidth: `${300 * scale}px`, objectFit: 'contain' }} />
                ))}
              </div>
            )}
          </div>

          {/* Fixed footer -- Listening Credit only now; Series Name moved
              into the reorderable text stack above (see renderBlock's
              'seriesName' case). */}
          {hasFooter && (
            <div style={{
              position: 'absolute',
              bottom: `${48 * scale}px`,
              left: `${80 * scale}px`,
              right: `${80 * scale}px`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: `${6 * scale}px`,
              textAlign: 'center',
            }}>
              {data.showListeningCredit && data.listeningCredit && (
                <div style={{
                  fontSize: `${23 * scale}px`,
                  lineHeight: listeningCreditLineHeight,
                  fontFamily: THEINHARDT,
                  fontWeight: 400,
                  color: data.listeningCreditColor ?? data.textColor,
                  opacity: 0.65,
                }}>
                  {data.listeningCredit}
                </div>
              )}
            </div>
          )}
        </div>
      )
    }

    if (orientation === 'landscape') {
      const bottomPad = hasFooter ? (footerH + 60) : 80
      // The text column's own padding and its footer's offsets are
      // deliberately asymmetric (a tight gap on the image-adjacent side, a
      // full margin on the outer slide edge) -- when flipped, that
      // asymmetry has to flip sides too, or the tight gap ends up on the
      // slide's outer edge and the full margin ends up hugging the image.
      const textPadLeft = imageOnRight ? 80 : 20
      const textPadRight = imageOnRight ? 20 : 80
      const footerLeft = imageOnRight ? 100 : 20
      const footerRight = imageOnRight ? 20 : 100

      return (
        <div
          ref={ref}
          id="slide-canvas"
          style={{
            width: dim.w * scale,
            height: dim.h * scale,
            backgroundColor: data.backgroundColor,
            color: data.textColor,
            display: 'flex',
            flexDirection: imageOnRight ? 'row-reverse' : 'row',
            alignItems: 'center',
            overflow: 'hidden',
            position: 'relative',
            flexShrink: 0,
          }}
        >
          {/* Left: Image column — width driven by image size in stagger mode */}
          {(() => {
            const count = staggerCount(data.imageMode)
            if (count > 0) {
              const { images, widths, lefts, tops, groupW, groupH } = computeStaggerLayout(data.imageMode)
              const colPad = 60 * scale
              const colW = groupW + colPad * 2
              return (
                <div style={{
                  width: colW,
                  flexShrink: 0,
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: `${colPad}px`,
                  overflow: 'visible',
                }}>
                  <div style={{ position: 'relative', width: groupW, height: groupH, flexShrink: 0, isolation: 'isolate' }}>
                    {images.map((img, i) => (
                      <div key={img?.id ?? i} style={{ position: 'absolute', top: tops[i], left: lefts[i], width: widths[i], zIndex: img?.zIndex ?? (i + 1) }}>
                        {img?.url
                          ? <img src={img.url} alt={img.alt} style={{ width: '100%', height: 'auto', display: 'block' }} />
                          : placeholderBox(widths[i], widths[i] * 1.35)
                        }
                      </div>
                    ))}
                  </div>
                </div>
              )
            }
            // Single image — fixed 40% column
            return (
              <div style={{
                width: '40%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: `${80 * scale}px`,
                flexShrink: 0,
              }}>
                {data.imageUrl
                  ? <img src={data.imageUrl} alt={data.imageAlt} style={{ width: `${(data.imageSize || 100)}%`, maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }} />
                  : placeholderBox(400 * scale, 400 * scale)
                }
              </div>
            )
          })()}

          {/* Text — flex:1 so it takes remaining space. No alignItems override
              here: children default to 'stretch' (full column width), which
              text-align then wraps/aligns within -- switching alignItems to
              flex-start/center would shrink each block to its own content
              width instead and break wrapping against the column's edge. */}
          <div style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            padding: `${80 * scale}px ${textPadRight * scale}px ${bottomPad * scale}px ${textPadLeft * scale}px`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            textAlign,
            position: 'relative',
          }}>

            {visibleBlocks.map(key => renderBlock(key))}

            {/* Logo bar */}
            {data.logos && data.logos.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: `${32 * scale}px`, marginTop: `${24 * scale}px` }}>
                {data.logos.map(logo => (
                  <img key={logo.id} src={logo.url} alt={logo.alt}
                    style={{ height: `${(data.logoSize || 60) * scale}px`, maxWidth: `${300 * scale}px`, objectFit: 'contain' }} />
                ))}
              </div>
            )}

            {/* Fixed footer -- Listening Credit only now; see the 'none'
                branch's identical comment above. */}
            {hasFooter && (
              <div style={{
                position: 'absolute',
                bottom: `${48 * scale}px`,
                left: `${footerLeft * scale}px`,
                right: `${footerRight * scale}px`,
                display: 'flex',
                flexDirection: 'column',
                gap: `${6 * scale}px`,
              }}>
                {data.showListeningCredit && data.listeningCredit && (
                  <div style={{
                    fontSize: `${23 * scale}px`,
                    lineHeight: listeningCreditLineHeight,
                    fontFamily: THEINHARDT,
                    fontWeight: 400,
                    color: data.listeningCreditColor ?? data.textColor,
                    opacity: 0.65,
                  }}>
                    {data.listeningCredit}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )
    }

    // Portrait
    // Label needs to behave differently from the rest of the text block:
    // when not flipped it stays inline as the text section's first child
    // (unchanged from before), but when flipped it must lead the WHOLE
    // slide -- above the image, not just above Title -- so it's pulled out
    // into its own standalone section only for that state (portraitLabelSection,
    // defined below) and excluded from portraitTextSection there to avoid
    // rendering it twice.
    const portraitImageSection = (
      <React.Fragment key="image">
        {staggerCount(data.imageMode) > 0 ? (
          (() => {
            const { images, widths, lefts, tops, groupW, groupH } = computeStaggerLayout(data.imageMode)
            return (
              <div style={{
                position: 'relative',
                width: groupW,
                height: groupH,
                alignSelf: 'center',
                flexShrink: 0,
                isolation: 'isolate',
              }}>
                {images.map((img, i) => (
                  <div key={img?.id ?? i} style={{ position: 'absolute', top: tops[i], left: lefts[i], width: widths[i], zIndex: img?.zIndex ?? (i + 1) }}>
                    {img?.url
                      ? <img src={img.url} alt={img.alt} style={{ width: '100%', height: 'auto', display: 'block' }} />
                      : placeholderBox(widths[i], widths[i] * 1.35)
                    }
                  </div>
                ))}
              </div>
            )
          })()
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '66%',
            alignSelf: 'center',
          }}>
            {data.imageUrl
              ? <img src={data.imageUrl} alt={data.imageAlt} style={{ width: `${(data.imageSize || 100)}%`, maxWidth: '100%', maxHeight: `${dim.h * 0.5 * scale}px`, objectFit: 'contain', display: 'block' }} />
              : placeholderBox(400 * scale, 400 * scale)
            }
          </div>
        )}
      </React.Fragment>
    )

    // Only when flipped, AND Label is actually first in the resolved order --
    // leads the entire slide, above the image. If a manual reorder moves
    // Label anywhere else, it renders inline in portraitTextSection like
    // any other block instead (this "lead the whole slide" carve-out is a
    // portrait-flip-specific quirk that only makes sense for a
    // leading Label, not for Label at some other position).
    const labelLeadsPortrait = imageOnRight && data.label && visibleBlocks[0] === 'label'
    const portraitLabelSection = labelLeadsPortrait ? (
      <div key="label" style={{
        padding: `0 ${80 * scale}px ${40 * scale}px ${80 * scale}px`,
        textAlign,
      }}>
        <div style={{ fontSize: `${labelSize * scale}px`, lineHeight: labelLineHeight, ...bodyStyle(data.labelWeight, labelSize, data.labelColor ?? data.textColor), ...trimEdges }}>
          {data.label}
        </div>
      </div>
    ) : null

    const portraitTextSection = (
      <div key="text" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: textAlignItems,
        padding: `${60 * scale}px ${80 * scale}px`,
        textAlign,
      }}>
        {visibleBlocks.filter(key => !(labelLeadsPortrait && key === 'label')).map(key => renderBlock(key))}

        {/* Logo bar */}
        {data.logos && data.logos.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: `${32 * scale}px`, marginTop: `${24 * scale}px` }}>
            {data.logos.map(logo => (
              <img key={logo.id} src={logo.url} alt={logo.alt}
                style={{ height: `${(data.logoSize || 60) * scale}px`, maxWidth: `${300 * scale}px`, objectFit: 'contain' }} />
            ))}
          </div>
        )}
      </div>
    )

    return (
      <div
        ref={ref}
        id="slide-canvas"
        style={{
          width: dim.w * scale,
          height: dim.h * scale,
          backgroundColor: data.backgroundColor,
          color: data.textColor,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          flexShrink: 0,
          // Matches the 80px edge margin used everywhere else in this file
          // (landscape's text column padding, portrait text section's own
          // horizontal padding, the footer's left/right offsets) -- the top
          // of the slide reads consistently with those regardless of
          // whether the image or the text section (with label) sits first.
          paddingTop: `${80 * scale}px`,
        }}
      >
        {imageOnRight ? (
          <>{portraitLabelSection}{portraitImageSection}{portraitTextSection}</>
        ) : (
          <>{portraitImageSection}{portraitTextSection}</>
        )}

        {/* Fixed footer -- Listening Credit only now; see the 'none'
            branch's identical comment above. */}
        {hasFooter && (
          <div style={{
            position: 'absolute',
            bottom: `${48 * scale}px`,
            left: `${80 * scale}px`,
            right: `${80 * scale}px`,
            display: 'flex',
            flexDirection: 'column',
            gap: `${6 * scale}px`,
          }}>
            {data.showListeningCredit && data.listeningCredit && (
              <div style={{
                fontSize: `${23 * scale}px`,
                lineHeight: listeningCreditLineHeight,
                fontFamily: THEINHARDT,
                fontWeight: 400,
                color: data.listeningCreditColor ?? data.textColor,
                opacity: 0.65,
              }}>
                {data.listeningCredit}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }
)

SlideCanvas.displayName = 'SlideCanvas'
export default SlideCanvas