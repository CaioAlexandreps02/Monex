-- Backfill app_state JSON into monex_* relational tables.
-- Run only after:
-- 1. supabase/migrations/202608110001_monex_relational_v2.sql
-- 2. supabase/manual-fixes/20260811_fix_mixed_card_bill_groups.sql
--
-- This script is intentionally additive/upsert-based. It does not delete app_state.

create table if not exists public.app_state_backup_20260811_before_relational_backfill as
select *
from public.app_state
where key = 'default';

alter table public.monex_bills
add column if not exists group_id text;

create index if not exists idx_monex_bills_group_id
on public.monex_bills (owner_key, group_id)
where group_id is not null;

alter table if exists public.monex_imported_statement_items
drop constraint if exists monex_imported_statement_items_owner_key_fingerprint_key;

drop index if exists public.monex_transactions_unique_source_bill;

create index if not exists idx_monex_transactions_owner_source_bill
on public.monex_transactions (owner_key, source_bill_id)
where source_bill_id is not null;

create index if not exists idx_monex_import_items_fingerprint
on public.monex_imported_statement_items (owner_key, fingerprint);

with source_state as (
  select state
  from public.app_state
  where key = 'default'
)
insert into public.monex_accounts (
  id,
  owner_key,
  name,
  type,
  initial_balance,
  current_balance,
  is_active
)
select
  account->>'id',
  'default',
  account->>'name',
  account->>'type',
  coalesce((account->>'initialBalance')::numeric, 0),
  coalesce((account->>'currentBalance')::numeric, 0),
  coalesce((account->>'isActive')::boolean, true)
from source_state,
jsonb_array_elements(coalesce(state->'accounts', '[]'::jsonb)) as account
where account ? 'id'
on conflict (id) do update set
  name = excluded.name,
  type = excluded.type,
  initial_balance = excluded.initial_balance,
  current_balance = excluded.current_balance,
  is_active = excluded.is_active,
  updated_at = now();

with source_state as (
  select state
  from public.app_state
  where key = 'default'
)
insert into public.monex_cards (
  id,
  owner_key,
  linked_account_id,
  name,
  issuer,
  brand,
  last_digits,
  accent_color,
  available_mode,
  closing_day,
  due_day,
  credit_limit,
  is_active
)
select
  card->>'id',
  'default',
  nullif(card->>'linkedAccountId', ''),
  card->>'name',
  card->>'issuer',
  card->>'brand',
  card->>'lastDigits',
  card->>'accentColor',
  card->>'availableMode',
  coalesce((card->>'closingDay')::integer, 1),
  coalesce((card->>'dueDay')::integer, 1),
  coalesce((card->>'creditLimit')::numeric, 0),
  coalesce((card->>'isActive')::boolean, true)
from source_state,
jsonb_array_elements(coalesce(state->'cards', '[]'::jsonb)) as card
where card ? 'id'
on conflict (id) do update set
  linked_account_id = excluded.linked_account_id,
  name = excluded.name,
  issuer = excluded.issuer,
  brand = excluded.brand,
  last_digits = excluded.last_digits,
  accent_color = excluded.accent_color,
  available_mode = excluded.available_mode,
  closing_day = excluded.closing_day,
  due_day = excluded.due_day,
  credit_limit = excluded.credit_limit,
  is_active = excluded.is_active,
  updated_at = now();

with source_state as (
  select state
  from public.app_state
  where key = 'default'
)
insert into public.monex_categories (
  id,
  owner_key,
  name,
  type,
  color,
  parent_id
)
select
  category->>'id',
  'default',
  category->>'name',
  category->>'type',
  category->>'color',
  nullif(category->>'parentId', '')
from source_state,
jsonb_array_elements(coalesce(state->'categories', '[]'::jsonb)) as category
where category ? 'id'
on conflict (id) do update set
  name = excluded.name,
  type = excluded.type,
  color = excluded.color,
  parent_id = excluded.parent_id,
  updated_at = now();

with source_state as (
  select state
  from public.app_state
  where key = 'default'
),
referenced_categories as (
  select distinct on (category_id)
    category_id,
    category_name,
    category_type
  from (
    select
      nullif(bill->>'categoryId', '') as category_id,
      nullif(bill->>'categoryName', '') as category_name,
      'expense' as category_type
    from source_state,
    jsonb_array_elements(coalesce(state->'bills', '[]'::jsonb)) as bill
    union all
    select
      nullif(transaction_item->>'categoryId', '') as category_id,
      nullif(transaction_item->>'categoryName', '') as category_name,
      nullif(transaction_item->>'type', '') as category_type
    from source_state,
    jsonb_array_elements(coalesce(state->'transactions', '[]'::jsonb)) as transaction_item
    union all
    select
      nullif(entry->>'categoryId', '') as category_id,
      nullif(entry->>'categoryName', '') as category_name,
      nullif(entry->>'kind', '') as category_type
    from source_state,
    jsonb_array_elements(coalesce(state->'fixedEntries', '[]'::jsonb)) as entry
  ) categories
  where category_id is not null
  order by category_id, category_name nulls last
)
insert into public.monex_categories (
  id,
  owner_key,
  name,
  type,
  color
)
select
  category_id,
  'default',
  coalesce(category_name, category_id),
  case when category_type in ('income', 'expense') then category_type else 'expense' end,
  '#94A3B8'
