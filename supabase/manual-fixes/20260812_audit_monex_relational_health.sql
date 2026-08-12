-- Health audit for the Monex relational Supabase model.
-- Safe to run multiple times. It only reads metadata and data.

-- 1) JSON snapshot vs relational counts.
with json_counts as (
  select 'accounts' as entity, jsonb_array_length(coalesce(state->'accounts', '[]'::jsonb)) as json_count
  from public.app_state where key = 'default'
  union all select 'cards', jsonb_array_length(coalesce(state->'cards', '[]'::jsonb))
  from public.app_state where key = 'default'
  union all select 'categories', jsonb_array_length(coalesce(state->'categories', '[]'::jsonb))
  from public.app_state where key = 'default'
  union all select 'transaction_groups', jsonb_array_length(coalesce(state->'transactionGroups', '[]'::jsonb))
  from public.app_state where key = 'default'
  union all select 'bills', jsonb_array_length(coalesce(state->'bills', '[]'::jsonb))
  from public.app_state where key = 'default'
  union all select 'transactions', jsonb_array_length(coalesce(state->'transactions', '[]'::jsonb))
  from public.app_state where key = 'default'
  union all select 'debts', jsonb_array_length(coalesce(state->'debts', '[]'::jsonb))
  from public.app_state where key = 'default'
  union all select 'fixed_flow_entries', jsonb_array_length(coalesce(state->'fixedEntries', '[]'::jsonb))
  from public.app_state where key = 'default'
  union all select 'planned_purchases', jsonb_array_length(coalesce(state->'plannedPurchases', '[]'::jsonb))
  from public.app_state where key = 'default'
  union all select 'investments', jsonb_array_length(coalesce(state->'investments', '[]'::jsonb))
  from public.app_state where key = 'default'
  union all select 'investment_contributions', coalesce((
    select count(*)::integer
    from public.app_state,
    jsonb_array_elements(coalesce(state->'investments', '[]'::jsonb)) investment,
    jsonb_array_elements(coalesce(investment->'contributions', '[]'::jsonb)) contribution
    where key = 'default'
  ), 0)
  from public.app_state where key = 'default'
  union all select 'card_bill_estimates', coalesce((
    select count(*)::integer
    from jsonb_object_keys(coalesce(state->'cardBillEstimates', '{}'::jsonb))
  ), 0)
  from public.app_state where key = 'default'
  union all select 'imported_statement_batches', jsonb_array_length(coalesce(state->'importedStatementBatches', '[]'::jsonb))
  from public.app_state where key = 'default'
  union all select 'imported_statement_items', jsonb_array_length(coalesce(state->'importedStatementItems', '[]'::jsonb))
  from public.app_state where key = 'default'
  union all select 'import_merchants', jsonb_array_length(coalesce(state->'importMerchants', '[]'::jsonb))
  from public.app_state where key = 'default'
  union all select 'import_learning_rules', jsonb_array_length(coalesce(state->'importLearningRules', '[]'::jsonb))
  from public.app_state where key = 'default'
  union all select 'import_automation_configs', jsonb_array_length(coalesce(state->'importAutomationConfigs', '[]'::jsonb))
  from public.app_state where key = 'default'
  union all select 'monthly_plans', coalesce((
    select count(*)::integer
    from jsonb_object_keys(coalesce(state->'monthlyPlansByMonth', '{}'::jsonb))
  ), 0)
  from public.app_state where key = 'default'
  union all select 'monthly_plan_category_budgets', coalesce((
    select count(*)::integer
    from public.app_state,
    jsonb_each(coalesce(state->'monthlyPlansByMonth', '{}'::jsonb)) as plan(month_key, plan_data),
    jsonb_array_elements(coalesce(plan_data->'categoryBudgets', '[]'::jsonb)) budget
    where key = 'default'
  ), 0)
  from public.app_state where key = 'default'
  union all select 'reserve_goals', coalesce((
    select count(*)::integer
    from public.app_state,
    jsonb_each(coalesce(state->'monthlyPlansByMonth', '{}'::jsonb)) as plan(month_key, plan_data),
    jsonb_array_elements(coalesce(plan_data->'reserveGoals', '[]'::jsonb)) goal
    where key = 'default'
  ), 0)
  from public.app_state where key = 'default'
  union all select 'settings', case when state ? 'settings' then 1 else 0 end
  from public.app_state where key = 'default'
),
relational_counts as (
  select 'accounts' as entity, count(*)::integer as relational_count from public.monex_accounts where owner_key = 'default'
  union all select 'cards', count(*)::integer from public.monex_cards where owner_key = 'default'
  union all select 'categories', count(*)::integer from public.monex_categories where owner_key = 'default'
  union all select 'transaction_groups', count(*)::integer from public.monex_transaction_groups where owner_key = 'default'
  union all select 'bills', count(*)::integer from public.monex_bills where owner_key = 'default'
  union all select 'transactions', count(*)::integer from public.monex_transactions where owner_key = 'default'
  union all select 'debts', count(*)::integer from public.monex_debts where owner_key = 'default'
  union all select 'fixed_flow_entries', count(*)::integer from public.monex_fixed_flow_entries where owner_key = 'default'
  union all select 'planned_purchases', count(*)::integer from public.monex_planned_purchases where owner_key = 'default'
  union all select 'investments', count(*)::integer from public.monex_investments where owner_key = 'default'
  union all select 'investment_contributions', count(*)::integer from public.monex_investment_contributions where owner_key = 'default'
  union all select 'card_bill_estimates', count(*)::integer from public.monex_card_bill_estimates where owner_key = 'default'
  union all select 'imported_statement_batches', count(*)::integer from public.monex_imported_statement_batches where owner_key = 'default'
  union all select 'imported_statement_items', count(*)::integer from public.monex_imported_statement_items where owner_key = 'default'
  union all select 'import_merchants', count(*)::integer from public.monex_import_merchants where owner_key = 'default'
  union all select 'import_learning_rules', count(*)::integer from public.monex_import_learning_rules where owner_key = 'default'
  union all select 'import_automation_configs', count(*)::integer from public.monex_import_automation_configs where owner_key = 'default'
  union all select 'monthly_plans', count(*)::integer from public.monex_monthly_plans where owner_key = 'default'
  union all select 'monthly_plan_category_budgets', count(*)::integer from public.monex_monthly_plan_category_budgets where owner_key = 'default'
  union all select 'reserve_goals', count(*)::integer from public.monex_reserve_goals where owner_key = 'default'
  union all select 'settings', count(*)::integer from public.monex_settings where owner_key = 'default'
)
select
  coalesce(json_counts.entity, relational_counts.entity) as entity,
  coalesce(json_counts.json_count, 0) as json_count,
  coalesce(relational_counts.relational_count, 0) as relational_count,
  coalesce(relational_counts.relational_count, 0) - coalesce(json_counts.json_count, 0) as difference
