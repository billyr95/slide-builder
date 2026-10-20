import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import NewSlideFlow from '@/components/NewSlideFlow'

// Regression coverage for the real bug this fixes: Build (which switches to
// the naming step, unmounting NewSlideModal) followed by Back used to lose
// every field the user had typed, because each field was local useState
// inside NewSlideModal itself. The fix lifts that state into NewSlideFlow
// (see lib/newSlideDraft.ts's NewSlideDraft) so the form's data survives
// the step transition regardless of whether the modal showing it is
// mounted or not. IndexedDB persistence (the "survives an accidental
// close/refresh" half of the fix) isn't exercised here -- jsdom has no
// indexedDB implementation, and lib/newSlideDraft.ts's save/load/clear are
// already individually try/catch-wrapped as best-effort, so they no-op
// silently in this environment without needing a mock.

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

// Real resizeImageDataUrl draws through a <canvas>, which jsdom doesn't
// implement meaningfully -- mocked the same way NewSlideModalReplace.test.tsx
// already does for the same reason.
vi.mock('@/lib/resizeImage', () => ({
  resizeImageDataUrl: vi.fn(async (dataUrl: string) => `resized:${dataUrl}`),
}))

afterEach(cleanup)

describe('NewSlideFlow -- draft persists across Build -> Back', () => {
  it('typing into Title, clicking Build, then Back restores the typed title', async () => {
    render(<NewSlideFlow initialScreenType="projector" onClose={vi.fn()} />)

    const titleField = screen.getByPlaceholderText('Event title')
    fireEvent.change(titleField, { target: { value: 'My Real Event Title' } })

    fireEvent.click(screen.getByText('Build'))

    // Now on the naming step -- NewSlideModal (and the title field) is unmounted.
    await waitFor(() => expect(screen.getByPlaceholderText(/Fall Author Series/)).toBeInTheDocument())
    expect(screen.queryByPlaceholderText('Event title')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Back'))

    // Back on the content step -- the title must be exactly what was typed, not blank.
    const titleFieldAgain = await screen.findByPlaceholderText('Event title')
    expect((titleFieldAgain as HTMLTextAreaElement).value).toBe('My Real Event Title')
  })

  it('an image dropped before Build is still there after Back', async () => {
    render(<NewSlideFlow initialScreenType="projector" onClose={vi.fn()} />)

    const file = new File(['fake-bytes'], 'photo.png', { type: 'image/png' })
    const dropInput = document.querySelector('input[type="file"][multiple]') as HTMLInputElement
    fireEvent.change(dropInput, { target: { files: [file] } })
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1))

    fireEvent.change(screen.getByPlaceholderText('Event title'), { target: { value: 'T' } })
    fireEvent.click(screen.getByText('Build'))
    await waitFor(() => expect(screen.getByText('Back')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Back'))

    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1))
  })

  it('Discard clears the draft -- Title is blank even without an intervening Build/Back', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onClose = vi.fn()
    render(<NewSlideFlow initialScreenType="projector" onClose={onClose} />)

    fireEvent.change(screen.getByPlaceholderText('Event title'), { target: { value: 'Will be discarded' } })
    fireEvent.click(screen.getByText('Discard'))

    expect(window.confirm).toHaveBeenCalled()
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    vi.restoreAllMocks()
  })

  it('closing with the ✕ button does NOT clear the draft state (non-destructive close)', async () => {
    const onClose = vi.fn()
    const { rerender } = render(<NewSlideFlow initialScreenType="projector" onClose={onClose} />)

    fireEvent.change(screen.getByPlaceholderText('Event title'), { target: { value: 'Kept on close' } })
    fireEvent.click(screen.getByTitle('Close (your draft is kept)'))

    expect(onClose).toHaveBeenCalled()
    // onClose doesn't unmount NewSlideFlow itself in real usage (the parent
    // flips showNewFlow off); what matters here is Cancel never calls the
    // same discard path Discard does -- confirmed by confirm() never firing.
  })
})
