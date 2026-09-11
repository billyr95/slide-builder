import { NextRequest, NextResponse } from 'next/server'
import { renderSlideToJpeg } from '@/lib/renderSlide'
import { SlideData } from '@/lib/types'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const { orientation, data }: { orientation: 'landscape' | 'portrait'; data: SlideData } = await req.json()

  const jpegBuffer = await renderSlideToJpeg(data, orientation)

  return new NextResponse(new Uint8Array(jpegBuffer), {
    headers: {
      'Content-Type': 'image/jpeg',
      'Content-Disposition': `attachment; filename="slide.jpg"`,
    },
  })
}