from referenced_categories
on conflict (id) do nothing;

with source_state as (
  select state
  from public.app_state
  where key = 'default'
)
insert into public.monex_transaction_groups (
  id,
  owner_key,
  name,
  created_at
)
select
  transaction_group->>'id',
  'default',
  coalesce(transaction_group->>'nome', transaction_group->>'name', 'Grupo'),
  coalesce(nullif(transaction_group->>'createdAt', '')::timestamptz, now())
from source_state,
jsonb_array_elements(coalesce(state->'transactionGroups', '[]'::jsonb)) as transaction_group
where transaction_group ? 'id'
on conflict (id) do update set
  name = excluded.name,
  updated_at = now();

with source_state as (
  select state
  from public.app_state
  where key = 'default'
)
insert into public.monex_bills (
  id,
  owner_key,
  title,
  amount,
  category_id,
  category_name,
  due_date,
  priority,
  is_recurring,
  recurring_day,
  status,
  planned_payment_method,
  planned_card_id,
  planned_card_mode,
  installments,
  recurring_group_id,
  group_id,
  notes,
  archived_at
)
select
  bill->>'id',
  'default',
  bill->>'title',
  coalesce((bill->>'amount')::numeric, 0),
  nullif(bill->>'categoryId', ''),
  bill->>'categoryName',
  (bill->>'dueDate')::date,
  bill->>'priority',
  coalesce((bill->>'isRecurring')::boolean, false),
  nullif(bill->>'recurringDay', '')::integer,
  bill->>'status',
  nullif(bill->>'plannedPaymentMethod', ''),
  nullif(bill->>'plannedCardId', ''),
  nullif(bill->>'plannedCardMode', ''),
  nullif(bill->>'installments', '')::integer,
  nullif(bill->>'recurringGroupId', ''),
  nullif(bill->>'groupId', ''),
  nullif(bill->>'notes', ''),
  nullif(bill->>'archivedAt', '')::timestamptz
from source_state,
jsonb_array_elements(coalesce(state->'bills', '[]'::jsonb)) as bill
where bill ? 'id'
on conflict (id) do update set
  title = excluded.title,
  amount = excluded.amount,
  category_id = excluded.category_id,
  category_name = excluded.category_name,
  due_date = excluded.due_date,
  priority = excluded.priority,
  is_recurring = excluded.is_recurring,
  recurring_day = excluded.recurring_day,
  status = excluded.status,
  planned_payment_method = excluded.planned_payment_method,
  planned_card_id = excluded.planned_card_id,
  planned_card_mode = excluded.planned_card_mode,
  installments = excluded.installments,
  recurring_group_id = excluded.recurring_group_id,
  group_id = excluded.group_id,
  notes = excluded.notes,
  archived_at = excluded.archived_at,
  updated_at = now();

with source_state as (
  select state
  from public.app_state
  where key = 'default'
)
insert into public.monex_planned_purchases (
  id,
  owner_key,
  name,
  description,
  estimated_value,
  priority,
  desired_date,
  target_month,
  target_week,
  schedule_type,
  specific_month_target,
  board_column,
  saved_amount,
  suggested_period_amount,
  planned_amount_by_month,
  status,
  planning_mode,
  planned_payment_method,
  planned_card_id,
  planned_card_mode,
  planned_installments,
  notes
)
select
  purchase->>'id',
  'default',
  purchase->>'name',
  nullif(purchase->>'description', ''),
  coalesce((purchase->>'estimatedValue')::numeric, 0),
  purchase->>'priority',
  nullif(purchase->>'desiredDate', '')::date,
  nullif(purchase->>'targetMonth', ''),
  nullif(purchase->>'targetWeek', ''),
  nullif(purchase->>'scheduleType', ''),
  coalesce((purchase->>'specificMonthTarget')::boolean, false),
  purchase->>'boardColumn',
  coalesce((purchase->>'savedAmount')::numeric, 0),
  coalesce((purchase->>'suggestedPeriodAmount')::numeric, 0),
  coalesce(purchase->'plannedAmountByMonth', '{}'::jsonb),
  purchase->>'status',
  nullif(purchase->>'planningMode', ''),
  nullif(purchase->>'plannedPaymentMethod', ''),
  nullif(purchase->>'plannedCardId', ''),
  nullif(purchase->>'plannedCardMode', ''),
  nullif(purchase->>'plannedInstallments', '')::integer,
  nullif(purchase->>'notes', '')
from source_state,
jsonb_array_elements(coalesce(state->'plannedPurchases', '[]'::jsonb)) as purchase
where purchase ? 'id'
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  estimated_value = excluded.estimated_value,
  priority = excluded.priority,
  desired_date = excluded.desired_date,
  target_month = excluded.target_month,
  target_week = excluded.target_week,
  schedule_type = excluded.schedule_type,
  specific_month_target = excluded.specific_month_target,
  board_column = excluded.board_column,
  saved_amount = excluded.saved_amount,
  suggested_period_amount = excluded.suggested_period_amount,
  planned_amount_by_month = excluded.planned_amount_by_month,
  status = excluded.status,
  planning_mode = excluded.planning_mode,
  planned_payment_method = excluded.planned_payment_method,
  planned_card_id = excluded.planned_card_id,
  planned_card_mode = excluded.planned_card_mode,
  planned_installments = excluded.planned_installments,
  notes = excluded.notes,
  updated_at = now();

