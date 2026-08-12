# Migracao do app_state para Supabase relacional

## Objetivo

Organizar o banco para o Monex deixar de depender de um unico JSON em `public.app_state` e passar a salvar contas, cartoes, faturas, compras, importacoes e configuracoes em tabelas relacionais.

Hoje o sistema funciona assim:

- O frontend monta um `FinancePersistedState` completo.
- A rota `src/app/api/app-state/route.ts` faz `GET` e `PUT` do estado inteiro.
- O Supabase tem varias tabelas relacionais criadas, mas elas estao vazias.
- A tabela `app_state` tem uma linha (`key = 'default'`) com todo o estado real do app.

Essa migracao precisa ser gradual. Se apenas copiarmos os dados para tabelas e o app continuar gravando o JSON inteiro, as tabelas ficam desatualizadas rapidamente.

## Estado atual confirmado

Resultado visto no Supabase:

- `app_state`: 1 linha com estado real.
- `accounts`, `cards`, `bills`, `transactions`, `settings` e demais tabelas: 0 linhas.
- Dentro do JSON atual existem aproximadamente:
  - 143 `bills`
  - 119 `transactions`
  - 22 `fixedEntries`
  - 4 `debts`
  - 5 `plannedPurchases`
  - 6 `cards`
  - 4 `accounts`

Tambem foi confirmado um problema importante: alguns itens de cartao migrados receberam o mesmo `recurringGroupId`, mesmo sendo produtos diferentes. Isso faz a planilha interpretar varios produtos como um grupo so ou espalhar parcelas de forma errada.

## Importante: nao apagar recorrencias validas

As contas recorrentes aparecem uma vez por mes porque a planilha trabalha por mes. Isso nao e automaticamente erro.

Exemplos que parecem corretos:

- Barbeiro com 12 meses.
- ChatGpt com 12 meses.
- Faculdade com 12 meses.
- Google One com 12 meses.
- TIM com 12 meses.
- Youtube Music com 12 meses.
- Gasolina e Seguro Moto com 12 meses.

O erro nao e ter 12 linhas. O erro e o mesmo `recurringGroupId` misturar titulos diferentes.

Regra correta:

- Recorrente mensal: pode ter varias linhas, uma por mes, mas todas representam o mesmo compromisso.
- Parcelamento: pode ter varias linhas, uma por parcela, mas todas representam o mesmo produto.
- Produto avulso: deve ter uma linha so.
- Grupo nunca deve misturar produtos diferentes.

## Correcao imediata antes da migracao

Antes de migrar para tabelas, o JSON atual precisa estar consistente.

Ja corrigido no codigo:

- A tela da planilha agrupa itens de fatura por `recurringGroupId` ou identificador de origem, para mostrar um produto em uma linha so.
- Ao editar uma celula vazia de um item recorrente pago no cartao, o sistema pode criar/atualizar o valor daquele mes dentro do mesmo grupo.
- A migracao automatica de compras planejadas para contas/faturas passou a gerar `recurringGroupId` por compra, e nao um unico grupo compartilhado por varias compras.

Ainda precisa confirmar no banco:

```sql
with bills as (
  select bill
  from app_state,
  jsonb_array_elements(state->'bills') bill
  where key = 'default'
)
select
  bill->>'recurringGroupId' as group_id,
  count(distinct bill->>'title') as titulos_diferentes,
  array_agg(distinct bill->>'title') as titulos,
  count(*) as qtd
from bills
where bill ? 'recurringGroupId'
group by 1
having count(distinct bill->>'title') > 1
order by qtd desc;
```

Resultado esperado: nenhuma linha.

Se aparecer alguma linha, ela deve ser corrigida separando o `recurringGroupId` por produto antes da migracao.

SQL manual preparado para isso:

- `supabase/manual-fixes/20260811_fix_mixed_card_bill_groups.sql`

Esse arquivo cria backup, separa os grupos conhecidos do cartao Inter e roda a verificacao final.

## Por que as tabelas atuais nao devem receber os dados direto

O arquivo `supabase/schema.sql` ja tem tabelas como `accounts`, `cards`, `bills`, `transactions` e `settings`, mas elas foram desenhadas com `uuid` e `user_id`.

