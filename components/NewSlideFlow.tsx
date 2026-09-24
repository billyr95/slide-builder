'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import NewSlideModal, { BuildResult } from './NewSlideModal'
import NameSlideModal from './NameSlideModal'
import { buildNewSlideData } from '@/lib/buildNewSlideData'
import { DEFAULT_SLIDE_DATA } from '@/lib/defaults'
import { SlideData } from '@/lib/types'
import { ScreenType } from '@/lib/trainTypes'

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
export default function NewSlideFlow({ initialScreenType, onClose, folderId }: NewSlideFlowProps) {
  const router = useRouter()
  const [step, setStep] = useState<'content' | 'name'>('content')
  const [pendingData, setPendingData] = useState<SlideData | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleBuild(result: BuildResult) {
    setPendingData(buildNewSlideData(result))
    setStep('name')
  }

  function handleSkip() {
    setPendingData(DEFAULT_SLIDE_DATA)
    setStep('name')
  }

  async function handleNameConfirm(name: string) {
    if (!pendingData || creating) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: name, data: pendingData, folderId }),
      })
      if (!res.ok) throw new Error(`Create failed (${res.status})`)
      const created = await res.json()
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
        <NewSlideModal initialScreenType={initialScreenType} onBuild={handleBuild} onSkip={handleSkip} onCancel={onClose} />
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
