import { createClient } from '@/lib/supabase/server'
import { Settings } from 'lucide-react'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Manage your account and preferences</p>
      </div>

      <div className="max-w-2xl space-y-4">
        {/* Account Card */}
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-blue-400" />
            <h2 className="text-white font-semibold">Account</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-gray-400 text-xs uppercase tracking-wide">Email</label>
              <p className="text-white mt-1">{user?.email}</p>
            </div>
            <div>
              <label className="text-gray-400 text-xs uppercase tracking-wide">Name</label>
              <p className="text-white mt-1">{user?.user_metadata?.full_name || 'Not set'}</p>
            </div>
            <div>
              <label className="text-gray-400 text-xs uppercase tracking-wide">User ID</label>
              <p className="text-gray-400 text-sm mt-1 font-mono">{user?.id}</p>
            </div>
          </div>
        </div>

        {/* Notifications Card - placeholder */}
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6">
          <h2 className="text-white font-semibold mb-4">Notifications</h2>
          <p className="text-gray-400 text-sm">
            Notification settings will be available in a future update. You&apos;ll be able to configure
            par level alerts via Telegram and email.
          </p>
        </div>
      </div>
    </div>
  )
}