O app atual usa IDs textuais:

- `card-inter`
- `card-nubank`
- `cat-market`
- `bill-...`
- `acc-...`

Se tentarmos inserir esses IDs nas tabelas atuais, teremos conflito de tipo. Tambem existe `user_id` obrigatorio, mas o app atual ainda trabalha com `key = 'default'`, sem perfil/autenticacao por usuario.

Por isso existem duas opcoes:

1. Alterar as tabelas atuais para aceitarem IDs textuais.
2. Criar tabelas novas `monex_*` com IDs textuais e migrar o app para elas.

Recomendacao: criar tabelas novas `monex_*`. Isso evita quebrar o schema antigo e permite rollback simples.

## Modelo relacional recomendado

Usar `owner_key text not null default 'default'` no primeiro momento. No futuro, quando houver autenticacao real, migrar para `user_id uuid`.

Tabelas principais:

- `monex_accounts`
- `monex_cards`
- `monex_categories`
- `monex_bills`
- `monex_transactions`
- `monex_transaction_groups`
- `monex_debts`
- `monex_fixed_flow_entries`
- `monex_planned_purchases`
- `monex_investments`
- `monex_investment_contributions`
- `monex_card_bill_estimates`
- `monex_imported_statement_batches`
- `monex_imported_statement_items`
- `monex_import_learning_rules`
- `monex_import_merchants`
- `monex_import_automation_configs`
- `monex_monthly_plans`
- `monex_monthly_plan_category_budgets`
- `monex_reserve_goals`
- `monex_settings`

Campos flexiveis podem continuar como `jsonb` quando isso fizer sentido, por exemplo:

- `amount_by_month`
- `completed_months`
- `planned_amount_by_month`
- `bank_presets`
- `suggested_match`
- `processed_external_ids`

Mas entidades principais nao devem ficar escondidas em um JSON unico.

## Regras para evitar novos erros

### Bills e faturas

`monex_bills` deve ter:

- `id text primary key`
- `owner_key text not null`
- `title text not null`
- `amount numeric(12,2) not null`
- `due_date date not null`
- `category_id text`
- `status text`
- `planned_payment_method text`
- `planned_card_id text`
- `planned_card_mode text`
- `installments integer`
- `recurring_group_id text`
- `archived_at timestamptz`

Indices/regras importantes:

- Indice por `(owner_key, due_date)`.
- Indice por `(owner_key, planned_card_id, planned_card_mode, due_date)`.
- Indice por `(owner_key, recurring_group_id)`.
- Regra de integridade para impedir duplicacao obvia:

```sql
create unique index if not exists monex_bills_unique_group_month_title
on public.monex_bills (owner_key, recurring_group_id, due_date, title)
where recurring_group_id is not null;
```

Essa regra permite recorrencias em meses diferentes, mas bloqueia duplicar o mesmo item no mesmo mes dentro do mesmo grupo.

### Transactions

`monex_transactions` deve guardar:

- `id text primary key`
- `owner_key text not null`
- `title`
- `type`
- `amount`
- `date`
- `category_id`
- `account_id`
- `payment_method`
- `status`
- `card_id`
- `card_mode`
- `installment_group_id`
- `installment_number`
- `installment_total`
- `source_bill_id`
- `linked_planned_purchase_id`
- `group_id`

Para itens importados, o ideal e usar `source_bill_id`, `external_item_id` e `fingerprint` para deduplicacao.

### Importacao de extratos

As importacoes precisam ficar em tabelas proprias:

- `monex_imported_statement_batches`: representa o arquivo/lote.
- `monex_imported_statement_items`: representa cada linha importada.
- `monex_import_merchants`: cadastro de estabelecimentos/lugares.
- `monex_import_learning_rules`: regras aprendidas com confirmacoes do usuario.
- `monex_import_automation_configs`: email, Open Finance e automacoes futuras.

Isso vai permitir:

- Historico completo do que entrou.
- Revisao de transacoes sem baguncar a planilha.
- Aprendizado por estabelecimento.
- Vinculo automatico com faturas, contas, debito, PIX e cartao.

## Ordem correta de implementacao

