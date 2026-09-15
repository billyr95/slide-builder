'use client'

import { PALETTE } from '@/lib/palette'

interface ColorPaletteProps {
  value: string
  onChange: (hex: string) => void
  // Shows an extra "Auto" swatch that clears the value to '' — for forms
  // where an unset color is meaningful (e.g. "let the model estimate it"),
  // as opposed to the main editor where a color is always required.
  clearable?: boolean
}

export default function ColorPalette({ value, onChange, clearable }: ColorPaletteProps) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {clearable && (
        <button title="Auto — model estimates" onClick={() => onChange('')} className="relative group" style={{ width: 28, height: 28 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            border: !value ? '2px solid white' : '2px dashed #666',
            outline: !value ? '2px solid #666' : 'none',
            boxSizing: 'border-box',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#888', fontSize: 13,
          }}>
            ?
          </div>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-1.5 py-0.5 bg-zinc-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10 border border-zinc-700">
            Auto (estimate)
          </div>
        </button>
      )}
      {PALETTE.map(({ hex, name }) => {
        const isSelected = value.toLowerCase() === hex.toLowerCase()
        return (
          <button key={hex} title={name} onClick={() => onChange(hex)} className="relative group" style={{ width: 28, height: 28 }}>
            <div style={{
              width: 28, height: 28, backgroundColor: hex, borderRadius: 6,
              border: isSelected ? '2px solid white' : '2px solid transparent',
              outline: isSelected ? '2px solid #666' : '1px solid #444',
              boxSizing: 'border-box',
            }} />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-1.5 py-0.5 bg-zinc-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10 border border-zinc-700">
              {name}
            </div>
          </button>
        )
      })}
    </div>
  )
}
