import { createClient } from '@/lib/supabase/server'
import StatCard from '@/components/StatCard'
import { DollarSign, ShoppingCart, Package, TrendingUp } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 
                    user?.email?.split('@')[0] || 
                    'there'

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          Welcome back, {firstName} 👋
        </h1>
        <p className="text-gray-400 mt-1">
          Here&apos;s an overview of your vending operation.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Total Revenue"
          value="$0.00"
          subtitle="No transactions yet"
          icon={<DollarSign className="w-5 h-5" />}
          accent="blue"
        />
        <StatCard
          title="Transactions"
          value="0"
          subtitle="Upload CSV to get started"
          icon={<ShoppingCart className="w-5 h-5" />}
          accent="green"
        />
        <StatCard
          title="Active Machines"
          value="0"
          subtitle="Add your machines"
          icon={<Package className="w-5 h-5" />}
          accent="purple"
        />
        <StatCard
          title="Avg / Machine"
          value="$0.00"
          subtitle="Per month"
          icon={<TrendingUp className="w-5 h-5" />}
          accent="orange"
        />
      </div>

      {/* Getting Started Card */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 lg:p-8">
        <h2 className="text-white text-lg font-semibold mb-4">Get started in 3 steps</h2>
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 bg-blue-600/20 border border-blue-600/40 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-400 text-sm font-bold">1</span>
            </div>
            <div>
              <p className="text-white font-medium">Add your machines</p>
              <p className="text-gray-400 text-sm mt-0.5">
                Go to Machines → Add Machine and enter your Nayax device IDs and locations.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 bg-blue-600/20 border border-blue-600/40 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-400 text-sm font-bold">2</span>
            </div>
            <div>
              <p className="text-white font-medium">Upload your transaction data</p>
              <p className="text-gray-400 text-sm mt-0.5">
                Export a CSV from Nayax and upload it under Upload Data to see your revenue insights.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 bg-blue-600/20 border border-blue-600/40 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-400 text-sm font-bold">3</span>
            </div>
            <div>
              <p className="text-white font-medium">Set par levels & alerts</p>
              <p className="text-gray-400 text-sm mt-0.5">
                Configure product inventory par levels to receive alerts before machines run out.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
