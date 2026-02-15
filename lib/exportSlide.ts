import { Orientation } from '@/lib/types'

const DIMS = {
  landscape: { w: 1920, h: 1080 },
  portrait: { w: 1080, h: 1920 },
}

export async function exportSlideAsJpeg(
  canvasEl: HTMLElement,
  orientation: Orientation,
  filename: string
) {
  const html2canvas = (await import('html2canvas')).default
  const { w, h } = DIMS[orientation]

  const canvas = await html2canvas(canvasEl, {
    width: w,
    height: h,
    scale: 1,
    useCORS: true,
    allowTaint: true,
    backgroundColor: null,
    logging: false,
  })

  const dataUrl = canvas.toDataURL('image/jpeg', 0.95)
  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  link.click()
}
