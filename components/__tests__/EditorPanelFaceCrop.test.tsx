import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import EditorPanel from '@/components/EditorPanel'
import { DEFAULT_SLIDE_DATA } from '@/lib/defaults'
import { SlideData } from '@/lib/types'

// The underlying face-api model/detection math is verified separately
// against real photos in a real browser (see the manual Puppeteer
// verification for this feature) -- jsdom can't run tfjs/WebGL at all, so
// these tests mock lib/faceDetect and lib/cropImage (both dynamically
// imported by EditorPanel specifically to keep them out of any
// server-evaluated bundle -- see EditorPanel.tsx's own comment on why) and
// focus on what jsdom CAN verify for real: the React wiring around them --
// which branch runs, and whether the suggested/final/wasOverridden fields
// end up correct.

const FAKE_CROP_BOX = { top: 0.1, bottom: 0.2, left: 0.15, right: 0.15 }

vi.mock('@/lib/faceDetect', () => ({
  detectFaceCropBox: vi.fn(),
}))
vi.mock('@/lib/cropImage', () => ({
  cropImageByRatioBox: vi.fn(async (url: string) => `cropped:${url}`),
}))
const MANUAL_CROP_BOX = { top: 0.3, bottom: 0.3, left: 0.3, right: 0.3 }

vi.mock('@/components/CropModal', () => ({
  default: ({ onCancel, onComplete }: { onCancel: () => void; onComplete: (url: string, box: typeof MANUAL_CROP_BOX) => void }) => (
    <div data-testid="crop-modal">
      <button onClick={onCancel}>cancel</button>
      <button onClick={() => onComplete('manually-cropped-url', MANUAL_CROP_BOX)}>apply</button>
    </div>
  ),
}))

import { detectFaceCropBox } from '@/lib/faceDetect'

function renderPanel(overrides: Partial<SlideData> = {}) {
  const data: SlideData = { ...DEFAULT_SLIDE_DATA, imageMode: 'single', ...overrides }
  const onChange = vi.fn()
  // Which tab shows is a controlled prop now (the icon rail that sets it
  // lives in page.tsx, outside this component) -- render straight onto the
  // Image tab rather than clicking a rail button that isn't part of this
  // component anymore.
  const utils = render(<EditorPanel data={data} onChange={onChange} screenType="projector" slideRevision={0} orientation="landscape" onOrientationChange={vi.fn()} activeSection="image" onActiveSectionChange={vi.fn()} />)
  return { onChange, ...utils }
}

function uploadFile(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  const file = new File(['fake-image-bytes'], 'photo.png', { type: 'image/png' })
  fireEvent.change(input, { target: { files: [file] } })
}

beforeEach(() => {
  vi.mocked(detectFaceCropBox).mockReset()
})

describe('EditorPanel image upload -- face detection integration', () => {
  it('auto-crops immediately (no modal) when a face is detected, and records suggested=final, wasOverridden=false', async () => {
    vi.mocked(detectFaceCropBox).mockResolvedValue({ cropBox: FAKE_CROP_BOX, faceCount: 1 })
    const { onChange, container } = renderPanel()

    uploadFile(container)

    await waitFor(() => expect(onChange).toHaveBeenCalled())
    const patch = onChange.mock.calls[0][0]
    expect(patch.imageUrl).toMatch(/^cropped:/)
    expect(patch.imageFaceCropSuggested).toEqual(FAKE_CROP_BOX)
    expect(patch.imageFaceCropFinal).toEqual(FAKE_CROP_BOX)
    expect(patch.imageFaceCropWasOverridden).toBe(false)
    expect(screen.queryByTestId('crop-modal')).not.toBeInTheDocument()
  })

  it('opens the crop modal (no auto-crop) when no face is detected', async () => {
    vi.mocked(detectFaceCropBox).mockResolvedValue(null)
    const { onChange, container } = renderPanel()

    uploadFile(container)

    await waitFor(() => expect(screen.getByTestId('crop-modal')).toBeInTheDocument())
    expect(onChange).not.toHaveBeenCalled()
  })

  it('opens the crop modal when detection itself throws, same as no-face-found', async () => {
    vi.mocked(detectFaceCropBox).mockRejectedValue(new Error('model failed to load'))
    const { container } = renderPanel()

    uploadFile(container)

    await waitFor(() => expect(screen.getByTestId('crop-modal')).toBeInTheDocument())
  })

  it('flags wasOverridden=true when the user manually re-crops an already auto-cropped image', async () => {
    const { onChange } = renderPanel({
      imageUrl: 'data:image/png;base64,AAA',
      imageFaceCropSuggested: FAKE_CROP_BOX,
      imageFaceCropFinal: FAKE_CROP_BOX,
      imageFaceCropWasOverridden: false,
    })

    fireEvent.click(screen.getByText('Edit crop'))
    await waitFor(() => expect(screen.getByTestId('crop-modal')).toBeInTheDocument())
    fireEvent.click(screen.getByText('apply'))

    await waitFor(() => expect(onChange).toHaveBeenCalled())
    const patch = onChange.mock.calls[0][0]
    expect(patch.imageUrl).toBe('manually-cropped-url')
    expect(patch.imageFaceCropFinal).toEqual(MANUAL_CROP_BOX)
    expect(patch.imageFaceCropWasOverridden).toBe(true)
    // The original suggestion is left untouched -- it's the fixed baseline
    // wasOverridden compares against, not something later crops should move.
    expect(patch.imageFaceCropSuggested).toEqual(FAKE_CROP_BOX)
  })

  it('leaves wasOverridden unset when manually cropping an image that was never auto-cropped (no face was ever detected)', async () => {
    const { onChange } = renderPanel({ imageUrl: 'data:image/png;base64,AAA' })

    fireEvent.click(screen.getByText('Edit crop'))
    await waitFor(() => expect(screen.getByTestId('crop-modal')).toBeInTheDocument())
    fireEvent.click(screen.getByText('apply'))

    await waitFor(() => expect(onChange).toHaveBeenCalled())
    const patch = onChange.mock.calls[0][0]
    expect(patch.imageFaceCropWasOverridden).toBeUndefined()
  })
})
