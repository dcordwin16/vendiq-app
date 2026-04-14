"use client"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Suspense } from "react"

function ErrorContent() {
  const params = useSearchParams()
  const error = params.get("error")

  const messages: Record<string, string> = {
    OAuthSignin: "Error starting Google sign-in. Check redirect URI in Google Console.",
    OAuthCallback: "Error during OAuth callback. Redirect URI mismatch — check Google Console.",
    OAuthCreateAccount: "Could not create account.",
    EmailCreateAccount: "Could not create account.",
    Callback: "OAuth callback error — redirect URI likely not added in Google Console.",
    AccessDenied: "Access denied — your email is not on the allowed list.",
    Verification: "Verification error.",
    Default: "An unknown error occurred.",
  }

  const message = error ? (messages[error] || messages.Default) : messages.Default

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 rounded-xl p-8 max-w-md w-full text-center border border-red-500/30">
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold text-white mb-2">Sign-in Error</h1>
        <p className="text-gray-400 mb-2">{message}</p>
        <p className="text-xs text-gray-600 mb-6 font-mono">Error code: {error || "unknown"}</p>

        {(error === "OAuthCallback" || error === "Callback" || error === "OAuthSignin") && (
          <div className="bg-gray-700 rounded-lg p-4 text-left mb-6 text-sm">
            <p className="text-yellow-400 font-semibold mb-2">Fix: Add this redirect URI in Google Console</p>
            <p className="text-gray-300 font-mono text-xs break-all">
              https://vendiq-app-iota.vercel.app/api/auth/callback/google
            </p>
            <p className="text-gray-400 mt-2 text-xs">
              console.cloud.google.com → APIs &amp; Services → Credentials → OAuth 2.0 Client IDs → your client → Authorized redirect URIs
            </p>
          </div>
        )}

        <Link href="/login" className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition">
          Try again
        </Link>
      </div>
    </div>
  )
}

export default function AuthError() {
  return (
    <Suspense>
      <ErrorContent />
    </Suspense>
  )
}
