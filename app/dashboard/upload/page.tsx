'use client'

import { useState, useRef, DragEvent } from 'react'
import { Upload, CheckCircle, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface UploadResult {
  success: boolean
  rows_imported: number
  machines: string[]
  date_range: { start: string; end: string }
  error?: string
}

export default function UploadPage() {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt') && !file.name.endsWith('.tsv')) {
      setError('Please upload a CSV file exported from Nayax.')
      return
    }

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
          <h1 className="text-2xl font-bold text-white">Upload Nayax CSV</h1>
          <p className="text-gray-400 mt-0.5 text-sm">Import transaction data from your Nayax CSV export</p>
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
                accept=".csv,.txt,.tsv"
                className="hidden"
                onChange={handleInputChange}
                disabled={isUploading}
              />

              {isUploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
                  <p className="text-white font-medium">Parsing and importing transactions...</p>
                  <p className="text-gray-400 text-sm">This may take a moment for large files</p>
                </div>
              ) : (
                <>
                  <div className="w-14 h-14 bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Upload className="w-7 h-7 text-gray-400" />
                  </div>
                  <p className="text-white font-medium mb-1">Drop your Nayax CSV here</p>
                  <p className="text-gray-400 text-sm mb-4">or click to browse files</p>
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
                  Imported <span className="text-white font-bold">{result.rows_imported.toLocaleString()}</span> transactions
                  {' '}from <span className="text-white font-bold">{result.machines.length}</span> machine{result.machines.length !== 1 ? 's' : ''}
                </p>
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
          <p className="text-gray-300 text-sm font-medium mb-3">How to export from Nayax:</p>
          <ol className="text-gray-400 text-sm space-y-1.5 list-decimal list-inside">
            <li>Log in to <span className="text-blue-400">my.nayax.com</span></li>
            <li>Go to Reports → Sales Summary</li>
            <li>Set your date range (up to 90 days recommended)</li>
            <li>Click Export → CSV</li>
            <li>Upload the downloaded file here</li>
          </ol>
          <p className="text-gray-500 text-xs mt-3">
            Nayax exports tab-separated CSV files. VendIQ will automatically detect the format.
          </p>
        </div>
      </div>
    </div>
  )
}
