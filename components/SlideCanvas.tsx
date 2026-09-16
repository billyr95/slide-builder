import React, { forwardRef } from 'react'
import { SlideData, Orientation, ImageMode, StaggerImage, staggerCount } from '@/lib/types'

interface SlideCanvasProps {
  data: SlideData
  orientation: Orientation
  scale?: number
}

type TheinhardtWeight = 'regular' | 'bold' | 'heavy'

const THEINHARDT = "'Theinhardt', sans-serif"
const NY92 = "'92NY', sans-serif"

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

    const titleFont = data.titleFont ?? '92NY'
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

    function bodyStyle(weight: TheinhardtWeight, sizePx: number) {
      const trackingEm = Math.max(-0.05, -20 / (sizePx * (1 / scale)))
      return {
        fontFamily: THEINHARDT,
        fontWeight: theinhardtWeight(weight),
        letterSpacing: `${trackingEm}em`,
        color: data.textColor,
        overflowWrap: 'break-word' as const,
        wordBreak: 'break-word' as const,
      }
    }

    // Shared by presenters and programTitle -- both are "body text that can
    // switch to 92NY" fields with their own independent font/weight/italic.
    function fontSwitchableStyle(font: 'Theinhardt' | '92NY', italic: boolean, weight: TheinhardtWeight, sizePx: number) {
      const fontStyle = italic ? 'italic' : 'normal'
      if (font === '92NY') {
        return {
          fontFamily: NY92,
          fontWeight: theinhardtWeight(weight),
          fontStyle,
          fontKerning: 'normal' as const,
          fontFeatureSettings: '"kern" 1, "liga" 1',
          letterSpacing: '0',
          color: data.textColor,
          overflowWrap: 'break-word' as const,
          wordBreak: 'break-word' as const,
        }
      }
      return { ...bodyStyle(weight, sizePx), fontStyle }
    }

    function presentersStyle(weight: TheinhardtWeight, sizePx: number) {
      return fontSwitchableStyle(data.presentersFont ?? 'Theinhardt', data.presentersItalic, weight, sizePx)
    }

    function programTitleStyle(weight: TheinhardtWeight, sizePx: number) {
      return fontSwitchableStyle(data.programTitleFont ?? 'Theinhardt', data.programTitleItalic, weight, sizePx)
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
            textAlign: 'center',
            padding: `${80 * scale}px`,
          }}
        >
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: `${16 * scale}px`,
            maxWidth: maxTextW * scale,
          }}>
            {data.label && (
              <div style={{ fontSize: `${labelSize * scale}px`, lineHeight: 0.95, ...bodyStyle(data.labelWeight, labelSize) }}>
                {data.label}
              </div>
            )}

            <div style={{ fontSize: `${titleSize * scale}px`, fontWeight: titleWeight, lineHeight: 0.88, whiteSpace: 'pre-line', ...titleStyle }}>
              {data.title}
            </div>

            {data.subtitle && !data.subtitleInline && (
              <div style={{ fontSize: `${data.subtitleSize * scale}px`, lineHeight: 0.95, ...bodyStyle(data.subtitleWeight, data.subtitleSize) }}>
                {data.subtitle}
              </div>
            )}

            {data.subtitle2 && (
              <div style={{ fontSize: `${data.subtitle2Size * scale}px`, lineHeight: 0.95, ...bodyStyle(data.subtitle2Weight, data.subtitle2Size) }}>
                {data.subtitle2}
              </div>
            )}

            {data.presenters && (
              <div style={{ fontSize: `${presenterSize * scale}px`, lineHeight: 0.95, whiteSpace: 'pre-line', ...presentersStyle(data.presentersWeight, presenterSize) }}>
                {data.subtitleInline && data.subtitle
                  ? (() => {
                      const lines = data.presenters.split('\n')
                      return (
                        <>
                          <span style={{ fontSize: `${presenterSize * scale * 0.75}px`, ...bodyStyle(data.subtitleWeight, presenterSize * 0.75) }}>
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
              <div style={{ fontSize: `${data.programTitleSize * scale}px`, lineHeight: 0.95, whiteSpace: 'pre-line', ...programTitleStyle(data.programTitleWeight, data.programTitleSize) }}>
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
                  fontWeight: 700,
                  color: data.textColor,
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
                  color: data.textColor,
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
            flexDirection: 'row',
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
                  <div style={{ position: 'relative', width: groupW, height: groupH, flexShrink: 0 }}>
                    {images.map((img, i) => (
                      <div key={img?.id ?? i} style={{ position: 'absolute', top: tops[i], left: lefts[i], width: widths[i] }}>
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

          {/* Right: Text — flex:1 so it takes remaining space */}
          <div style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            padding: `${80 * scale}px ${80 * scale}px ${bottomPad * scale}px ${20 * scale}px`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: `${16 * scale}px`,
            position: 'relative',
          }}>

            {data.label && (
              <div style={{ fontSize: `${labelSize * scale}px`, lineHeight: 0.95, ...bodyStyle(data.labelWeight, labelSize) }}>
                {data.label}
              </div>
            )}

            <div style={{ fontSize: `${titleSize * scale}px`, fontWeight: titleWeight, lineHeight: 0.88, whiteSpace: 'pre-line', ...titleStyle }}>
              {data.title}
            </div>

            {data.subtitle && !data.subtitleInline && (
              <div style={{ fontSize: `${data.subtitleSize * scale}px`, lineHeight: 0.95, ...bodyStyle(data.subtitleWeight, data.subtitleSize) }}>
                {data.subtitle}
              </div>
            )}

            {data.subtitle2 && (
              <div style={{ fontSize: `${data.subtitle2Size * scale}px`, lineHeight: 0.95, ...bodyStyle(data.subtitle2Weight, data.subtitle2Size) }}>
                {data.subtitle2}
              </div>
            )}

            {data.presenters && (
              <div style={{ fontSize: `${presenterSize * scale}px`, lineHeight: 0.95, whiteSpace: 'pre-line', ...presentersStyle(data.presentersWeight, presenterSize) }}>
                {data.subtitleInline && data.subtitle
                  ? (() => {
                      const lines = data.presenters.split('\n')
                      return (
                        <>
                          <span style={{ fontSize: `${presenterSize * scale * 0.75}px`, ...bodyStyle(data.subtitleWeight, presenterSize * 0.75) }}>
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
              <div style={{ fontSize: `${data.programTitleSize * scale}px`, lineHeight: 0.95, whiteSpace: 'pre-line', ...programTitleStyle(data.programTitleWeight, data.programTitleSize) }}>
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
                left: `${20 * scale}px`,
                right: `${100 * scale}px`,
                display: 'flex',
                flexDirection: 'column',
                gap: `${6 * scale}px`,
              }}>
                {data.showSeriesName && data.seriesName && (
                  <div style={{
                    fontSize: `${38 * scale}px`,
                    lineHeight: 1,
                    fontFamily: THEINHARDT,
                    fontWeight: 700,
                    color: data.textColor,
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
                    color: data.textColor,
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
        }}
      >
        {/* Top label */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: `${80 * scale}px`,
          paddingBottom: `${40 * scale}px`,
        }}>
          {data.label && (
            <div style={{ fontSize: `${labelSize * scale}px`, lineHeight: 0.95, ...bodyStyle(data.labelWeight, labelSize) }}>
              {data.label}
            </div>
          )}
        </div>

        {/* Image */}
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
              }}>
                {images.map((img, i) => (
                  <div key={img?.id ?? i} style={{ position: 'absolute', top: tops[i], left: lefts[i], width: widths[i] }}>
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

        {/* Text block */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: `${60 * scale}px ${80 * scale}px`,
          gap: `${16 * scale}px`,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: `${titleSize * scale}px`, fontWeight: titleWeight, lineHeight: 0.88, whiteSpace: 'pre-line', ...titleStyle }}>
            {data.title}
          </div>

          {data.subtitle && !data.subtitleInline && (
            <div style={{ fontSize: `${data.subtitleSize * scale}px`, lineHeight: 0.95, ...bodyStyle(data.subtitleWeight, data.subtitleSize) }}>
              {data.subtitle}
            </div>
          )}

          {data.subtitle2 && (
            <div style={{ fontSize: `${data.subtitle2Size * scale}px`, lineHeight: 0.95, ...bodyStyle(data.subtitle2Weight, data.subtitle2Size) }}>
              {data.subtitle2}
            </div>
          )}

          {data.presenters && (
            <div style={{ fontSize: `${presenterSize * scale}px`, lineHeight: 0.95, whiteSpace: 'pre-line', ...presentersStyle(data.presentersWeight, presenterSize) }}>
              {data.subtitleInline && data.subtitle
                ? (() => {
                    const lines = data.presenters.split('\n')
                    return (
                      <>
                        <span style={{ fontSize: `${presenterSize * scale * 0.75}px`, ...bodyStyle(data.subtitleWeight, presenterSize * 0.75) }}>
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
            <div style={{ fontSize: `${data.programTitleSize * scale}px`, lineHeight: 0.95, whiteSpace: 'pre-line', ...programTitleStyle(data.programTitleWeight, data.programTitleSize) }}>
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
                fontWeight: 700,
                color: data.textColor,
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
                color: data.textColor,
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