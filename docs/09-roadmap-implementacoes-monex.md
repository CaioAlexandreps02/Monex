# 09 — Roadmap Geral de Implementacoes do Monex

## Objetivo

Organizar todas as implementacoes pendentes em uma ordem segura, clara e incremental.

Este arquivo funciona como documento mestre. Ele conecta os planejamentos detalhados ja existentes:

- [06 — Logica Cartao Credito](./06-logica-cartao-credito.md)
- [07 — Planilha como Centro de Planejamento e Controle](./07-planilha-single-source-of-truth.md)
- [08 — Importacao de Extratos, Reconciliacao e Aprendizado](./08-importacao-extratos-e-reconciliacao.md)

---

## Visao Geral do Que Estamos Construindo

O Monex deve evoluir para separar bem duas camadas:

1. **Planejamento**
   - Planilha
   - Compras planejadas
   - Estimativas de fatura
   - Metas, parcelas futuras, previsao mensal

2. **Realidade**
   - Transacoes reais
   - Extratos importados
   - Faturas reais de cartao
   - Debito, Pix, boleto, transferencia
   - Pagamentos e estornos

A planilha vira o centro operacional para planejar e controlar. Os extratos e transacoes viram a base real do que aconteceu.

> Regra principal: planejamento pode sugerir e prever; realidade deve ser calculada a partir de transacoes confirmadas.

---

## Dependencias Entre os Documentos

### `06-logica-cartao-credito.md`

Base conceitual da parte de cartao.

Usar para entender:

- Como o cartao calcula fechamento/vencimento.
- Como compras de credito entram em faturas.
- Como parcelamentos devem impactar meses futuros.
- Como evitar misturar pagamento de fatura com compra de credito.

### `07-planilha-single-source-of-truth.md`

Plano da nova planilha.

Usar para implementar:

- Destaque visual do mes atual.
- Grid com Ganhos e Contas.
- Subgrupos dentro de Contas.
- Criacao inline de itens simples.
- Estimativa de fatura vs valor real.
- Modal de comparacao de fatura.

### `08-importacao-extratos-e-reconciliacao.md`

Plano da importacao de realidade financeira.

Usar para implementar:

- Upload de extratos.
- Normalizacao de linhas.
- Revisao antes de salvar.
- Criacao de transacoes reais.
- Reconciliacao com planejamento.
- Aprendizado por regras.
- Futuras integracoes com email e Open Finance.

## Status Atual Verificado em 2026-08-04

Auditoria feita contra `C:\Caio\Monex\repo\src`.

Legenda:

- `[x]` ja existe no codigo atual.
- `[ ]` ainda precisa implementar.
- `Parcial` existe alguma base, mas nao atende ao comportamento final planejado.

Resumo verificado:

- `[x]` O app ja tem tipos principais (`Transaction`, `Bill`, `Card`, `FixedFlowEntry`, `PlannedPurchase`, `MonthlyGridRow`).
- `[x]` O app ja tem persistencia base em `FinancePersistedState`, `buildPersistedState()` e `applyPersistedState()`.
- `[x]` O app ja calcula faturas reais de cartao via `autoCardBills`, derivadas de `transactions` com `cardMode: "credit"`.
- `[x]` A aba Cartoes ja abre detalhes de cartao/fatura com `openCardDetails()`.
- `[x]` O app ja tem modais existentes para compra planejada, cartao, divida, bill e fixed entry.
- `[x]` A grid ja renderiza fixed entries, bills avulsas, faturas automaticas de cartao e compras planejadas em 2 secoes (`Ganhos`, `Contas`).
- `[x]` Compras planejadas ja aparecem dentro de `Contas`, agrupadas antes de `Faturas`.
- `[x]` A grid ja tem criacao inline para `Ganhos` e `Contas fixas`, alem de botoes por subgrupo.
- `[x]` Existe `CardBillEstimate`.
- `[x]` Existe `cardBillEstimates`.
- `[x]` Existe modal de comparacao de fatura via `renderCardBillComparisonModal()`.
- `[x]` Existe `handleToggleCardBillPaid`.
- `[x]` Existe importacao de extratos (`ImportedStatementBatch`, `ImportedStatementItem`, CSV/OFX, revisao).
- `[ ]` Nao existe aprendizado por regras (`ImportLearningRule`).

