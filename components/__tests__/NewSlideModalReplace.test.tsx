import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NewSlideModal from '@/components/NewSlideModal'

// Covers the "Replace image" action added to each dropped-image slot --
// specifically that replacing swaps the slot's image IN PLACE (same
// position, same id) rather than removing it and appending a new one at the
// end (which would reorder the "assigned in the order added" slots), and
// that it keeps whatever face-crop fields that slot already had rather than
// re-running detection -- same replace-image rule as the main editor.

vi.mock('@/lib/resizeImage', () => ({
  resizeImageDataUrl: vi.fn(async (dataUrl: string) => `resized:${dataUrl}`),
}))

const FAKE_CROP_BOX = { top: 0.1, bottom: 0.2, left: 0.15, right: 0.15 }
vi.mock('@/lib/faceDetect', () => ({
  detectFaceCropBox: vi.fn(async () => ({ cropBox: FAKE_CROP_BOX, faceCount: 1 })),
}))
vi.mock('@/lib/cropImage', () => ({
  cropImageByRatioBox: vi.fn(async (url: string) => `cropped:${url}`),
}))

function makeFile(name: string) {
  return new File(['fake-bytes'], name, { type: 'image/png' })
}

describe('NewSlideModal image replace', () => {
  it('replacing the second of two images keeps it in slot 2 and preserves its already-run face crop', async () => {
    const onBuild = vi.fn()
    render(<NewSlideModal initialScreenType="projector" onBuild={onBuild} onSkip={vi.fn()} onCancel={vi.fn()} />)

    const dropInput = document.querySelector('input[type="file"][multiple]') as HTMLInputElement
    fireEvent.change(dropInput, { target: { files: [makeFile('a.png'), makeFile('b.png')] } })

    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(2))

    // Run "Auto-crop face" on the second image specifically.
    const secondAutoCropButton = screen.getAllByText('Auto-crop face')[1]
    fireEvent.click(secondAutoCropButton)
    await waitFor(() => expect(screen.getAllByRole('img')[1].getAttribute('src')).toMatch(/^cropped:/))

    // Replace slot 2's image via its "Replace" overlay input (the second
    // single-file input on the page -- the first is the multi-file dropzone).
    const replaceInputs = document.querySelectorAll('input[type="file"]:not([multiple])')
    expect(replaceInputs.length).toBe(2)
    fireEvent.change(replaceInputs[1], { target: { files: [makeFile('replacement.png')] } })

    await waitFor(() => expect(screen.getAllByRole('img')[1].getAttribute('src')).toMatch(/^resized:/))

    // Still exactly 2 images (not 3 -- replace, not append).
    expect(screen.getAllByRole('img')).toHaveLength(2)

    fireEvent.change(screen.getByPlaceholderText('Event title'), { target: { value: 'Test Title' } })
    fireEvent.click(screen.getByText('Build'))

    await waitFor(() => expect(onBuild).toHaveBeenCalled())
    const built = onBuild.mock.calls[0][0]
    // Slot 2's crop fields survive the replace -- no re-detection ran on
    // the new photo, same replace-image rule as the main editor.
    expect(built.images[1].faceCropFinal).toEqual(FAKE_CROP_BOX)
    expect(built.images[1].faceCropWasOverridden).toBe(false)
    expect(built.images[1].url).toMatch(/^resized:/)
    // Slot 1 was never auto-cropped.
    expect(built.images[0].faceCropFinal).toBeUndefined()
  })
})