### Fase 1 - Congelar e validar o JSON atual

Status: concluida em 2026-08-11.

1. Fazer backup da linha atual de `app_state`.
2. Corrigir todos os `recurringGroupId` que misturam titulos diferentes.
3. Rodar query de verificacao ate nao retornar grupos misturados.
4. Conferir totais da planilha no app.

### Fase 2 - Criar schema relacional v2

Status: executada em 2026-08-11.

1. Criar tabelas `monex_*`.
2. Usar `text` para IDs.
3. Usar `owner_key = 'default'` inicialmente.
4. Ativar RLS nas tabelas novas.
5. Manter acesso pelo servidor usando service role.

Observacao: no Supabase atual, novas tabelas podem precisar ser expostas/configuradas para a Data API. Como o app usa rotas server-side, isso reduz risco, mas ainda precisa ser validado no painel/API.

Migration inicial preparada:

- `supabase/migrations/202608110001_monex_relational_v2.sql`

### Fase 3 - Backfill do JSON para tabelas

Status: executada em 2026-08-11.

1. Inserir `accounts`, `cards`, `categories`, `settings`.
2. Inserir `bills`, `transactions`, `debts`, `fixedEntries`.
3. Inserir `plannedPurchases`, `investments` e contribuicoes.
4. Inserir dados de importacao e aprendizado.
5. Inserir planos mensais, categorias planejadas e metas.

Nada deve ser removido de `app_state` nessa fase.

SQL de backfill preparado:

- `supabase/manual-fixes/20260811_backfill_monex_relational_from_app_state.sql`

Descoberta durante execucao: o JSON pode ter itens usando categorias que nao existem mais na lista principal, por exemplo `cat-extra`. O backfill precisa criar essas categorias auxiliares antes de inserir contas, transacoes e linhas da planilha, para preservar o historico sem quebrar chaves estrangeiras.

Resultado observado do backfill:

- `accounts`: 4
- `cards`: 6
- `categories`: 16, incluindo categoria auxiliar criada a partir de referencias antigas.
- `bills`: 143
- `transactions`: 119
- `fixed_flow_entries`: 22
- `planned_purchases`: 5
- `card_bill_estimates`: 19
- `imported_statement_items`: 64
- `settings`: 1

### Fase 4 - Reconciliacao

Status: em andamento.

Comparar JSON vs tabelas:

- Quantidade de registros por entidade.
- Soma de contas por mes.
- Soma das faturas por cartao e mes.
- Soma de parcelas por grupo.
- Quantidade de itens importados por status.

Exemplo de verificacao de grupos:

```sql
select
  recurring_group_id,
  count(distinct title) as titulos_diferentes,
  array_agg(distinct title) as titulos,
  count(*) as qtd
from public.monex_bills
where recurring_group_id is not null
group by recurring_group_id
having count(distinct title) > 1;
```

Resultado esperado: nenhuma linha.

SQL de auditoria preparado:

- `supabase/manual-fixes/20260811_audit_monex_relational_backfill.sql`

Resultado parcial observado:

- Totais de fatura por cartao/mes passaram a mostrar o Inter consolidado em `142.75` de 2026-08 ate 2026-11.
- Isso indica que os produtos parcelados do Inter foram separados por grupo e somados corretamente por mes.

### Fase 5 - Criar camada de leitura relacional

Status: implementada em codigo, pendente de teste com `MONEX_APP_STATE_SOURCE=relational`.

1. Criar um servico server-side para carregar as tabelas.
2. Montar o mesmo formato `FinancePersistedState` esperado pelo frontend.
3. Manter `/api/app-state` funcionando.
4. Adicionar feature flag para escolher fonte:
   - `json`
   - `relational`

Arquivos:

- `src/lib/monex-relational-state.ts`
- `src/app/api/app-state/route.ts`
- `supabase/manual-fixes/20260811_grant_monex_service_role_data_api.sql`

Variavel:

- `MONEX_APP_STATE_SOURCE=json`: comportamento atual.
- `MONEX_APP_STATE_SOURCE=relational`: `/api/app-state` passa a montar o estado a partir das tabelas `monex_*`.