from json_counts
full outer join relational_counts using (entity)
order by entity;

-- 2) Required schema objects.
select
  'monex_bills.group_id column' as check_name,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'monex_bills'
      and column_name = 'group_id'
  ) as ok
union all
select
  'idx_monex_bills_group_id index',
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'monex_bills'
      and indexname = 'idx_monex_bills_group_id'
  );

-- 3) RLS should be enabled for every monex_* table in public.
select
  relname as table_name,
  relrowsecurity as rls_enabled
from pg_class
join pg_namespace on pg_namespace.oid = pg_class.relnamespace
where nspname = 'public'
  and relkind = 'r'
  and relname like 'monex_%'
order by relname;

-- 4) service_role grants expected by the server routes.
select
  table_name,
  privilege_type,
  grantee
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name like 'monex_%'
  and grantee = 'service_role'
order by table_name, privilege_type;

-- 5) Orphaned group references should return zero rows.
select 'bill_group_without_group' as issue, bill.id, bill.title, bill.group_id
from public.monex_bills bill
left join public.monex_transaction_groups groups
  on groups.owner_key = bill.owner_key
  and groups.id = bill.group_id
where bill.owner_key = 'default'
  and bill.group_id is not null
  and groups.id is null
union all
select 'transaction_group_without_group', transaction.id, transaction.title, transaction.group_id
from public.monex_transactions transaction
left join public.monex_transaction_groups groups
  on groups.owner_key = transaction.owner_key
  and groups.id = transaction.group_id
where transaction.owner_key = 'default'
  and transaction.group_id is not null
  and groups.id is null;
