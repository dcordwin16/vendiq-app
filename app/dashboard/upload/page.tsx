import { Upload } from 'lucide-react'

export default function UploadPage() {
  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Upload Data</h1>
        <p className="text-gray-400 mt-1">Import transaction data from Nayax CSV exports</p>
      </div>

      {/* Upload Area */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 lg:p-8 max-w-2xl">
        <div className="border-2 border-dashed border-gray-600 hover:border-blue-500 rounded-xl p-10 text-center transition-colors cursor-pointer">
          <div className="w-14 h-14 bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Upload className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-white font-medium mb-1">Drop your Nayax CSV here</p>
          <p className="text-gray-400 text-sm mb-4">or click to browse files</p>
          <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
            Choose File
          </button>
        </div>

        <div className="mt-6 p-4 bg-gray-700/50 rounded-xl">
          <p className="text-gray-300 text-sm font-medium mb-2">How to export from Nayax:</p>
          <ol className="text-gray-400 text-sm space-y-1.5 list-decimal list-inside">
            <li>Log in to my.nayax.com</li>
            <li>Go to Reports → Sales Summary</li>
            <li>Set your date range</li>
            <li>Click Export → CSV</li>
            <li>Upload the downloaded file here</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
