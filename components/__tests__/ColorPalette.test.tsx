import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ColorPalette from '@/components/ColorPalette'
import { PALETTE } from '@/lib/palette'

describe('ColorPalette (swatch-only dropdown)', () => {
  it('starts closed -- no swatch grid visible until the trigger is clicked', () => {
    render(<ColorPalette value={PALETTE[0].hex} onChange={vi.fn()} />)
    // The palette's own colors would be ambiguous to query for (the trigger
    // itself is styled with the current color) -- assert via the count of
    // color swatch buttons, which should be just the one trigger button.
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('opens a grid of every palette swatch on click, with no name/label text anywhere', () => {
    render(<ColorPalette value={PALETTE[0].hex} onChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Choose color' }))
    // Trigger + one button per palette color.
    expect(screen.getAllByRole('button')).toHaveLength(1 + PALETTE.length)
    // No color name (e.g. "Periwinkle") should appear as visible text.
    for (const { name } of PALETTE) {
      expect(screen.queryByText(name)).not.toBeInTheDocument()
    }
  })

  it('selecting a swatch calls onChange with its hex and closes the dropdown', () => {
    const onChange = vi.fn()
    render(<ColorPalette value={PALETTE[0].hex} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Choose color' }))

    const target = PALETTE[3]
    fireEvent.click(screen.getByRole('button', { name: target.hex }))

    expect(onChange).toHaveBeenCalledWith(target.hex)
    // Closed again -- back down to just the trigger.
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('clicking outside the dropdown closes it without selecting anything', () => {
    const onChange = vi.fn()
    render(
      <div>
        <ColorPalette value={PALETTE[0].hex} onChange={onChange} />
        <button>outside</button>
      </div>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Choose color' }))
    expect(screen.getAllByRole('button').length).toBeGreaterThan(1)

    fireEvent.mouseDown(screen.getByText('outside'))

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getAllByRole('button')).toHaveLength(2) // trigger + the outside button
  })

  it('shows an Auto swatch that clears the value when clearable', () => {
    const onChange = vi.fn()
    render(<ColorPalette value={PALETTE[0].hex} onChange={onChange} clearable />)
    fireEvent.click(screen.getByRole('button', { name: 'Choose color' }))
    fireEvent.click(screen.getByRole('button', { name: 'Auto' }))
    expect(onChange).toHaveBeenCalledWith('')
  })
})

describe('ColorPalette (inline, e.g. Background Color)', () => {
  it('shows every swatch immediately -- no trigger button, no click needed', () => {
    render(<ColorPalette value={PALETTE[0].hex} onChange={vi.fn()} inline />)
    // No "Choose color" trigger at all -- just one button per palette color.
    expect(screen.queryByRole('button', { name: 'Choose color' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(PALETTE.length)
  })

  it('selecting a swatch calls onChange and the grid stays visible (nothing to close)', () => {
    const onChange = vi.fn()
    render(<ColorPalette value={PALETTE[0].hex} onChange={onChange} inline />)
    const target = PALETTE[3]
    fireEvent.click(screen.getByRole('button', { name: target.hex }))
    expect(onChange).toHaveBeenCalledWith(target.hex)
    expect(screen.getAllByRole('button')).toHaveLength(PALETTE.length)
  })

  it('marks the currently-selected swatch active with a distinct border', () => {
    const selected = PALETTE[2]
    render(<ColorPalette value={selected.hex} onChange={vi.fn()} inline />)
    const selectedBtn = screen.getByRole('button', { name: selected.hex }) as HTMLButtonElement
    const otherBtn = screen.getByRole('button', { name: PALETTE[0].hex }) as HTMLButtonElement
    expect(selectedBtn.style.border).toContain('2px solid white')
    expect(otherBtn.style.border).not.toContain('2px solid white')
  })
})
