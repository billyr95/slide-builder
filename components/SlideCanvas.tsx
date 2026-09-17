import React, { forwardRef } from 'react'
import { SlideData, Orientation, ImageMode, StaggerImage, staggerCount } from '@/lib/types'

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

    // Every text block in a layout's column sits in a flex column with a
    // fixed `gap` (below), so spacing between blocks is already independent
    // of how many lines any one block wraps to -- gap is measured between
    // box edges, not proportional to content height. The one exception the
    // spec calls out is the Title -> next-block transition, which should
    // read tighter than the rest. A fixed negative marginTop on whichever
    // block actually follows Title (subtitle, subtitle2, presenters, or
    // programTitle, in render order -- exactly one of these renders
    // immediately after Title for any given slide) shaves a constant amount
    // off that one gap without touching the others, and stays exact
    // regardless of Title's wrap count since margin doesn't scale with it.
    const TITLE_GAP_TIGHTEN = 8
    const elementAfterTitle: 'subtitle' | 'subtitle2' | 'presenters' | 'programTitle' | null =
      (data.subtitle && !data.subtitleInline) ? 'subtitle'
      : data.subtitle2 ? 'subtitle2'
      : data.presenters ? 'presenters'
      : data.programTitle ? 'programTitle'
      : null
    function titleGapAdjust(key: NonNullable<typeof elementAfterTitle>) {
      return elementAfterTitle === key ? { marginTop: `${-TITLE_GAP_TIGHTEN * scale}px` } : undefined
    }

    const titleFont = data.titleFont ?? '92NY Text'
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

    // 92NY Text renders tighter (0.88) than Theinhardt's body line-height
    // (0.95, used by label/subtitle/subtitle2, which have no font choice and
    // are always Theinhardt) -- matches Title, which is always 0.88 since
    // its own two font options (92NY Text / Theinhardt Heavy) both read
    // better tight.
    const presentersLineHeight = (data.presentersFont ?? 'Theinhardt') === '92NY Text' ? 0.88 : 0.95
    const programTitleLineHeight = (data.programTitleFont ?? 'Theinhardt') === '92NY Text' ? 0.88 : 0.95

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

    const hasFooter = data.showSeriesName || data.showListeningCredit
    const footerH = hasFooter ? (data.showSeriesName && data.showListeningCredit ? 120 : 80) : 0

    if (data.imageMode === 'none') {
      const labelSize = 48
      const titleSize = data.titleSize
      const presenterSize = data.presentersSize
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
            gap: `${16 * scale}px`,
            maxWidth: maxTextW * scale,
          }}>
            {data.label && (
              <div style={{ fontSize: `${labelSize * scale}px`, lineHeight: 0.95, ...bodyStyle(data.labelWeight, labelSize, data.labelColor ?? data.textColor) }}>
                {data.label}
              </div>
            )}

            <div style={{ fontSize: `${titleSize * scale}px`, fontWeight: titleWeight, lineHeight: 0.88, whiteSpace: 'pre-line', ...titleStyle }}>
              {data.title}
            </div>

            {data.subtitle && !data.subtitleInline && (
              <div style={{ fontSize: `${data.subtitleSize * scale}px`, lineHeight: 0.95, ...bodyStyle(data.subtitleWeight, data.subtitleSize, data.subtitleColor ?? data.textColor), ...titleGapAdjust('subtitle') }}>
                {data.subtitle}
              </div>
            )}

            {data.subtitle2 && (
              <div style={{ fontSize: `${data.subtitle2Size * scale}px`, lineHeight: 0.95, ...bodyStyle(data.subtitle2Weight, data.subtitle2Size, data.subtitle2Color ?? data.textColor), ...titleGapAdjust('subtitle2') }}>
                {data.subtitle2}
              </div>
            )}

            {data.presenters && (
              <div style={{ fontSize: `${presenterSize * scale}px`, lineHeight: presentersLineHeight, whiteSpace: 'pre-line', ...presentersStyle(data.presentersWeight, presenterSize), ...titleGapAdjust('presenters') }}>
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
            )}

            {data.programTitle && (
              <div style={{ fontSize: `${data.programTitleSize * scale}px`, lineHeight: programTitleLineHeight, whiteSpace: 'pre-line', ...programTitleStyle(data.programTitleWeight, data.programTitleSize), ...titleGapAdjust('programTitle') }}>
                {data.programTitle}
              </div>
            )}

            {/* Logo bar */}
            {data.logos && data.logos.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: `${32 * scale}px`, marginTop: `${8 * scale}px`, flexWrap: 'wrap' }}>
                {data.logos.map(logo => (
                  <img key={logo.id} src={logo.url} alt={logo.alt}
                    style={{ height: `${(data.logoSize || 60) * scale}px`, maxWidth: `${300 * scale}px`, objectFit: 'contain' }} />
                ))}
              </div>
            )}
          </div>

          {/* Fixed footer */}
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
              {data.showSeriesName && data.seriesName && (
                <div style={{
                  fontSize: `${38 * scale}px`,
                  lineHeight: 1,
                  fontFamily: THEINHARDT,
                  fontWeight: theinhardtWeight('heavy'),
                  color: data.seriesNameColor ?? data.textColor,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}>
                  {data.seriesName}
                </div>
              )}
              {data.showListeningCredit && data.listeningCredit && (
                <div style={{
                  fontSize: `${23 * scale}px`,
                  lineHeight: 1.4,
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
      const labelSize = 48
      const titleSize = data.titleSize
      const presenterSize = data.presentersSize
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
            gap: `${16 * scale}px`,
            position: 'relative',
          }}>

            {data.label && (
              <div style={{ fontSize: `${labelSize * scale}px`, lineHeight: 0.95, ...bodyStyle(data.labelWeight, labelSize, data.labelColor ?? data.textColor) }}>
                {data.label}
              </div>
            )}

            <div style={{ fontSize: `${titleSize * scale}px`, fontWeight: titleWeight, lineHeight: 0.88, whiteSpace: 'pre-line', ...titleStyle }}>
              {data.title}
            </div>

            {data.subtitle && !data.subtitleInline && (
              <div style={{ fontSize: `${data.subtitleSize * scale}px`, lineHeight: 0.95, ...bodyStyle(data.subtitleWeight, data.subtitleSize, data.subtitleColor ?? data.textColor), ...titleGapAdjust('subtitle') }}>
                {data.subtitle}
              </div>
            )}

            {data.subtitle2 && (
              <div style={{ fontSize: `${data.subtitle2Size * scale}px`, lineHeight: 0.95, ...bodyStyle(data.subtitle2Weight, data.subtitle2Size, data.subtitle2Color ?? data.textColor), ...titleGapAdjust('subtitle2') }}>
                {data.subtitle2}
              </div>
            )}

            {data.presenters && (
              <div style={{ fontSize: `${presenterSize * scale}px`, lineHeight: presentersLineHeight, whiteSpace: 'pre-line', ...presentersStyle(data.presentersWeight, presenterSize), ...titleGapAdjust('presenters') }}>
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
            )}

            {data.programTitle && (
              <div style={{ fontSize: `${data.programTitleSize * scale}px`, lineHeight: programTitleLineHeight, whiteSpace: 'pre-line', ...programTitleStyle(data.programTitleWeight, data.programTitleSize), ...titleGapAdjust('programTitle') }}>
                {data.programTitle}
              </div>
            )}

            {/* Logo bar */}
            {data.logos && data.logos.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: `${32 * scale}px`, marginTop: `${8 * scale}px` }}>
                {data.logos.map(logo => (
                  <img key={logo.id} src={logo.url} alt={logo.alt}
                    style={{ height: `${(data.logoSize || 60) * scale}px`, maxWidth: `${300 * scale}px`, objectFit: 'contain' }} />
                ))}
              </div>
            )}

            {/* Fixed footer */}
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
                {data.showSeriesName && data.seriesName && (
                  <div style={{
                    fontSize: `${38 * scale}px`,
                    lineHeight: 1,
                    fontFamily: THEINHARDT,
                    fontWeight: theinhardtWeight('heavy'),
                    color: data.seriesNameColor ?? data.textColor,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}>
                    {data.seriesName}
                  </div>
                )}
                {data.showListeningCredit && data.listeningCredit && (
                  <div style={{
                    fontSize: `${23 * scale}px`,
                    lineHeight: 1.4,
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
    const labelSize = 48
    const titleSize = data.titleSize
    const presenterSize = data.presentersSize

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

    // Only when flipped -- leads the entire slide, above the image. When
    // not flipped, Label instead renders inline inside portraitTextSection
    // below (unchanged), since Image already comes first there.
    const portraitLabelSection = (imageOnRight && data.label) ? (
      <div key="label" style={{
        padding: `0 ${80 * scale}px ${40 * scale}px ${80 * scale}px`,
        textAlign,
      }}>
        <div style={{ fontSize: `${labelSize * scale}px`, lineHeight: 0.95, ...bodyStyle(data.labelWeight, labelSize, data.labelColor ?? data.textColor) }}>
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
        gap: `${16 * scale}px`,
        textAlign,
      }}>
        {!imageOnRight && data.label && (
          <div style={{ fontSize: `${labelSize * scale}px`, lineHeight: 0.95, ...bodyStyle(data.labelWeight, labelSize, data.labelColor ?? data.textColor) }}>
            {data.label}
          </div>
        )}

        <div style={{ fontSize: `${titleSize * scale}px`, fontWeight: titleWeight, lineHeight: 0.88, whiteSpace: 'pre-line', ...titleStyle }}>
          {data.title}
        </div>

        {data.subtitle && !data.subtitleInline && (
          <div style={{ fontSize: `${data.subtitleSize * scale}px`, lineHeight: 0.95, ...bodyStyle(data.subtitleWeight, data.subtitleSize, data.subtitleColor ?? data.textColor), ...titleGapAdjust('subtitle') }}>
            {data.subtitle}
          </div>
        )}

        {data.subtitle2 && (
          <div style={{ fontSize: `${data.subtitle2Size * scale}px`, lineHeight: 0.95, ...bodyStyle(data.subtitle2Weight, data.subtitle2Size, data.subtitle2Color ?? data.textColor), ...titleGapAdjust('subtitle2') }}>
            {data.subtitle2}
          </div>
        )}

        {data.presenters && (
          <div style={{ fontSize: `${presenterSize * scale}px`, lineHeight: presentersLineHeight, whiteSpace: 'pre-line', ...presentersStyle(data.presentersWeight, presenterSize), ...titleGapAdjust('presenters') }}>
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
        )}

        {data.programTitle && (
          <div style={{ fontSize: `${data.programTitleSize * scale}px`, lineHeight: programTitleLineHeight, whiteSpace: 'pre-line', ...programTitleStyle(data.programTitleWeight, data.programTitleSize), ...titleGapAdjust('programTitle') }}>
            {data.programTitle}
          </div>
        )}

        {/* Logo bar */}
        {data.logos && data.logos.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: `${32 * scale}px`, marginTop: `${8 * scale}px` }}>
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

        {/* Fixed footer */}
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
            {data.showSeriesName && data.seriesName && (
              <div style={{
                fontSize: `${38 * scale}px`,
                lineHeight: 1,
                fontFamily: THEINHARDT,
                fontWeight: theinhardtWeight('heavy'),
                color: data.seriesNameColor ?? data.textColor,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}>
                {data.seriesName}
              </div>
            )}
            {data.showListeningCredit && data.listeningCredit && (
              <div style={{
                fontSize: `${23 * scale}px`,
                lineHeight: 1.4,
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