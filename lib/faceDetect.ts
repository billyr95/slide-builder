'use client'

import * as faceapi from '@vladmandic/face-api'
import { FaceCropBox } from './types'

// Served from /public so this runs entirely client-side with no external
// request and no API cost -- see public/models/README (if present) for how
// these were obtained (copied from @vladmandic/face-api's own package).
const MODEL_URL = '/models'

// Loaded once, lazily, on first call rather than at app init -- the model is
// tiny (~200KB) so there's no real benefit to eagerly loading it before it's
// needed, and this avoids spending that cost on sessions that never upload
// an image at all.
let modelLoadPromise: Promise<void> | null = null

function ensureModelLoaded(): Promise<void> {
  if (!modelLoadPromise) {
    modelLoadPromise = faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
  }
  return modelLoadPromise
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image for face detection'))
    img.src = url
  })
}

// Padding multipliers for standard headshot framing, as fractions of the
// detected face box's own width/height. Set to the midpoint of the ranges
// this feature was spec'd with (0.6-0.8x horizontal, 0.3-0.5x headroom,
// 1.2-1.5x chin/shoulders), then checked by eye against a handful of real
// headshots (close-up, half-body, off-center, and a near-edge case to
// confirm clamping) -- all five produced sensible crops with these values,
// so no further adjustment from the spec'd midpoints was needed. Not fitted
// from real correction data yet: that's exactly what
// faceCropSuggested/faceCropFinal/faceCropWasOverridden are for, once
// there's enough of it to be worth refitting these from.
const HORIZONTAL_PAD = 0.7
const HEADROOM_PAD = 0.4
const CHIN_PAD = 1.35

// TinyFaceDetectorOptions' own default (416) turned out to be a real bug for
// this use case, not just an unneeded tuning knob: verified against a real
// 128x128 headshot photo, inputSize 416 (and 512) missed the face entirely
// (0 detections) or only found it at a near-worthless confidence once the
// threshold was loosened to 0.1, while 320 detected it (and every other test
// photo, 128x128 through synthetic 400-700px composites) at 0.64-1.00
// confidence. Smaller inputSize means less upscaling of a small source image
// before inference, which is exactly the resolution range real uploaded
// headshots (old scanned slides especially) will often fall into.
const DETECTOR_INPUT_SIZE = 320

export interface FaceDetectionResult {
  cropBox: FaceCropBox
  faceCount: number
}

// Detects the largest face in an image and returns a suggested headshot
// crop box, or null if no face was found (book covers, posters, graphics --
// same as today's no-auto-crop behavior for those). Multiple faces: the
// largest one wins, as a simple proxy for "the subject of this headshot"
// without a second pass to judge centrality.
export async function detectFaceCropBox(imageUrl: string): Promise<FaceDetectionResult | null> {
  await ensureModelLoaded()
  const img = await loadImageElement(imageUrl)
  let detections: faceapi.FaceDetection[]
  try {
    detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: DETECTOR_INPUT_SIZE }))
  } catch (e) {
    console.warn('Face detection failed, skipping auto-crop', e)
    return null
  }
  if (detections.length === 0) return null

  const face = detections.reduce((largest, next) => (next.box.area > largest.box.area ? next : largest))
  const { box } = face
  const w = img.naturalWidth
  const h = img.naturalHeight
  if (w === 0 || h === 0) return null

  // Desired crop rectangle in original-image pixel coordinates, clamped to
  // the image's actual bounds so a face near an edge doesn't crop outside it.
  const cropLeftPx = Math.max(0, box.x - box.width * HORIZONTAL_PAD)
  const cropRightPx = Math.min(w, box.x + box.width + box.width * HORIZONTAL_PAD)
  const cropTopPx = Math.max(0, box.y - box.height * HEADROOM_PAD)
  const cropBottomPx = Math.min(h, box.y + box.height + box.height * CHIN_PAD)

  return {
    faceCount: detections.length,
    cropBox: {
      left: cropLeftPx / w,
      right: (w - cropRightPx) / w,
      top: cropTopPx / h,
      bottom: (h - cropBottomPx) / h,
    },
  }
}
