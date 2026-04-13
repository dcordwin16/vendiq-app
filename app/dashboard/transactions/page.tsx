import { Receipt } from 'lucide-react'

export default function TransactionsPage() {
  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Transactions</h1>
        <p className="text-gray-400 mt-1">View and analyze your transaction history</p>
      </div>

      {/* Empty State */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700 border-dashed p-12 text-center">
        <div className="w-14 h-14 bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Receipt className="w-7 h-7 text-gray-500" />
        </div>
        <h3 className="text-white font-semibold mb-2">No transactions yet</h3>
        <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">
          Upload a CSV export from Nayax to see your transaction data here.
        </p>
        <a
          href="/dashboard/upload"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          Upload CSV
        </a>
      </div>
    </div>
  )
}
