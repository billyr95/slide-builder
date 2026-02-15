import { Orientation, SlideData } from '@/lib/types'

export async function exportSlideAsJpeg(
  orientation: Orientation,
  data: SlideData,
  filename: string
) {
  const res = await fetch('/api/export-slide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orientation, data }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Export failed: ${err}`)
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = filename
  link.href = url
  link.click()
  URL.revokeObjectURL(url)
}