'use client'

// Shared by EditorPanel.tsx (the main editor) and NewSlideModal.tsx (the
// "+ New" content-entry flow) -- the one place that owns the "Edit HTML"
// link + raw-markup modal for a text field's rare per-run
// italic/bold override (see lib/types.ts's *RichText comment and
// lib/richText.ts's sanitizer). Deliberately tucked away rather than a
// normal visible control: a plain, tiny, low-contrast text link rather
// than a button with an icon keeps it from reading as a first-class option
// sitting next to Color/Size/etc., since this is a last-resort escape
// hatch most slides should never need. Hidden entirely when the field is
// empty -- nothing to mark up yet.
import { useEffect, useRef, useState } from 'react'
import { fieldHtmlForEditing, processFieldHtml, sanitizeFormattingHtml } from '@/lib/richText'

const ALLOWED_TAGS_HINT = 'Allowed tags: em, i, strong, b, br'

export default function EditHtmlLink({ fieldLabel, plainValue, richValue, allowBold, onApply }: {
  fieldLabel: string
  plainValue: string
  richValue: string | undefined
  // Whether <strong>/<b> are offered at all -- false for a field whose
  // current font has no bold face (92NY Text), same rule the weight
  // picker already uses elsewhere in this app.
  allowBold: boolean
  onApply: (plain: string, rich: string | undefined) => void
}) {
  const [open, setOpen] = useState(false)
  const linkRef = useRef<HTMLButtonElement>(null)

  if (!plainValue.trim()) return null

  function close() {
    setOpen(false)
    // Focus returns to the link that opened the modal.
    linkRef.current?.focus()
  }

  return (
    <>
      <button
        ref={linkRef}
        type="button"
        aria-label={`Edit HTML for ${fieldLabel}`}
        onClick={() => setOpen(true)}
        className="mt-1 block text-[11px] text-zinc-500 hover:text-zinc-300 underline decoration-dotted underline-offset-2 transition-colors"
      >
        Edit HTML
      </button>
      {open && (
        <EditHtmlModal
          fieldLabel={fieldLabel}
          plainValue={plainValue}
          richValue={richValue}
          allowBold={allowBold}
          onCancel={close}
          onSave={(plain, rich) => { onApply(plain, rich); close() }}
        />
      )}
    </>
  )
}

function EditHtmlModal({ fieldLabel, plainValue, richValue, allowBold, onCancel, onSave }: {
  fieldLabel: string
  plainValue: string
  richValue: string | undefined
  allowBold: boolean
  onCancel: () => void
  onSave: (plain: string, rich: string | undefined) => void
}) {
  const [text, setText] = useState(() => fieldHtmlForEditing(plainValue, richValue))
  const [note, setNote] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    el?.focus()
    el?.setSelectionRange(el.value.length, el.value.length)
  }, [])

  function attemptSave() {
    const { plainText, richHtml, stripped } = processFieldHtml(text, allowBold)
    if (stripped && !note) {
      // Show what was removed before actually closing, rather than
      // silently discarding part of what the user typed -- a second Save
      // (now a no-op strip, since the textarea already reflects the
      // cleaned-up result) commits it.
      setText(sanitizeFormattingHtml(text, allowBold).html)
      setNote(allowBold ? 'Removed unsupported tags.' : "Removed unsupported tags (this field's font doesn't support bold).")
      return
    }
    onSave(plainText, richHtml)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      attemptSave()
    }
  }

  const preview = sanitizeFormattingHtml(text, allowBold).html

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onKeyDown={handleKeyDown}
      onMouseDown={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="bg-zinc-900 rounded-2xl border border-zinc-700 shadow-2xl w-full max-w-md p-5 flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-white">Edit HTML: {fieldLabel}</h3>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => { setText(e.target.value); setNote(null) }}
          spellCheck={false}
          className="min-h-[90px] max-h-[220px] overflow-auto bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-zinc-500 resize-y"
        />

        <p className="text-[11px] text-zinc-500">{ALLOWED_TAGS_HINT}{!allowBold ? ' (bold unavailable for this field\'s font)' : ''}</p>

        <div>
          <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-1">Preview</p>
          <div
            data-testid="edit-html-preview"
            className="text-sm text-zinc-200 whitespace-pre-line border border-zinc-800 rounded-lg px-3 py-2 bg-zinc-950/50 min-h-[2.5em]"
            dangerouslySetInnerHTML={{ __html: preview }}
          />
        </div>

        {note && <p className="text-xs text-amber-400">{note}</p>}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-zinc-400 hover:text-white transition-colors py-1.5 px-3"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={attemptSave}
            className="text-xs font-medium bg-white text-black hover:bg-zinc-200 py-1.5 px-3 rounded-lg transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
