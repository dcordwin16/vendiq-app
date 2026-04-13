-- VendIQ Phase 1 Schema Migration
-- Paste this into the Supabase SQL editor for project fqwpvncgtalskpxrmgzc
-- All tables are prefixed with dashboard_ to avoid conflicts with beta_signups

-- ============================================================
-- dashboard_machines
-- ============================================================
create table if not exists dashboard_machines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  nayax_device_id text,
  name text not null,
  location text,
  location_pair text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Enable RLS
alter table dashboard_machines enable row level security;

-- Users can only see their own machines
create policy "Users can view their own machines"
  on dashboard_machines for select
  using (auth.uid() = user_id);

create policy "Users can insert their own machines"
  on dashboard_machines for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own machines"
  on dashboard_machines for update
  using (auth.uid() = user_id);

create policy "Users can delete their own machines"
  on dashboard_machines for delete
  using (auth.uid() = user_id);

-- ============================================================
-- dashboard_transactions
-- ============================================================
create table if not exists dashboard_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  machine_id uuid references dashboard_machines(id) on delete set null,
  nayax_device_id text,
  transaction_date timestamptz,
  product_name text,
  product_sku text,
  amount_cents integer,
  quantity integer default 1,
  payment_type text,
  raw_csv_row jsonb,
  created_at timestamptz default now()
);

-- Enable RLS
alter table dashboard_transactions enable row level security;

create policy "Users can view their own transactions"
  on dashboard_transactions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own transactions"
  on dashboard_transactions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own transactions"
  on dashboard_transactions for update
  using (auth.uid() = user_id);

create policy "Users can delete their own transactions"
  on dashboard_transactions for delete
  using (auth.uid() = user_id);

-- Index for fast queries
create index if not exists dashboard_transactions_user_id_idx on dashboard_transactions(user_id);
create index if not exists dashboard_transactions_machine_id_idx on dashboard_transactions(machine_id);
create index if not exists dashboard_transactions_date_idx on dashboard_transactions(transaction_date);

-- ============================================================
-- dashboard_products
-- ============================================================
create table if not exists dashboard_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  sku text,
  barcode text,
  category text,
  cost_cents integer,
  price_cents integer,
  created_at timestamptz default now()
);

-- Enable RLS
alter table dashboard_products enable row level security;

create policy "Users can view their own products"
  on dashboard_products for select
  using (auth.uid() = user_id);

create policy "Users can insert their own products"
  on dashboard_products for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own products"
  on dashboard_products for update
  using (auth.uid() = user_id);

create policy "Users can delete their own products"
  on dashboard_products for delete
  using (auth.uid() = user_id);

-- ============================================================
-- dashboard_csv_uploads
-- ============================================================
create table if not exists dashboard_csv_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  filename text,
  row_count integer,
  date_range_start date,
  date_range_end date,
  status text default 'pending',
  error_message text,
  created_at timestamptz default now()
);

-- Enable RLS
alter table dashboard_csv_uploads enable row level security;

create policy "Users can view their own uploads"
  on dashboard_csv_uploads for select
  using (auth.uid() = user_id);

create policy "Users can insert their own uploads"
  on dashboard_csv_uploads for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own uploads"
  on dashboard_csv_uploads for update
  using (auth.uid() = user_id);

create policy "Users can delete their own uploads"
  on dashboard_csv_uploads for delete
  using (auth.uid() = user_id);
