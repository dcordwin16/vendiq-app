import { NextResponse } from 'next/server'

// This route is no longer needed — NextAuth handles OAuth callbacks at
// /api/auth/callback/google automatically.
// Keeping this file to redirect any old links gracefully.
export async function GET(request: Request) {
  const { origin } = new URL(request.url)
  return NextResponse.redirect(`${origin}/dashboard`)
}
