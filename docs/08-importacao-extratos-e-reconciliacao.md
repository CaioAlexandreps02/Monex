# 08 — Importação de Extratos, Reconciliacao e Aprendizado

## Objetivo

Criar uma area no Monex para importar extratos bancarios e extratos de cartao, revisar os lancamentos detectados, transformar itens confirmados em transacoes reais e atualizar automaticamente os valores reais de cartao, debito, Pix, boletos, entradas e pagamentos.

Essa funcionalidade complementa a planilha:

- A planilha continua sendo o centro de **planejamento**.
- A importacao de extratos vira uma das principais fontes de **realidade financeira**.
- O sistema passa a comparar planejado vs real com menos trabalho manual.

---

## Principio Central

Nenhum arquivo importado deve alterar o historico financeiro de forma cega.

Fluxo obrigatorio:

1. Usuario envia um arquivo.
2. Sistema le e normaliza os dados.
3. Sistema sugere tipo, categoria, conta/cartao e possiveis vinculos.
4. Usuario revisa, confirma, edita ou ignora.
5. Apenas itens aprovados viram `Transaction`, atualizam faturas reais e participam dos relatorios.

> Regra de seguranca: extrato importado entra primeiro como "pendente". So vira realidade depois de confirmacao manual ou regra automatica previamente aprovada pelo usuario.

---

## O Que Essa Implementacao Vai Mudar no Sistema

Hoje, grande parte da realidade financeira depende de lancamento manual.

Depois:

- O usuario podera importar extratos de banco e cartao.
- O Monex vai interpretar as linhas do arquivo.
- O sistema vai sugerir classificacoes.
- O usuario vai confirmar em lote ou item por item.
- Transacoes reais serao criadas com mais consistencia.
- Faturas reais de cartao serao calculadas a partir das compras reais importadas.
- Compras planejadas poderao ser vinculadas a compras reais encontradas no extrato.
- Relatorios de gastos ficarao mais proximos da vida real.

---

## Tipos de Arquivo Suportados

### Fase inicial

- CSV
- OFX

### Fase futura

- PDF de extrato bancario
- PDF de fatura de cartao
- Arquivos recebidos por email
- Integracao Open Finance

> Recomendacao: comecar por CSV e OFX. PDF deve vir depois, porque cada banco formata de um jeito e a extracao visual exige mais tratamento.

---

## Entidades Novas

### `ImportedStatementBatch`

Representa um arquivo importado.

```typescript
interface ImportedStatementBatch {
  id: string;
  fileName: string;
  fileType: "csv" | "ofx" | "pdf";
  sourceKind: "bank_account" | "credit_card" | "unknown";
  sourceInstitution?: string;
  accountId?: string;
  cardId?: string;
  importedAt: string;
  periodStart?: string;
  periodEnd?: string;
  status: "pending_review" | "partially_confirmed" | "confirmed" | "archived";
  itemCount: number;
  confirmedCount: number;
  ignoredCount: number;
  duplicateCount: number;
}
```

### `ImportedStatementItem`

Representa uma linha do arquivo antes de virar transacao real.

```typescript
interface ImportedStatementItem {
  id: string;
  batchId: string;
  rawDescription: string;
  normalizedDescription: string;
  date: string;
  amount: number;
  direction: "inflow" | "outflow";
  sourceKind: "bank_account" | "credit_card" | "unknown";
  paymentMethod:
    | "credit_card"
    | "debit_card"
    | "pix"
    | "bank_transfer"
    | "boleto"
    | "cash"
    | "unknown";
  accountId?: string;
  cardId?: string;
  suggestedCategoryId?: string;
  suggestedTransactionType?: "income" | "expense";
  suggestedMatch?: ImportedStatementMatch;
  confidence: number;
  status: "pending" | "confirmed" | "ignored" | "duplicate";
  confirmedTransactionId?: string;
  ignoredReason?: string;
}
```

### `ImportedStatementMatch`

Representa um possivel vinculo com algo que ja existe.

```typescript
interface ImportedStatementMatch {
  kind:
    | "existing_transaction"
    | "planned_purchase"
    | "fixed_entry"
    | "bill"
    | "card_bill_payment";
  targetId: string;
  confidence: number;
  reason: string;
}
```

---

## Fluxo de Uso

### 1. Upload

Tela: `Importar extratos`

O usuario seleciona:

- Arquivo
- Tipo: conta bancaria, cartao de credito ou detectar automaticamente
- Conta/cartao relacionado, quando souber
- Banco/instituicao, se necessario

### 2. Normalizacao

O sistema transforma formatos diferentes em uma estrutura unica:

- Data
- Descricao original
- Descricao normalizada
- Valor
- Entrada/saida
- Metodo de pagamento provavel
- Conta/cartao provavel

### 3. Classificacao

O sistema sugere:

- Categoria
- Tipo: receita ou despesa
- Metodo: credito, debito, Pix, boleto, transferencia
- Conta/cartao
- Se e duplicado
- Se bate com compra planejada
- Se bate com transacao ja existente
- Se parece pagamento de fatura