Validacao tecnica:

- `npm.cmd run lint` foi executado em `C:\Caio\Monex\repo`.
- Resultado atual: lint passou apos correcao do `Unexpected any` e remocao de imports/funcoes nao usados.
- Observacao: `npm run lint` direto no PowerShell falhou por politica de execucao de scripts; `npm.cmd run lint` executou corretamente.
- `npm.cmd run build` foi executado em `C:\Caio\Monex\repo`.
- Resultado atual: build passou com sucesso.

---

## Ordem Correta de Implementacao

### Fase 0 — Preparacao e Validacao do Estado Atual

Antes de mudar comportamento:

- [x] Rodar lint para saber o estado inicial e corrigir problemas encontrados (`npm.cmd run lint`; passou).
- [x] Rodar build para saber o estado inicial (`npm.cmd run build`; passou).
- [x] Revisar tipos principais: `Transaction`, `Bill`, `Card`, `FixedFlowEntry`, `PlannedPurchase`, `MonthlyGridRow`.
- [x] Confirmar como o app persiste estado em `FinancePersistedState`, `buildPersistedState()` e `applyPersistedState()`.
- [x] Confirmar como `autoCardBills` calcula faturas reais hoje.

Objetivo:

- Evitar implementar em cima de uma suposicao errada.
- Saber o que ja funciona e o que realmente precisa mudar.

---

### Fase 1 — Correcoes Pequenas e Seguras da Planilha

