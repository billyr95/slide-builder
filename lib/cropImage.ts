import { resizeImageDataUrl } from './resizeImage'
import { FaceCropBox } from './types'

// Matches CropModal's own MAX_CROPPED_DIM cap.
const MAX_CROPPED_DIM = 1600

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image for cropping'))
    img.src = url
  })
}

// Applies a {top,bottom,left,right} ratio crop box (the shape
// lib/faceDetect.ts computes, and the vision model already returns for
// uploads) directly to an image's full natural resolution. Deliberately
// separate from CropModal's own getCroppedImg, which works off an on-screen
// react-image-crop selection in CSS pixels instead -- sharing that code path
// would risk regressing its recently-fixed natural-resolution scaling for a
// case it was never written to handle.
export async function cropImageByRatioBox(imageUrl: string, box: FaceCropBox): Promise<string> {
  const img = await loadImage(imageUrl)
  const w = img.naturalWidth
  const h = img.naturalHeight

  const left = box.left * w
  const top = box.top * h
  const cropW = Math.max(1, w - left - box.right * w)
  const cropH = Math.max(1, h - top - box.bottom * h)

  const canvas = document.createElement('canvas')
  canvas.width = cropW
  canvas.height = cropH
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, left, top, cropW, cropH, 0, 0, cropW, cropH)

  return resizeImageDataUrl(canvas.toDataURL('image/png'), MAX_CROPPED_DIM)
}