### 4. Revisao

Tela de revisao com filtros:

- Pendentes
- Alta confianca
- Baixa confianca
- Duplicados
- Cartao
- Debito/Pix
- Entradas
- Possiveis vinculos com planejamento

Acoes por item:

- Confirmar
- Editar e confirmar
- Ignorar
- Marcar como duplicado
- Vincular a compra planejada
- Criar regra a partir dessa escolha

### 5. Confirmacao

Ao confirmar:

- Item vira `Transaction`.
- Item recebe `confirmedTransactionId`.
- Fatura real do cartao recalcula automaticamente.
- Relatorios passam a considerar a transacao.
- Se houver vinculo com `PlannedPurchase`, a compra planejada pode virar realizada.

---

## Cartao de Credito: Regra Mais Importante

Para cartao, separar estes conceitos:

| Conceito | Papel | Fonte |
|----------|-------|-------|
| Compra real de credito | Algo que aconteceu no cartao | Extrato ou lancamento manual |
| Parcela | Ocorrencia mensal de uma compra parcelada | Derivada da compra real |
| Fatura real | Soma das compras/parcelas no ciclo do cartao | Calculada por transacoes reais |
| Estimativa de fatura | Planejamento do usuario na planilha | `CardBillEstimate` |

Regras:

- A fatura real nao deve ser editada diretamente.
- A fatura real deve ser recalculada a partir de `Transaction`.
- A planilha pode editar apenas estimativa.
- Pagamento de fatura deve ser uma saida da conta bancaria, nao uma nova compra de credito no mesmo cartao.
- Importar extrato de cartao deve criar ou reconciliar compras reais, nao alterar estimativas diretamente.

---

## Reconciliacao com Compras Planejadas

Exemplo:

Planejado:

```text
Notebook, 10x R$ 300, Nubank
```

Importado:

```text
MERCADO PAGO NOTEBOOK 01/10 - R$ 300
```

O sistema sugere:

```text
Possivel vinculo com compra planejada "Notebook".
Confianca: 86%.
Motivo: descricao parecida, mesmo cartao, valor compativel e mes esperado.
```

Ao confirmar:

- `ImportedStatementItem` vira `Transaction`.
- `PlannedPurchase` recebe vinculo com a transacao real.
- Status da compra planejada pode mudar para `bought`.
- Parcelas futuras podem ser geradas ou acompanhadas conforme a regra do cartao.
- Fatura real passa a incluir a compra.

---

## Aprendizado do Sistema

Sim, da para fazer o sistema "aprender" com o que o usuario vai marcando.

Mas o jeito seguro nao e deixar uma IA alterar tudo sozinha desde o comeco. O melhor caminho e criar um mecanismo de **regras aprendidas e auditaveis**.

### Como funciona

Quando o usuario confirma uma classificacao, o sistema observa o padrao:

```text
Descricao contem "SPOTIFY"
Usuario escolheu categoria "Assinaturas"
Usuario escolheu metodo "cartao de credito"
Usuario escolheu cartao "Nubank"
```

Depois de repeticoes suficientes, o sistema sugere:

```text
Sempre classificar lancamentos com "SPOTIFY" como Assinaturas no Nubank?
```

Se o usuario aprovar, vira uma regra automatica.

### Entidade `ImportLearningRule`

```typescript
interface ImportLearningRule {
  id: string;
  name: string;
  patternKind: "contains" | "starts_with" | "exact" | "regex";
  pattern: string;
  normalizedPattern: string;
  sourceKind?: "bank_account" | "credit_card";
  institution?: string;
  accountId?: string;
  cardId?: string;
  categoryId?: string;
  paymentMethod?: ImportedStatementItem["paymentMethod"];
  transactionType?: "income" | "expense";
  targetKind?: ImportedStatementMatch["kind"];
  targetId?: string;
  confidence: number;
  supportCount: number;
  mistakeCount: number;
  autoApply: boolean;
  requiresReviewAboveAmount?: number;
  createdAt: string;
  updatedAt: string;
}
```

### Ciclo de aprendizado

1. Primeira vez: sistema apenas sugere com baixa confianca.
2. Segunda/terceira vez: sistema mostra sugestao mais forte.
3. Depois de N confirmacoes iguais: sistema pergunta se pode automatizar.
4. Depois de autorizado: sistema aplica sozinho em novos imports.
5. Se o usuario corrigir uma regra automatica, `mistakeCount` sobe.
6. Se houver muitos erros, regra volta para revisao manual.

### Parametros recomendados

| Situacao | Acao |
|----------|------|
| 1 ocorrencia | Apenas sugestao |
| 2-3 ocorrencias iguais | Sugestao com destaque |
| 4+ ocorrencias iguais | Perguntar se deseja criar regra |
| Regra aprovada + valor baixo | Auto-aplicar |
| Regra aprovada + valor alto | Aplicar, mas manter em revisao |
| Usuario corrigiu regra 2 vezes | Desativar auto-aplicacao |

