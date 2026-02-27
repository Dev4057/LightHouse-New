import { NextRequest, NextResponse } from 'next/server'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
  'Access-Control-Max-Age': '86400',
}

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
      })
    }

    const response = NextResponse.next()
    for (const [key, value] of Object.entries(corsHeaders)) {
      response.headers.set(key, value)
    }
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}
