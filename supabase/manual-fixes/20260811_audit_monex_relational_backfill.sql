-- Audit relational backfill against app_state.
-- Expected: JSON counts and monex_* counts should match for the main collections.

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
    jsonb_array_elements(coalesce(state->'investments', '[]'::jsonb)) as investment,
    jsonb_array_elements(coalesce(investment->'contributions', '[]'::jsonb)) as contribution
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

select
  recurring_group_id,
  count(distinct title) as different_titles,
  array_agg(distinct title order by title) as titles,
  count(*) as quantity
from public.monex_bills
where owner_key = 'default'
  and recurring_group_id is not null
group by recurring_group_id
having count(distinct title) > 1
order by quantity desc;

select
  planned_card_id,
  planned_card_mode,
  date_trunc('month', due_date)::date as month_start,
  round(sum(amount), 2) as bills_total
from public.monex_bills
where owner_key = 'default'
  and planned_card_id is not null
group by planned_card_id, planned_card_mode, date_trunc('month', due_date)
order by month_start, planned_card_id;
