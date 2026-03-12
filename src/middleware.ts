import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
}

export default withAuth(
  function middleware(req) {
    if (req.method === "OPTIONS") {
      return NextResponse.json({}, { headers: corsHeaders })
    }

    const res = NextResponse.next()
    
    if (req.nextUrl.pathname.startsWith('/api/')) {
      Object.entries(corsHeaders).forEach(([key, value]) => {
        res.headers.append(key, value)
      })
    }

    return res
  },
  {
    callbacks: {
      authorized: () => {
        // ✨ GHOST AUTH BYPASS ✨
        // We are returning 'true' for everything so the app ignores the login screen
        // while we build the containerized version.
        return true; 
      }
    },
    pages: {
      signIn: '/login',
    }
  }
)

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)']
}