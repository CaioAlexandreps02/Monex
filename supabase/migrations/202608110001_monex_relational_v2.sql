create extension if not exists "pgcrypto";

create table if not exists public.monex_accounts (
  id text primary key,
  owner_key text not null default 'default',
  name text not null,
  type text not null,
  initial_balance numeric(12, 2) not null default 0,
  current_balance numeric(12, 2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monex_cards (
  id text primary key,
  owner_key text not null default 'default',
  linked_account_id text references public.monex_accounts(id) on delete set null,
  name text not null,
  issuer text not null,
  brand text not null,
  last_digits text not null,
  accent_color text not null,
  available_mode text not null check (available_mode in ('credit', 'debit', 'both')),
  closing_day integer not null check (closing_day between 1 and 31),
  due_day integer not null check (due_day between 1 and 31),
  credit_limit numeric(12, 2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monex_categories (
  id text primary key,
  owner_key text not null default 'default',
  name text not null,
  type text not null check (type in ('income', 'expense')),
  color text not null,
  parent_id text references public.monex_categories(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monex_transaction_groups (
  id text primary key,
  owner_key text not null default 'default',
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monex_bills (
  id text primary key,
  owner_key text not null default 'default',
  title text not null,
  amount numeric(12, 2) not null,
  category_id text references public.monex_categories(id) on delete set null,
  category_name text not null,
  due_date date not null,
  priority text not null,
  is_recurring boolean not null default false,
  recurring_day integer check (recurring_day between 1 and 31),
  status text not null check (status in ('pending', 'paid', 'overdue')),
  planned_payment_method text check (planned_payment_method in ('pix', 'cash', 'bank_transfer', 'card')),
  planned_card_id text references public.monex_cards(id) on delete set null,
  planned_card_mode text check (planned_card_mode in ('credit', 'debit')),
  installments integer,
  recurring_group_id text,
  group_id text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monex_transactions (
  id text primary key,
  owner_key text not null default 'default',
  title text not null,
  type text not null check (type in ('income', 'expense')),
  amount numeric(12, 2) not null,
  date date not null,
  category_id text references public.monex_categories(id) on delete set null,
  category_name text not null,
  description text,
  account_id text references public.monex_accounts(id) on delete set null,
  payment_method text not null check (payment_method in ('pix', 'cash', 'bank_transfer', 'credit_card', 'debit_card')),
  status text not null check (status in ('planned', 'received', 'paid')),
  income_kind text,
  expense_kind text,
  card_id text references public.monex_cards(id) on delete set null,
  card_mode text check (card_mode in ('credit', 'debit')),
  installment_group_id text,
  installment_number integer,
  installment_total integer,
  source_bill_id text references public.monex_bills(id) on delete set null,
  linked_planned_purchase_id text,
  notes text,
  group_id text references public.monex_transaction_groups(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monex_debts (
  id text primary key,
  owner_key text not null default 'default',
  name text not null,
  description text,
  total_amount numeric(12, 2) not null,
  paid_amount numeric(12, 2) not null default 0,
  remaining_amount numeric(12, 2) not null,
  total_installments integer not null default 1,
  paid_installments integer not null default 0,
  installment_amount numeric(12, 2) not null,
  next_due_date date not null,
  priority text not null,
  status text not null check (status in ('active', 'paused', 'settled')),
  planned_payment_method text check (planned_payment_method in ('pix', 'cash', 'bank_transfer', 'card')),
  planned_card_id text references public.monex_cards(id) on delete set null,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monex_fixed_flow_entries (
  id text primary key,
  owner_key text not null default 'default',
  section text not null,
  title text not null,
  kind text not null check (kind in ('income', 'expense')),
  category_id text references public.monex_categories(id) on delete set null,
  category_name text not null,
  amount_by_month jsonb not null default '{}'::jsonb,
  completed_months text[] not null default '{}',
  payment_method text not null check (payment_method in ('pix', 'cash', 'bank_transfer', 'credit_card', 'debit_card')),
  account_id text references public.monex_accounts(id) on delete set null,
  card_id text references public.monex_cards(id) on delete set null,
  card_mode text check (card_mode in ('credit', 'debit')),
  linked_bill_group_id text,
  linked_debt_id text references public.monex_debts(id) on delete set null,
  linked_investment_id text,
  sync_card_limit boolean,
  manual_amount_months text[] not null default '{}',
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monex_planned_purchases (
  id text primary key,
  owner_key text not null default 'default',
  name text not null,
  description text,
  estimated_value numeric(12, 2) not null,
  priority text not null,
  desired_date date,
  target_month text,
  target_week text,
  schedule_type text check (schedule_type in ('week', 'month')),
  specific_month_target boolean not null default false,
  board_column text not null,
  saved_amount numeric(12, 2) not null default 0,
  suggested_period_amount numeric(12, 2) not null default 0,
  planned_amount_by_month jsonb not null default '{}'::jsonb,
  status text not null,
  planning_mode text,
  planned_payment_method text check (planned_payment_method in ('pix', 'cash', 'bank_transfer', 'card')),
  planned_card_id text references public.monex_cards(id) on delete set null,
  planned_card_mode text check (planned_card_mode in ('credit', 'debit')),
  planned_installments integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monex_investments (
  id text primary key,
  owner_key text not null default 'default',
  name text not null,
  type text not null,
  objective text,
  total_gross_invested numeric(12, 2) not null default 0,
  current_manual_value numeric(12, 2),
  notes text,
  monthly_target numeric(12, 2) not null default 0,
  payment_method text check (payment_method in ('pix', 'cash', 'bank_transfer', 'credit_card', 'debit_card')),
  account_id text references public.monex_accounts(id) on delete set null,
  card_id text references public.monex_cards(id) on delete set null,
  card_mode text check (card_mode in ('credit', 'debit')),
  planned_amount_by_month jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monex_investment_contributions (
  id text primary key,
  owner_key text not null default 'default',
  investment_id text not null references public.monex_investments(id) on delete cascade,
  contribution_date date not null,
  amount numeric(12, 2) not null,
  month_value text,
  source text,
  linked_transaction_id text references public.monex_transactions(id) on delete set null,
  payment_method text check (payment_method in ('pix', 'cash', 'bank_transfer', 'credit_card', 'debit_card')),
  account_id text references public.monex_accounts(id) on delete set null,
  card_id text references public.monex_cards(id) on delete set null,
  card_mode text check (card_mode in ('credit', 'debit')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monex_card_bill_estimates (
  id text primary key,
  owner_key text not null default 'default',
  card_id text not null references public.monex_cards(id) on delete cascade,
  month_value text not null,
  estimated_amount numeric(12, 2) not null default 0,
  is_auto_estimate boolean not null default true,
  status text not null check (status in ('pending', 'paid')),
  paid_transaction_id text references public.monex_transactions(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_key, card_id, month_value)
);

create table if not exists public.monex_imported_statement_batches (
  id text primary key,
  owner_key text not null default 'default',
  file_name text not null,
  file_type text not null check (file_type in ('csv', 'ofx')),
  source_kind text not null check (source_kind in ('bank_account', 'credit_card', 'unknown')),
  transport text check (transport in ('manual_upload', 'email_attachment', 'open_finance')),
  source_institution text,
  account_id text references public.monex_accounts(id) on delete set null,
  card_id text references public.monex_cards(id) on delete set null,
  external_source_id text,
  source_label text,
  imported_at timestamptz not null,
  period_start date,
  period_end date,
  status text not null check (status in ('pending_review', 'partially_confirmed', 'confirmed', 'archived')),
  item_count integer not null default 0,
  confirmed_count integer not null default 0,
  ignored_count integer not null default 0,
  duplicate_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monex_import_merchants (
  id text primary key,
  owner_key text not null default 'default',
  name text not null,
  aliases text[] not null default '{}',
  source_kind text not null check (source_kind in ('bank_account', 'credit_card', 'unknown')),
  suggested_category_id text references public.monex_categories(id) on delete set null,
  suggested_transaction_type text check (suggested_transaction_type in ('income', 'expense')),
  payment_method text check (payment_method in ('pix', 'cash', 'bank_transfer', 'credit_card', 'debit_card')),
  suggested_match jsonb,
  support_count integer not null default 0,
  mistake_count integer not null default 0,
  status text not null check (status in ('suggested', 'approved', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_applied_at timestamptz
);

create table if not exists public.monex_import_learning_rules (
  id text primary key,
  owner_key text not null default 'default',
  pattern text not null,
  source_kind text not null check (source_kind in ('bank_account', 'credit_card', 'unknown')),
  suggested_category_id text references public.monex_categories(id) on delete set null,
  suggested_transaction_type text check (suggested_transaction_type in ('income', 'expense')),
  payment_method text check (payment_method in ('pix', 'cash', 'bank_transfer', 'credit_card', 'debit_card')),
  suggested_match jsonb,
  support_count integer not null default 0,
  mistake_count integer not null default 0,
  status text not null check (status in ('suggested', 'approved', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_applied_at timestamptz
);

create table if not exists public.monex_import_automation_configs (
  id text primary key,
  owner_key text not null default 'default',
  transport text not null check (transport in ('email_attachment', 'open_finance')),
  label text not null,
  status text not null check (status in ('planned', 'needs_authorization', 'active', 'paused', 'disabled')),
  is_enabled boolean not null default false,
  provider text,
  account_id text references public.monex_accounts(id) on delete set null,
  card_id text references public.monex_cards(id) on delete set null,
  allowed_senders text[] not null default '{}',
  keywords text[] not null default '{}',
  external_connection_id text,
  processed_external_ids text[] not null default '{}',
  authorized_at timestamptz,
  last_sync_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monex_imported_statement_items (
  id text primary key,
  owner_key text not null default 'default',
  batch_id text not null references public.monex_imported_statement_batches(id) on delete cascade,
  raw_description text not null,
  review_title text,
  normalized_description text not null,
  date date not null,
  amount numeric(12, 2) not null,
  direction text not null check (direction in ('inflow', 'outflow')),
  source_kind text not null check (source_kind in ('bank_account', 'credit_card', 'unknown')),
  transport text check (transport in ('manual_upload', 'email_attachment', 'open_finance')),
  payment_method text not null,
  account_id text references public.monex_accounts(id) on delete set null,
  card_id text references public.monex_cards(id) on delete set null,
  external_item_id text,
  origin_label text,
  suggested_category_id text references public.monex_categories(id) on delete set null,
  suggested_transaction_type text check (suggested_transaction_type in ('income', 'expense')),
  suggested_match jsonb,
  applied_learning_rule_id text references public.monex_import_learning_rules(id) on delete set null,
  detected_merchant_id text references public.monex_import_merchants(id) on delete set null,
  statement_month text,
  confidence numeric(5, 2) not null default 0,
  status text not null check (status in ('pending', 'confirmed', 'ignored', 'duplicate')),
  confirmed_transaction_id text references public.monex_transactions(id) on delete set null,
  ignored_reason text,
  fingerprint text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monex_monthly_plans (
  id text primary key,
  owner_key text not null default 'default',
  month_value text not null,
  month_label text not null,
  fixed_income_planned numeric(12, 2) not null default 0,
  variable_income_planned numeric(12, 2) not null default 0,
  fixed_expenses_planned numeric(12, 2) not null default 0,
  variable_expenses_planned numeric(12, 2) not null default 0,
  debt_target numeric(12, 2) not null default 0,
  investment_target numeric(12, 2) not null default 0,
  extra_income_goal numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_key, month_value)
);

create table if not exists public.monex_monthly_plan_category_budgets (
  id text primary key,
  owner_key text not null default 'default',
  monthly_plan_id text not null references public.monex_monthly_plans(id) on delete cascade,
  budget_key text not null,
  name text not null,
  kind text not null check (kind in ('income', 'expense', 'reserve', 'investment', 'debt')),
  planned numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monex_reserve_goals (
  id text primary key,
  owner_key text not null default 'default',
  monthly_plan_id text not null references public.monex_monthly_plans(id) on delete cascade,
  goal_key text not null,
  name text not null,
  target numeric(12, 2) not null,
  current numeric(12, 2) not null default 0,
  deadline date not null,
  priority text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monex_settings (
  owner_key text primary key default 'default',
  fixed_salary_expected numeric(12, 2) not null default 0,
  monthly_investment_target numeric(12, 2) not null default 0,
  monthly_debt_payment_cap numeric(12, 2) not null default 0,
  bank_presets jsonb not null default '[]'::jsonb,
  default_account_id text references public.monex_accounts(id) on delete set null,
  default_card_id text references public.monex_cards(id) on delete set null,
  week_start_day integer not null default 1,
  extra_income_goal numeric(12, 2) not null default 0,
  default_bill_payment_method text check (default_bill_payment_method in ('pix', 'cash', 'bank_transfer', 'card')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_monex_accounts_owner on public.monex_accounts (owner_key);
create index if not exists idx_monex_cards_owner on public.monex_cards (owner_key);
create index if not exists idx_monex_cards_linked_account on public.monex_cards (linked_account_id);
create index if not exists idx_monex_categories_owner_type on public.monex_categories (owner_key, type);
create index if not exists idx_monex_transactions_owner_date on public.monex_transactions (owner_key, date desc);
create index if not exists idx_monex_transactions_source_bill on public.monex_transactions (source_bill_id);
create index if not exists idx_monex_transactions_card_month on public.monex_transactions (owner_key, card_id, card_mode, date);
create index if not exists idx_monex_bills_owner_due_date on public.monex_bills (owner_key, due_date);
create index if not exists idx_monex_bills_card_due_date on public.monex_bills (owner_key, planned_card_id, planned_card_mode, due_date);
create index if not exists idx_monex_bills_recurring_group on public.monex_bills (owner_key, recurring_group_id);
create index if not exists idx_monex_bills_group_id on public.monex_bills (owner_key, group_id) where group_id is not null;
create index if not exists idx_monex_debts_owner_status on public.monex_debts (owner_key, status);
create index if not exists idx_monex_fixed_entries_owner_section on public.monex_fixed_flow_entries (owner_key, section);
create index if not exists idx_monex_import_items_batch on public.monex_imported_statement_items (batch_id);
create index if not exists idx_monex_import_items_status on public.monex_imported_statement_items (owner_key, status);
create index if not exists idx_monex_import_items_external on public.monex_imported_statement_items (owner_key, external_item_id) where external_item_id is not null;
create index if not exists idx_monex_import_items_fingerprint on public.monex_imported_statement_items (owner_key, fingerprint);
create index if not exists idx_monex_import_merchants_owner_status on public.monex_import_merchants (owner_key, status);

create unique index if not exists monex_bills_unique_group_month_title
on public.monex_bills (owner_key, recurring_group_id, due_date, title)
where recurring_group_id is not null;

create index if not exists idx_monex_transactions_owner_source_bill
on public.monex_transactions (owner_key, source_bill_id)
where source_bill_id is not null;

alter table public.monex_accounts enable row level security;
alter table public.monex_cards enable row level security;
alter table public.monex_categories enable row level security;
alter table public.monex_transaction_groups enable row level security;
alter table public.monex_bills enable row level security;
alter table public.monex_transactions enable row level security;
alter table public.monex_debts enable row level security;
alter table public.monex_fixed_flow_entries enable row level security;
alter table public.monex_planned_purchases enable row level security;
alter table public.monex_investments enable row level security;
alter table public.monex_investment_contributions enable row level security;
alter table public.monex_card_bill_estimates enable row level security;
alter table public.monex_imported_statement_batches enable row level security;
alter table public.monex_imported_statement_items enable row level security;
alter table public.monex_import_learning_rules enable row level security;
alter table public.monex_import_merchants enable row level security;
alter table public.monex_import_automation_configs enable row level security;
alter table public.monex_monthly_plans enable row level security;
alter table public.monex_monthly_plan_category_budgets enable row level security;
alter table public.monex_reserve_goals enable row level security;
alter table public.monex_settings enable row level security;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.monex_accounts to service_role;
grant select, insert, update, delete on public.monex_cards to service_role;
grant select, insert, update, delete on public.monex_categories to service_role;
grant select, insert, update, delete on public.monex_transaction_groups to service_role;
grant select, insert, update, delete on public.monex_bills to service_role;
grant select, insert, update, delete on public.monex_transactions to service_role;
grant select, insert, update, delete on public.monex_debts to service_role;
grant select, insert, update, delete on public.monex_fixed_flow_entries to service_role;
grant select, insert, update, delete on public.monex_planned_purchases to service_role;
grant select, insert, update, delete on public.monex_investments to service_role;
grant select, insert, update, delete on public.monex_investment_contributions to service_role;
grant select, insert, update, delete on public.monex_card_bill_estimates to service_role;
grant select, insert, update, delete on public.monex_imported_statement_batches to service_role;
grant select, insert, update, delete on public.monex_imported_statement_items to service_role;
grant select, insert, update, delete on public.monex_import_learning_rules to service_role;
grant select, insert, update, delete on public.monex_import_merchants to service_role;
grant select, insert, update, delete on public.monex_import_automation_configs to service_role;
grant select, insert, update, delete on public.monex_monthly_plans to service_role;
grant select, insert, update, delete on public.monex_monthly_plan_category_budgets to service_role;
grant select, insert, update, delete on public.monex_reserve_goals to service_role;
grant select, insert, update, delete on public.monex_settings to service_role;
