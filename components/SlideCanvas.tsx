'use client'

import { SlideData, Orientation } from '@/lib/types'
import { forwardRef } from 'react'

interface SlideCanvasProps {
  data: SlideData
  orientation: Orientation
  scale?: number
}

// Native dimensions
const LANDSCAPE = { w: 1920, h: 1080 }
const PORTRAIT = { w: 1080, h: 1920 }

const SlideCanvas = forwardRef<HTMLDivElement, SlideCanvasProps>(
  ({ data, orientation, scale = 1 }, ref) => {
    const dim = orientation === 'landscape' ? LANDSCAPE : PORTRAIT
    const fontClass = data.fontFamily === 'serif' ? 'font-serif-slide' : 'font-sans-slide'

    const titleStyle = {
      fontStyle: data.titleItalic ? 'italic' : 'normal',
      color: data.accentColor,
      fontFamily: data.fontFamily === 'serif' ? "'Playfair Display', Georgia, serif" : "'DM Sans', system-ui, sans-serif",
    }

    const bodyStyle = {
      fontFamily: data.fontFamily === 'serif' ? "'Playfair Display', Georgia, serif" : "'DM Sans', system-ui, sans-serif",
    }

    if (orientation === 'landscape') {
      return (
        <div
          ref={ref}
          id="slide-canvas"
          className={fontClass}
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
            {data.imageUrl ? (
              <img
                src={data.imageUrl}
                alt={data.imageAlt}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            ) : (
              <div style={{
                width: `${400 * scale}px`,
                height: `${400 * scale}px`,
                border: `${3 * scale}px dashed`,
                borderColor: data.textColor,
                opacity: 0.2,
                borderRadius: `${8 * scale}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: `${18 * scale}px`,
                color: data.textColor,
              }}>
                Image
              </div>
            )}
          </div>

          {/* Right: Text */}
          <div style={{
            width: '60%',
            padding: `${80 * scale}px ${100 * scale}px ${80 * scale}px ${20 * scale}px`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: `${12 * scale}px`,
            ...bodyStyle,
          }}>
            {/* Label */}
            {data.label && (
              <div style={{
                fontSize: `${36 * scale}px`,
                fontWeight: 500,
                letterSpacing: `${4 * scale}px`,
                color: data.textColor,
                marginBottom: `${8 * scale}px`,
                ...bodyStyle,
              }}>
                {data.label}
              </div>
            )}

            {/* Title */}
            <div style={{
              fontSize: `${72 * scale}px`,
              fontWeight: 700,
              lineHeight: 1.1,
              ...titleStyle,
            }}>
              {data.title}
            </div>

            {/* Subtitle */}
            {data.subtitle && (
              <div style={{
                fontSize: `${48 * scale}px`,
                fontWeight: 400,
                marginTop: `${8 * scale}px`,
                color: data.textColor,
                ...bodyStyle,
              }}>
                {data.subtitle}
              </div>
            )}

            {/* Presenters */}
            {data.presenters && (
              <div style={{
                fontSize: `${56 * scale}px`,
                fontWeight: 700,
                lineHeight: 1.2,
                color: data.textColor,
                whiteSpace: 'pre-line',
                ...bodyStyle,
              }}>
                {data.presenters}
              </div>
            )}
          </div>
        </div>
      )
    }

    // Portrait
    return (
      <div
        ref={ref}
        id="slide-canvas"
        className={fontClass}
        style={{
          width: dim.w * scale,
          height: dim.h * scale,
          backgroundColor: data.backgroundColor,
          color: data.textColor,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          overflow: 'hidden',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        {/* Top label */}
        {data.label && (
          <div style={{
            fontSize: `${52 * scale}px`,
            fontWeight: 500,
            letterSpacing: `${4 * scale}px`,
            paddingTop: `${80 * scale}px`,
            paddingBottom: `${40 * scale}px`,
            color: data.textColor,
            ...bodyStyle,
          }}>
            {data.label}
          </div>
        )}

        {/* Image */}
        <div style={{
          width: '66%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          {data.imageUrl ? (
            <img
              src={data.imageUrl}
              alt={data.imageAlt}
              style={{
                width: '100%',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          ) : (
            <div style={{
              width: `${600 * scale}px`,
              height: `${600 * scale}px`,
              border: `${3 * scale}px dashed`,
              borderColor: data.textColor,
              opacity: 0.2,
              borderRadius: `${8 * scale}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: `${22 * scale}px`,
              color: data.textColor,
            }}>
              Image
            </div>
          )}
        </div>

        {/* Bottom text block */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: `${60 * scale}px ${80 * scale}px`,
          gap: `${16 * scale}px`,
          ...bodyStyle,
        }}>
          {/* Title */}
          <div style={{
            fontSize: `${72 * scale}px`,
            fontWeight: 700,
            lineHeight: 1.1,
            ...titleStyle,
          }}>
            {data.title}
          </div>

          {/* Subtitle */}
          {data.subtitle && (
            <div style={{
              fontSize: `${52 * scale}px`,
              fontWeight: 400,
              color: data.textColor,
              marginTop: `${8 * scale}px`,
              ...bodyStyle,
            }}>
              {data.subtitle}
            </div>
          )}

          {/* Presenters */}
          {data.presenters && (
            <div style={{
              fontSize: `${60 * scale}px`,
              fontWeight: 700,
              lineHeight: 1.2,
              color: data.textColor,
              whiteSpace: 'pre-line',
              ...bodyStyle,
            }}>
              {data.presenters}
            </div>
          )}
        </div>
      </div>
    )
  }
)

SlideCanvas.displayName = 'SlideCanvas'
export default SlideCanvas