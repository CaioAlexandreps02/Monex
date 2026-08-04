# 07 — Planilha como Centro de Planejamento e Controle

## Objetivo
Transformar a tela de planilha no centro operacional do Monex: o usuário consegue visualizar, editar e criar os principais itens financeiros ali, com propagação automática para as entidades relacionadas (transações, faturas, investimentos, dívidas).

> Nota importante: a planilha **não deve ser tratada como a única fonte absoluta da verdade**. Ela é a fonte principal de **planejamento**. A realidade financeira continua vindo das entidades finais: transações, faturas reais de cartão, dívidas e investimentos. Isso evita misturar estimativa com registro contábil.

---

## Contexto

### O que a planilha já faz hoje
- Renderiza 4 fontes de dados em uma única tabela: FixedFlowEntry, Bills avulsas, Card Auto-Bills, PlannedPurchases
- Permite edição inline de valores (input por cell)
- Permite marcar como pago (toggle) — cria transação
- Permite drag & drop entre meses
- Propaga mudanças de FixedEntry → Bills/Investments/Transactions vinculadas

### O que NÃO faz (lacunas)
- Faturas de cartão são read-only (calculadas em runtime)
- Não existe botão "+" para adicionar itens novos na grid
- Não existe visualização de detalhes da fatura (compras que a compõem)
- Usuário precisa sair da planilha pra criar contas, compras, cartões

---

## Definições de Produto (decisões do Caio)

| Decisão | Escolha |
|---------|---------|
| Conceito de fatura na planilha | **Estimativa de planejamento** — valor que o usuário prevê que a fatura será. Não é o valor real. |
| Conceito de fatura em Cartões | **Realidade** — valor calculado a partir das transações de crédito reais. |
| Comparação estimado vs real | **Modal ao clicar na fatura na planilha** — mostra lado a lado valor estimado e valor real |
| Edição de fatura na planilha | **Dois modos**: soma automática (padrão) + override manual (quando usuário quiser ajustar a estimativa) |
| Adição rápida de itens | **Híbrido por seção**: inline rápido (Ganhos/Contas) + modal rápido (Cartões/Compras) |

### Regra de verdade dos dados

| Domínio | Papel no sistema | Fonte confiável |
|---------|------------------|-----------------|
| Planilha | Planejamento, estimativas e controle rápido | `FixedFlowEntry`, `PlannedPurchase`, `CardBillEstimate` |
| Transações | Registro do que aconteceu | `Transaction` |
| Cartões | Realidade das faturas de crédito | Soma das `Transaction` com `cardMode: "credit"` |
| Contas/Bills | Cobranças avulsas e recorrentes | `Bill` |
| Dívidas | Saldo, parcelas e liquidação | `Debt` + `FixedFlowEntry` vinculada |
| Investimentos | Meta e aportes | `Investment` + contribuições vinculadas |

---

## Arquitetura da Solução

### Conceito Central

```
PLANILHA = PLANEJAMENTO (estimativas)
    │
    │  Valor estimado do que vai pagar
    │  Usado no comparativo mensal e projeções
    │
    ▼
MODAL DE COMPARAÇÃO ← click na fatura
    │
    │  Mostra: estimado vs real + diferença
    │  Permite: editar estimativa, marcar como paga
    │
    ▼
CARTÕES = REALIDADE (valores reais)
    │
    │  Valor calculado das transações de crédito
    │  É o que o cartão cobra de verdade
    │
    ▼
TRANSAÇÕES = REGISTRO (o que aconteceu)
    │
    │  Transação de pagamento quando marca como paga
    │  Amount = realAmount (não o estimado)
    └─────────────────────────────────────────────────────┘

---

## Fase 0: Destaque do Mês Atual na Planilha (Bug Fix)

### Problema
O `selectedMonth` já tem lógica de highlight no código (linhas 6313, 6384, 6564), mas **não aparece visualmente** nas seções da grid. Só funciona no "Comparativo mensal".

**Causa raiz:** Os `<div>` filhos dentro de cada `<td>` têm seus próprios backgrounds opacos (`bg-violet-100`, `bg-sky-100`, `bg-rose-50`, etc.) que **cobrem por cima** do background do `<td>`. Mesmo que o `<td>` tenha `bg-sky-100/80`, o `<div>` filhho com `bg-violet-100` oculta completamente.

```tsx
// Linha 6384 — highlight no TD (NÃO aparece):
<td className={`... ${monthItem.monthValue === selectedMonth ? "bg-sky-100/80 ring-1 ring-sky-200" : ""}`}>