with source_state as (
  select state
  from public.app_state
  where key = 'default'
)
insert into public.monex_transactions (
  id,
  owner_key,
  title,
  type,
  amount,
  date,
  category_id,
  category_name,
  description,
  account_id,
  payment_method,
  status,
  income_kind,
  expense_kind,
  card_id,
  card_mode,
  installment_group_id,
  installment_number,
  installment_total,
  source_bill_id,
  linked_planned_purchase_id,
  notes,
  group_id
)
select
  transaction_item->>'id',
  'default',
  transaction_item->>'title',
  transaction_item->>'type',
  coalesce((transaction_item->>'amount')::numeric, 0),
  (transaction_item->>'date')::date,
  nullif(transaction_item->>'categoryId', ''),
  transaction_item->>'categoryName',
  nullif(transaction_item->>'description', ''),
  nullif(transaction_item->>'accountId', ''),
  transaction_item->>'paymentMethod',
  transaction_item->>'status',
  nullif(transaction_item->>'incomeKind', ''),
  nullif(transaction_item->>'expenseKind', ''),
  nullif(transaction_item->>'cardId', ''),
  nullif(transaction_item->>'cardMode', ''),
  nullif(transaction_item->>'installmentGroupId', ''),
  nullif(transaction_item->>'installmentNumber', '')::integer,
  nullif(transaction_item->>'installmentTotal', '')::integer,
  nullif(transaction_item->>'sourceBillId', ''),
  nullif(transaction_item->>'linkedPlannedPurchaseId', ''),
  nullif(transaction_item->>'notes', ''),
  nullif(transaction_item->>'groupId', '')
from source_state,
jsonb_array_elements(coalesce(state->'transactions', '[]'::jsonb)) as transaction_item
where transaction_item ? 'id'
on conflict (id) do update set
  title = excluded.title,
  type = excluded.type,
  amount = excluded.amount,
  date = excluded.date,
  category_id = excluded.category_id,
  category_name = excluded.category_name,
  description = excluded.description,
  account_id = excluded.account_id,
  payment_method = excluded.payment_method,
  status = excluded.status,
  income_kind = excluded.income_kind,
  expense_kind = excluded.expense_kind,
  card_id = excluded.card_id,
  card_mode = excluded.card_mode,
  installment_group_id = excluded.installment_group_id,
  installment_number = excluded.installment_number,
  installment_total = excluded.installment_total,
  source_bill_id = excluded.source_bill_id,
  linked_planned_purchase_id = excluded.linked_planned_purchase_id,
  notes = excluded.notes,
  group_id = excluded.group_id,
  updated_at = now();

with source_state as (
  select state
  from public.app_state
  where key = 'default'
)
insert into public.monex_debts (
  id,
  owner_key,
  name,
  description,
  total_amount,
  paid_amount,
  remaining_amount,
  total_installments,
  paid_installments,
  installment_amount,
  next_due_date,
  priority,
  status,
  planned_payment_method,
  planned_card_id,
  notes,
  archived_at
)
select
  debt->>'id',
  'default',
  debt->>'name',
  nullif(debt->>'description', ''),
  coalesce((debt->>'totalAmount')::numeric, 0),
  coalesce((debt->>'paidAmount')::numeric, 0),
  coalesce((debt->>'remainingAmount')::numeric, 0),
  coalesce((debt->>'totalInstallments')::integer, 1),
  coalesce((debt->>'paidInstallments')::integer, 0),
  coalesce((debt->>'installmentAmount')::numeric, 0),
  (debt->>'nextDueDate')::date,
  debt->>'priority',
  debt->>'status',
  nullif(debt->>'plannedPaymentMethod', ''),
  nullif(debt->>'plannedCardId', ''),
  nullif(debt->>'notes', ''),
  nullif(debt->>'archivedAt', '')::timestamptz
from source_state,
jsonb_array_elements(coalesce(state->'debts', '[]'::jsonb)) as debt
where debt ? 'id'
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  total_amount = excluded.total_amount,
  paid_amount = excluded.paid_amount,
  remaining_amount = excluded.remaining_amount,
  total_installments = excluded.total_installments,
  paid_installments = excluded.paid_installments,
  installment_amount = excluded.installment_amount,
  next_due_date = excluded.next_due_date,
  priority = excluded.priority,
  status = excluded.status,
  planned_payment_method = excluded.planned_payment_method,
  planned_card_id = excluded.planned_card_id,
  notes = excluded.notes,
  archived_at = excluded.archived_at,
  updated_at = now();

