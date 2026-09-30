import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { db } from './db'
import { users } from './db/schema'
import { eq } from 'drizzle-orm'

// The JWT's user id is baked in at sign-in and never re-checked by NextAuth
// itself (session strategy is 'jwt', not DB-backed) -- if that user's row
// was ever deleted and recreated with a new id (e.g. a past user-data
// migration), an already-signed-in browser keeps presenting the old id
// forever, and every write that uses it as a foreign key (slides.user_id,
// folders.created_by, ...) fails with an opaque, permanent 500 until that
// browser happens to sign out and back in on its own. Treating a stale id
// as "not logged in" here instead makes every route's existing `if
// (!session) return 401` naturally send them back through /login, where
// they get a fresh, valid session.
export async function getSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return session

  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.id, session.user.id)).limit(1)
  if (!exists) return null

  return session
}
