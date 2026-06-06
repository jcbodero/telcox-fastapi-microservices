import { NextResponse } from 'next/server'

const MANUALS_USER = process.env.MANUALS_BASIC_AUTH_USER || 'manuales'
const MANUALS_PASSWORD = process.env.MANUALS_BASIC_AUTH_PASSWORD
const REALM = process.env.MANUALS_BASIC_AUTH_REALM || 'TelcoX Manuales'

function unauthorized() {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
      'Cache-Control': 'no-store',
    },
  })
}

export function middleware(request) {
  if (!MANUALS_PASSWORD) {
    return unauthorized()
  }

  const authorization = request.headers.get('authorization')

  if (!authorization?.startsWith('Basic ')) {
    return unauthorized()
  }

  let credentials = ''
  try {
    credentials = atob(authorization.slice('Basic '.length))
  } catch {
    return unauthorized()
  }

  const separator = credentials.indexOf(':')
  if (separator < 0) {
    return unauthorized()
  }

  const user = credentials.slice(0, separator)
  const password = credentials.slice(separator + 1)

  if (user !== MANUALS_USER || password !== MANUALS_PASSWORD) {
    return unauthorized()
  }

  const response = NextResponse.next()
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}

export const config = {
  matcher: ['/manuales/:path*'],
}