// Linha 6416 — div filho com background opaco (COBRE o TD):
<div className={`... ${amount <= 0 ? "bg-slate-50" : isCompleted ? "bg-violet-100" : "bg-violet-50"}`}>
```

### Solução
Mover o highlight do `<td>` para os `<div>` filhos. Cada tipo de row recebe a cor de destaque do mês selecionado:

**Fixed entries (Ganhos/Contas fixas):**
```tsx
<div className={`... ${
  amount <= 0 ? "bg-slate-50" : isCompleted
    ? row.section === "Ganhos" ? "bg-emerald-100" : "bg-sky-100"
    : row.section === "Ganhos" ? "bg-emerald-50" : "bg-rose-50"
} ${
  // ← NOVO: highlight do mês selecionado
  monthItem.monthValue === selectedMonth ? "ring-2 ring-inset ring-sky-400" : ""
}`}>
```

**Planned purchases:**
```tsx
<div className={`... ${
  amount <= 0 ? "bg-slate-50" : isCompleted ? "bg-violet-100" : "bg-violet-50"
} ${
  monthItem.monthValue === selectedMonth ? "ring-2 ring-inset ring-sky-400" : ""
}`}>
```

**Card auto-bills:**
```tsx
<div className={`... ${
  amount <= 0 ? "bg-slate-50" : isCompleted ? "bg-sky-100" : "bg-slate-100"
} ${
  monthItem.monthValue === selectedMonth ? "ring-2 ring-inset ring-sky-400" : ""
}`}>
```

**Técnica:** Usar `ring-2 ring-inset ring-sky-400` (borda interna azul) em vez de mudar o background, porque:
- Não conflita com as cores existentes de cada tipo de row
- `ring-inset` faz a borda ficar por dentro do `rounded-[18px]`
- Visível em qualquer cor de fundo
- Mantém a identidade visual de cada tipo (verde=ganhos, rosa=contas, roxo=planejamento, azul=fatura)

### Headers das seções (já funciona)
O header das seções (linha 6313) já tem o highlight correto:
```tsx
className={`... ${monthItem.monthValue === selectedMonth ? "bg-sky-200 text-sky-950 ring-2 ring-sky-300" : ""}`}
```
Este NÃO tem problema porque o `<th>` não tem filhos com background opaco.

### Totais de seção (já funciona)
A linha "Soma" (linha 6564) também já funciona:
```tsx
className={`... ${salaryCalendarMonths[index].monthValue === selectedMonth ? "bg-sky-200 text-sky-950" : ""}`}
```

### Arquivos afetados
- `src/components/finance-app.tsx`: ~3 locations (linhas 6416, 6445, 6516) — adicionar `ring-2 ring-inset ring-sky-400` nos `<div>` filhos

---

## Fase 0.5: Compras Planejadas dentro de Contas (Com Divisórias)

### Problema
Hoje a grid tem 3 seções: Ganhos, Contas, Planejamento. Compras planejadas ficam separadas das contas fixas, faturas e dívidas.

### Objetivo
Juntar tudo em 2 seções: Ganhos e Contas. Dentro de Contas, adicionar divisórias visuais entre os sub-tipos, com **Faturas por último**:

```
Ganhos ─────────────────
  Salário, Freelance
Contas ─────────────────
  Aluguel, Luz, Água     ← contas fixas (FixedFlowEntry)
  ─────────────────────
  Dívida Visa             ← dívida (FixedFlowEntry com linkedDebtId)
  ─────────────────────
  TV nova, Viagem         ← compra planejada (planned_purchase)
  ─────────────────────
  Fatura Nubank           ← fatura de cartão (card_auto_bill) — POR ÚLTIMO
```

### Implementação

**1. Alterar `normalizeFixedSection` (linha 517):**
```tsx
function normalizeFixedSection(section: FixedFlowSection): FixedFlowSection {
  if (section === "Gastos fixos" || section === "Dividas e repasses") {
    return "Contas";
  }
  if (section === "Compras planejadas" || section === "Planejamento") {
    return "Contas";  // ← mudou de "Planejamento" pra "Contas"
  }
  return section;
}
```

**2. Remover "Planejamento" do `fixedSectionOrder` (linha 630):**
```tsx
const fixedSectionOrder: FixedFlowSection[] = [
  "Ganhos",
  "Contas",
  // "Planejamento" removido
];
```

**3. Adicionar lógica de agrupamento dentro de `Contas`:**

No `renderTransactionsWorkspace()`, quando renderiza as rows de uma seção, agrupar por sub-tipo:

```tsx
function getContasSubType(row: MonthlyGridRow): string {
  if (row.sourceType === "card_auto_bill") return "Faturas";
  if (row.sourceType === "planned_purchase") return "Compras planejadas";
  if (row.linkedDebtId) return "Dívidas";
  return "Contas fixas";
}

