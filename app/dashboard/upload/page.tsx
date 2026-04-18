'use client'

import { useState, useRef, DragEvent } from 'react'
import { Upload, CheckCircle, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface UploadResult {
  success: boolean
  rows_imported: number
  machines: string[]
  date_range: { start: string; end: string }
  file_format?: string
  error?: string
}

const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls']

export default function UploadPage() {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    const nameLower = file.name.toLowerCase()
    const validExt = ACCEPTED_EXTENSIONS.some(ext => nameLower.endsWith(ext))
    if (!validExt) {
      setError('Please upload a CSV, XLSX, or XLS file exported from Nayax.')
      return
    }

    setSelectedFile(file.name)
    setIsUploading(true)
    setError(null)
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/upload-csv', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Upload failed')
      } else {
        setResult(data)
      }
    } catch {
      setError('Network error — please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleReset = () => {
    setResult(null)
    setError(null)
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const formatDate = (d: string) => {
    if (!d) return ''
    try {
      return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
      })
    } catch {
      return d
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/dashboard"
          className="text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Upload Nayax CSV or Excel file</h1>
          <p className="text-gray-400 mt-0.5 text-sm">Import transaction or sales data from your Nayax export</p>
        </div>
      </div>

      <div className="max-w-2xl space-y-4">
        {/* Upload Zone */}
        {!result && (
          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 lg:p-8">
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${
                isDragging
                  ? 'border-blue-400 bg-blue-500/10'
                  : isUploading
                  ? 'border-gray-600 cursor-not-allowed'
                  : 'border-gray-600 hover:border-blue-500 hover:bg-gray-700/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleInputChange}
                disabled={isUploading}
              />

              {isUploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
                  <p className="text-white font-medium">
                    {selectedFile && (selectedFile.endsWith('.xlsx') || selectedFile.endsWith('.xls'))
                      ? 'Parsing Excel file and importing data...'
                      : 'Parsing and importing transactions...'}
                  </p>
                  <p className="text-gray-400 text-sm">This may take a moment for large files</p>
                </div>
              ) : (
                <>
                  <div className="w-14 h-14 bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Upload className="w-7 h-7 text-gray-400" />
                  </div>
                  <p className="text-white font-medium mb-1">Drop your Nayax file here</p>
                  <p className="text-gray-400 text-sm mb-2">or click to browse</p>
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <span className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded font-mono">.csv</span>
                    <span className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded font-mono">.xlsx</span>
                    <span className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded font-mono">.xls</span>
                  </div>
                  <button
                    type="button"
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors pointer-events-none"
                  >
                    Choose File
                  </button>
                </>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="mt-4 flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-300 font-medium text-sm">Upload failed</p>
                  <p className="text-red-400 text-sm mt-0.5">{error}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Success Result */}
        {result && (
          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 lg:p-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-500/20 border border-green-500/30 rounded-2xl flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-white font-semibold text-lg">Import complete!</h2>
                <p className="text-gray-300 mt-1">
                  Imported <span className="text-white font-bold">{result.rows_imported.toLocaleString()}</span> rows
                  {result.machines.length > 0 && (
                    <> from <span className="text-white font-bold">{result.machines.length}</span> machine{result.machines.length !== 1 ? 's' : ''}</>
                  )}
                </p>
                {result.file_format && (
                  <p className="text-gray-500 text-xs mt-0.5">
                    {result.file_format === 'excel' ? 'Parsed from Excel (.xlsx/.xls)' : 'Parsed from CSV'}
                  </p>
                )}
                {result.date_range?.start && (
                  <p className="text-gray-400 text-sm mt-1">
                    {formatDate(result.date_range.start)} — {formatDate(result.date_range.end)}
                  </p>
                )}

                {result.machines.length > 0 && (
                  <div className="mt-3">
                    <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Machines</p>
                    <div className="flex flex-wrap gap-2">
                      {result.machines.map(m => (
                        <span key={m} className="bg-gray-700 text-gray-200 text-xs px-2.5 py-1 rounded-lg">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <Link
                href="/dashboard"
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                View Dashboard
              </Link>
              <button
                onClick={handleReset}
                className="text-gray-400 hover:text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors border border-gray-600 hover:border-gray-500"
              >
                Upload Another
              </button>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6">
          <p className="text-gray-300 text-sm font-medium mb-3">Supported Nayax exports:</p>
          <div className="space-y-4">
            <div>
              <p className="text-gray-300 text-sm font-medium mb-1.5">Transaction CSV (Sales Summary)</p>
              <ol className="text-gray-400 text-sm space-y-1 list-decimal list-inside">
                <li>Go to Reports → Online Reports → Sales Summary</li>
                <li>Select your Actor and set your date range</li>
                <li>Click <strong className="text-gray-300">View Report</strong> → <strong className="text-gray-300">Export → CSV</strong></li>
              </ol>
            </div>
            <div className="border-t border-gray-700 pt-4">
              <p className="text-gray-300 text-sm font-medium mb-1.5">Sales By Product Report (XLSX)</p>
              <ol className="text-gray-400 text-sm space-y-1 list-decimal list-inside">
                <li>Go to Reports → Online Reports → Sales By Product</li>
                <li>Select your machine and date range</li>
                <li>Click <strong className="text-gray-300">View Report</strong> → <strong className="text-gray-300">Export → Excel (XLSX)</strong></li>
                <li>Upload the <span className="font-mono text-xs bg-gray-700 px-1 py-0.5 rounded">.xlsx</span> file here</li>
              </ol>
            </div>
          </div>
          <p className="text-gray-500 text-xs mt-4">
            VendIQ auto-detects the file format and report type. CSV, XLSX, and XLS are all supported.
          </p>
        </div>
      </div>
    </div>
  )
}
