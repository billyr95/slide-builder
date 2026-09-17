'use client'

import { useEffect, useRef, useState } from 'react'
import { PALETTE } from '@/lib/palette'

interface ColorPaletteProps {
  value: string
  onChange: (hex: string) => void
  // Shows an extra "Auto" swatch that clears the value to '' — for forms
  // where an unset color is meaningful (e.g. "let the model estimate it"),
  // as opposed to the main editor where a color is always required.
  clearable?: boolean
}

// A closed swatch button that opens a small grid of plain color swatches on
// click -- no names/labels anywhere, even on hover; picking one selects it
// and closes the dropdown immediately.
export default function ColorPalette({ value, onChange, clearable }: ColorPaletteProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  function select(hex: string) {
    onChange(hex)
    setOpen(false)
  }

  return (
    <div className="relative inline-block" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Choose color"
        className="rounded-md border-2 box-border flex items-center justify-center transition-colors"
        style={{
          width: 28, height: 28,
          backgroundColor: value || 'transparent',
          borderColor: open ? '#ffffff' : '#444',
          borderStyle: value ? 'solid' : 'dashed',
        }}
      >
        {!value && <span className="text-zinc-500 text-xs">?</span>}
      </button>

      {open && (
        <div
          className="absolute z-20 mt-1.5 p-2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl grid grid-cols-5 gap-1.5"
          style={{ width: 176 }}
        >
          {clearable && (
            <button
              type="button"
              onClick={() => select('')}
              aria-label="Auto"
              className="rounded flex items-center justify-center box-border"
              style={{
                width: 28, height: 28,
                border: !value ? '2px solid white' : '2px dashed #666',
                color: '#888', fontSize: 12,
              }}
            >
              ?
            </button>
          )}
          {PALETTE.map(({ hex }) => (
            <button
              key={hex}
              type="button"
              onClick={() => select(hex)}
              aria-label={hex}
              className="rounded box-border"
              style={{
                width: 28, height: 28,
                backgroundColor: hex,
                border: value.toLowerCase() === hex.toLowerCase() ? '2px solid white' : '1px solid #444',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
