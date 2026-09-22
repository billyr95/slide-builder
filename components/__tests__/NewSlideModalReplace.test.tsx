import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NewSlideModal from '@/components/NewSlideModal'

// Covers the "Replace image" action added to each dropped-image slot --
// specifically that replacing swaps the slot's image IN PLACE (same
// position, same id-adjacent autoCropEnabled toggle state) rather than
// removing it and appending a new one at the end (which would both reorder
// the "assigned in the order added" slots and silently reset the toggle).

vi.mock('@/lib/resizeImage', () => ({
  resizeImageDataUrl: vi.fn(async (dataUrl: string) => `resized:${dataUrl}`),
}))

function makeFile(name: string) {
  return new File(['fake-bytes'], name, { type: 'image/png' })
}

describe('NewSlideModal image replace', () => {
  it('replacing the second of two images keeps it in slot 2 and preserves its autoCropEnabled toggle', async () => {
    render(<NewSlideModal initialScreenType="projector" onBuild={vi.fn()} onSkip={vi.fn()} onCancel={vi.fn()} />)

    const dropInput = document.querySelector('input[type="file"][multiple]') as HTMLInputElement
    fireEvent.change(dropInput, { target: { files: [makeFile('a.png'), makeFile('b.png')] } })

    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(2))

    // Turn off auto-crop on the second image specifically -- the auto-crop
    // checkboxes are the ones inside a label with "Auto-crop" text.
    const secondAutoCrop = screen.getAllByText('Auto-crop')[1].closest('label')!.querySelector('input[type="checkbox"]') as HTMLInputElement
    fireEvent.click(secondAutoCrop)
    expect(secondAutoCrop.checked).toBe(false)

    // Replace slot 2's image via its "Replace" overlay input (the second
    // single-file input on the page -- the first is the multi-file dropzone).
    const replaceInputs = document.querySelectorAll('input[type="file"]:not([multiple])')
    expect(replaceInputs.length).toBe(2)
    fireEvent.change(replaceInputs[1], { target: { files: [makeFile('replacement.png')] } })

    await waitFor(() => expect(screen.getAllByRole('img')[1].getAttribute('src')).toMatch(/^resized:/))

    // Still exactly 2 images (not 3 -- replace, not append), and the toggle
    // state for slot 2 survived the swap.
    expect(screen.getAllByRole('img')).toHaveLength(2)
    const secondAutoCropAfter = screen.getAllByText('Auto-crop')[1].closest('label')!.querySelector('input[type="checkbox"]') as HTMLInputElement
    expect(secondAutoCropAfter.checked).toBe(false)
  })
})
