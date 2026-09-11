import { NextRequest, NextResponse } from 'next/server'
import { renderSlideToPng } from '@/lib/renderSlide'
import { SlideData } from '@/lib/types'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const { orientation, data }: { orientation: 'landscape' | 'portrait'; data: SlideData } = await req.json()

  const pngBuffer = await renderSlideToPng(data, orientation)

  return new NextResponse(new Uint8Array(pngBuffer), {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="slide.png"`,
    },
  })
}
