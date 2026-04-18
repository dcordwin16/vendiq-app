-- VendIQ — historical_baselines table
-- Stores aggregate revenue totals from XLSX imports (Sales By Machine report)
-- so they don't pollute the real transaction feed from SQS.
-- Paste into the Supabase SQL editor for project fqwpvncgtalskpxrmgzc

CREATE TABLE IF NOT EXISTS historical_baselines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  machine_name        text NOT NULL,
  machine_serial      text,
  period_start        date NOT NULL,
  period_end          date NOT NULL,
  total_revenue       integer NOT NULL DEFAULT 0,  -- cents
  transaction_count   integer NOT NULL DEFAULT 0,
  source_file         text,   -- original filename for audit
  created_at  timestamptz NOT NULL DEFAULT now(),

  -- One baseline row per machine+period — upsert-safe
  UNIQUE (user_id, machine_name, period_start, period_end)
);

-- RLS
ALTER TABLE historical_baselines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_anon_select_baselines"
  ON historical_baselines FOR SELECT TO anon USING (true);

CREATE POLICY "allow_anon_insert_baselines"
  ON historical_baselines FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "allow_anon_delete_baselines"
  ON historical_baselines FOR DELETE TO anon USING (true);

-- Index for dashboard queries
CREATE INDEX IF NOT EXISTS historical_baselines_machine_idx
  ON historical_baselines (user_id, machine_name);