with source_state as (
  select state
  from public.app_state
  where key = 'default'
)
insert into public.monex_fixed_flow_entries (
  id,
  owner_key,
  section,
  title,
  kind,
  category_id,
  category_name,
  amount_by_month,
  completed_months,
  payment_method,
  account_id,
  card_id,
  card_mode,
  linked_bill_group_id,
  linked_debt_id,
  linked_investment_id,
  sync_card_limit,
  manual_amount_months,
  notes,
  archived_at
)
select
  entry->>'id',
  'default',
  entry->>'section',
  entry->>'title',
  entry->>'kind',
  nullif(entry->>'categoryId', ''),
  entry->>'categoryName',
  coalesce(entry->'amountByMonth', '{}'::jsonb),
  coalesce(
    array(select item_value from jsonb_array_elements_text(coalesce(entry->'completedMonths', '[]'::jsonb)) as completed(item_value)),
    '{}'::text[]
  ),
  entry->>'paymentMethod',
  nullif(entry->>'accountId', ''),
  nullif(entry->>'cardId', ''),
  nullif(entry->>'cardMode', ''),
  nullif(entry->>'linkedBillGroupId', ''),
  nullif(entry->>'linkedDebtId', ''),
  nullif(entry->>'linkedInvestmentId', ''),
  nullif(entry->>'syncCardLimit', '')::boolean,
  coalesce(
    array(select item_value from jsonb_array_elements_text(coalesce(entry->'manualAmountMonths', '[]'::jsonb)) as manual_month(item_value)),
    '{}'::text[]
  ),
  nullif(entry->>'notes', ''),
  nullif(entry->>'archivedAt', '')::timestamptz
from source_state,
jsonb_array_elements(coalesce(state->'fixedEntries', '[]'::jsonb)) as entry
where entry ? 'id'
on conflict (id) do update set
  section = excluded.section,
  title = excluded.title,
  kind = excluded.kind,
  category_id = excluded.category_id,
  category_name = excluded.category_name,
  amount_by_month = excluded.amount_by_month,
  completed_months = excluded.completed_months,
  payment_method = excluded.payment_method,
  account_id = excluded.account_id,
  card_id = excluded.card_id,
  card_mode = excluded.card_mode,
  linked_bill_group_id = excluded.linked_bill_group_id,
  linked_debt_id = excluded.linked_debt_id,
  linked_investment_id = excluded.linked_investment_id,
  sync_card_limit = excluded.sync_card_limit,
  manual_amount_months = excluded.manual_amount_months,
  notes = excluded.notes,
  archived_at = excluded.archived_at,
  updated_at = now();

with source_state as (
  select state
  from public.app_state
  where key = 'default'
)
insert into public.monex_investments (
  id,
  owner_key,
  name,
  type,
  objective,
  total_gross_invested,
  current_manual_value,
  notes,
  monthly_target,
  payment_method,
  account_id,
  card_id,
  card_mode,
  planned_amount_by_month
)
select
  investment->>'id',
  'default',
  investment->>'name',
  investment->>'type',
  nullif(investment->>'objective', ''),
  coalesce((investment->>'totalGrossInvested')::numeric, 0),
  nullif(investment->>'currentManualValue', '')::numeric,
  nullif(investment->>'notes', ''),
  coalesce((investment->>'monthlyTarget')::numeric, 0),
  nullif(investment->>'paymentMethod', ''),
  nullif(investment->>'accountId', ''),
  nullif(investment->>'cardId', ''),
  nullif(investment->>'cardMode', ''),
  coalesce(investment->'plannedAmountByMonth', '{}'::jsonb)
from source_state,
jsonb_array_elements(coalesce(state->'investments', '[]'::jsonb)) as investment
where investment ? 'id'
on conflict (id) do update set
  name = excluded.name,
  type = excluded.type,
  objective = excluded.objective,
  total_gross_invested = excluded.total_gross_invested,
  current_manual_value = excluded.current_manual_value,
  notes = excluded.notes,
  monthly_target = excluded.monthly_target,
  payment_method = excluded.payment_method,
  account_id = excluded.account_id,
  card_id = excluded.card_id,
  card_mode = excluded.card_mode,
  planned_amount_by_month = excluded.planned_amount_by_month,
  updated_at = now();

with source_state as (
  select state
  from public.app_state
  where key = 'default'
),
contributions as (
  select
    investment->>'id' as investment_id,
    contribution
  from source_state,
  jsonb_array_elements(coalesce(state->'investments', '[]'::jsonb)) as investment,
  jsonb_array_elements(coalesce(investment->'contributions', '[]'::jsonb)) as contribution
)
insert into public.monex_investment_contributions (
  id,
  owner_key,
  investment_id,
  contribution_date,
  amount,
  month_value,
  source,
  linked_transaction_id,
  payment_method,
  account_id,
  card_id,
  card_mode,
  notes
)
select
  contribution->>'id',
  'default',
  investment_id,
  (contribution->>'contributionDate')::date,
  coalesce((contribution->>'amount')::numeric, 0),
  nullif(contribution->>'monthValue', ''),
  nullif(contribution->>'source', ''),
  nullif(contribution->>'linkedTransactionId', ''),
  nullif(contribution->>'paymentMethod', ''),
  nullif(contribution->>'accountId', ''),
  nullif(contribution->>'cardId', ''),
  nullif(contribution->>'cardMode', ''),
  nullif(contribution->>'notes', '')
