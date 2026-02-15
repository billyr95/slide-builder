'use client'

import React, { forwardRef } from 'react'
import { SlideData, Orientation } from '@/lib/types'

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

    const titleStyle = {
      fontFamily: NY92,
      fontStyle: data.titleItalic ? 'italic' : 'normal',
      fontKerning: 'normal' as const,
      fontFeatureSettings: '"kern" 1, "liga" 1',
      letterSpacing: '0',
      color: data.accentColor,
    }

    function bodyStyle(weight: TheinhardtWeight, sizePx: number) {
      const trackingEm = Math.max(-0.05, -20 / (sizePx * (1 / scale)))
      return {
        fontFamily: THEINHARDT,
        fontWeight: theinhardtWeight(weight),
        letterSpacing: `${trackingEm}em`,
        color: data.textColor,
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

    const hasFooter = data.showSeriesName || data.showListeningCredit
    const footerH = hasFooter ? (data.showSeriesName && data.showListeningCredit ? 120 : 80) : 0

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
          {/* Left: Image */}
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

          {/* Right: Text */}
          <div style={{
            width: '60%',
            height: '100%',
            padding: `${80 * scale}px ${100 * scale}px ${bottomPad * scale}px ${20 * scale}px`,
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

            <div style={{ fontSize: `${titleSize * scale}px`, fontWeight: 700, lineHeight: 0.88, whiteSpace: 'pre-line', ...titleStyle }}>
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
              <div style={{ fontSize: `${presenterSize * scale}px`, lineHeight: 0.95, whiteSpace: 'pre-line', ...bodyStyle(data.presentersWeight, presenterSize) }}>
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

        {/* Text block */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: `${60 * scale}px ${80 * scale}px`,
          gap: `${16 * scale}px`,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: `${titleSize * scale}px`, fontWeight: 700, lineHeight: 0.88, whiteSpace: 'pre-line', ...titleStyle }}>
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
            <div style={{ fontSize: `${presenterSize * scale}px`, lineHeight: 0.95, whiteSpace: 'pre-line', ...bodyStyle(data.presentersWeight, presenterSize) }}>
              {data.presenters}
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