### O Que Pode Ser Automatizado

- Categoria
- Metodo de pagamento
- Conta/cartao
- Tipo receita/despesa
- Ignorar tarifas conhecidas, se o usuario quiser
- Detectar assinatura recorrente
- Detectar pagamento de fatura
- Vincular descricoes recorrentes a planejamentos recorrentes

### O Que Deve Exigir Revisao

- Lancamentos de valor alto
- Estornos
- Transferencias entre contas proprias
- Pagamento de fatura de cartao
- Duplicados incertos
- Vinculo com compra planejada quando a confianca for baixa
- Qualquer regra nova ainda nao aprovada

---

## Deteccao de Duplicados

Criar uma chave de deduplicacao:

```typescript
function buildImportFingerprint(item: ImportedStatementItem) {
  return [
    item.date,
    item.amount.toFixed(2),
    normalizeDescriptionForFingerprint(item.normalizedDescription),
    item.accountId ?? item.cardId ?? "unknown",
  ].join(":");
}
```

Regras:

- Se fingerprint igual ja existe, marcar como `duplicate`.
- Se data e valor forem iguais, mas descricao levemente diferente, sugerir duplicado com confianca media.
- Nunca criar `Transaction` duplicada sem revisao.

---

## Integracoes Futuras

### Open Finance

Registrar como direcao futura.

Objetivo:

- Conectar contas e cartoes via Open Finance.
- Buscar transacoes direto das instituicoes.
- Reduzir necessidade de upload manual.
- Manter o mesmo fluxo de reconciliacao e aprendizado.

Observacao:

- Mesmo com Open Finance, dados novos devem passar pelo pipeline de normalizacao, classificacao, deduplicacao e reconciliacao.
- A diferenca e apenas a origem dos dados: em vez de arquivo, vem de API.

### Email

Registrar como direcao futura.

Objetivo:

- Conectar ao email do usuario.
- Detectar emails de banco/cartao com extratos e faturas.
- Baixar anexos automaticamente.
- Criar `ImportedStatementBatch` sem o usuario precisar baixar arquivo manualmente.

Fluxo esperado:

1. Usuario conecta email e autoriza leitura limitada.
2. Sistema busca emails de remetentes confiaveis ou filtros configurados.
3. Sistema encontra anexos de extrato/fatura.
4. Sistema importa o anexo como batch pendente.
5. Usuario revisa no Monex.

Regras de seguranca:

- Pedir autorizacao explicita.
- Permitir configurar remetentes/palavras-chave.
- Nao apagar emails.
- Nao enviar conteudo sensivel para terceiros sem consentimento.
- Guardar historico de quais arquivos foram processados para evitar duplicidade.

---

## Ordem de Implementacao Recomendada

### Fase 1: Base de importacao manual

- Criar pagina `Importar extratos`.
- Criar tipos `ImportedStatementBatch` e `ImportedStatementItem`.
- Implementar parser CSV.
- Implementar parser OFX.
- Criar tela de revisao.
- Confirmar item como `Transaction`.
- Ignorar item.
- Detectar duplicados simples.

### Fase 2: Cartao de credito

- Importar extrato de cartao.
- Mapear itens para compras reais de credito.
- Recalcular fatura real por ciclo do cartao.
- Detectar pagamento de fatura vindo do extrato bancario.
- Evitar que pagamento de fatura entre como compra do proprio cartao.

### Fase 3: Reconciliacao com planejamento

- Sugerir vinculo com `PlannedPurchase`.
- Sugerir vinculo com `Bill`.
- Sugerir vinculo com `FixedFlowEntry`.
- Atualizar status de compra planejada quando confirmada como real.
- Mostrar planejado vs real.

### Fase 4: Aprendizado por regras

- Criar `ImportLearningRule`.
- Registrar escolhas do usuario.
- Sugerir criacao de regra apos repeticoes.
- Auto-aplicar apenas regras aprovadas.
- Medir erros e desativar regra ruim.

### Fase 5: Automacao de origem

- Email: buscar anexos automaticamente.
- Open Finance: importar transacoes por API.
- Manter o mesmo pipeline de revisao/reconciliacao.

---

## Checklist de Validacao

- [x] Upload cria um `ImportedStatementBatch`.
- [x] Cada linha do arquivo vira `ImportedStatementItem`.
- [x] Usuario consegue revisar antes de salvar.
- [x] Confirmar item cria `Transaction`.
- [x] Ignorar item nao altera o historico financeiro.
- [x] Duplicados nao criam transacoes repetidas.
- [x] Extrato de cartao atualiza fatura real.
- [x] Pagamento de fatura nao entra como compra de credito.
- [ ] Compra importada pode ser vinculada a compra planejada.
- [ ] Escolhas repetidas geram sugestao de regra.
- [ ] Regra so auto-aplica depois de autorizacao.
- [ ] Regra ruim pode ser corrigida/desativada.
- [ ] Email e Open Finance ficam registrados como origens futuras, sem misturar com a primeira fase.
