import { db } from '@/lib/db'
import { slides, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// How long a heartbeat stays "live" before a second opener stops seeing the
// "someone else is editing this" warning. The editor pings its heartbeat
// once per autosave tick (AUTOSAVE_INTERVAL_MS in app/editor/[id]/page.tsx,
// currently 60s) -- this window is a few ticks wide so one missed beat
// (a slow request, a brief network blip) doesn't flash the banner off.
export const ACTIVE_EDITOR_WINDOW_MS = 3 * 60 * 1000 // 3 minutes

export interface ActiveEditorInfo {
  email: string
  since: string
}

export type ActiveEditorCheck =
  | { found: false }
  | { found: true; otherEditor: ActiveEditorInfo | null }

// Single source of truth for the "who else has this slide open" check --
// used by the editor's heartbeat endpoint (polled while the editor stays
// open) and nowhere else. Deliberately NOT wired into the plain GET-slide
// route, since that route is also used for passive thumbnail previews
// (SlideCard) which must never register as "now editing this".
//
// Reads the slide's last-recorded heartbeat, decides whether it belongs to
// a DIFFERENT still-live user, then stamps the caller's own heartbeat --
// one round trip covers both "is anyone else here" and "mark myself here
// now".
export async function checkAndRefreshActiveEditor(slideId: string, userId: string): Promise<ActiveEditorCheck> {
  const rows = await db
    .select({ activeEditorId: slides.activeEditorId, activeEditorAt: slides.activeEditorAt, activeEditorEmail: users.email })
    .from(slides)
    .leftJoin(users, eq(slides.activeEditorId, users.id))
    .where(eq(slides.id, slideId))
    .limit(1)
  const current = rows[0]
  if (!current) return { found: false }

  let otherEditor: ActiveEditorInfo | null = null
  if (current.activeEditorId && current.activeEditorId !== userId && current.activeEditorAt && current.activeEditorEmail) {
    const ageMs = Date.now() - new Date(current.activeEditorAt).getTime()
    if (ageMs < ACTIVE_EDITOR_WINDOW_MS) {
      otherEditor = { email: current.activeEditorEmail, since: new Date(current.activeEditorAt).toISOString() }
    }
  }

  await db.update(slides).set({ activeEditorId: userId, activeEditorAt: new Date() }).where(eq(slides.id, slideId))

  return { found: true, otherEditor }
}
