import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import StatCard from '@/components/StatCard'
import { DollarSign, ShoppingCart, Package, TrendingUp, Upload } from 'lucide-react'
import Link from 'next/link'

const OPERATOR_UUID = '00000000-0000-0000-0000-000000000001'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createSupabaseClient(url, key)
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2,
  }).format(cents / 100)
}

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  } catch { return isoString }
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch { return iso.slice(0, 10) }
}

interface Transaction {
  id: string
  transaction_date: string
  product_name: string
  amount_cents: number
  payment_type: string
  dashboard_machines?: { name: string } | null
  machine_id: string
}

interface Machine {
  id: string
  name: string
}

interface Baseline {
  machine_name: string
  period_start: string
  period_end: string
  total_revenue: number
  transaction_count: number
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  const firstName = session?.user?.name?.split(' ')[0] ||
    session?.user?.email?.split('@')[0] || 'there'

  const supabase = getSupabaseAdmin()

  const now = new Date()
  const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7)
  const todayStr = now.toISOString().split('T')[0]
  const yesterdayStr = new Date(now.getTime() - 86400000).toISOString().split('T')[0]

  // Fetch all SQS transactions
  const { data: allTransactions } = await supabase
    .from('dashboard_transactions')
    .select('id, transaction_date, product_name, amount_cents, payment_type, machine_id, dashboard_machines(name)')
    .eq('user_id', OPERATOR_UUID)
    .order('transaction_date', { ascending: false })

  // Fetch all machines (excluding synthetic placeholders)
  const { data: machines } = await supabase
    .from('dashboard_machines')
    .select('id, name')
    .eq('user_id', OPERATOR_UUID)
    .eq('is_active', true)
    .neq('name', 'Unknown Machine')
    .neq('name', 'Total')

  // Fetch historical baselines (Sales By Machine XLSX imports)
  const { data: baselines } = await supabase
    .from('historical_baselines')
    .select('machine_name, period_start, period_end, total_revenue, transaction_count')
    .eq('user_id', OPERATOR_UUID)
    .order('period_start', { ascending: true })

  const txList: Transaction[] = (allTransactions || []) as unknown as Transaction[]
  const machineList: Machine[] = (machines || []) as unknown as Machine[]
  const baselineList: Baseline[] = (baselines || []) as unknown as Baseline[]

  const hasData = txList.length > 0 || machineList.length > 0
  const hasBaselines = baselineList.length > 0

  // ── SQS date range ──
  const txDates = txList.map(t => t.transaction_date).filter(Boolean).sort()
  const sqsEarliest = txDates[0] ?? null
  const sqsLatest   = txDates[txDates.length - 1] ?? null
  const sqsRangeLabel = sqsEarliest && sqsLatest
    ? fmtDate(sqsEarliest) === fmtDate(sqsLatest)
      ? fmtDate(sqsLatest)
      : `${fmtDate(sqsEarliest)} – ${fmtDate(sqsLatest)}`
    : null

  // ── Historical baseline range (latest baseline period) ──
  const latestBaseline = baselineList.length > 0
    ? baselineList.reduce((a, b) => (a.period_end > b.period_end ? a : b))
    : null
  const baselineRangeLabel = latestBaseline
    ? `${fmtDate(latestBaseline.period_start)} – ${fmtDate(latestBaseline.period_end)}`
    : null

  // ── Blended header subtitle ──
  // If we have both, show the historical range (wider context)
  const headerRangeLabel = baselineRangeLabel ?? sqsRangeLabel

  // ── Top stat cards — use SQS for live totals ──
  const sqsRevenue = txList.reduce((s, t) => s + (t.amount_cents || 0), 0)
  const sqsTransactions = txList.length
  const activeMachinesCount = machineList.length

  // Historical baseline totals (aggregate across all machines for latest period)
  const baselineRevenue = hasBaselines
    ? baselineList
        .filter(b => latestBaseline && b.period_start === latestBaseline.period_start && b.period_end === latestBaseline.period_end)
        .reduce((s, b) => s + (b.total_revenue || 0), 0)
    : 0
  const baselineTxCount = hasBaselines
    ? baselineList
        .filter(b => latestBaseline && b.period_start === latestBaseline.period_start && b.period_end === latestBaseline.period_end)
        .reduce((s, b) => s + (b.transaction_count || 0), 0)
    : 0

  // For avg/machine use SQS data (most accurate per-machine)
  const avgPerMachine = activeMachinesCount > 0 && sqsRevenue > 0
    ? Math.round(sqsRevenue / activeMachinesCount) : 0

  // ── Machine performance table ──
  type MachineStats = {
    id: string; name: string
    today: number; yesterday: number; last7: number; sqsTotal: number
    baselineRevenue: number; baselineTxCount: number
    topProduct: string
  }

  // Build a lookup: machine_name → baseline row for the latest period
  const baselineByMachine: Record<string, Baseline> = {}
  if (latestBaseline) {
    baselineList
      .filter(b => b.period_start === latestBaseline.period_start && b.period_end === latestBaseline.period_end)
      .forEach(b => { baselineByMachine[b.machine_name] = b })
  }

  const machineStats: MachineStats[] = machineList.map(m => {
    const machineTx = txList.filter(t => t.machine_id === m.id)
    const todayRev     = machineTx.filter(t => t.transaction_date?.startsWith(todayStr)).reduce((s,t) => s + (t.amount_cents||0), 0)
    const yesterdayRev = machineTx.filter(t => t.transaction_date?.startsWith(yesterdayStr)).reduce((s,t) => s + (t.amount_cents||0), 0)
    const last7Rev     = machineTx.filter(t => t.transaction_date && t.transaction_date >= sevenDaysAgo.toISOString()).reduce((s,t) => s + (t.amount_cents||0), 0)
    const sqsTot       = machineTx.reduce((s,t) => s + (t.amount_cents||0), 0)

    const bl = baselineByMachine[m.name]

    const productCounts: Record<string, number> = {}
    machineTx.forEach(t => {
      const p = t.product_name || 'Unknown'
      productCounts[p] = (productCounts[p] || 0) + (t.amount_cents || 0)
    })
    const topProduct = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'

    return {
      id: m.id, name: m.name,
      today: todayRev, yesterday: yesterdayRev, last7: last7Rev, sqsTotal: sqsTot,
      baselineRevenue:   bl?.total_revenue    ?? 0,
      baselineTxCount:   bl?.transaction_count ?? 0,
      topProduct,
    }
  }).sort((a, b) => (b.baselineRevenue || b.sqsTotal) - (a.baselineRevenue || a.sqsTotal))

  const recentTx = txList.slice(0, 20)

  const getMachineName = (tx: Transaction) => {
    if (tx.dashboard_machines && typeof tx.dashboard_machines === 'object' && 'name' in tx.dashboard_machines)
      return (tx.dashboard_machines as { name: string }).name
    return machineList.find(m => m.id === tx.machine_id)?.name || '—'
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Welcome back, {firstName} 👋</h1>
        <p className="text-gray-400 mt-1">
          {headerRangeLabel
            ? `Showing data from ${headerRangeLabel}.`
            : hasData ? 'Here\'s an overview of your vending operation.' : 'Here\'s an overview of your vending operation.'}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {hasBaselines ? (
          <StatCard
            title="90-Day Revenue"
            value={formatCurrency(baselineRevenue)}
            subtitle={baselineRangeLabel ?? 'Historical baseline'}
            icon={<DollarSign className="w-5 h-5" />}
            accent="blue"
          />
        ) : (
          <StatCard
            title="Total Revenue"
            value={formatCurrency(sqsRevenue)}
            subtitle={sqsRangeLabel ?? 'All time'}
            icon={<DollarSign className="w-5 h-5" />}
            accent="blue"
          />
        )}
        {hasBaselines ? (
          <StatCard
            title="90-Day Transactions"
            value={baselineTxCount.toLocaleString()}
            subtitle={baselineRangeLabel ?? 'Historical baseline'}
            icon={<ShoppingCart className="w-5 h-5" />}
            accent="green"
          />
        ) : (
          <StatCard
            title="Transactions"
            value={sqsTransactions.toLocaleString()}
            subtitle={sqsRangeLabel ?? 'All time'}
            icon={<ShoppingCart className="w-5 h-5" />}
            accent="green"
          />
        )}
        <StatCard
          title="Active Machines"
          value={activeMachinesCount.toString()}
          subtitle="In your fleet"
          icon={<Package className="w-5 h-5" />}
          accent="purple"
        />
        <StatCard
          title="Avg / Machine"
          value={formatCurrency(avgPerMachine)}
          subtitle={sqsRangeLabel ? `Live · ${sqsRangeLabel}` : 'Live data'}
          icon={<TrendingUp className="w-5 h-5" />}
          accent="orange"
        />
      </div>

      {!hasData ? (
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-8 lg:p-12 text-center">
          <div className="w-16 h-16 bg-blue-600/20 border border-blue-600/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Upload className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-white text-xl font-semibold mb-2">No data yet</h2>
          <p className="text-gray-400 mb-6 max-w-sm mx-auto">
            Upload your first Nayax CSV export to see machine performance, revenue, and transaction history.
          </p>
          <Link href="/dashboard/upload"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-medium transition-colors">
            <Upload className="w-4 h-4" /> Upload CSV
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Machine Performance Table */}
          {machineStats.length > 0 && (
            <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
                <div>
                  <h2 className="text-white font-semibold">Machine Performance</h2>
                  {hasBaselines && sqsRangeLabel && (
                    <p className="text-gray-500 text-xs mt-0.5">
                      Today/Yesterday/7d from live SQS · {baselineRangeLabel} from historical baseline
                    </p>
                  )}
                </div>
                {sqsRangeLabel && (
                  <span className="text-gray-400 text-sm">{sqsRangeLabel}</span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-6 py-3">Machine</th>
                      <th className="text-right text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Today</th>
                      <th className="text-right text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Yesterday</th>
                      <th className="text-right text-xs text-gray-400 uppercase tracking-wider px-4 py-3">7 Days</th>
                      {hasBaselines ? (
                        <th className="text-right text-xs text-gray-400 uppercase tracking-wider px-4 py-3">
                          {baselineRangeLabel ?? '90 Days'}
                        </th>
                      ) : (
                        <th className="text-right text-xs text-gray-400 uppercase tracking-wider px-4 py-3">
                          {sqsRangeLabel ?? 'All Time'}
                        </th>
                      )}
                      <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-6 py-3">Top Product</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/50">
                    {machineStats.map(m => {
                      const dayChange = m.today - m.yesterday
                      const rangeRevenue = hasBaselines ? m.baselineRevenue : m.sqsTotal
                      return (
                        <tr key={m.id} className="hover:bg-gray-700/30 transition-colors">
                          <td className="px-6 py-4">
                            <span className="text-white font-medium">{m.name}</span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="flex flex-col items-end">
                              <span className="text-white text-sm">{formatCurrency(m.today)}</span>
                              {m.yesterday > 0 && (
                                <span className={`text-xs ${dayChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {dayChange >= 0 ? '▲' : '▼'} {formatCurrency(Math.abs(dayChange))}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <span className="text-gray-300 text-sm">{formatCurrency(m.yesterday)}</span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <span className="text-gray-300 text-sm">{formatCurrency(m.last7)}</span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <span className="text-white text-sm font-medium">{formatCurrency(rangeRevenue)}</span>
                            {hasBaselines && m.baselineTxCount > 0 && (
                              <div className="text-xs text-gray-500">{m.baselineTxCount.toLocaleString()} vends</div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-gray-300 text-sm truncate max-w-[150px] block">{m.topProduct}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Data Sources Legend */}
          {hasBaselines && sqsRangeLabel && (
            <div className="flex flex-wrap gap-4 text-xs text-gray-500 px-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                Live SQS · {sqsRangeLabel} · {sqsTransactions.toLocaleString()} transactions
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gray-500 inline-block"></span>
                Historical baseline · {baselineRangeLabel} · {baselineTxCount.toLocaleString()} vends total
              </span>
            </div>
          )}

          {/* Recent Transactions */}
          {recentTx.length > 0 && (
            <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
                <h2 className="text-white font-semibold">Recent Transactions</h2>
                <Link href="/dashboard/transactions" className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
                  View all
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-6 py-3">Time</th>
                      <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Machine</th>
                      <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Product</th>
                      <th className="text-right text-xs text-gray-400 uppercase tracking-wider px-4 py-3">Amount</th>
                      <th className="text-left text-xs text-gray-400 uppercase tracking-wider px-6 py-3">Payment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/50">
                    {recentTx.map(tx => (
                      <tr key={tx.id} className="hover:bg-gray-700/30 transition-colors">
                        <td className="px-6 py-3">
                          <span className="text-gray-300 text-sm whitespace-nowrap">
                            {tx.transaction_date ? formatTime(tx.transaction_date) : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3"><span className="text-gray-300 text-sm">{getMachineName(tx)}</span></td>
                        <td className="px-4 py-3"><span className="text-gray-300 text-sm">{tx.product_name || '—'}</span></td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-white text-sm font-medium">{formatCurrency(tx.amount_cents || 0)}</span>
                        </td>
                        <td className="px-6 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            tx.payment_type === 'Cash' ? 'bg-green-500/20 text-green-400'
                            : tx.payment_type === 'Credit Card' ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-gray-600/50 text-gray-400'
                          }`}>
                            {tx.payment_type || 'Unknown'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
