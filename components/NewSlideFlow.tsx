'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import NewSlideModal, { BuildResult } from './NewSlideModal'
import NameSlideModal from './NameSlideModal'
import { buildNewSlideData } from '@/lib/buildNewSlideData'
import { DEFAULT_SLIDE_DATA } from '@/lib/defaults'
import { SlideData } from '@/lib/types'
import { ScreenType } from '@/lib/trainTypes'
import { NewSlideDraft, blankDraft, draftHasContent, loadDraft, saveDraft, clearDraft } from '@/lib/newSlideDraft'

interface NewSlideFlowProps {
  initialScreenType: ScreenType
  onClose: () => void
  // Which folder the new slide is created inside -- passed by the
  // Dashboard as whatever folder is currently open. Omitted (the editor's
  // own "+ New" button, which has no folder-browsing context) falls back
  // server-side to the root "All Slides" folder.
  folderId?: string
}

// Two steps, shared by the Dashboard's "+ New" and the editor's own: (1) the
// existing content/paste-and-build modal, (2) a required name -- no slide
// row is created until a real name is given, so autosave never has
// anything meaningless to attach to. Ends by navigating into the new
// slide's real editor URL.
//
// The content step's form state (`draft`) lives HERE, not inside
// NewSlideModal, specifically so clicking Build (which switches `step` to
// 'name', unmounting NewSlideModal) and then Back (remounting it) doesn't
// lose anything -- NewSlideModal just re-renders with the same draft it
// left off with. It's also persisted to IndexedDB on every change so an
// accidental close or page refresh restores it the next time this flow is
// opened; it's only ever cleared on a successful slide creation or an
// explicit Discard (see handleDiscard/handleNameConfirm below).
export default function NewSlideFlow({ initialScreenType, onClose, folderId }: NewSlideFlowProps) {
  const router = useRouter()
  const [step, setStep] = useState<'content' | 'name'>('content')
  const [draft, setDraft] = useState<NewSlideDraft>(() => blankDraft(initialScreenType))
  const [pendingData, setPendingData] = useState<SlideData | null>(null)
  const [pendingScreenType, setPendingScreenType] = useState<ScreenType>(initialScreenType)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Restore a draft left over from an accidental close/refresh, once, when
  // this flow is first opened. A race against the user's own early typing
  // is avoided by only overwriting draft if nothing's been typed yet.
  useEffect(() => {
    let cancelled = false
    loadDraft().then(saved => {
      if (cancelled || !saved) return
      setDraft(prev => (draftHasContent(prev) ? prev : saved))
    })
    return () => { cancelled = true }
  }, [])

  // Debounced save -- avoids a write on every keystroke while still
  // persisting quickly enough to survive most accidental closes.
  useEffect(() => {
    const t = setTimeout(() => { saveDraft(draft) }, 400)
    return () => clearTimeout(t)
  }, [draft])

  function patchDraft(patch: Partial<NewSlideDraft>) {
    setDraft(d => ({ ...d, ...patch }))
  }

  function handleBuild(result: BuildResult) {
    setPendingData(buildNewSlideData(result))
    setPendingScreenType(result.screenType)
    setStep('name')
  }

  function handleSkip() {
    setPendingData(DEFAULT_SLIDE_DATA)
    setPendingScreenType(draft.screenType)
    setStep('name')
  }

  // Discards the in-progress draft (confirming first if there's anything to
  // lose) and closes the flow entirely -- the one place short of a
  // successful creation that actually clears the draft/IndexedDB, per the
  // "reset only on creation or explicit Discard" rule.
  async function handleDiscard() {
    if (draftHasContent(draft) && !window.confirm('Discard this draft? Everything you\'ve entered will be lost.')) return
    setDraft(blankDraft(initialScreenType))
    await clearDraft()
    onClose()
  }

  async function handleNameConfirm(name: string) {
    if (!pendingData || creating) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: name, data: pendingData, screenType: pendingScreenType, folderId }),
      })
      if (!res.ok) throw new Error(`Create failed (${res.status})`)
      const created = await res.json()
      await clearDraft()
      router.push(`/editor/${created.id}`)
    } catch (e) {
      console.error(e)
      setError('Could not create the slide. Try again.')
      setCreating(false)
    }
  }

  return (
    <>
      {step === 'content' && (
        <NewSlideModal
          draft={draft}
          onDraftChange={patchDraft}
          onBuild={handleBuild}
          onSkip={handleSkip}
          onCancel={onClose}
          onDiscard={handleDiscard}
        />
      )}
      {step === 'name' && (
        <div>
          <NameSlideModal onConfirm={handleNameConfirm} onCancel={() => setStep('content')} />
          {creating && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
              <p className="text-sm text-white bg-black/70 px-4 py-2 rounded-full">Creating…</p>
            </div>
          )}
          {error && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-950 text-red-300 text-sm px-4 py-2 rounded-full z-[60]">
              {error}
            </div>
          )}
        </div>
      )}
    </>
  )
}
