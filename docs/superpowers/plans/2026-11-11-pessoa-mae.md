# Linha "Mãe" em Dívidas e acordos — plano de implementação

> **Para quem executa:** use superpowers:executing-plans (tarefa por tarefa). Passos usam checkbox.

**Goal:** a "Mãe" vira uma linha em Dívidas e acordos que soma, por mês, tudo que o Caio deve a ela e expande em itens.

**Architecture:** a Mãe é um `Card` com `issuer === "Pessoa"`. Reaproveita a linha de fatura (`card_auto_bill`), o valor real digitável (`monex_card_bill_estimates`) e a lista expansível (`getCardStatementGridItems`). Mudam só: onde a linha aparece, o mês das parcelas, a checagem de limite e a inclusão das dívidas dela. Um script migra os dados.

**Tech Stack:** Next.js, TypeScript, Supabase REST. Tudo em `src/components/finance-app.tsx` (regra do projeto), tipos em `src/types/finance.ts`.

**Spec:** `docs/superpowers/specs/2026-11-11-pessoa-mae-design.md`

## Global Constraints
- Sem coluna nova no banco; o marcador é `issuer = "Pessoa"`.
- Nunca vermelho em elementos visuais novos.
- Zero erros do `tsc` ao final. Nunca commitar sem aprovação do Caio.
- Não testar contra o banco de produção: usar dev server sem credenciais do Supabase.

## Review Focus
- Parcela no dia 31 não pode ir para o mês seguinte (Mãe não tem fechamento).
- Cadastrar compra no "cartão" Mãe não pode ser bloqueado por limite 0.
- A dívida movida para a Mãe não pode somar duas vezes (linha própria + dentro da Mãe).
- Mês sem item: a linha da Mãe some como as outras faturas vazias.
- A Mãe não aparece na tela/menu Cartões nem como "Fatura" na seção Faturas.

### Task 1: Marcador e regras de cálculo
**Files:** Modify `src/types/finance.ts` (`MonthlyGridRow`), `src/components/finance-app.tsx` (`getCardStatementMonthForTransaction` ~l.690, limite ~l.3479).
**Interfaces — Produces:** `isPersonCard(card: Card | undefined): boolean` (módulo, `issuer === "Pessoa"`); `MonthlyGridRow.isPersonCard?: boolean`.
- [ ] `isPersonCard` no módulo, perto de `getCardStatementMonthForTransaction`.
- [ ] `getCardStatementMonthForTransaction`: se `isPersonCard(card)` retorna `transaction.date.slice(0, 7)`.
- [ ] Verificação de limite (`affectedCardIds` loop): `continue` também quando `isPersonCard(card)`.
- [ ] `npx tsc --noEmit` sem erros.

### Task 2: Linha da Mãe em Dívidas e acordos
**Files:** Modify `src/components/finance-app.tsx`: `getContasSubType` (~l.802), `cardAutoRows` em `createMonthlyGridRows` (~l.7909), `getCardStatementGridItems` (~l.7617), `fixedRows` filter (~l.7836), `cardSummaries` (~l.3493).
**Consumes:** Task 1.
- [ ] `cardAutoRows`: para cartão de pessoa, `title: card.name`, `categoryName: "A repassar"`, `isPersonCard: true`.
- [ ] `getContasSubType`: `card_auto_bill` com `row.isPersonCard` → `"Dividas e acordos"`, senão `"Faturas"`.
- [ ] `getCardStatementGridItems`: se `isPersonCard(card)`, acrescentar um item por dívida ativa com `plannedCardId === cardId`: `{ id: "debt-<id>", title: debt.name, support: "Divida", amount: <valor do mês no FixedFlowEntry ligado>, sourceType: "bill", sourceId: "debt-<id>" }`.
- [ ] `fixedRows`: excluir a entrada cujo `linkedDebtId` aponta para dívida com `plannedCardId` de cartão de pessoa.
- [ ] `cardSummaries`: passar `cards.filter((card) => !isPersonCard(card))`.
- [ ] `tsc` sem erros.

### Task 3: Verificação visual com dados de exemplo
- [ ] Subir dev server sem credenciais (`NEXT_PUBLIC_SUPABASE_URL=` e `SUPABASE_SERVICE_ROLE_KEY=` vazios), injetar no `localStorage` um estado com a Mãe, uma compra parcelada e uma dívida; conferir: linha "Mãe" em Dívidas e acordos, expande, total do mês, dívida não duplicada, Mãe ausente em Faturas e em Cartões.
- [ ] Conferir o total de nov: 78 + 81,43 + 16,67 = 176,10 no cenário de exemplo.

### Task 4: Migração em produção (só após aprovação)
**Files:** Create script no scratchpad (não vai para o repositório).
- [ ] Backup JSON de `monex_cards`, `monex_bills`, `monex_transactions`, `monex_debts`, `monex_card_bill_estimates`.
- [ ] Criar `person-mae` (`issuer: "Pessoa"`, `brand: "Pessoa"`, `last_digits: ""`, `credit_limit: 0`, `closing_day: 1`, `due_day: 15`).
- [ ] Mover contas e parcelas de `card-mp-mae`, `card-renner`, e as do PicPay que são da mãe (Roupas Anjus) para `person-mae`, acrescentando ao título o nome do cartão antigo quando ele não estiver no título.
- [ ] Dívida "Mae": `planned_card_id = person-mae`.
- [ ] Apagar estimativas e cartões antigos da mãe; avançar `app_state.updated_at`.
- [ ] Conferir contagens e o total de nov (176,10).
