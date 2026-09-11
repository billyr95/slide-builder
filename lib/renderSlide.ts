import fs from 'fs'
import path from 'path'
import React from 'react'
import SlideCanvas from '@/components/SlideCanvas'
import { Orientation, SlideData } from '@/lib/types'

const DIMS: Record<Orientation, { w: number; h: number }> = {
  landscape: { w: 1920, h: 1080 },
  portrait: { w: 1080, h: 1920 },
}

const FONT_FILES: { family: string; file: string; weight: string; style: string }[] = [
  { family: '92NY', file: '92NY_Variable.woff2', weight: '100 900', style: 'normal' },
  { family: 'Theinhardt', file: 'Theinhardt-Pan-Regular.woff2', weight: '400', style: 'normal' },
  { family: 'Theinhardt', file: 'Theinhardt-Pan-Italic.woff2', weight: '400', style: 'italic' },
  { family: 'Theinhardt', file: 'Theinhardt-Pan-Bold.woff2', weight: '700', style: 'normal' },
  { family: 'Theinhardt', file: 'Theinhardt-Pan-Bold-Italic.woff2', weight: '700', style: 'italic' },
  { family: 'Theinhardt', file: 'Theinhardt-Pan-Heavy.woff2', weight: '900', style: 'normal' },
]

let cachedFontCss: string | null = null

// Fonts are embedded as base64 data URIs (rather than linked by URL) so the
// export renders identically regardless of host/origin and needs no network
// round-trip back into the same server process.
function getFontCss(): string {
  if (cachedFontCss) return cachedFontCss
  const fontsDir = path.join(process.cwd(), 'public', 'fonts')
  cachedFontCss = FONT_FILES.map(({ family, file, weight, style }) => {
    const b64 = fs.readFileSync(path.join(fontsDir, file)).toString('base64')
    return `@font-face {
      font-family: '${family}';
      src: url(data:font/woff2;base64,${b64}) format('woff2');
      font-weight: ${weight};
      font-style: ${style};
      font-display: block;
    }`
  }).join('\n')
  return cachedFontCss
}

async function buildHtml(data: SlideData, orientation: Orientation): Promise<string> {
  const { w, h } = DIMS[orientation]
  const { renderToStaticMarkup } = await import('react-dom/server')
  const markup = renderToStaticMarkup(React.createElement(SlideCanvas, { data, orientation, scale: 1 }))
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  ${getFontCss()}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${w}px; height: ${h}px; overflow: hidden; background: #000; }
</style>
</head>
<body>${markup}</body>
</html>`
}

async function launchBrowser() {
  if (process.env.VERCEL) {
    const chromium = (await import('@sparticuz/chromium')).default
    const puppeteer = await import('puppeteer-core')
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  }
  // Local dev: use the full `puppeteer` package's bundled Chrome install.
  const puppeteer = (await import('puppeteer')).default
  return puppeteer.launch({ headless: true })
}

export async function renderSlideToPng(data: SlideData, orientation: Orientation): Promise<Buffer> {
  const { w, h } = DIMS[orientation]
  const html = await buildHtml(data, orientation)

  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 })
    await page.setContent(html, { waitUntil: 'load' })
    await page.evaluate(() => (document as any).fonts?.ready ?? Promise.resolve())
    await page.waitForFunction(() => Array.from(document.images).every(img => img.complete))
    const buffer = await page.screenshot({ type: 'png' })
    return buffer as Buffer
  } finally {
    await browser.close()
  }
}
