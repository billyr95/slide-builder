import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Broad, page-level gating only. Fine-grained checks (ownership, per-method
// admin-only operations like POSTing a training entry vs. listing/editing
// them) live in each API route handler itself -- this middleware can't see
// enough to make those calls correctly from the path alone.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const isAdmin = token.role === 'admin'
  if ((pathname.startsWith('/admin') || pathname.startsWith('/train')) && !isAdmin) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return NextResponse.next()
}

export const config = {
  // Excludes Next internals, the favicon, and /fonts/* (public/fonts,
  // referenced directly by @font-face in globals.css) -- without that last
  // one, font requests get redirected to /login too, which silently broke
  // the login page's own typography for anyone not yet authenticated.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|fonts/).*)'],
}
