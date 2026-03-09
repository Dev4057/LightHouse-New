import NextAuth, { DefaultSession, DefaultUser } from "next-auth"
import { JWT, DefaultJWT } from "next-auth/jwt"

// Define the exact roles allowed in Lighthouse
export type LighthouseRole = 'WORKSPACE_ADMIN' | 'COMPUTE_ADMIN' | 'DEVELOPER'

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: LighthouseRole
    } & DefaultSession["user"]
  }

  interface User extends DefaultUser {
    role: LighthouseRole
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string
    role: LighthouseRole
  }
}