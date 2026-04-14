-- VendIQ Phase 2 — RLS Policies for single-operator MVP
-- Paste this into the Supabase SQL editor for project fqwpvncgtalskpxrmgzc

-- ============================================================
-- Allow anon to INSERT (MVP single-operator mode)
-- Dan is the only user — no multi-tenant security needed yet
-- ============================================================

CREATE POLICY "allow_anon_insert_machines"
  ON dashboard_machines FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "allow_anon_insert_transactions"
  ON dashboard_transactions FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "allow_anon_insert_products"
  ON dashboard_products FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "allow_anon_insert_csv_uploads"
  ON dashboard_csv_uploads FOR INSERT TO anon WITH CHECK (true);

-- ============================================================
-- Allow anon to SELECT all rows
-- ============================================================

CREATE POLICY "allow_anon_select_machines"
  ON dashboard_machines FOR SELECT TO anon USING (true);

CREATE POLICY "allow_anon_select_transactions"
  ON dashboard_transactions FOR SELECT TO anon USING (true);

CREATE POLICY "allow_anon_select_products"
  ON dashboard_products FOR SELECT TO anon USING (true);

CREATE POLICY "allow_anon_select_csv_uploads"
  ON dashboard_csv_uploads FOR SELECT TO anon USING (true);

-- ============================================================
-- Also add columns needed by Phase 2 CSV parser
-- (Run these if they don't exist yet)
-- ============================================================

ALTER TABLE dashboard_transactions
  ADD COLUMN IF NOT EXISTS cost_cents integer,
  ADD COLUMN IF NOT EXISTS product_category text,
  ADD COLUMN IF NOT EXISTS transaction_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS tran_status text;

-- Index for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS dashboard_transactions_tx_id_idx
  ON dashboard_transactions(transaction_id)
  WHERE transaction_id IS NOT NULL;