from contributions
where contribution ? 'id'
on conflict (id) do update set
  investment_id = excluded.investment_id,
  contribution_date = excluded.contribution_date,
  amount = excluded.amount,
  month_value = excluded.month_value,
  source = excluded.source,
  linked_transaction_id = excluded.linked_transaction_id,
  payment_method = excluded.payment_method,
  account_id = excluded.account_id,
  card_id = excluded.card_id,
  card_mode = excluded.card_mode,
  notes = excluded.notes,
  updated_at = now();

with source_state as (
  select state
  from public.app_state
  where key = 'default'
),
estimates as (
  select
    estimate_key,
    estimate
  from source_state,
  jsonb_each(coalesce(state->'cardBillEstimates', '{}'::jsonb)) as estimate_item(estimate_key, estimate)
)
insert into public.monex_card_bill_estimates (
  id,
  owner_key,
  card_id,
  month_value,
  estimated_amount,
  is_auto_estimate,
  status,
  paid_transaction_id,
  archived_at
)
select
  estimate_key,
  'default',
  estimate->>'cardId',
  estimate->>'monthValue',
  coalesce((estimate->>'estimatedAmount')::numeric, 0),
  coalesce((estimate->>'isAutoEstimate')::boolean, true),
  estimate->>'status',
  nullif(estimate->>'paidTransactionId', ''),
  nullif(estimate->>'archivedAt', '')::timestamptz
from estimates
where estimate ? 'cardId'
on conflict (id) do update set
  card_id = excluded.card_id,
  month_value = excluded.month_value,
  estimated_amount = excluded.estimated_amount,
  is_auto_estimate = excluded.is_auto_estimate,
  status = excluded.status,
  paid_transaction_id = excluded.paid_transaction_id,
  archived_at = excluded.archived_at,
  updated_at = now();

with source_state as (
  select state
  from public.app_state
  where key = 'default'
)
insert into public.monex_imported_statement_batches (
  id,
  owner_key,
  file_name,
  file_type,
  source_kind,
  transport,
  source_institution,
  account_id,
  card_id,
  external_source_id,
  source_label,
  imported_at,
  period_start,
  period_end,
  status,
  item_count,
  confirmed_count,
  ignored_count,
  duplicate_count
)
select
  batch->>'id',
  'default',
  batch->>'fileName',
  batch->>'fileType',
  batch->>'sourceKind',
  nullif(batch->>'transport', ''),
  nullif(batch->>'sourceInstitution', ''),
  nullif(batch->>'accountId', ''),
  nullif(batch->>'cardId', ''),
  nullif(batch->>'externalSourceId', ''),
  nullif(batch->>'sourceLabel', ''),
  (batch->>'importedAt')::timestamptz,
  nullif(batch->>'periodStart', '')::date,
  nullif(batch->>'periodEnd', '')::date,
  batch->>'status',
  coalesce((batch->>'itemCount')::integer, 0),
  coalesce((batch->>'confirmedCount')::integer, 0),
  coalesce((batch->>'ignoredCount')::integer, 0),
  coalesce((batch->>'duplicateCount')::integer, 0)
from source_state,
jsonb_array_elements(coalesce(state->'importedStatementBatches', '[]'::jsonb)) as batch
where batch ? 'id'
on conflict (id) do update set
  file_name = excluded.file_name,
  file_type = excluded.file_type,
  source_kind = excluded.source_kind,
  transport = excluded.transport,
  source_institution = excluded.source_institution,
  account_id = excluded.account_id,
  card_id = excluded.card_id,
  external_source_id = excluded.external_source_id,
  source_label = excluded.source_label,
  imported_at = excluded.imported_at,
  period_start = excluded.period_start,
  period_end = excluded.period_end,
  status = excluded.status,
  item_count = excluded.item_count,
  confirmed_count = excluded.confirmed_count,
  ignored_count = excluded.ignored_count,
  duplicate_count = excluded.duplicate_count,
  updated_at = now();

with source_state as (
  select state
  from public.app_state
  where key = 'default'
)
insert into public.monex_import_merchants (
  id,
  owner_key,
  name,
  aliases,
  source_kind,
  suggested_category_id,
  suggested_transaction_type,
  payment_method,
  suggested_match,
  support_count,
  mistake_count,
  status,
  created_at,
  updated_at,
  last_applied_at
)
select
  merchant->>'id',
  'default',
  merchant->>'name',
  coalesce(array(select alias_value from jsonb_array_elements_text(coalesce(merchant->'aliases', '[]'::jsonb)) as alias_item(alias_value)), '{}'::text[]),
  merchant->>'sourceKind',
  nullif(merchant->>'suggestedCategoryId', ''),
  nullif(merchant->>'suggestedTransactionType', ''),
  nullif(merchant->>'paymentMethod', ''),
  merchant->'suggestedMatch',
  coalesce((merchant->>'supportCount')::integer, 0),
  coalesce((merchant->>'mistakeCount')::integer, 0),
  merchant->>'status',
  coalesce(nullif(merchant->>'createdAt', '')::timestamptz, now()),
  coalesce(nullif(merchant->>'updatedAt', '')::timestamptz, now()),
  nullif(merchant->>'lastAppliedAt', '')::timestamptz
