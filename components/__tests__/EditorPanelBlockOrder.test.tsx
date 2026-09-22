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
    <EditorPanel data={data} onChange={onChange} screenType="projector" slideRevision={0}
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

  it('dragging a row onto another reorders blockOrder, preserving an unpopulated block\'s relative position', () => {
    const { onChange } = renderPanel({
      label: 'TONIGHT', title: 'A Talk', subtitle: '', subtitle2: '', presenters: 'Jane Doe', programTitle: 'Some Work', showSeriesName: false,
      blockOrder: ['label', 'title', 'subtitle', 'subtitle2', 'presenters', 'programTitle', 'seriesName'],
    })

    const presentersRow = screen.getByText('Presenters').closest('div')!
    const titleRow = screen.getByText('Title').closest('div')!

    fireEvent.dragStart(presentersRow)
    fireEvent.dragOver(titleRow)
    fireEvent.drop(titleRow)

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      blockOrder: ['label', 'presenters', 'title', 'subtitle', 'subtitle2', 'programTitle', 'seriesName'],
    }))
  })
})
