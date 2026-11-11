# Linha "Mãe" em Dívidas e acordos — desenho

Data: 11/11/2026 · Status: aguardando revisão do Caio

## Objetivo

Hoje as compras e dívidas ligadas à mãe do Caio ficam espalhadas em três cartões (MP Mãe, Renner Mãe,
PicPay) e numa dívida avulsa ("Mae", R$ 78/mês). Isso causa erro de cadastro (cartão errado) e não
mostra quanto ele precisa mandar para ela em cada mês.

Queremos uma única linha **"Mãe"**, na seção **Dívidas e acordos** da Planilha, que:

- mostra o **total do mês a repassar para ela**;
- expande em **uma linha por item** (compra parcelada, dívida, empréstimo), com o nome do cartão dela
  escrito no título do item;
- entra nos **Gastos e no Saldo** como entra a fatura de um cartão, sem contar os itens em dobro.

## Decisões já tomadas com o Caio

1. Os cartões MP Mãe, Renner e PicPay são **substituídos** pela "Mãe". O nome do cartão vira texto no
   título do item, por exemplo "Tenis Asics (MP Mãe)".
2. A dívida "Mae" (R$ 1.000, parcelas de R$ 78) **entra dentro** da linha Mãe.
3. A linha aparece em **Dívidas e acordos**, não em Faturas nem em Cartões.
4. Sem tela nova. O modelo deve aceitar outras pessoas no futuro, mas **só a Mãe é criada agora**.

## Modelo de dados

A "Mãe" é um registro em `monex_cards` marcado como pessoa, sem coluna nova no banco (evita alterar a
estrutura direto no Supabase).

| Campo | Valor |
|---|---|
| `id` | `person-mae` |
| `name` | `Mãe` |
| `issuer` | `Pessoa` (é o marcador; `isPerson = issuer === "Pessoa"`) |
| `brand` | `Pessoa` |
| `last_digits` | vazio |
| `available_mode` | `credit` |
| `closing_day` / `due_day` | sem efeito (ver "Regras") |
| `credit_limit` | 0 |
| `is_active` | true |

- Compras parceladas: continuam sendo `monex_bills` + `monex_transactions` com `planned_card_id` /
  `card_id` = `person-mae` e `planned_card_mode`/`card_mode` = `credit`, gerados pela mesma função que
  gera as parcelas dos cartões (`buildLinkedTransactionsFromBill`).
- Dívidas: `monex_debts.planned_card_id = person-mae` identifica uma dívida da Mãe, qualquer que seja
  a forma de pagamento (hoje, pix).
- Valor real digitado: reutiliza `monex_card_bill_estimates` (id `person-mae:YYYY-MM`, `is_auto_estimate
  = false`). Apagar a linha volta para a soma automática.
- Tipo `Card` em `src/types/finance.ts` ganha o campo derivado opcional `isPerson`, calculado ao ler o
  banco (`mapCard` em `src/lib/monex-relational-state.ts`). Na gravação, `issuer` já guarda o marcador.

## Regras de cálculo

- **Mês de cada parcela**: o mês da data da própria parcela. Não existe fechamento, então não há o "+1
  mês" quando o dia passa do fechamento.
- **Total do mês da Mãe** = valor real digitado, se existir; senão a soma de:
  - as parcelas (`monex_transactions`) ligadas a `person-mae` naquele mês;
  - as parcelas das dívidas com `planned_card_id = person-mae` naquele mês.
- O total da linha entra nos Gastos e no Saldo. As linhas de dentro são informativas e **não somam**
  no total geral.
- A dívida "Mae" deixa de ser uma linha própria em Dívidas e acordos para não contar duas vezes.

## Planilha (src/components/finance-app.tsx)

- Em **Dívidas e acordos**: nova linha-grupo "Mãe", com um valor por mês e a mesma seta de expandir
  das linhas de fatura. Ao expandir, uma linha por item com o valor de cada mês.
- Cartões de pessoa são excluídos de:
  - as linhas de fatura automática da seção **Faturas** (`cardAutoRows`);
  - o menu e a tela **Cartões**;
  - seletores de cartão que checam limite, fechamento e vencimento.
- O comparativo mensal (Ganhos − Gastos = Saldo) usa o total da linha Mãe uma vez.

## Cadastro

- **Nova conta** (à vista ou parcelada) e **Novo compromisso**: a forma de pagamento "cartão" passa a
  listar "Pessoa: Mãe" além dos cartões. Escolhida, o sistema usa `person-mae` como cartão, sem
  verificar limite.
- O nome do cartão real dela fica no título do item, digitado pelo Caio.
- Dívida simples (pix): campo "Devo a", com a opção "Mãe", que grava `planned_card_id = person-mae`.

## Migração dos dados existentes

Feita por script, em produção, com backup antes (cópia JSON das tabelas afetadas no scratchpad) e só
depois da aprovação do Caio.

1. Criar o registro `person-mae`.
2. Para cada conta/parcela com cartão `card-mp-mae`, `card-renner` ou `card-picpay`: trocar o cartão
   para `person-mae` e acrescentar o nome do cartão antigo ao título, por exemplo `Tenis Asics (MP
   Mãe)`, `Renner Mãe` (já tem nome), `Roupas Anjus (PicPay)`.
3. Trocar `planned_card_id` da dívida "Mae" (R$ 78) para `person-mae`.
4. Apagar `monex_card_bill_estimates` desses três cartões e depois os três cartões.
5. Conferir: o total de novembro/2026 deve ser **R$ 176,10** (78 + 81,43 + 16,67).

O Caio deve fechar todas as abas do Monex durante a migração. Uma aba antiga que salva sobrescreve o
banco inteiro (o salvamento apaga e reinsere tudo).

## Casos de borda

- Mês sem nenhum item: a linha mostra 0 e fica apagada, como as outras linhas sem valor.
- Item pago antes: continua com status pago e aparece no mês dele.
- Valor real digitado diferente da soma: vale o digitado, e a soma dos itens continua visível dentro da
  linha expandida.
- Uma segunda pessoa no futuro: criar outro registro com `issuer = "Pessoa"`. Cada pessoa teria sua
  linha em Dívidas e acordos.

## Verificação

- `npx tsc --noEmit` sem erros.
- Conferir em produção: o total de novembro da Mãe (176,10) e que o total geral de Gastos não mudou
  além do esperado (a dívida de R$ 78 só muda de lugar).
- Conferir que os cartões MP Mãe, Renner e PicPay não aparecem mais e que a seção Faturas segue igual.

## Fora do escopo

- Tela própria de dívidas com pessoas.
- Controle de limite, fechamento e vencimento da Mãe.
- Criar outras pessoas agora.
- Migrar o layout para rotas separadas.

## Pontos a confirmar no código durante a implementação

- Nomes exatos das colunas de `monex_debts` (parcelas, primeiro vencimento), usadas para calcular o
  valor mensal de cada dívida da Mãe.
- Todos os lugares que listam cartões e precisam esconder ou tratar `isPerson`. A busca por
  `availableMode` e `cards.` em `finance-app.tsx` cobre a maioria.