Referencia: [07 — Fase 0](./07-planilha-single-source-of-truth.md#fase-0-destaque-do-mes-atual-na-planilha-bug-fix)

Implementar primeiro:

- Corrigir highlight do mes atual nas cells da grid.
- Aplicar `ring-2 ring-inset ring-sky-400` nos `<div>` internos.
- Manter headers e totais como ja estao se estiverem funcionando.

Por que vem primeiro:

- Baixo risco.
- Melhora visual imediata.
- Ajuda a validar a grid antes das mudancas estruturais.

Checklist:

- [x] Mes atual aparece destacado em fixed entries.
- [x] Mes atual aparece destacado em planned purchases.
- [x] Mes atual aparece destacado em card auto-bills.
- [x] Highlight nao quebra as cores existentes.

Status verificado:

- Feito. O codigo aplica `ring-2 ring-inset ring-sky-400` nos `<div>` internos das cells, preservando as cores existentes.

---

### Fase 2 — Reorganizacao da Grid: Ganhos e Contas

Referencia: [07 — Fase 0.5](./07-planilha-single-source-of-truth.md#fase-05-compras-planejadas-dentro-de-contas-com-divisorias)

Implementar:

- Remover secao visual "Planejamento" da grid.
- Mover compras planejadas para dentro de "Contas".
- Criar subgrupos dentro de Contas:
  - Contas fixas
  - Dividas
  - Compras planejadas
  - Faturas
- Renderizar divisorias apenas entre grupos visiveis.
- Manter chaves exigidas por `FixedFlowSection` enquanto o tipo ainda existir.

Cuidados:

- Nao remover chaves de `fixedSectionStyles` e `fixedSectionDisplayLabels` sem ajustar `FixedFlowSection`.
- Evitar duplicar compras planejadas no comparativo mensal.
- Garantir que drag & drop continue funcionando.

Checklist:

- [x] Grid mostra Ganhos e Contas.
- [x] Compras planejadas aparecem dentro de Contas.
- [x] Faturas aparecem por ultimo.
- [x] Divisoria nao aparece antes do primeiro grupo visivel.
- [x] Totais continuam corretos.

Status verificado:

- Feito. `normalizeFixedSection()` agora normaliza `Planejamento`/`Compras planejadas` para `Contas`, `fixedSectionOrder` tem apenas `Ganhos` e `Contas`, e a renderizacao agrupa `Contas fixas`, `Dividas`, `Compras planejadas` e `Faturas` nessa ordem.

---

### Fase 3 — Criacao Rapida Pela Planilha

Referencia: [07 — Fase 1](./07-planilha-single-source-of-truth.md#fase-1-adicao-rapida-de-itens-na-planilha)

Implementar:

- Estado `inlineNewEntry`.
- Linha inline para criar Ganhos.
- Linha inline para criar Contas fixas.
- Handler `handleCreateFixedEntryFromGrid`.
- Botao de edicao completa como alternativa.
- Botao "+" no subgrupo de compras planejadas chamando `openPurchaseModal()`.
- Botao "+" em faturas chamando `openPurchaseModal()` em modo cartao.
- Botao "+" em dividas chamando `openDebtModal()`.

Cuidados:

- Botao "+" de fatura nao deve chamar `openCardModal()`.
- Linha inline nao deve participar de drag & drop.
- Criacao inline deve exigir nome e pelo menos um valor.

Checklist:

- [x] Ganhos podem ser criados inline.
- [x] Contas fixas podem ser criadas inline.
- [x] Compras planejadas abrem modal existente.
- [x] Faturas abrem modal de compra no cartao.
- [x] Dividas abrem modal de divida.
- [x] Cancelar linha inline nao deixa lixo no estado.

Status verificado:

- Feito. `inlineNewEntry` cria rows rapidas para `Ganhos` e `Contas fixas`; subgrupos de compras, faturas e dividas reaproveitam os modais existentes.

---

### Fase 4 — Separar Estimativa de Fatura e Fatura Real

Referencias:

- [07 — Fase 2](./07-planilha-single-source-of-truth.md#fase-2-faturas-de-cartao-na-planilha-estimativa-vs-realidade)
- [06 — Logica Cartao Credito](./06-logica-cartao-credito.md)

Implementar:

- Tipo `CardBillEstimate`.
- Estado `cardBillEstimates`.
- Persistencia em `FinancePersistedState`.
- Helpers:
  - `getCardBillEstimateKey`
  - `getCardBillRealAmount`
  - `getCardBillAutoEstimatedAmount`
  - `getCardBillGridAmount`
- Grid exibindo valor estimado da fatura.
- Aba Cartoes mantendo valor real calculado por transacoes.
- Fatura aparecendo quando estimativa ou valor real forem maiores que zero.

Cuidados:

- Nao persistir `realAmount`.
- Valor real deve ser sempre derivado de `transactions`.
- Comparativo mensal deve usar estimativa.
- Aba Cartoes deve usar realidade.

Checklist:

- [x] Estimativa manual persiste apos reload.
- [x] Real recalcula quando transacoes mudam.
- [x] Grid usa estimado.
- [x] Cartoes usa real.
- [x] Fatura sem transacao real aparece se tiver estimativa.

Status verificado:

- Feito. A estrutura `CardBillEstimate`/`cardBillEstimates` existe, esta persistida, a grid usa estimativa automatica ou manual, e o real continua derivado de `transactions`.

---

### Fase 5 — Modal de Comparacao da Fatura

Referencia: [07 — Modal de Comparacao](./07-planilha-single-source-of-truth.md#22-modal-de-comparacao-estimado-vs-real)

Implementar:

- `CardBillComparisonModal`.
- Abrir modal ao clicar na cell de fatura na planilha.
- Mostrar:
  - Valor estimado
  - Valor real
  - Diferenca
  - Compras reais da fatura
  - Input para editar estimativa
  - Status pago/pendente
- Handler `handleUpdateCardBillEstimate`.

Cuidados:

- Modal nao deve editar transacoes reais diretamente.
- Edicao da estimativa afeta planilha e comparativo, nao a realidade.

Checklist:

- [x] Modal abre no mes correto.
- [x] Mostra itens reais do ciclo correto.
- [x] Editar estimativa atualiza grid.
- [x] Diferenca estimado vs real aparece corretamente.

Status verificado:

- Feito. `renderCardBillComparisonModal()` abre pela cell da fatura na planilha, mostra estimado, real, diferenca, itens reais e permite editar a estimativa.

---

### Fase 6 — Pagamento de Fatura com Idempotencia

Referencias:

- [07 — Pagamento de Fatura](./07-planilha-single-source-of-truth.md#241-pagamento-de-fatura-regra-de-idempotencia)
- [06 — Logica Cartao Credito](./06-logica-cartao-credito.md)

Implementar:

- Handler `handleToggleCardBillPaid(cardId, monthValue)`.
- Criar transacao de pagamento com marcador deterministico.
- Usar `paidTransactionId`.
- Permitir desfazer pagamento.

Regra obrigatoria:

- Pagamento de fatura e saida da conta bancaria.
- Pagamento de fatura nao e compra de credito do proprio cartao.

Checklist:

- [x] Pagar fatura cria uma unica transacao.
- [x] Clicar novamente desfaz corretamente.
- [x] Reabrir modal nao cria duplicado.
- [x] Valor pago usa `realAmount` calculado no momento.
- [x] Pagamento nao aumenta fatura real.

Status verificado:

- Feito. `handleToggleCardBillPaid()` usa `paidTransactionId` e marcador deterministico `CARD_BILL_PAYMENT:{cardId}:{monthValue}`; a transacao de pagamento nao recebe `cardId`/`cardMode`, entao nao entra no calculo da fatura real.

---

### Fase 7 — Ajustes de Propagacao e Reconciliacao Interna

Referencia: [07 — Fase 3](./07-planilha-single-source-of-truth.md#fase-3-propagacao-completa)

Implementar/verificar:

- `handleFixedEntryAmountChange`.
- `handleToggleFixedEntry`.
- `handlePlannedPurchaseAmountChange`.
- `handleMoveMonthlyGridRow`.
- Regras para compra planejada ja realizada.

Decisao recomendada:

- Se `PlannedPurchase` ja virou realidade (`status === "bought"` ou `linkedTransactionId`), bloquear edicao direta pela grid no primeiro ciclo.
- Orientar o usuario a editar a transacao real.

Checklist:

- [x] Fixed entries continuam propagando para bills/transacoes.
- [x] Dividas nao duplicam pagamento.
- [x] Investimentos continuam sincronizados.
- [x] Compra planejada realizada nao e alterada como se ainda fosse planejamento.

Status verificado:

- Feito. `isPlannedPurchaseRealized()` centraliza a regra e os handlers da grid bloqueiam alteracao/movimento de compras planejadas que ja viraram realidade.

---

### Fase 8 — Base de Importacao Manual de Extratos

Referencia: [08 — Fase 1](./08-importacao-extratos-e-reconciliacao.md#fase-1-base-de-importacao-manual)

Implementar:

- Pagina `Importar extratos`.
- Tipos `ImportedStatementBatch` e `ImportedStatementItem`.
- Parser CSV.
- Parser OFX.
- Tela de revisao.
- Confirmar item como `Transaction`.
- Ignorar item.
- Marcar duplicado.

Regra obrigatoria:

- Importacao nao cria transacao real sem confirmacao ou regra aprovada.

Checklist:

- [x] Upload cria batch.
- [x] Linhas viram itens pendentes.
- [x] Usuario revisa antes de salvar.
- [x] Confirmar cria transacao.
- [x] Ignorar nao altera historico.
- [x] Duplicados nao sao salvos duas vezes.

Status verificado:

- Feito. A aba `Importar` na Home aceita CSV/OFX, cria `ImportedStatementBatch`/`ImportedStatementItem`, permite revisar categoria/metodo/tipo, confirmar como `Transaction`, ignorar e bloquear confirmacao de duplicados detectados.

---

### Fase 9 — Importacao de Extrato de Cartao

Referencia: [08 — Cartao de Credito](./08-importacao-extratos-e-reconciliacao.md#cartao-de-credito-regra-mais-importante)

Implementar:

- Detectar arquivo como extrato de cartao.
- Mapear linhas para compras reais de credito.
- Relacionar compra ao cartao correto.
- Calcular ciclo de fatura pelo fechamento/vencimento.
- Atualizar fatura real derivada das transacoes.

Cuidados:

- Nao alterar estimativas automaticamente em modo manual.
- Nao duplicar compras ja lancadas manualmente.
- Estornos devem reduzir ou anular transacoes conforme regra definida.

Checklist:

- [x] Compra importada entra como credito no cartao correto.
- [x] Fatura real recalcula.
- [x] Estimativa da planilha continua separada.
- [x] Duplicados sao detectados.

Status verificado:

- Feito. A importacao aceita origem `Cartao de credito`, confirma compras como transacoes de credito no cartao escolhido, calcula o mes da fatura pelo fechamento do cartao, preserva estimativas da planilha e trata creditos/estornos como abatimento da fatura real. A reconciliacao avancada com compras planejadas fica para a Fase 10.

---

### Fase 10 — Reconciliacao com Planejamento

Referencia: [08 — Reconciliacao com Compras Planejadas](./08-importacao-extratos-e-reconciliacao.md#reconciliacao-com-compras-planejadas)

Implementar:

- Sugerir match com `PlannedPurchase`.
- Sugerir match com `Bill`.
- Sugerir match com `FixedFlowEntry`.
- Sugerir pagamento de fatura.
- Permitir vincular item importado a planejamento existente.

Checklist:

- [ ] Sistema sugere compra planejada parecida.
- [ ] Usuario confirma ou rejeita match.
- [ ] Compra planejada vinculada vira realizada.
- [ ] Transacao real fica conectada ao planejamento.
- [ ] Planejado vs real fica rastreavel.

Status verificado:

- Pendente. Nao existe reconciliacao de importados com planejamento.

---

### Fase 11 — Aprendizado por Regras

Referencia: [08 — Aprendizado do Sistema](./08-importacao-extratos-e-reconciliacao.md#aprendizado-do-sistema)

Implementar:

- Tipo `ImportLearningRule`.
- Registrar escolhas repetidas do usuario.
- Sugerir criacao de regra apos repeticoes.
- Auto-aplicar apenas regras aprovadas.
- Medir `supportCount` e `mistakeCount`.
- Desativar regra que comeca a errar.

Regra de seguranca:

- O sistema pode aprender, mas automacao precisa ser autorizada.
- Itens de alto valor ou baixa confianca continuam em revisao.

Checklist:

- [ ] Escolhas repetidas geram sugestao.
- [ ] Usuario aprova regra.
- [ ] Regra aplica sozinha em novo import.
- [ ] Usuario pode corrigir regra.
- [ ] Regra ruim deixa de auto-aplicar.

Status verificado:

- Pendente. Nao existe `ImportLearningRule` nem mecanismo de aprendizado.

---

### Fase 12 — Integracoes Futuras: Email e Open Finance

Referencia: [08 — Integracoes Futuras](./08-importacao-extratos-e-reconciliacao.md#integracoes-futuras)

Nao implementar agora. Apenas manter planejado.

#### Email

Objetivo futuro:

- Conectar email do usuario.
- Buscar anexos de extratos/faturas.
- Criar batches automaticamente.
- Manter revisao no Monex.

#### Open Finance

Objetivo futuro:

- Conectar contas e cartoes por API.
- Buscar transacoes direto das instituicoes.
- Usar o mesmo pipeline de importacao, deduplicacao e reconciliacao.

Checklist futuro:

- [ ] Autorizacao explicita.
- [ ] Controle de origem dos dados.
- [ ] Evitar duplicidade entre email, upload manual e Open Finance.
- [ ] Mesmo pipeline para todas as origens.

---

## Ordem Resumida

1. Validar estado atual.
2. Corrigir highlight do mes atual.
3. Reorganizar grid em Ganhos e Contas.
4. Criar adicao rapida pela planilha.
5. Separar estimativa de fatura e fatura real.
6. Criar modal estimado vs real.
7. Implementar pagamento de fatura idempotente.
8. Ajustar propagacoes internas.
9. Criar importacao manual CSV/OFX.
10. Importar extratos de cartao.
11. Reconciliar importados com planejamento.
12. Criar aprendizado por regras.
13. Futuro: email e Open Finance.

---

## Regra de Ouro Para Toda Implementacao

Antes de salvar algo como realidade financeira, perguntar:

```text
Esse dado veio de planejamento ou de um evento real confirmado?
```

Se veio de planejamento:

- Pode afetar previsoes, planilha e estimativas.
- Nao deve virar historico real sem confirmacao.

Se veio de evento real confirmado:

- Deve virar `Transaction`.
- Pode recalcular fatura real, relatorios e fechamento.
- Nao deve sobrescrever estimativa manual sem permissao.

Essa separacao e o que mantem o Monex poderoso sem virar confuso.