const contasSubTypeOrder = ["Contas fixas", "Dívidas", "Compras planejadas", "Faturas"];
```

**4. Renderizar com divisórias:**

Na seção "Contas", iterar por sub-tipo e adicionar `<div>` divisor entre eles:

```tsx
{section === "Contas" ? (
  contasSubTypeOrder
    .map((subType) => ({
      subType,
      subRows: rows.filter((row) => getContasSubType(row) === subType),
    }))
    .filter((group) => group.subRows.length > 0)
    .map(({ subType, subRows }, visibleIndex) => {
      return (
        <React.Fragment key={subType}>
          {visibleIndex > 0 && (
            <tr>
              <td colSpan={salaryCalendarMonths.length + 2} className="border-0 px-0 py-1">
                <div className="border-t border-dashed border-slate-300" />
              </td>
            </tr>
          )}
          {subRows.map((row) => (
            // ... renderização existente da row
          ))}
        </React.Fragment>
      );
    })
) : (
  // ... renderização normal para Ganhos
)}
```

> Cuidado: usar `subIndex > 0` diretamente em `contasSubTypeOrder.map()` cria divisor antes do primeiro grupo visível quando os grupos anteriores estão vazios. Usar `visibleIndex` depois do `.filter()` evita esse bug visual.

**5. Atualizar `fixedSectionDisplayLabels` (linha 645):**
```tsx
const fixedSectionDisplayLabels: Record<FixedFlowSection, string> = {
  Ganhos: "Ganhos",
  Contas: "Contas",
  Planejamento: "Contas",
  "Gastos fixos": "Contas fixas",
  "Dividas e repasses": "Dívidas",
  "Compras planejadas": "Compras planejadas",
};
```

**6. Atualizar `fixedSectionStyles` (linha 636):**
```tsx
const fixedSectionStyles: Record<FixedFlowSection, string> = {
  Ganhos: "border-emerald-200 bg-emerald-50/80",
  Contas: "border-rose-200 bg-rose-50/80",
  Planejamento: "border-rose-200 bg-rose-50/80",
  "Gastos fixos": "border-rose-200 bg-rose-50/80",
  "Dividas e repasses": "border-rose-200 bg-rose-50/80",
  "Compras planejadas": "border-rose-200 bg-rose-50/80",
};
```

> Cuidado de TypeScript: enquanto `FixedFlowSection` continuar incluindo `"Planejamento"`, `"Gastos fixos"`, `"Dividas e repasses"` e `"Compras planejadas"`, os `Record<FixedFlowSection, string>` precisam manter essas chaves. Remover as chaves sem mudar o tipo em `src/types/finance.ts` quebra compilação.

### Arquivos afetados
- `src/components/finance-app.tsx`:
  - `normalizeFixedSection()` (linha 517) — mapear Planejamento → Contas
  - `fixedSectionOrder` (linha 630) — remover "Planejamento"
  - `fixedSectionStyles` (linha 636) — manter todas as chaves exigidas por `FixedFlowSection`, mas fazer Planejamento/Compras planejadas usarem visual de Contas
  - `fixedSectionDisplayLabels` (linha 645) — manter todas as chaves exigidas por `FixedFlowSection`, mas normalizar a apresentação para Contas/subtipos
  - `renderTransactionsWorkspace()` (linha 6056) — adicionar lógica de sub-tipo e divisórias

### Comportamento existente que não muda
- `handlePlannedPurchaseAmountChange()` continua funcionando (edita valor na cell)
- `openMonthlyGridCardModal()` continua funcionando (abre detalhes da compra)
- Drag & drop entre meses continua funcionando
- Toggle de compra (marcar como bought) continua funcionando

### Comportamento que muda, apesar de reaproveitar handlers
- Compras planejadas deixam de aparecer em uma seção própria chamada "Planejamento" na grid e passam a aparecer dentro de "Contas" como subgrupo.
- O botão geral de "Adicionar item" do antigo Planejamento precisa virar ação do subgrupo "Compras planejadas", não desaparecer.
- Cálculos de total de seção passam a incluir compras planejadas dentro de Contas; isso é desejado, mas deve ser validado no comparativo mensal para não duplicar valores.

---

## Fase 1: Adição Rápida de Itens na Planilha

### Conceito
- **Coisas simples** (Ganhos, Contas fixas): criação **inline na grid** — linha nova aparece sem abrir modal
- **Coisas complexas** (Faturas, Dívidas, Compras): manter os **modais grandes** que já existem — só adicionar o botão "+" nas seções que faltam

### O que já existe hoje
- Botão "+" nos cabeçalhos de Ganhos, Contas e Planejamento (linha 6270)
- Modal de FixedEntry (`renderFixedEntryModal`, linha 7736) — completo, com todos os campos
- Modal de PlannedPurchase (`renderPurchaseModal`, linha 7981) — completo
- Modal de Card (`renderCardModal`, linha 8375) — só na aba Cartões, **não na grid**
- Modal de Debt (`renderDebtModal`, linha 8918) — só na aba Contas, **não na grid**

### O que falta criar

#### 1. Criação inline para Ganhos/Contas (🆕)

**UX:**
1. Usuário clica no "+" no cabeçalho de "Ganhos" ou "Contas"
2. Uma nova linha aparece no topo da seção com:
   - Campo "Nome" (auto-focus)
   - Cells de mês (valores editáveis)
   - Botão ✓ (confirmar) e ✗ (cancelar)
3. Ao preencher o nome e pelo menos 1 valor → salva como `FixedFlowEntry`
4. Enter salva, Escape cancela

**Implementação:**
- Criar estado `inlineNewEntry: { section: FixedFlowSection } | null`
- Renderizar linha condicional quando `inlineNewEntry` está ativo
- Handler `handleCreateFixedEntryFromGrid(section, title, amountByMonth)`
- Manter o modal grande como alternativa (botão "Edição completa" na linha inline)

**Arquivos afetados:**
- `finance-app.tsx`: novo estado + renderização da linha de criação + handler

#### 2. "+" nas Faturas (abre modal existente)

**Problema:** A sub-seção "Faturas" dentro de Contas não tem botão "+". Pra adicionar compra no cartão, precisa ir na aba Cartões.

**Solução:** Adicionar "+" na sub-seção de Faturas que chama `openPurchaseModal()` já preenchido para compra parcelada/cartão (`planningMode: "card_parcelado"`, `paymentOption: "card"` e cartão padrão quando existir).

> Não usar `openCardModal()` para esse botão. `openCardModal()` cria/edita o cadastro do cartão; aqui o objetivo é criar uma compra planejada que vai compor uma fatura futura.

**O que já existe:** O modal de PlannedPurchase já suporta modo "Comprar no cartão" (linha 7981). Basta conectar o "+" ao modal existente.

#### 3. "+" nas Dívidas (abre modal existente)

**Problema:** Dívida só é criada na aba Contas. Na grid, dívidas aparecem como rows mas sem "+" próprio.

**Solução:** Adicionar "+" na sub-seção de Dívidas que chama `openDebtModal()`.

**O que já existe:** O modal de Debt já existe (linha 8918). Basta conectar o "+" ao modal existente.

#### 4. Investimentos — não muda

Investimentos não são itens da planilha. Continuam sendo criados na aba Planejamento/Investimentos.

---

### Resumo das mudanças

| Seção | Hoje | Depois |
|-------|------|--------|
| Ganhos | "+" abre modal grande | "+" abre **linha inline** (modal como alternativa) |
| Contas fixas | "+" abre modal grande | "+" abre **linha inline** (modal como alternativa) |
| Dívidas | Sem "+" na grid | "+" abre **modal existente** (`openDebtModal`) |
| Compras planejadas | "+" abre modal grande na seção Planejamento | Continua usando o modal grande, mas agora como subgrupo dentro de Contas |
| Faturas | Sem "+" na grid | "+" abre **modal existente** (`openPurchaseModal` com modo cartão) |

---

## Fase 2: Faturas de Cartão na Planilha (Estimativa vs Realidade)

### Conceito

A planilha é uma ferramenta de **planejamento**. O valor da fatura ali é uma **estimativa** do que o usuário prevê que a fatura será. A **realidade** da fatura vive na aba Cartões (calculada a partir das transações de crédito reais).

```
PLANILHA (Estimativa)              CARTÕES (Realidade)
┌──────────────────────┐          ┌──────────────────────┐
│  Fatura Nubank        │          │  Fatura Nubank        │
│  R$ 1.800,00 (estimado)│  ←vs→  │  R$ 1.560,00 (real)  │
└──────────────────────┘          └──────────────────────┘
```

Ao clicar na fatura dentro da planilha, abre um **modal** mostrando:
- Valor estimado (o que o usuário digitou na planilha)
- Valor real (soma das transações de crédito do cartão naquele mês)
- Diferença entre os dois
- Lista de compras que compõem a fatura real

### 2.1 Resumo na Grid

A row de cartão na seção "Contas" já mostra valores por mês. Comportamento:

- **Valor exibido**: é a **estimativa** (o que o usuário planejou)
- **Badge de status**: 🟡 Pendente / 🟢 Pago / ⚪ Zero
- **Click na cell**: abre o modal de comparação (estimado vs real)

### 2.2 Modal de Comparação (Estimado vs Real)

**Componente:** `CardBillComparisonModal`

**Layout:**
```
┌─────────────────────────────────────────┐
│  Fatura Nubank **** 1234      [Fechar]  │
│  Referência: Agosto/2026                │
│                                         │
│  ┌─────────────┬─────────────┐          │
│  │  Estimado   │    Real     │          │
│  │  R$ 1.800   │  R$ 1.560   │          │
│  │  (planilha) │ (cartão)    │          │
│  └─────────────┴─────────────┘          │
│  Diferença: R$ 240 a menos que o previsto│
│                                         │
│  ┌─ Compras reais nesta fatura ───────┐ │
│  │  Amazon      12x R$ 50   R$ 600    │ │
│  │  iFood       1x R$ 120   R$ 120    │ │
│  │  Uber        3x R$ 80   R$ 240     │ │
│  │  Mercado L.  2x R$ 300  R$ 600     │ │
│  └────────────────────────────────────┘ │
│                                         │
│  ┌─ Editar estimativa ────────────────┐ │
│  │  Valor estimado: [1800.00]         │ │
│  │  (este valor é usado na planilha   │ │
│  │   e no comparativo mensal)         │ │
│  └────────────────────────────────────┘ │
│                                         │
│  [Marcar como pago]                     │
└─────────────────────────────────────────┘
```

**Funcionalidades:**
1. **Comparação lado a lado** — estimado (planilha) vs real (cartão)
2. **Diferença** — mostra se a estimativa está acima ou abaixo do real
3. **Lista de compras reais** — transações credit vinculadas à fatura
4. **Editar estimativa** — input para ajustar o valor que aparece na planilha
5. **Marcar como pago** — cria transação de pagamento do cartão

### 2.3 Dual Mode: Estimativa Automática vs Manual

**Estado por fatura:**
```typescript
interface CardBillEstimate {
  cardId: string;
  monthValue: string;
  estimatedAmount: number;       // valor que o usuário digitou (estimativa)
  isAutoEstimate: boolean;       // se true, estimativa = soma de compras planejadas
  status: "pending" | "paid";
  paidTransactionId?: string;
}
```

> Não persistir `realAmount` em `CardBillEstimate`. O valor real é sempre derivado das transações de crédito do cartão no mês da fatura. Persistir esse campo criaria risco de valor stale quando o usuário editar, remover ou adicionar transações.

**Modos:**
- **Automático** (padrão): `estimatedAmount` = soma de compras planejadas no cartão
  - Atualiza quando o usuário adiciona/remove compras planejadas
  - Útil quando o usuário não sabe o valor exato
- **Manual**: `estimatedAmount` = valor digitado pelo usuário
  - Override da estimativa automática
  - Mostra badge "Estimativa manual" na grid
  - Útil quando o usuário quer testar cenários ("e se eu gastar R$200 a mais?")

**Onde armazenar:** Novo estado `cardBillEstimates: Record<string, CardBillEstimate>`
- Chave: `${cardId}:${monthValue}`
- Persistido junto com o state do app
- Incluir em `FinancePersistedState`, `buildPersistedState()` e `applyPersistedState()` em `src/components/finance-app.tsx`

### 2.3.1 Valores Derivados

Criar helpers para separar estimativa, realidade e valor exibido:

```typescript
function getCardBillEstimateKey(cardId: string, monthValue: string) {
  return `${cardId}:${monthValue}`;
}