from source_state,
jsonb_array_elements(coalesce(state->'importMerchants', '[]'::jsonb)) as merchant
where merchant ? 'id'
on conflict (id) do update set
  name = excluded.name,
  aliases = excluded.aliases,
  source_kind = excluded.source_kind,
  suggested_category_id = excluded.suggested_category_id,
  suggested_transaction_type = excluded.suggested_transaction_type,
  payment_method = excluded.payment_method,
  suggested_match = excluded.suggested_match,
  support_count = excluded.support_count,
  mistake_count = excluded.mistake_count,
  status = excluded.status,
  updated_at = now(),
  last_applied_at = excluded.last_applied_at;

with source_state as (
  select state
  from public.app_state
  where key = 'default'
)
insert into public.monex_import_learning_rules (
  id,
  owner_key,
  pattern,
  source_kind,
  suggested_category_id,
  suggested_transaction_type,
  payment_method,
  suggested_match,
  support_count,
  mistake_count,
  status,
  created_at,
  updated_at,
  last_applied_at
)
select
  rule->>'id',
  'default',
  rule->>'pattern',
  rule->>'sourceKind',
  nullif(rule->>'suggestedCategoryId', ''),
  nullif(rule->>'suggestedTransactionType', ''),
  nullif(rule->>'paymentMethod', ''),
  rule->'suggestedMatch',
  coalesce((rule->>'supportCount')::integer, 0),
  coalesce((rule->>'mistakeCount')::integer, 0),
  rule->>'status',
  coalesce(nullif(rule->>'createdAt', '')::timestamptz, now()),
  coalesce(nullif(rule->>'updatedAt', '')::timestamptz, now()),
  nullif(rule->>'lastAppliedAt', '')::timestamptz
from source_state,
jsonb_array_elements(coalesce(state->'importLearningRules', '[]'::jsonb)) as rule
where rule ? 'id'
on conflict (id) do update set
  pattern = excluded.pattern,
  source_kind = excluded.source_kind,
  suggested_category_id = excluded.suggested_category_id,
  suggested_transaction_type = excluded.suggested_transaction_type,
  payment_method = excluded.payment_method,
  suggested_match = excluded.suggested_match,
  support_count = excluded.support_count,
  mistake_count = excluded.mistake_count,
  status = excluded.status,
  updated_at = now(),
  last_applied_at = excluded.last_applied_at;

with source_state as (
  select state
  from public.app_state
  where key = 'default'
)
insert into public.monex_import_automation_configs (
  id,
  owner_key,
  transport,
  label,
  status,
  is_enabled,
  provider,
  account_id,
  card_id,
  allowed_senders,
  keywords,
  external_connection_id,
  processed_external_ids,
  authorized_at,
  last_sync_at,
  notes
)
select
  config->>'id',
  'default',
  config->>'transport',
  config->>'label',
  config->>'status',
  coalesce((config->>'isEnabled')::boolean, false),
  nullif(config->>'provider', ''),
  nullif(config->>'accountId', ''),
  nullif(config->>'cardId', ''),
  coalesce(array(select sender_value from jsonb_array_elements_text(coalesce(config->'allowedSenders', '[]'::jsonb)) as sender(sender_value)), '{}'::text[]),
  coalesce(array(select keyword_value from jsonb_array_elements_text(coalesce(config->'keywords', '[]'::jsonb)) as keyword(keyword_value)), '{}'::text[]),
  nullif(config->>'externalConnectionId', ''),
  coalesce(array(select external_id_value from jsonb_array_elements_text(coalesce(config->'processedExternalIds', '[]'::jsonb)) as external_id(external_id_value)), '{}'::text[]),
  nullif(config->>'authorizedAt', '')::timestamptz,
  nullif(config->>'lastSyncAt', '')::timestamptz,
  nullif(config->>'notes', '')
from source_state,
jsonb_array_elements(coalesce(state->'importAutomationConfigs', '[]'::jsonb)) as config
where config ? 'id'
on conflict (id) do update set
  transport = excluded.transport,
  label = excluded.label,
  status = excluded.status,
  is_enabled = excluded.is_enabled,
  provider = excluded.provider,
  account_id = excluded.account_id,
  card_id = excluded.card_id,
  allowed_senders = excluded.allowed_senders,
  keywords = excluded.keywords,
  external_connection_id = excluded.external_connection_id,
  processed_external_ids = excluded.processed_external_ids,
  authorized_at = excluded.authorized_at,
  last_sync_at = excluded.last_sync_at,
  notes = excluded.notes,
  updated_at = now();

