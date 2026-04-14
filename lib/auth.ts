import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Allow any Google account for now — restrict later when multi-tenant
      const allowed = process.env.ALLOWED_EMAIL
      if (allowed && user.email !== allowed) {
        return false
      }
      return true
    },
    async session({ session }) {
      return session
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async jwt({ token }: any) {
      return token
    },
  },
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
  secret: process.env.NEXTAUTH_SECRET,
}
