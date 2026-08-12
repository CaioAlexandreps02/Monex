-- Allows grouping card statement items that come from bills, not only transactions.

alter table public.monex_bills
add column if not exists group_id text;

create index if not exists idx_monex_bills_group_id
on public.monex_bills (owner_key, group_id)
where group_id is not null;
