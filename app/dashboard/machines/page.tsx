import { Package, Plus } from 'lucide-react'

export default function MachinesPage() {
  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Machines</h1>
          <p className="text-gray-400 mt-1">Manage your vending machine fleet</p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" />
          Add Machine
        </button>
      </div>

      {/* Empty State */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700 border-dashed p-12 text-center">
        <div className="w-14 h-14 bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Package className="w-7 h-7 text-gray-500" />
        </div>
        <h3 className="text-white font-semibold mb-2">No machines yet</h3>
        <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">
          Add your first vending machine to start tracking revenue and inventory.
        </p>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors mx-auto">
          <Plus className="w-4 h-4" />
          Add your first machine
        </button>
      </div>
    </div>
  )
}
