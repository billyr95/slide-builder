'use client'

import { useEffect, useRef, useState } from 'react'
import SlideCanvas from './SlideCanvas'
import { SlideData, Orientation } from '@/lib/types'

const DIMS: Record<Orientation, { w: number; h: number }> = {
  landscape: { w: 1920, h: 1080 },
  portrait: { w: 1080, h: 1920 },
}

// Renders the real slide (via the same SlideCanvas the editor uses) scaled
// down to fit whatever width its container ends up at -- measured with
// ResizeObserver rather than a fixed scale, since dashboard/admin cards are
// laid out in a responsive grid.
export default function SlideThumbnail({ data, orientation }: { data: SlideData; orientation: Orientation }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)
  const dims = DIMS[orientation]

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width
      if (width) setScale(width / dims.w)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [dims.w])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', aspectRatio: `${dims.w} / ${dims.h}`, overflow: 'hidden', position: 'relative', background: '#000' }}
    >
      {scale > 0 && (
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <SlideCanvas data={data} orientation={orientation} scale={1} />
        </div>
      )}
    </div>
  )
}