with source_state as (
  select state
  from public.app_state
  where key = 'default'
)
insert into public.monex_imported_statement_items (
  id,
  owner_key,
  batch_id,
  raw_description,
  review_title,
  normalized_description,
  date,
  amount,
  direction,
  source_kind,
  transport,
  payment_method,
  account_id,
  card_id,
  external_item_id,
  origin_label,
  suggested_category_id,
  suggested_transaction_type,
  suggested_match,
  applied_learning_rule_id,
  detected_merchant_id,
  statement_month,
  confidence,
  status,
  confirmed_transaction_id,
  ignored_reason,
  fingerprint
)
select
  item->>'id',
  'default',
  item->>'batchId',
  item->>'rawDescription',
  nullif(item->>'reviewTitle', ''),
  item->>'normalizedDescription',
  (item->>'date')::date,
  coalesce((item->>'amount')::numeric, 0),
  item->>'direction',
  item->>'sourceKind',
  nullif(item->>'transport', ''),
  item->>'paymentMethod',
  nullif(item->>'accountId', ''),
  nullif(item->>'cardId', ''),
  nullif(item->>'externalItemId', ''),
  nullif(item->>'originLabel', ''),
  nullif(item->>'suggestedCategoryId', ''),
  nullif(item->>'suggestedTransactionType', ''),
  item->'suggestedMatch',
  nullif(item->>'appliedLearningRuleId', ''),
  nullif(item->>'detectedMerchantId', ''),
  nullif(item->>'statementMonth', ''),
  coalesce((item->>'confidence')::numeric, 0),
  item->>'status',
  nullif(item->>'confirmedTransactionId', ''),
  nullif(item->>'ignoredReason', ''),
  item->>'fingerprint'
from source_state,
jsonb_array_elements(coalesce(state->'importedStatementItems', '[]'::jsonb)) as item
where item ? 'id'
on conflict (id) do update set
  batch_id = excluded.batch_id,
  raw_description = excluded.raw_description,
  review_title = excluded.review_title,
  normalized_description = excluded.normalized_description,
  date = excluded.date,
  amount = excluded.amount,
  direction = excluded.direction,
  source_kind = excluded.source_kind,
  transport = excluded.transport,
  payment_method = excluded.payment_method,
  account_id = excluded.account_id,
  card_id = excluded.card_id,
  external_item_id = excluded.external_item_id,
  origin_label = excluded.origin_label,
  suggested_category_id = excluded.suggested_category_id,
  suggested_transaction_type = excluded.suggested_transaction_type,
  suggested_match = excluded.suggested_match,
  applied_learning_rule_id = excluded.applied_learning_rule_id,
  detected_merchant_id = excluded.detected_merchant_id,
  statement_month = excluded.statement_month,
  confidence = excluded.confidence,
  status = excluded.status,
  confirmed_transaction_id = excluded.confirmed_transaction_id,
  ignored_reason = excluded.ignored_reason,
  fingerprint = excluded.fingerprint,
  updated_at = now();

with source_state as (
  select state
  from public.app_state
  where key = 'default'
),
plans as (
  select
    plan_key,
    plan_data
  from source_state,
  jsonb_each(coalesce(state->'monthlyPlansByMonth', '{}'::jsonb)) as plan(plan_key, plan_data)
)
insert into public.monex_monthly_plans (
  id,
  owner_key,
  month_value,
  month_label,
  fixed_income_planned,
  variable_income_planned,
  fixed_expenses_planned,
  variable_expenses_planned,
  debt_target,
  investment_target,
  extra_income_goal
)
select
  'monthly-plan-' || plan_key,
  'default',
  plan_key,
  plan_data->>'monthLabel',
  coalesce((plan_data->>'fixedIncomePlanned')::numeric, 0),
  coalesce((plan_data->>'variableIncomePlanned')::numeric, 0),
  coalesce((plan_data->>'fixedExpensesPlanned')::numeric, 0),
  coalesce((plan_data->>'variableExpensesPlanned')::numeric, 0),
  coalesce((plan_data->>'debtTarget')::numeric, 0),
  coalesce((plan_data->>'investmentTarget')::numeric, 0),
  coalesce((plan_data->>'extraIncomeGoal')::numeric, 0)
from plans
on conflict (id) do update set
  month_value = excluded.month_value,
  month_label = excluded.month_label,
  fixed_income_planned = excluded.fixed_income_planned,
  variable_income_planned = excluded.variable_income_planned,
  fixed_expenses_planned = excluded.fixed_expenses_planned,
  variable_expenses_planned = excluded.variable_expenses_planned,
  debt_target = excluded.debt_target,
  investment_target = excluded.investment_target,
  extra_income_goal = excluded.extra_income_goal,
  updated_at = now();

with source_state as (
  select state
  from public.app_state
  where key = 'default'
),
budget_rows as (
  select
    plan_key,
    budget
  from source_state,
  jsonb_each(coalesce(state->'monthlyPlansByMonth', '{}'::jsonb)) as plan(plan_key, plan_data),
  jsonb_array_elements(coalesce(plan_data->'categoryBudgets', '[]'::jsonb)) as budget
)
insert into public.monex_monthly_plan_category_budgets (
  id,
  owner_key,
  monthly_plan_id,
  budget_key,
  name,
  kind,
  planned
)
select
  'monthly-budget-' || plan_key || '-' || (budget->>'id'),
  'default',
  'monthly-plan-' || plan_key,
  budget->>'id',
  budget->>'name',
  budget->>'kind',
  coalesce((budget->>'planned')::numeric, 0)
