// Client-side orchestration for the three group-mutating actions in
// SlidePreviewPanel.tsx -- kept deliberately composed from the small
// primitives GET/POST /api/slide-groups and PUT /api/slides/[id]'s groupId
// already provide, rather than one monolithic endpoint trying to handle
// every combination (create new group vs. join an existing one, etc.)
// server-side. Grouping is purely organizational: none of these ever touch
// a slide's own `data` content.
import { ScreenType } from './trainTypes'

interface SlideGroup {
  id: string
  name: string
}

export async function createGroup(name: string): Promise<SlideGroup> {
  const res = await fetch('/api/slide-groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error(`Failed to create group (${res.status})`)
  return res.json()
}

export async function setSlideGroup(slideId: string, groupId: string | null): Promise<void> {
  const res = await fetch(`/api/slides/${slideId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupId }),
  })
  if (!res.ok) throw new Error(`Failed to update slide's group (${res.status})`)
}

// "Create lobby version" / "Create projector version" -- duplicates the
// given slide (same data/folder/orientation, screenType flipped) and
// assigns both the original and the duplicate to the same group, creating
// one first (named after the source slide) if it wasn't already grouped.
// Orientation is carried over as-is, left for the user to change
// afterward, same as the spec asks.
export async function createScreenTypeVersion(slideId: string, targetScreenType: ScreenType): Promise<{ id: string }> {
  const slideRes = await fetch(`/api/slides/${slideId}`)
  if (!slideRes.ok) throw new Error(`Failed to load slide (${slideRes.status})`)
  const slide = await slideRes.json()

  let groupId: string | null = slide.groupId ?? null
  if (!groupId) {
    const group = await createGroup(slide.title)
    groupId = group.id
    await setSlideGroup(slide.id, groupId)
  }

  const res = await fetch('/api/slides', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: slide.title,
      orientation: slide.orientation,
      screenType: targetScreenType,
      folderId: slide.folderId,
      groupId,
      data: slide.data,
    }),
  })
  if (!res.ok) throw new Error(`Failed to create ${targetScreenType} version (${res.status})`)
  return res.json()
}

// "Group with..." -- pairs two existing, already-saved slides. If either
// is already in a group, the other joins it (leaving its own previous
// group behind, which is cleaned up automatically once empty -- see
// app/api/slides/[id]/route.ts's deleteGroupIfEmpty); if neither is
// grouped, a new group is created for both, named after `primary`.
export async function groupSlides(
  primary: { id: string; title: string; groupId?: string | null },
  other: { id: string; groupId?: string | null }
): Promise<void> {
  let groupId: string | null = primary.groupId ?? other.groupId ?? null
  if (!groupId) {
    const group = await createGroup(primary.title)
    groupId = group.id
  }
  await Promise.all([
    setSlideGroup(primary.id, groupId),
    setSlideGroup(other.id, groupId),
  ])
}

export async function removeFromGroup(slideId: string): Promise<void> {
  await setSlideGroup(slideId, null)
}
