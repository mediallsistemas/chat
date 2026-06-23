import { NextRequest, NextResponse } from 'next/server'

const publicRoutes = ['/login', '/signup']
const adminRoutes = ['/admin']

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')
  const { pathname } = request.nextUrl

  console.log(`[mw] ${pathname} | token=${JSON.stringify(token)} | raw-cookie=${request.headers.get('cookie')}`)

  if (publicRoutes.some((r) => pathname.startsWith(r))) {
    return NextResponse.next()
  }

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (adminRoutes.some((r) => pathname.startsWith(r))) {
    // Role check happens server-side via API — middleware only checks token presence
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