from budget_rows
where budget ? 'id'
on conflict (id) do update set
  monthly_plan_id = excluded.monthly_plan_id,
  budget_key = excluded.budget_key,
  name = excluded.name,
  kind = excluded.kind,
  planned = excluded.planned,
  updated_at = now();

with source_state as (
  select state
  from public.app_state
  where key = 'default'
),
goal_rows as (
  select
    plan_key,
    goal
  from source_state,
  jsonb_each(coalesce(state->'monthlyPlansByMonth', '{}'::jsonb)) as plan(plan_key, plan_data),
  jsonb_array_elements(coalesce(plan_data->'reserveGoals', '[]'::jsonb)) as goal
)
insert into public.monex_reserve_goals (
  id,
  owner_key,
  monthly_plan_id,
  goal_key,
  name,
  target,
  current,
  deadline,
  priority
)
select
  'monthly-reserve-' || plan_key || '-' || (goal->>'id'),
  'default',
  'monthly-plan-' || plan_key,
  goal->>'id',
  goal->>'name',
  coalesce((goal->>'target')::numeric, 0),
  coalesce((goal->>'current')::numeric, 0),
  (goal->>'deadline')::date,
  goal->>'priority'
from goal_rows
where goal ? 'id'
on conflict (id) do update set
  monthly_plan_id = excluded.monthly_plan_id,
  goal_key = excluded.goal_key,
  name = excluded.name,
  target = excluded.target,
  current = excluded.current,
  deadline = excluded.deadline,
  priority = excluded.priority,
  updated_at = now();

with source_state as (
  select state->'settings' as settings
  from public.app_state
  where key = 'default'
)
insert into public.monex_settings (
  owner_key,
  fixed_salary_expected,
  monthly_investment_target,
  monthly_debt_payment_cap,
  bank_presets,
  default_account_id,
  default_card_id,
  week_start_day,
  extra_income_goal,
  default_bill_payment_method
)
select
  'default',
  coalesce((settings->>'fixedSalaryExpected')::numeric, 0),
  coalesce((settings->>'monthlyInvestmentTarget')::numeric, 0),
  coalesce((settings->>'monthlyDebtPaymentCap')::numeric, 0),
  coalesce(settings->'bankPresets', '[]'::jsonb),
  nullif(settings->>'defaultAccountId', ''),
  nullif(settings->>'defaultCardId', ''),
  coalesce((settings->>'weekStartDay')::integer, 1),
  coalesce((settings->>'extraIncomeGoal')::numeric, 0),
  nullif(settings->>'defaultBillPaymentMethod', '')
from source_state
where settings is not null
on conflict (owner_key) do update set
  fixed_salary_expected = excluded.fixed_salary_expected,
  monthly_investment_target = excluded.monthly_investment_target,
  monthly_debt_payment_cap = excluded.monthly_debt_payment_cap,
  bank_presets = excluded.bank_presets,
  default_account_id = excluded.default_account_id,
  default_card_id = excluded.default_card_id,
  week_start_day = excluded.week_start_day,
  extra_income_goal = excluded.extra_income_goal,
  default_bill_payment_method = excluded.default_bill_payment_method,
  updated_at = now();

select 'accounts' as entity, count(*) as row_count from public.monex_accounts where owner_key = 'default'
union all select 'cards', count(*) from public.monex_cards where owner_key = 'default'
union all select 'categories', count(*) from public.monex_categories where owner_key = 'default'
union all select 'transaction_groups', count(*) from public.monex_transaction_groups where owner_key = 'default'
union all select 'bills', count(*) from public.monex_bills where owner_key = 'default'
union all select 'transactions', count(*) from public.monex_transactions where owner_key = 'default'
union all select 'debts', count(*) from public.monex_debts where owner_key = 'default'
union all select 'fixed_flow_entries', count(*) from public.monex_fixed_flow_entries where owner_key = 'default'
union all select 'planned_purchases', count(*) from public.monex_planned_purchases where owner_key = 'default'
union all select 'investments', count(*) from public.monex_investments where owner_key = 'default'
union all select 'investment_contributions', count(*) from public.monex_investment_contributions where owner_key = 'default'
union all select 'card_bill_estimates', count(*) from public.monex_card_bill_estimates where owner_key = 'default'
union all select 'imported_statement_batches', count(*) from public.monex_imported_statement_batches where owner_key = 'default'
union all select 'imported_statement_items', count(*) from public.monex_imported_statement_items where owner_key = 'default'
union all select 'import_merchants', count(*) from public.monex_import_merchants where owner_key = 'default'
union all select 'import_learning_rules', count(*) from public.monex_import_learning_rules where owner_key = 'default'
union all select 'import_automation_configs', count(*) from public.monex_import_automation_configs where owner_key = 'default'
union all select 'monthly_plans', count(*) from public.monex_monthly_plans where owner_key = 'default'
union all select 'monthly_plan_category_budgets', count(*) from public.monex_monthly_plan_category_budgets where owner_key = 'default'
union all select 'reserve_goals', count(*) from public.monex_reserve_goals where owner_key = 'default'
union all select 'settings', count(*) from public.monex_settings where owner_key = 'default';
