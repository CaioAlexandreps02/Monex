-- Manual fix for app_state JSON before relational migration.
-- Goal: prevent different Inter card products from sharing the same recurringGroupId.
-- Run in Supabase SQL editor before the relational backfill.

create table if not exists public.app_state_backup_20260811_before_card_group_fix as
select *
from public.app_state
where key = 'default';

update public.app_state
set state = jsonb_set(state, '{bills}', (
  select jsonb_agg(
    case
      when bill->>'plannedCardId' = 'card-inter'
        and bill->>'title' = 'Faca Churrasco'
        then jsonb_set(bill, '{recurringGroupId}', '"inter-faca-churrasco"')
      when bill->>'plannedCardId' = 'card-inter'
        and bill->>'title' = 'Guarda Chuva How I Met your Mother'
        then jsonb_set(bill, '{recurringGroupId}', '"inter-guarda-chuva"')
      when bill->>'plannedCardId' = 'card-inter'
        and bill->>'title' = 'Par de Alianças + solitário'
        then jsonb_set(bill, '{recurringGroupId}', '"inter-aliancas-solitario"')
      when bill->>'plannedCardId' = 'card-inter'
        and bill->>'title' = 'Sifão Espuma'
        then jsonb_set(bill, '{recurringGroupId}', '"inter-sifao-espuma"')
      when bill->>'plannedCardId' = 'card-inter'
        and bill->>'title' = 'Tabua de Carne'
        then jsonb_set(bill, '{recurringGroupId}', '"inter-tabua-carne"')
      when bill->>'plannedCardId' = 'card-inter'
        and bill->>'title' = 'Freio moto'
        then jsonb_set(bill, '{recurringGroupId}', '"inter-freio-moto"')
      when bill->>'plannedCardId' = 'card-inter'
        and bill->>'title' = 'Banco moto'
        then jsonb_set(bill, '{recurringGroupId}', '"inter-banco-moto"')
      when bill->>'plannedCardId' = 'card-inter'
        and bill->>'title' = 'Bola Vapo'
        then jsonb_set(bill, '{recurringGroupId}', '"inter-bola-vapo"')
      when bill->>'plannedCardId' = 'card-inter'
        and bill->>'title' = 'Roupas novas'
        then jsonb_set(bill, '{recurringGroupId}', '"inter-roupas-novas"')
      when bill->>'plannedCardId' = 'card-inter'
        and bill->>'title' = 'Carenagem moto'
        then jsonb_set(bill, '{recurringGroupId}', '"inter-carenagem-moto"')
      else bill
    end
  )
  from jsonb_array_elements(state->'bills') as bill
))
where key = 'default';

with bills as (
  select bill
  from public.app_state,
  jsonb_array_elements(state->'bills') bill
  where key = 'default'
)
select
  bill->>'recurringGroupId' as group_id,
  count(distinct bill->>'title') as different_titles,
  array_agg(distinct bill->>'title') as titles,
  count(*) as quantity
from bills
where bill ? 'recurringGroupId'
group by 1
having count(distinct bill->>'title') > 1
order by quantity desc;
