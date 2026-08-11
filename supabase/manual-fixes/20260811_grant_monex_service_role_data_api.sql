-- Grants required for server-side REST/Data API access to monex_* tables.
-- Keep anon/authenticated without direct access for now; the app uses API routes with service_role.

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
