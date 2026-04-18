import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as XLSX from 'xlsx'

// Supabase admin client (bypasses RLS via service role key)
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

function parseTSVWithBOM(text: string): Record<string, string>[] {
  // Strip UTF-8 BOM if present
  const cleaned = text.startsWith('\uFEFF') ? text.slice(1) : text

  const lines = cleaned.split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length < 2) return []

  // Auto-detect delimiter: tab vs comma
  const firstLine = lines[0]
  const delimiter = firstLine.includes('\t') ? '\t' : ','

  const headers = firstLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''))

  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delimiter)
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] || '').trim().replace(/^"|"$/g, '')
    })
    rows.push(row)
  }
  return rows
}

/**
 * Parse XLSX or XLS buffer into the same row structure as parseTSVWithBOM.
 * Handles both the Transaction CSV format AND the Sales By Product report format.
 *
 * Nayax Sales By Product quirks:
 * - Uses inlineStr cell type (xlsx handles this automatically with dense mode)
 * - Row 0 is a metadata row ("Sales Summary", date range) — must be skipped
 * - Row 1 is the real header row
 * - Column names have trailing spaces that must be trimmed
 */
function parseExcelBuffer(buffer: ArrayBuffer): Record<string, string>[] {
  const workbook = XLSX.read(buffer, { type: 'array', dense: true })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  // sheet_to_json with header:1 gives us an array-of-arrays, letting us
  // manually handle the metadata row skip and header trimming.
  const allRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  })

  if (allRows.length < 2) return []

  // Detect if row 0 is a metadata row (Sales By Product pattern):
  // row 0 col 0 is something like "Sales Summary" or contains a date range,
  // NOT a real column header. Row 1 in that case holds the real headers.
  const firstCell = String((allRows[0] as unknown[])[0] ?? '').trim()
  const isMetadataFirst =
    firstCell.toLowerCase().includes('sales') ||
    firstCell.toLowerCase().includes('summary') ||
    firstCell.toLowerCase().includes('report') ||
    firstCell === '' ||
    // Real header rows start with "Product" or known column names
    !firstCell.toLowerCase().startsWith('product')

  const headerRowIdx = isMetadataFirst ? 1 : 0
  const dataStartIdx = headerRowIdx + 1

  if (allRows.length <= dataStartIdx) return []

  // Build trimmed header array
  const headers = (allRows[headerRowIdx] as unknown[]).map(h => String(h ?? '').trim())

  const rows: Record<string, string>[] = []
  for (let i = dataStartIdx; i < allRows.length; i++) {
    const cells = allRows[i] as unknown[]
    // Skip completely empty rows
    if (cells.every(c => String(c ?? '').trim() === '')) continue
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = String(cells[idx] ?? '').trim()
    })
    rows.push(row)
  }
  return rows
}

function cleanProductName(raw: string): string {
  // Strip trailing slot info like "(2, 2 = 1.75)" or "(56)"
  return raw.replace(/\s*\([^)]*\)\s*$/, '').trim()
}

function parseCents(val: string): number {
  const n = parseFloat(val.replace(/[,$]/g, ''))
  if (isNaN(n)) return 0
  return Math.round(n * 100)
}

/**
 * Detect whether this is a "Sales By Product" report (from XLSX export)
 * vs the standard transaction CSV.  Sales By Product has "Product Name" and
 * "Total Transaction Amount" columns but no "machine_name" column.
 * Column names are already trimmed by parseExcelBuffer.
 */
function isSalesByProductReport(rows: Record<string, string>[]): boolean {
  if (rows.length === 0) return false
  const keys = Object.keys(rows[0])
  return (
    keys.includes('Product Name') &&
    (keys.includes('Total Transaction Amount') || keys.includes('Total Transaction/Vend Count')) &&
    !keys.includes('machine_name')
  )
}

/**
 * Map a Sales By Product row into a pseudo-transaction row so the existing
 * insert logic can handle it with minimal changes.
 *
 * Exact column names (after trimming trailing spaces from the XLSX):
 *   Product Name, Product ID, Product Barcode, Catalog Number,
 *   Credit Card, Credit Card Transaction Count,
 *   Monyx App Using Monyx Balance, Monyx App Using Monyx Balance Transaction Count,
 *   Cash, Cash Transaction Count, Currency,
 *   Total Transaction/Vend Count, Total Transaction Amount
 */
function mapSalesByProductRows(
  rows: Record<string, string>[],
  machineName: string
): Record<string, string>[] {
  return rows.map((r, idx) => {
    const productId = r['Product ID'] || String(idx)
    return {
      machine_name: machineName,
      product_name: r['Product Name'] || '',
      product_id: productId,
      product_barcode: r['Product Barcode'] || '',
      catalog_number: r['Catalog Number'] || '',
      currency: r['Currency'] || 'USD',
      // Synthetic transaction_id for dedup
      transaction_id: `sbp-${machineName}-${productId}-${Date.now()}-${idx}`,
      // Use today as date (SBP is an aggregated report, no per-tx dates)
      machineAuTime_Date: new Date().toISOString().slice(0, 10),
      // Amount and quantity from the correct trimmed column names
      auValue: r['Total Transaction Amount'] || '0',
      total_tx_count: r['Total Transaction/Vend Count'] || '0',
      payment_method_descr: 'Mixed',
    }
  })
}

