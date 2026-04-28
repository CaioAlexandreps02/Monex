create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  type text not null,
  initial_balance numeric(12, 2) not null default 0,
  current_balance numeric(12, 2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  linked_account_id uuid references public.accounts(id) on delete set null,
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
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  color text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  type text not null check (type in ('income', 'expense')),
  amount numeric(12, 2) not null,
  date date not null,
  category_id uuid references public.categories(id) on delete set null,
  category_name text not null,
  description text,
  account_id uuid references public.accounts(id) on delete set null,
  payment_method text not null check (payment_method in ('pix', 'cash', 'bank_transfer', 'credit_card', 'debit_card')),
  status text not null check (status in ('planned', 'received', 'paid')),
  income_kind text,
  expense_kind text,
  card_id uuid references public.cards(id) on delete set null,
  card_mode text check (card_mode in ('credit', 'debit')),
  installment_group_id uuid,
  installment_number integer,
  installment_total integer,
  source_bill_id uuid,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  amount numeric(12, 2) not null,
  category_id uuid references public.categories(id) on delete set null,
  category_name text not null,
  due_date date not null,
  priority text not null,
  is_recurring boolean not null default false,
  recurring_day integer check (recurring_day between 1 and 31),
  status text not null check (status in ('pending', 'paid', 'overdue')),
  planned_payment_method text check (planned_payment_method in ('pix', 'cash', 'bank_transfer', 'card')),
  planned_card_id uuid references public.cards(id) on delete set null,
  planned_card_mode text check (planned_card_mode in ('credit', 'debit')),
  installments integer,
  recurring_group_id uuid,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
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
  planned_card_id uuid references public.cards(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.planned_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
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
  status text not null,
  planning_mode text,
  planned_payment_method text check (planned_payment_method in ('pix', 'cash', 'bank_transfer', 'card')),
  planned_card_id uuid references public.cards(id) on delete set null,
  planned_card_mode text check (planned_card_mode in ('credit', 'debit')),
  planned_installments integer,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  type text not null,
  objective text,
  total_gross_invested numeric(12, 2) not null default 0,
  current_manual_value numeric(12, 2),
  notes text,
  monthly_target numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.investment_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  investment_id uuid not null references public.investments(id) on delete cascade,
  contribution_date date not null,
  amount numeric(12, 2) not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  default_account_id uuid references public.accounts(id) on delete set null,
  default_card_id uuid references public.cards(id) on delete set null,
  fixed_salary_expected numeric(12, 2) not null default 0,
  monthly_investment_target numeric(12, 2) not null default 0,
  week_start_day integer not null default 1,
  extra_income_goal numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fixed_flow_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  section text not null,
  title text not null,
  kind text not null check (kind in ('income', 'expense')),
  category_id uuid references public.categories(id) on delete set null,
  category_name text not null,
  amount_by_month jsonb not null default '{}'::jsonb,
  completed_months text[] not null default '{}',
  payment_method text not null check (payment_method in ('pix', 'cash', 'bank_transfer', 'credit_card', 'debit_card')),
  account_id uuid references public.accounts(id) on delete set null,
  card_id uuid references public.cards(id) on delete set null,
  card_mode text check (card_mode in ('credit', 'debit')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.monthly_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
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
  unique (user_id, month_value)
);

create table if not exists public.monthly_plan_category_budgets (
  id uuid primary key default gen_random_uuid(),
  monthly_plan_id uuid not null references public.monthly_plans(id) on delete cascade,
  budget_key text not null,
  name text not null,
  kind text not null,
  planned numeric(12, 2) not null default 0
);

create table if not exists public.reserve_goals (
  id uuid primary key default gen_random_uuid(),
  monthly_plan_id uuid not null references public.monthly_plans(id) on delete cascade,
  goal_key text not null,
  name text not null,
  target numeric(12, 2) not null,
  current numeric(12, 2) not null default 0,
  deadline date not null,
  priority text not null
);

create index if not exists idx_transactions_user_date on public.transactions (user_id, date desc);
create index if not exists idx_bills_user_due_date on public.bills (user_id, due_date);
create index if not exists idx_debts_user_status on public.debts (user_id, status);
create index if not exists idx_monthly_plans_user_month on public.monthly_plans (user_id, month_value);

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.cards enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.bills enable row level security;
alter table public.debts enable row level security;
alter table public.planned_purchases enable row level security;
alter table public.investments enable row level security;
alter table public.investment_contributions enable row level security;
alter table public.settings enable row level security;
alter table public.fixed_flow_entries enable row level security;
alter table public.monthly_plans enable row level security;
alter table public.monthly_plan_category_budgets enable row level security;
alter table public.reserve_goals enable row level security;

create policy "profiles are private" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "accounts are private" on public.accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "cards are private" on public.cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "categories are private" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "transactions are private" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "bills are private" on public.bills
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "debts are private" on public.debts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "planned purchases are private" on public.planned_purchases
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "investments are private" on public.investments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "investment contributions are private" on public.investment_contributions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "settings are private" on public.settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "fixed flow entries are private" on public.fixed_flow_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "monthly plans are private" on public.monthly_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "monthly plan budgets are private" on public.monthly_plan_category_budgets
  for all using (
    exists (
      select 1
      from public.monthly_plans mp
      where mp.id = monthly_plan_id
        and mp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.monthly_plans mp
      where mp.id = monthly_plan_id
        and mp.user_id = auth.uid()
    )
  );

create policy "reserve goals are private" on public.reserve_goals
  for all using (
    exists (
      select 1
      from public.monthly_plans mp
      where mp.id = monthly_plan_id
        and mp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.monthly_plans mp
      where mp.id = monthly_plan_id
        and mp.user_id = auth.uid()
    )
  );