Observacao: enquanto a escrita relacional nao existir, o `PUT /api/app-state` continua salvando no JSON. Por isso, ligar `relational` deve ser feito primeiro em ambiente de teste/preview.

### Fase 6 - Criar camada de escrita relacional

Status: implementada em codigo como sincronizacao completa de snapshot quando `MONEX_APP_STATE_SOURCE=relational`.

1. Parar de salvar o estado inteiro para cada pequena edicao.
2. Criar endpoints por operacao:
   - criar/editar/excluir bill
   - criar/editar/excluir transaction
   - editar celula da planilha
   - arquivar/restaurar
   - confirmar importacao
3. Cada endpoint deve atualizar so as tabelas afetadas.

Implementacao atual:

- O `PUT /api/app-state` continua salvando no JSON quando `MONEX_APP_STATE_SOURCE=json`.
- Quando `MONEX_APP_STATE_SOURCE=relational`, o `PUT /api/app-state` sincroniza o snapshot recebido para as tabelas `monex_*`.
- A sincronizacao apaga as linhas de `owner_key = 'default'` nas tabelas relacionais e reinsere o estado completo em ordem de dependencia.
- Antes de apagar qualquer tabela, o servidor compara o snapshot recebido com o `app_state` de backup e rejeita gravacoes que parecam incompletas.

Essa abordagem e adequada para a fase atual porque o volume de dados e pequeno e reduz risco de divergencia. No futuro, pode ser refinada para endpoints incrementais por operacao.

Incidente observado em 2026-08-12: a auditoria mostrou tabelas relacionais quase vazias (`cards = 0`, `bills = 1`) enquanto o JSON continuava completo. A recuperacao correta e rodar novamente `supabase/manual-fixes/20260811_backfill_monex_relational_from_app_state.sql` e depois a auditoria.

### Fase 7 - Dual-write temporario

Por um periodo curto:

- Ler do JSON.
- Gravar no JSON e nas tabelas.
- Comparar divergencias.

Quando estiver estavel:

- Ler das tabelas.
- Manter snapshot do JSON apenas como backup.

### Fase 8 - Virada para producao

1. Fazer novo backup do `app_state`.
2. Ativar leitura relacional.
3. Testar planilha, faturas, importacao e arquivados.
4. Monitorar logs.
5. So depois disso considerar desativar gravacao no JSON.

### Fase 9 - Limpeza futura

Somente depois de varios dias sem divergencia:

- Manter `app_state` como snapshot historico.
- Ou criar job de backup periodico.
- Nao apagar dados antigos sem exportacao antes.

## SQL seguro para proxima etapa

Antes de criar tabelas novas, rodar:

```sql
create table if not exists public.app_state_backup_20260811_before_relational_migration as
select *
from public.app_state
where key = 'default';
```

Depois confirmar:

```sql
select
  key,
  updated_at,
  jsonb_array_length(state->'bills') as bills,
  jsonb_array_length(state->'transactions') as transactions,
  jsonb_array_length(state->'fixedEntries') as fixed_entries,
  jsonb_array_length(state->'debts') as debts,
  jsonb_array_length(state->'plannedPurchases') as planned_purchases,
  jsonb_array_length(state->'cards') as cards,
  jsonb_array_length(state->'accounts') as accounts
from public.app_state
where key = 'default';
```

## O que nao fazer

- Nao deletar as 12 ocorrencias de contas recorrentes sem entender se elas representam meses validos.
- Nao migrar direto para as tabelas antigas com `uuid`, porque os IDs atuais do app sao textuais.
- Nao remover `app_state` na primeira versao da migracao.
- Nao ativar escrita relacional sem reconciliacao.
- Nao confiar apenas na UI para validar faturas; precisa comparar totais por cartao e mes.

## Proximo passo tecnico

1. Confirmar a primeira tabela da auditoria (`json_count`, `relational_count`, `difference`).
2. Confirmar que a auditoria de grupos misturados retorna zero linhas.
3. Criar camada server-side que monta `FinancePersistedState` a partir das tabelas.
4. Colocar feature flag para alternar entre JSON e relacional.
5. Depois criar escrita relacional ou dual-write temporario.
