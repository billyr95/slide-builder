import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import { SlideData, TheinhardtWeight } from '@/lib/types'

const DIMS = {
  landscape: { w: 1920, h: 1080 },
  portrait: { w: 1080, h: 1920 },
}

function tw(w: TheinhardtWeight): string {
  if (w === 'heavy') return '900'
  if (w === 'bold') return '700'
  return '400'
}

function wrapText(ctx: any, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  for (const rawLine of text.split('\n')) {
    const words = rawLine.split(' ')
    let current = ''
    for (const word of words) {
      const test = current ? current + ' ' + word : word
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current)
        current = word
      } else {
        current = test
      }
    }
    if (current) lines.push(current)
  }
  return lines
}

export async function POST(req: NextRequest) {
  const { createCanvas, GlobalFonts, Image } = await import('@napi-rs/canvas') as any

  const fontsDir = path.join(process.cwd(), 'public', 'fonts')
  GlobalFonts.registerFromPath(path.join(fontsDir, '92NY_Variable.woff2'), '92NY')
  GlobalFonts.registerFromPath(path.join(fontsDir, 'Theinhardt-Pan-Regular.woff2'), 'Theinhardt')
  GlobalFonts.registerFromPath(path.join(fontsDir, 'Theinhardt-Pan-Bold.woff2'), 'Theinhardt')
  GlobalFonts.registerFromPath(path.join(fontsDir, 'Theinhardt-Pan-Heavy.woff2'), 'Theinhardt')
  GlobalFonts.registerFromPath(path.join(fontsDir, 'Theinhardt-Pan-Italic.woff2'), 'Theinhardt')
  GlobalFonts.registerFromPath(path.join(fontsDir, 'Theinhardt-Pan-Bold-Italic.woff2'), 'Theinhardt')

  const body = await req.json()
  const { orientation, data }: { orientation: 'landscape' | 'portrait'; data: SlideData } = body

  const { w, h } = DIMS[orientation]
  const canvas = createCanvas(w, h)
  const ctx = canvas.getContext('2d')

  const PAD = 80
  const GAP = 16

  // Background
  ctx.fillStyle = data.backgroundColor
  ctx.fillRect(0, 0, w, h)

  // Helper to load image from base64 data URL
  async function loadImg(dataUrl: string) {
    const img = new Image()
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
    img.src = Buffer.from(base64, 'base64')
    await img.decode() // Required for napi-rs to actually render the image
    return img
  }

  if (orientation === 'landscape') {
    const imgColW = w * 0.4
    const textColX = imgColW + 20 + PAD
    const textColMaxW = w - textColX - PAD

    // Image
    if (data.imageUrl) {
      try {
        const img = await loadImg(data.imageUrl)
        const imgSizePct = (data.imageSize ?? 100) / 100
        const availW = (imgColW - PAD * 2) * imgSizePct
        const availH = (h - PAD * 2) * imgSizePct
        const scale = Math.min(availW / img.width, availH / img.height)
        const dw = img.width * scale
        const dh = img.height * scale
        const dx = (imgColW - dw) / 2
        const dy = (h - dh) / 2
        ctx.drawImage(img, dx, dy, dw, dh)
      } catch (e) { console.warn('Image error', e) }
    }

    const labelSize = 48
    const titleSize = data.titleSize
    const subSize = data.subtitleSize
    const sub2Size = data.subtitle2Size
    const pSize = data.presentersSize

    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'

    // Pre-measure title lines with correct font
    // 92NY variable: use weight 500 to match the visual weight seen in browser at 700
    // (variable fonts map differently in canvas vs browser)
    ctx.font = `normal 500 ${titleSize}px 92NY`
    const titleLines = data.title ? wrapText(ctx, data.title, textColMaxW) : []
    const presenterLines = data.presenters ? data.presenters.split('\n') : []

    // Calculate total block height for vertical centering
    let totalH = 0
    if (data.label) totalH += labelSize * 1.2 + GAP
    if (data.title) totalH += titleLines.length * (titleSize * 0.88) + GAP
    if (data.subtitle && !data.subtitleInline) totalH += subSize * 1.2 + GAP
    if (data.subtitle2) totalH += sub2Size * 1.2 + GAP
    if (data.presenters) totalH += presenterLines.length * (pSize * 0.95)

    let y = (h - totalH) / 2

    // Label
    if (data.label) {
      ctx.fillStyle = data.textColor
      ctx.font = `normal ${tw(data.labelWeight)} ${labelSize}px Theinhardt`
      ctx.fillText(data.label, textColX, y)
      y += labelSize * 1.2 + GAP
    }

    // Title — 92NY at weight 500 matches browser 700 visually for this variable font
    if (data.title) {
      ctx.fillStyle = data.accentColor
      ctx.font = `${data.titleItalic ? 'italic' : 'normal'} 500 ${titleSize}px 92NY`
      for (const line of titleLines) {
        ctx.fillText(line, textColX, y)
        y += titleSize * 0.88
      }
      y += GAP * 2
    }

    // Subtitle standalone
    if (data.subtitle && !data.subtitleInline) {
      ctx.fillStyle = data.textColor
      ctx.font = `normal ${tw(data.subtitleWeight)} ${subSize}px Theinhardt`
      ctx.fillText(data.subtitle, textColX, y)
      y += subSize * 1.2 + GAP
    }

    // Subtitle 2
    if (data.subtitle2) {
      ctx.fillStyle = data.textColor
      ctx.font = `normal ${tw(data.subtitle2Weight)} ${sub2Size}px Theinhardt`
      ctx.fillText(data.subtitle2, textColX, y)
      y += sub2Size * 1.2 + GAP
    }

    // Presenters
    if (data.presenters) {
      presenterLines.forEach((line: string, i: number) => {
        ctx.fillStyle = data.textColor
        if (i === 0 && data.subtitleInline && data.subtitle) {
          const inlineSubSize = pSize * 0.75
          ctx.font = `normal ${tw(data.subtitleWeight)} ${inlineSubSize}px Theinhardt`
          const subW = ctx.measureText(data.subtitle + ' ').width
          ctx.fillText(data.subtitle + ' ', textColX, y + (pSize - inlineSubSize))
          ctx.font = `normal ${tw(data.presentersWeight)} ${pSize}px Theinhardt`
          ctx.fillText(line, textColX + subW, y)
        } else {
          ctx.font = `normal ${tw(data.presentersWeight)} ${pSize}px Theinhardt`
          ctx.fillText(line, textColX, y)
        }
        y += pSize * 0.95
      })
    }

    // Logos
    if (data.logos && data.logos.length > 0) {
      y += GAP * 2
      const logoH = data.logoSize || 60
      let logoX = textColX
      for (const logo of data.logos) {
        try {
          const logoImg = await loadImg(logo.url)
          const scale = logoH / logoImg.height
          const logoW = logoImg.width * scale
          ctx.drawImage(logoImg, logoX, y, logoW, logoH)
          logoX += logoW + 32
        } catch (e) { console.warn('Logo error', e) }
      }
    }

    // Fixed footer — always at bottom
    // Calculate footer height to anchor it properly
    const seriesLineH = 52
    const creditLineH = 30
    const creditLines = (data.showListeningCredit && data.listeningCredit)
      ? (() => {
          ctx.font = `normal 400 23px Theinhardt`
          return wrapText(ctx, data.listeningCredit, w - textColX - PAD)
        })()
      : []
    const footerTotalH =
      (data.showSeriesName ? seriesLineH : 0) +
      (data.showListeningCredit ? creditLines.length * creditLineH : 0)
    let fy = h - 60 - footerTotalH

    if (data.showSeriesName && data.seriesName) {
      ctx.fillStyle = data.textColor
      ctx.globalAlpha = 1
      ctx.font = `normal 700 38px Theinhardt`
      ctx.textAlign = 'left'
      ctx.fillText(data.seriesName.toUpperCase(), textColX, fy)
      fy += seriesLineH
    }
    if (data.showListeningCredit && data.listeningCredit) {
      // Use a slightly transparent version of textColor instead of globalAlpha
      const hex = data.textColor.replace('#', '')
      const r = parseInt(hex.slice(0,2), 16)
      const g = parseInt(hex.slice(2,4), 16)
      const b = parseInt(hex.slice(4,6), 16)
      ctx.fillStyle = `rgba(${r},${g},${b},0.7)`
      ctx.globalAlpha = 1
      ctx.font = `normal 400 23px Theinhardt`
      ctx.textAlign = 'left'
      for (const line of creditLines) {
        ctx.fillText(line, textColX, fy)
        fy += creditLineH
      }
      ctx.fillStyle = data.textColor
    }

  } else {
    // Portrait
    const textMaxW = w - PAD * 2
    const labelSize = 48
    const titleSize = data.titleSize
    const pSize = data.presentersSize

    ctx.textBaseline = 'top'
    ctx.textAlign = 'center'

    if (data.imageUrl) {
      try {
        const img = await loadImg(data.imageUrl)
        const imgSizePct = (data.imageSize ?? 100) / 100
        const availW = w * 0.66 * imgSizePct
        const availH = h * 0.5 * imgSizePct
        const scale = Math.min(availW / img.width, availH / img.height)
        const dw = img.width * scale
        const dh = img.height * scale
        const dx = (w - dw) / 2
        const dy = PAD + 80
        ctx.drawImage(img, dx, dy, dw, dh)
      } catch (e) { console.warn('Image error', e) }
    }

    if (data.label) {
      ctx.fillStyle = data.textColor
      ctx.font = `normal ${tw(data.labelWeight)} ${labelSize}px Theinhardt`
      ctx.fillText(data.label, w / 2, PAD)
    }

    const imgBottom = data.imageUrl ? PAD + 80 + h * 0.45 + 20 : PAD + labelSize + GAP * 2
    let y = imgBottom

    if (data.title) {
      ctx.fillStyle = data.accentColor
      ctx.font = `${data.titleItalic ? 'italic' : 'normal'} 500 ${titleSize}px 92NY`
      const titleLines = wrapText(ctx, data.title, textMaxW)
      for (const line of titleLines) {
        ctx.fillText(line, w / 2, y)
        y += titleSize * 0.88
      }
      y += GAP
    }

    if (data.subtitle && !data.subtitleInline) {
      ctx.fillStyle = data.textColor
      ctx.font = `normal ${tw(data.subtitleWeight)} ${data.subtitleSize}px Theinhardt`
      ctx.fillText(data.subtitle, w / 2, y)
      y += data.subtitleSize * 1.2 + GAP
    }

    if (data.subtitle2) {
      ctx.fillStyle = data.textColor
      ctx.font = `normal ${tw(data.subtitle2Weight)} ${data.subtitle2Size}px Theinhardt`
      ctx.fillText(data.subtitle2, w / 2, y)
      y += data.subtitle2Size * 1.2 + GAP
    }

    if (data.presenters) {
      data.presenters.split('\n').forEach((line: string) => {
        ctx.fillStyle = data.textColor
        ctx.font = `normal ${tw(data.presentersWeight)} ${pSize}px Theinhardt`
        ctx.fillText(line, w / 2, y)
        y += pSize * 0.95
      })
    }
  }

  const jpegBuffer = await canvas.encode('jpeg', 95)
  return new NextResponse(jpegBuffer, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Content-Disposition': `attachment; filename="slide.jpg"`,
    },
  })
}