function getCardBillRealAmount(cardId: string, monthValue: string) {
  // Soma transações reais de crédito daquele cartão cuja fatura pertence ao monthValue.
}

function getCardBillAutoEstimatedAmount(cardId: string, monthValue: string) {
  // Soma compras planejadas daquele cartão/mês ainda não realizadas.
}

function getCardBillGridAmount(cardId: string, monthValue: string) {
  // Se existir override manual, usa estimatedAmount.
  // Caso contrário, usa getCardBillAutoEstimatedAmount().
}
```

Regras:
- `realAmount` é derivado de `transactions`, usando a mesma regra de mês de fatura já usada em `getCardStatementMonthForTransaction()`.
- `estimatedAmount` persistido só representa override/manual ou snapshot de planejamento, não realidade.
- Em modo automático, a grid deve refletir mudanças em compras planejadas sem salvar um novo registro a cada render.
- Uma fatura deve aparecer na grid quando `estimatedAmount > 0` **ou** `realAmount > 0`, para permitir planejamento antes de existirem transações reais.

### 2.4 Propagação da Estimativa

| Ação | O que acontece |
|------|----------------|
| Usuário digita valor estimado na planilha | Atualiza `cardBillEstimates[key].estimatedAmount` |
| Comparativo mensal usa valor estimado | Soma do valor exibido na grid (`manual estimatedAmount` ou estimativa automática), nunca `realAmount` |
| Usuário clica na fatura | Abre modal com estimado vs real |
| Usuário marca como paga | Cria Transaction de pagamento com `amount: realAmount` |
| Adiciona compra no cartão | `realAmount` recalcula automaticamente |

### 2.4.1 Pagamento de Fatura: Regra de Idempotência

`handleToggleCardBillPaid(cardId, monthValue)` precisa ser idempotente:
- Se `status` for `"pending"` e não existir `paidTransactionId`, cria uma única `Transaction` de pagamento.
- Se `status` for `"pending"` mas `paidTransactionId` apontar para uma transação existente, reaproveita/atualiza essa transação em vez de criar outra.
- Se `status` for `"paid"`, desfaz o pagamento: remove ou estorna a transação vinculada e limpa `paidTransactionId`.
- Antes de criar nova transação, procurar uma existente por `paidTransactionId` e por marcador determinístico na descrição/notas, por exemplo `CARD_BILL_PAYMENT:{cardId}:{monthValue}`.

A transação de pagamento da fatura deve:
- Ter `amount = realAmount` calculado no momento do pagamento.
- Ser uma saída da conta usada para pagar a fatura.
- **Não** ser registrada como nova compra de crédito do mesmo cartão, para não entrar de volta no cálculo da fatura real.
- Ter categoria `cat-bills` ou equivalente de fatura de cartão.

### 2.5 Onde Cada Valor É Usado

| Local | Qual valor usa | Por quê |
|-------|---------------|---------|
| **Planilha (grid)** | Estimado | É planejamento — "vai ser mais ou menos isso" |
| **Comparativo mensal** | Estimado | Projeção de entradas/saídas futuras |
| **Fechamento do mês** | Estimado | Prévia do que vai pagar |
| **Cartões (aba)** | Real | Já aconteceu — é o que o cartão cobra |
| **Modal de comparação** | Ambos | Mostra a diferença entre previsão e realidade |

### 2.6 Arquivos afetados

| Arquivo | Mudanças |
|---------|----------|
| `src/types/finance.ts` | Novo tipo `CardBillEstimate` |
| `src/components/finance-app.tsx` | Novo estado `cardBillEstimates`, helpers de estimativa/realidade, persistência em `FinancePersistedState`, novo modal `CardBillComparisonModal`, handler `handleUpdateEstimate` |
| `src/components/finance-ui.tsx` | Componente `CardBillComparisonModal` |

---

## Fase 3: Propagação Completa

### 3.1 Mapa de Propagação

| Origem na grid | Entidade criada/atualizada | Entidades propagadas |
|---|---|---|
| Muda valor de FixedEntry | `fixedEntries[i].amountByMonth[m]` | → Bills vinculadas (amount) → Transactions existentes (amount) |
| Marca FixedEntry como pago | `fixedEntries[i].completedMonths` | → Transaction nova (buildFixedFlowTransaction) → Debts (paidAmount) |
| Muda estimativa de fatura | `cardBillEstimates[key].estimatedAmount` | → Comparativo mensal (usa estimado) |
| Marca fatura como pago | `cardBillEstimates[key].status` | → Transaction nova (pagamento do cartão, amount = realAmount) |
| Adiciona compra no cartão | Transaction nova (credit) | → Fatura real recalcula (auto) → Estimativa pode atualizar se modo automático |
| Muda valor de PlannedPurchase | `plannedPurchases[i].plannedAmountByMonth` | → Se já tiver `linkedTransactionId` ou bill vinculada, sincronizar valor/data ou bloquear edição direta |
| Marca compra como bought | `plannedPurchases[i].status` | → Transaction nova + Bill nova |
| Adiciona nova FixedEntry | `fixedEntries` (nova entry) | — (só afeta ao marcar pago) |
| Adiciona nova Debt | `debts` (nova dívida) | → FixedEntry vinculada (se tem plano) |
| Adiciona novo Investment | `investments` (novo) | → FixedEntry "Aporte {nome}" |

### 3.2 Handlers Existentes que Precisam de Ajuste

| Handler | Linha | Ajuste necessário |
|---------|-------|-------------------|
| `handleFixedEntryAmountChange()` | 4778 | ✅ Já propaga — verificar se pega todas as entidades vinculadas |
| `handleToggleFixedEntry()` | 5012 | ✅ Já cria transação — verificar se atualiza bills corretamente |
| `handlePlannedPurchaseAmountChange()` | 4953 | ⚠️ Só atualiza purchase — precisa propagar ou bloquear se tem `linkedTransactionId`/bill vinculada |
| `handleMoveMonthlyGridRow()` | 5286 | ✅ Já move entre meses — verificar se atualiza dueDate de bills |

### 3.2.1 Regra Para Compras Planejadas Já Realizadas

Antes de permitir edição inline ou drag & drop de uma `PlannedPurchase`, verificar se ela já virou compra real:
- Se `purchase.status === "bought"` ou `purchase.linkedTransactionId` existir, a grid não deve editar como planejamento simples.
- Opção A: bloquear edição na grid e orientar a editar a transação real.
- Opção B: permitir edição e sincronizar a `Transaction`/`Bill` vinculada no mesmo handler.

Escolha recomendada para reduzir risco: **Opção A no primeiro ciclo**. Compras realizadas já são realidade, então devem ser editadas na transação/fatura real, não no planejamento.

### 3.3 Handlers Novos

| Handler | O que faz |
|---------|-----------|
| `handleCreateFixedEntryFromGrid(section, title, amountByMonth)` | Cria nova FixedFlowEntry a partir da linha inline na grid |
| `handleUpdateCardBillEstimate(cardId, monthValue, estimatedAmount)` | Atualiza estimativa da fatura na planilha |
| `handleToggleCardBillPaid(cardId, monthValue)` | Marca fatura como paga + cria Transaction de pagamento (amount = realAmount) |

---

## Fase 4: UX e Detalhes Visuais

### 4.1 Botões "+" por Seção

**Posição:** No cabeçalho de cada seção, à direita do título
**Estilo:** Botão sutil com ícone `Plus`, `text-slate-400 hover:text-sky-600`, sem borda visível
**Comportamento:** Hover mostra tooltip "Adicionar [tipo]"

### 4.2 Linha de Criação Inline (Ganhos/Contas)

**Estilo:**
- Fundo `bg-sky-50/50` (diferente das outras linhas)
- Borda tracejada `border-dashed border-sky-300`
- Campo de nome com placeholder "Novo item..."
- Cells de mês com placeholder "0"
- Botões ✓ e ✗ na coluna "Total"

**Animação:**
- Entrada: `animate-slide-in` (desliza de cima)
- Saída: `animate-slide-out` (desliza pra cima e desaparece)

### 4.3 Badges na Grid

| Badge | Cor | Onde aparece |
|-------|-----|--------------|
| Pago | `bg-emerald-100 text-emerald-700` | Toggle de status |
| Pendente | `bg-amber-100 text-amber-700` | Toggle de status |
| Estimativa manual | `bg-violet-100 text-violet-700` | Ao lado do valor da fatura na grid |
| Parcela | `bg-sky-100 text-sky-700` | Na cell do mês (ex: "3/12") |
| Diferença | `bg-amber-50 text-amber-600` | No modal (estimado vs real) |

### 4.4 Painel Lateral (CardBillPanel)

**Posição:** Direita da tela, `w-[400px]`, overlay com backdrop
**Animação:** Slide-in da direita
**Conteúdo:** Conforme layout da seção 2.2

---

## Ordem de Implementação

### Passo 1: Criação inline (Ganhos/Contas) + botões "+" faltantes
- Implementar linha de criação inline para Ganhos e Contas
- Adicionar "+" nas sub-seções de Faturas e Dívidas (conectar aos modais existentes)
- Criar handler `handleCreateFixedEntryFromGrid`

### Passo 2: Modal de fatura (estimado vs real)
- Criar estado `cardBillEstimates`
- Incluir `cardBillEstimates` em `FinancePersistedState`, `buildPersistedState()` e `applyPersistedState()`
- Criar helpers para `realAmount` derivado, estimativa automática e valor exibido na grid
- Criar componente `CardBillComparisonModal`
- Implementar `handleUpdateCardBillEstimate`
- Conectar click na cell do cartão ao modal

### Passo 3: Propagação completa
- Revisar todos os handlers existentes
- Implementar handlers novos
- Garantir idempotência de `handleToggleCardBillPaid`
- Garantir que pagamento de fatura não entre como compra de crédito do próprio cartão
- Testar todos os cenários de propagação

### Passo 4: UX polish
- Badges visuais
- Animações de entrada/saída
- Tooltips explicativos
- Testes de edge cases

---

## Arquivos Afetados

| Arquivo | Mudanças |
|---------|----------|
| `src/components/finance-app.tsx` | Novo estado `inlineNewEntry`, renderização da linha inline, handler `handleCreateFixedEntryFromGrid`, novo estado `cardBillEstimates`, novo modal `CardBillComparisonModal` |
| `src/components/finance-ui.tsx` | Componente `CardBillComparisonModal` |
| `src/types/finance.ts` | Novo tipo: `CardBillEstimate`; manter/ajustar `FixedFlowSection` com cuidado para não quebrar `Record<FixedFlowSection, string>` |
| `src/app/globals.css` | Animações: slide-in, slide-out, modal-enter |

---

## Riscos e Considerações

1. **Performance**: Adicionar muitos useState pode causar re-renders. Considerar usar `useReducer` ou agrupar estados relacionados.

2. **Consistência**: Quando override manual está ativo, o valor calculado continua atualizando em background. Se o usuário desativar override, o valor volta ao calculado (que pode ter mudado).

3. **Dívida duplicada**: Ao criar Debt + FixedEntry vinculada, garantir que não haja duplicação ao marcar como pago.

4. **Faturas recorrentes**: Faturas de cartão são geradas automaticamente. A criação manual deve ser limitada a casos excepcionais.

5. **Drag & drop**: Com a nova linha de criação, o drag & drop pode conflitar. Considerar desabilitar drag na linha de criação.

6. **Persistência incompleta**: Se `cardBillEstimates` não entrar em `FinancePersistedState`, `buildPersistedState()` e `applyPersistedState()`, o usuário perde estimativas manuais ao recarregar.

7. **Valor real stale**: Não persistir `realAmount`. Sempre recalcular a partir de `transactions`.

8. **Fatura invisível sem transação real**: A row de fatura precisa aparecer quando houver estimativa planejada, mesmo que `realAmount` seja zero.

9. **Pagamento duplicado de fatura**: `handleToggleCardBillPaid` precisa usar `paidTransactionId` e marcador determinístico para não criar múltiplas transações do mesmo pagamento.

10. **TypeScript em `FixedFlowSection`**: Remover `"Planejamento"` dos maps visuais sem alterar o tipo quebra os `Record`. Ou mantém as chaves, ou altera o tipo e corrige todos os usos.

---

## Checklist de Validação Antes de Considerar Pronto

- [x] Mês selecionado fica destacado visualmente em todas as cells da grid, não só nos headers/totais.
- [x] A grid mostra apenas duas seções principais: Ganhos e Contas.
- [x] Dentro de Contas, subgrupos aparecem na ordem: Contas fixas, Dívidas, Compras planejadas, Faturas.
- [x] Divisória não aparece antes do primeiro subgrupo visível.
- [x] Botão "+" de Ganhos/Contas cria linha inline.
- [x] Botão "+" de Compras planejadas abre `openPurchaseModal()`.
- [x] Botão "+" de Faturas abre `openPurchaseModal()` em modo cartão, não `openCardModal()`.
- [x] Botão "+" de Dívidas abre `openDebtModal()`.
- [x] Fatura com estimativa manual aparece mesmo sem transação real.
- [x] Comparativo mensal usa valor estimado da fatura.
- [x] Aba Cartões continua mostrando valor real calculado por transações.
- [x] Modal de fatura mostra estimado, real, diferença e itens reais.
- [x] Pagar fatura cria uma única transação de pagamento.
- [x] Desfazer pagamento remove/estorna a transação vinculada sem afetar compras reais do cartão.
- [x] Recarregar a página preserva estimativas manuais e status de pagamento.
- [x] `npm run lint` e/ou `npm run build` passam sem erro de TypeScript.
