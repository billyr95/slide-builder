import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EditorPanel from '@/components/EditorPanel'
import { DEFAULT_SLIDE_DATA } from '@/lib/defaults'
import { SlideData } from '@/lib/types'

// Covers the drag-to-reorder text block list in the Layout & Preview tab --
// specifically that it only lists populated blocks, and that dragging one
// row onto another produces a correctly reordered blockOrder array (moving
// the dragged key within the FULL order, not just the visible subset, so
// an unpopulated block's relative position is preserved).

function renderPanel(overrides: Partial<SlideData> = {}) {
  const data: SlideData = { ...DEFAULT_SLIDE_DATA, ...overrides }
  const onChange = vi.fn()
  render(
    <EditorPanel data={data} onChange={onChange} screenType="projector" onScreenTypeChange={vi.fn()} slideRevision={0}
      orientation="landscape" onOrientationChange={vi.fn()}
      activeSection="layout" onActiveSectionChange={vi.fn()} />
  )
  return { onChange }
}

describe('EditorPanel block order drag list', () => {
  it('lists only populated blocks, in resolved order', () => {
    renderPanel({ label: 'TONIGHT', title: 'A Talk', subtitle: '', subtitle2: '', presenters: 'Jane Doe', programTitle: '', showSeriesName: false })
    const rows = screen.getAllByText(/Label|Title|Subtitle|Presenters|Program \/ Work Title|Series Name/)
    expect(rows.map(r => r.textContent)).toEqual(['Label', 'Title', 'Presenters'])
  })

  it('never lists Series Name as a reorderable row, even when it\'s populated -- it\'s pinned to its own fixed footer slot', () => {
    renderPanel({ label: 'TONIGHT', title: 'A Talk', presenters: 'Jane Doe', showSeriesName: true, seriesName: 'SERIES' })
    const rows = screen.getAllByText(/Label|Title|Subtitle|Presenters|Program \/ Work Title|Series Name/)
    expect(rows.map(r => r.textContent)).not.toContain('Series Name')
  })

  it('dragging a row onto another reorders blockOrder, preserving an unpopulated block\'s relative position', () => {
    const { onChange } = renderPanel({
      label: 'TONIGHT', title: 'A Talk', subtitle: '', subtitle2: '', presenters: 'Jane Doe', programTitle: 'Some Work', showSeriesName: false,
      blockOrder: ['label', 'title', 'subtitle', 'subtitle2', 'presenters', 'programTitle'],
    })

    const presentersRow = screen.getByText('Presenters').closest('div')!
    const titleRow = screen.getByText('Title').closest('div')!

    fireEvent.dragStart(presentersRow)
    fireEvent.dragOver(titleRow)
    fireEvent.drop(titleRow)

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      blockOrder: ['label', 'presenters', 'title', 'subtitle', 'subtitle2', 'programTitle'],
    }))
  })
})

describe('EditorPanel block order up/down arrow buttons', () => {
  it('disables the first row\'s up arrow and the last row\'s down arrow', () => {
    renderPanel({ label: 'TONIGHT', title: 'A Talk', subtitle: '', subtitle2: '', presenters: 'Jane Doe', programTitle: '', showSeriesName: false })
    // Rows in order: Label, Title, Presenters.
    expect(screen.getByTitle('Move Label up')).toBeDisabled()
    expect(screen.getByTitle('Move Label down')).not.toBeDisabled()
    expect(screen.getByTitle('Move Title up')).not.toBeDisabled()
    expect(screen.getByTitle('Move Title down')).not.toBeDisabled()
    expect(screen.getByTitle('Move Presenters up')).not.toBeDisabled()
    expect(screen.getByTitle('Move Presenters down')).toBeDisabled()
  })

  it('clicking the down arrow moves that block after its next visible neighbor, preserving a hidden block in between', () => {
    const { onChange } = renderPanel({
      label: 'TONIGHT', title: 'A Talk', subtitle: '', subtitle2: '', presenters: 'Jane Doe', programTitle: 'Some Work', showSeriesName: false,
      // subtitle/subtitle2/seriesName are unpopulated (hidden) but sit
      // between title and presenters/programTitle in the stored order.
      blockOrder: ['label', 'title', 'subtitle', 'subtitle2', 'presenters', 'programTitle'],
    })

    fireEvent.click(screen.getByTitle('Move Title down'))

    // Title moves past its next VISIBLE neighbor (Presenters), landing
    // immediately before whatever followed Presenters in the full order
    // (subtitle2's neighbor "programTitle") -- subtitle/subtitle2 keep
    // their own original relative position untouched.
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      blockOrder: ['label', 'subtitle', 'subtitle2', 'presenters', 'title', 'programTitle'],
    }))
  })

  it('clicking the up arrow moves that block before its previous visible neighbor', () => {
    const { onChange } = renderPanel({
      label: 'TONIGHT', title: 'A Talk', subtitle: '', subtitle2: '', presenters: 'Jane Doe', programTitle: 'Some Work', showSeriesName: false,
      blockOrder: ['label', 'title', 'presenters', 'programTitle', 'subtitle', 'subtitle2'],
    })

    fireEvent.click(screen.getByTitle('Move Program / Work Title up'))

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      blockOrder: ['label', 'title', 'programTitle', 'presenters', 'subtitle', 'subtitle2'],
    }))
  })
})
