import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
}

// Wrap your entire middleware in NextAuth's withAuth function
export default withAuth(
  function middleware(req) {
    // 1. Handle CORS Preflight (OPTIONS) requests
    if (req.method === "OPTIONS") {
      return NextResponse.json({}, { headers: corsHeaders })
    }

    const res = NextResponse.next()
    
    // 2. Add CORS headers to all API routes
    if (req.nextUrl.pathname.startsWith('/api/')) {
      Object.entries(corsHeaders).forEach(([key, value]) => {
        res.headers.append(key, value)
      })
    }

    return res
  },
  {
    callbacks: {
      // This is the actual Bouncer logic
      authorized: ({ req, token }) => {
        const path = req.nextUrl.pathname;
        
        // Let people access the login page and NextAuth API endpoints freely
        if (path.startsWith('/login') || path.startsWith('/api/auth')) {
          return true; 
        }
        
        // For EVERY OTHER PAGE, require a valid token
        return !!token; 
      }
    },
    // Tell NextAuth where to send people if they fail the authorized check
    pages: {
      signIn: '/login',
    }
  }
)

// The Matcher tells Next.js to run this on all routes EXCEPT static files
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)']
}