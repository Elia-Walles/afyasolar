import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import type { NextFetchEvent, NextRequest } from 'next/server'

const handler = withAuth(
  function proxy(req: NextRequest) {
    const token = (req as any).nextauth?.token
    const path = req.nextUrl.pathname

    if (token) {
      if (path.startsWith('/dashboard/admin') && (token as any).role !== 'admin') {
        return NextResponse.redirect(new URL('/services/afya-solar', req.url))
      }

      if (path.startsWith('/dashboard/technician') && (token as any).role !== 'technician') {
        return NextResponse.redirect(new URL('/services/afya-solar', req.url))
      }

      if (path.startsWith('/services') && (token as any).role !== 'facility') {
        if ((token as any).role === 'admin') {
          return NextResponse.redirect(new URL('/dashboard/admin', req.url))
        } else if ((token as any).role === 'technician') {
          return NextResponse.redirect(new URL('/dashboard/technician', req.url))
        }
      }
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname

        if (
          path === '/' ||
          path.startsWith('/feedback') ||
          path.startsWith('/auth') ||
          path.startsWith('/api/auth') ||
          path.startsWith('/api/payments/azam-pay/callback') ||
          path.startsWith('/api/technicians') ||
          path.startsWith('/api/users') ||
          path.startsWith('/api/facilities') ||
          path.startsWith('/api/regions') ||
          path.startsWith('/api/districts') ||
          path.startsWith('/privacy-policy') ||
          path.startsWith('/terms') ||
          path.startsWith('/_next') ||
          path.startsWith('/api/public') ||
          path === '/manifest.json' ||
          path === '/sw.js' ||
          path.startsWith('/workbox-')
        ) {
          return true
        }

        if (path.startsWith('/services')) {
          return !!token
        }

        return !!token
      },
    },
  }
)

export function proxy(request: NextRequest, event: NextFetchEvent) {
  return handler(request, event)
}

export default proxy

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|workbox-.*\\.js|manifest.json|feedback(?:/|$)|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

