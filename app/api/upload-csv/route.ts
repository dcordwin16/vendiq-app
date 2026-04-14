import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

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

  const headers = lines[0].split('\t').map(h => h.trim())

  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split('\t')
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] || '').trim()
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
  const n = parseFloat(val)
  if (isNaN(n)) return 0
  return Math.round(n * 100)
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

  const text = await file.text()
  const rows = parseTSVWithBOM(text)

  if (rows.length === 0) {
    return NextResponse.json({ error: 'CSV appears empty or invalid' }, { status: 400 })
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

    // Check if machine already exists (by name, since we use email as user_id for NextAuth)
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
          user_id: '00000000-0000-0000-0000-000000000001', // sentinel UUID for NextAuth users
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
    const amountCents = parseCents(row.auValue)
    const costCents = parseCents(row.cost_price)
    const paymentType = row.payment_method_descr || null
    const productCategory = row.product_group_descr || null
    const slotNumber = row.product_code_in_map || null

    transactionBatch.push({
      user_id: '00000000-0000-0000-0000-000000000001',
      machine_id: machineId,
      nayax_device_id: row.machine_id || row.HW_serial || null,
      transaction_date: transactionDate,
      product_name: productName,
      product_sku: slotNumber,
      amount_cents: amountCents,
      cost_cents: costCents,
      quantity: 1,
      payment_type: paymentType,
      product_category: productCategory,
      transaction_id: txId,
      tran_status: row.tran_status_name || null,
      raw_csv_row: row,
    })
  }

  // Batch insert transactions (skip duplicates by transaction_id)
  // Insert in chunks of 200
  const CHUNK = 200
  for (let i = 0; i < transactionBatch.length; i += CHUNK) {
    const chunk = transactionBatch.slice(i, i + CHUNK)
    const { error } = await supabase
      .from('dashboard_transactions')
      .upsert(chunk, { onConflict: 'transaction_id', ignoreDuplicates: true })

    if (error) {
      // If transaction_id column doesn't exist yet, fall back to plain insert
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
  })
}