export async function POST(req: NextRequest) {
  // --- Auth: accept either NextAuth session OR API key header ---
  const apiKeyHeader = req.headers.get('x-vendiq-key')
  const expectedKey = process.env.VENDIQ_API_KEY

  if (apiKeyHeader) {
    if (!expectedKey || apiKeyHeader !== expectedKey) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }
    // Automation path — proceed with sentinel UUID
  } else {
    // Web upload path — require NextAuth session
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Failed to parse form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  }

  const fileName = file.name.toLowerCase()
  const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')

  // Optional machine name hint from form (used for Sales By Product reports)
  const machineNameHint = (formData.get('machine_name') as string | null) || 'Unknown Machine'

  let rows: Record<string, string>[]

  if (isExcel) {
    const buffer = await file.arrayBuffer()
    try {
      rows = parseExcelBuffer(buffer)
    } catch (e) {
      console.error('Excel parse error:', e)
      return NextResponse.json({ error: 'Failed to parse Excel file. Make sure it is a valid .xlsx or .xls export from Nayax.' }, { status: 400 })
    }
  } else {
    // CSV / TSV / TXT
    const text = await file.text()
    rows = parseTSVWithBOM(text)
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: 'File appears empty or invalid' }, { status: 400 })
  }

  // If this is a Sales By Product report, remap into transaction-compatible rows
  if (isSalesByProductReport(rows)) {
    rows = mapSalesByProductRows(rows, machineNameHint)
  }

  const supabase = getSupabaseAdmin()

  // Track machines seen in this upload
  const machineMap: Record<string, string> = {} // machine_name -> machine uuid
  const machineNames: string[] = []
  let rowsImported = 0
  let minDate = ''
  let maxDate = ''

  // First pass: collect unique machine names
  const uniqueMachinesSet = new Set(rows.map(r => r.machine_name).filter(Boolean))
  const uniqueMachines = Array.from(uniqueMachinesSet)

  // Upsert machines
  for (const machineName of uniqueMachines) {
    const nayaxId = rows.find(r => r.machine_name === machineName)?.machine_id || null
    const hwSerial = rows.find(r => r.machine_name === machineName)?.HW_serial || null

    const { data: existing } = await supabase
      .from('dashboard_machines')
      .select('id')
      .eq('name', machineName)
      .limit(1)
      .maybeSingle()

    if (existing) {
      machineMap[machineName] = existing.id
    } else {
      const { data: inserted, error } = await supabase
        .from('dashboard_machines')
        .insert({
          user_id: '00000000-0000-0000-0000-000000000001',
          name: machineName,
          nayax_device_id: nayaxId || hwSerial,
          is_active: true,
        })
        .select('id')
        .single()

      if (error) {
        console.error('Error inserting machine:', machineName, error)
      } else if (inserted) {
        machineMap[machineName] = inserted.id
        machineNames.push(machineName)
      }
    }
  }

  // Second pass: insert transactions
  const transactionBatch: Record<string, unknown>[] = []
  const seenTxIds = new Set<string>()

  for (const row of rows) {
    const txId = row.transaction_id
    if (!txId || seenTxIds.has(txId)) continue
    seenTxIds.add(txId)

    const machineName = row.machine_name
    const machineId = machineMap[machineName] || null

    const dateStr = row.machineAuTime_Date || ''
    const timeStr = row.machineAuTime_Time || ''
    const transactionDate = dateStr
      ? `${dateStr}${timeStr ? 'T' + timeStr : 'T00:00:00'}`
      : null

    if (dateStr) {
      if (!minDate || dateStr < minDate) minDate = dateStr
      if (!maxDate || dateStr > maxDate) maxDate = dateStr
    }

    const rawProductName = row.product_name || ''
    const productName = cleanProductName(rawProductName)
    const amountCents = parseCents(row.auValue || row.total_tx_amount || '0')
    const costCents = parseCents(row.cost_price || '0')
    const paymentType = row.payment_method_descr || null
    const productCategory = row.product_group_descr || null
    const slotNumber = row.product_code_in_map || null
    // For SBP reports, total_tx_count holds the vend count; for transaction CSVs it's always 1
    const quantity = row.total_tx_count ? (parseInt(row.total_tx_count, 10) || 1) : 1

    transactionBatch.push({
      user_id: '00000000-0000-0000-0000-000000000001',
      machine_id: machineId,
      nayax_device_id: row.machine_id || row.HW_serial || null,
      transaction_date: transactionDate,
      product_name: productName,
      product_sku: slotNumber,
      amount_cents: amountCents,
      cost_cents: costCents,
      quantity,
      payment_type: paymentType,
      product_category: productCategory,
      transaction_id: txId,
      tran_status: row.tran_status_name || null,
      raw_csv_row: row,
    })
  }

  // Batch insert in chunks of 200
  const CHUNK = 200
  for (let i = 0; i < transactionBatch.length; i += CHUNK) {
    const chunk = transactionBatch.slice(i, i + CHUNK)
    const { error } = await supabase
      .from('dashboard_transactions')
      .upsert(chunk, { onConflict: 'transaction_id', ignoreDuplicates: true })

    if (error) {
      // Fallback to plain insert if upsert fails (e.g. missing unique constraint)
      const { error: insertError, count } = await supabase
        .from('dashboard_transactions')
        .insert(chunk, { count: 'exact' })
      if (!insertError) {
        rowsImported += count || chunk.length
      } else {
        console.error('Insert error:', insertError)
      }
    } else {
      rowsImported += chunk.length
    }
  }

  // Record the upload
  await supabase.from('dashboard_csv_uploads').insert({
    user_id: '00000000-0000-0000-0000-000000000001',
    filename: file.name,
    row_count: transactionBatch.length,
    date_range_start: minDate || null,
    date_range_end: maxDate || null,
    status: 'complete',
  })

  return NextResponse.json({
    success: true,
    rows_imported: rowsImported || transactionBatch.length,
    machines: Object.keys(machineMap),
    date_range: { start: minDate, end: maxDate },
    file_format: isExcel ? 'excel' : 'csv',
  })
}
