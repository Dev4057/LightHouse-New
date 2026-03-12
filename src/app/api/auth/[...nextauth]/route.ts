import NextAuth, { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { LighthouseRole } from "@/types/next-auth"

export const authOptions: NextAuthOptions = {
  // 1. Configure the session to use secure JWTs
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  
  // 2. Define our custom login page route
  pages: {
    signIn: '/login',
  },

  // 3. Set up the Credentials Provider (Safely preserved for the future!)
  providers: [
    CredentialsProvider({
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing credentials")
        }

        const mockUsers = [
          { id: "1", name: "Head of Data", email: "admin@lighthouse.dev", password: "admin", role: "WORKSPACE_ADMIN" as LighthouseRole },
          { id: "2", name: "Data Ops Engineer", email: "dataops@lighthouse.dev", password: "dataops", role: "COMPUTE_ADMIN" as LighthouseRole },
          { id: "3", name: "Junior Dev", email: "dev@lighthouse.dev", password: "dev", role: "DEVELOPER" as LighthouseRole },
        ]

        const user = mockUsers.find(u => u.email === credentials.email)

        if (user && user.password === credentials.password) {
          return { id: user.id, name: user.name, email: user.email, role: user.role }
        }

        throw new Error("Invalid email or password")
      }
    })
  ],

  // 4. Callbacks: Where we inject the Ghost Auth
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      // ✨ GHOST AUTH BYPASS ✨
      // No matter what happens, we force the frontend to see this Admin session.
      // Your Header will now say "Devang (Admin)" without anyone logging in!
      session.user = {
        id: "ghost-admin-123",
        name: "Devang (Admin)",
        email: "devang@lighthouse.local",
        role: "WORKSPACE_ADMIN" as LighthouseRole,
      }
      return session
    }
  }
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }