# Integração Pluggy — Open Finance no Monex

> Data: 03/08/2026
> Status: Planejamento
> Prioridade: Alta

---

## Sumário

| # | Seção |
|---|-------|
| 1 | O que é a Pluggy |
| 2 | Benefícios pro Monex |
| 3 | Limitações |
| 4 | Arquitetura da integração |
| 5 | Sistema de rate limit budget |
| 6 | Fluxo de sincronização |
| 7 | Mapeamento de bancos |
| 8 | Estrutura de dados |
| 9 | Fases de implementação |
| 10 | Checklist de validação |

---

## 1. O que é a Pluggy

A Pluggy é uma **instituição regulada pelo Banco Central** (ITP — Iniciadora de Transação de Pagamento) que oferece uma API pra acessar dados financeiros via Open Finance Brasil.

### Productos relevantes

| Produto | O que faz |
|---------|-----------|
| **Meu Pluggy** | App gratuito onde você conecta seus bancos |
| **Dashboard Pluggy** | Portal onde pega as credenciais da API |
| **Pluggy Data API** | REST API que retorna saldos, transações, investimentos |

### Como funciona

```
Seus bancos → Open Finance → Pluggy API → Monex
```

1. Você conecta seus bancos no Meu Pluggy (fluxo oficial BACEN)
2. Cria uma aplicação no Dashboard Pluggy (pega CLIENT_ID + CLIENT_SECRET)
3. O Monex chama a Pluggy API
4. A Pluggy retorna dados categorizados e estruturados

### Custo

| Item | Preço |
|------|-------|
| Meu Pluggy | Gratuito |
| Acesso API (uso pessoal) | Gratuito |
| Sincronização | Gratuita |
| Dashboard | Gratuito |
| **Total** | **R$ 0,00 sem prazo de expiração** |

### Segurança

- Regulada pelo Banco Central (licença ITP)
- Autenticação via OAuth 2.0
- Read-only (não pode movimentar dinheiro)
- Consentimento do Open Finance (você autoriza e pode revogar a qualquer momento)
- Dados trafegam criptografados

---

## 2. Benefícios pro Monex

### 2.1 Importação automática de transações

**Antes (atual):**
- Usuário baixa CSV/OFX do banco
- Faz upload no Monex
- Monex parseia e categoriza

**Depois (com Pluggy):**
- Monex puxa transações automaticamente da API
- Categorização automática pela Pluggy
- Sem upload manual

### 2.2 Saldos em tempo real

- Saldos de todas as contas num dashboard
- Atualização sem automática
- Comparativo mês a mês

### 2.3 Investimentos

- Valor atual de cada investimento
- Rendimento mensal
- Histórico de aplicações e resgates

### 2.4 Cartões de crédito

- Limite disponível
- Fatura atual
- Transações do cartão

### 2.5 Categorização automática

A Pluggy categoriza transações em:

| Categoria | Exemplo |
|-----------|---------|
| Alimentação | iFood, supermercado |
| Transporte | Uber, gasolina |
| Moradia | Aluguel, luz, água |
| Lazer | Netflix, Spotify |
| Saúde | Farmácia, consulta |
| Educação | Curso, faculdade |
| Transferências | Pix, TED |
| Assinaturas | Apps, serviços |

**Pra Monex:** a categorização da Pluggy pode ser usada como sugestão, e o usuário pode sobrescrever.

---

## 3. Limitações

### 3.1 Read-only

| Pode fazer | Não pode fazer |
|------------|---------------|
| Ler saldos | Fazer Pix |
| Ler extratos | Transferir dinheiro |
| Ler investimentos | Pagar boletos |
| Ler cartões | Alterar cadastro |

**Impacto no Monex:** nenhum — o Monex é gestão, não movimentação.

### 3.2 Rate limits do Open Finance

São limites **por combinação** de CPF + banco + produto:

| Produto | Limite/mês | Descrição |
|---------|-----------|-----------|
| Saldo da conta | 420 | Cada sync consome 1 |
| Transações recentes (1-6 dias) | 240 | Cada sync consome 1 |
| Transações antigas (7-365 dias) | 4 | Só criação + 1x/semana |
| Fatura do cartão | 240 | Cada sync consome 1 |
| Investimentos | 120 | Cada sync consome 1 |

**Importante:** cada banco tem seu próprio baldão. 6 bancos = 6 baldões independentes.

### 3.3 Consentimento expira em 12 meses

- Precisa reautorizar uma vez por ano
- Pluggy avisa quando tá perto de vencer
- Se não renovar, dados param de atualizar

### 3.4 Sync pode ter delay

- Transações podem aparecer com 1-2 dias de atraso
- Investimentos podem ter até 3 dias
- Não é 100% tempo real

### 3.5 Só seus dados (1 CPF)

- Não pode conectar contas de outras pessoas
- Servir outros = plano comercial (R$ 2.500+/mês)

---

## 4. Arquitetura da integração

### Visão geral

```
┌─────────────────────────────────────────────────────────┐
│                      MONEX                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Cache Local (SQLite)               │   │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────────┐  │   │
│  │  │ Saldos   │ │ Transações│ │ Investimentos  │  │   │
│  │  └──────────┘ └──────────┘ └────────────────┘  │   │
│  │  ┌──────────────────────────────────────────┐  │   │
│  │  │ Rate Limit Budget (controle interno)     │  │   │
│  │  └──────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│  ┌──────────────────────▼──────────────────────────┐   │
│  │              Sync Engine                        │   │
│  │  ┌────────────────┐  ┌────────────────────────┐ │   │
│  │  │ Auto Sync      │  │ Manual Sync            │ │   │
│  │  │ (1x/semana)    │  │ (sob demanda)          │ │   │
│  │  │ Budget próprio │  │ Budget próprio          │ │   │
│  │  └────────────────┘  └────────────────────────┘ │   │
│  └──────────────────────┬──────────────────────────┘   │
│                         │                               │
└─────────────────────────┼───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                 PLUGGY API                              │
├─────────────────────────────────────────────────────────┤
│  GET /accounts          → contas e saldos               │
│  GET /accounts/{id}/transactions → extratos             │
│  GET /credit-cards      → cartões de crédito            │
│  GET /investments       → investimentos                 │
│  GET /identity          → dados pessoais                │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              OPEN FINANCE (BACEN)                       │
├─────────────────────────────────────────────────────────┤
│  Nubank · Inter · Itaú · Bradesco · BB · XP · etc     │
└─────────────────────────────────────────────────────────┘
```

### Componentes

| Componente | Responsabilidade |
|------------|-----------------|
| **Cache Local** | Armazena dados pra leitura instantânea |
| **Rate Limit Budget** | Controla quantos requests cada tipo de sync pode fazer |
| **Auto Sync** | Roda 1x/semana, usa budget próprio |
| **Manual Sync** | Disparado pelo usuário, usa budget próprio |
| **Sync Engine** | Coordena tudo, decide quando puxar o quê |
| **Pluggy API** | Interface com os dados financeiros |

---

## 5. Sistema de rate limit budget

### O problema

Se o sync automático (1x/semana) e o manual compartilharem o mesmo "baldão" de requests, um sync manual pode consumir o budget do automático e vice-versa.

### A solução: budgets separados

```
┌─────────────────────────────────────────────────────┐
│              RATE LIMIT: 420 requests/mês           │
│              (saldo da conta, por banco)            │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌───────────────────────┐  ┌───────────────────┐  │
│  │ AUTO SYNC BUDGET      │  │ MANUAL SYNC       │  │
│  │ 300 requests/mês      │  │ BUDGET            │  │
│  │ (71% do total)        │  │ 120 requests/mês  │  │
│  │                       │  │ (29% do total)    │  │
│  │ 4 syncs/mês × 6      │  │                   │  │
│  │ bancos = 24 requests  │  │ Até 20 syncs      │  │
│  │ (sobra 276)           │  │ manuais/mês       │  │
│  └───────────────────────┘  └───────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Estrutura do budget

```typescript
type SyncBudget = {
  // Limites por tipo de sync
  autoSync: {
    maxRequestsPerMonth: number;    // 300
    usedThisMonth: number;          // counter
    lastResetAt: string;            // ISO date
  };
  manualSync: {
    maxRequestsPerMonth: number;    // 120
    usedThisMonth: number;          // counter
    lastResetAt: string;            // ISO date
  };
  
  // Limites por produto
  products: {
    balance: { limit: 420; auto: 300; manual: 120 };
    transactionsRecent: { limit: 240; auto: 180; manual: 60 };
    transactionsOld: { limit: 4; auto: 2; manual: 2 };
    investments: { limit: 120; auto: 90; manual: 30 };
    creditCard: { limit: 240; auto: 180; manual: 60 };
  };
};
```

### Regras do budget

1. **Auto sync só roda se tiver budget disponível**
   - Se já gastou 300 requests no mês, para
   - Avisa o usuário: "Sync automático pausado por limite mensal"

2. **Manual sync só roda se tiver budget disponível**
   - Se já gastou 120 requests no mês, avisa
   - Usuário pode escolher: "Sync limitado — só saldos" ou "Esperar próximo mês"

3. **Budget reseta no dia 1 de cada mês**

4. **Se um tipo de sync estourar, o outro continua**
   - Auto estourou → manual ainda funciona
   - Manual estourou → auto ainda funciona
   - Cada um é independente

### Priorização dentro do budget

Quando o budget tá baixo, o sync prioriza:

```
1. Saldos (sempre — é o mais barato e útil)
2. Transações recentes (últimos 6 dias)
3. Investimentos
4. Transações antigas (só se sobrar budget)
```

---

## 6. Fluxo de sincronização

### 6.1 Sync automático (1x/semana)

```
Domingo à meia-noite (ou primeiro acesso da semana)
    │
    ├── 1. Verifica budget auto sync
    │   └── Se esgotou → para e avisa
    │
    ├── 2. Pra cada banco conectado:
    │   ├── Puxa saldos (1 request/banco)
    │   ├── Puxa transações desde último sync (1 request/banco)
    │   ├── Puxa investimentos se tiver (1 request/banco)
    │   └── Salva no cache local
    │
    ├── 3. Atualiza timestamp do último sync
    │
    └── 4. Notifica UI que dados foram atualizados
```

**Custo estimado:**
```
6 bancos × 3 requests = 18 requests/semana
18 × 4 semanas = 72 requests/mês
Budget auto: 300 → usando 24% ✅
```

### 6.2 Sync manual (sob demanda)

```
Usuário clica "Atualizar dados"
    │
    ├── 1. Verifica budget manual sync
    │   └── Se esgotou → avisa e sugere esperar
    │
    ├── 2. Pergunta ao usuário o quê atualizar:
    │   ├── [x] Saldos
    │   ├── [x] Transações
    │   ├── [ ] Investimentos
    │   └── (seleção)
    │
    ├── 3. Pra cada item selecionado:
    │   ├── Verifica se tem budget pra esse produto
    │   ├── Se sim → puxa dados
    │   ├── Se não → pula e avisa
    │   └── Salva no cache local
    │
    └── 4. Mostra resumo: "Dados atualizados. X requests restantes no mês."
```

**Custo estimado:**
```
2 syncs manuais/mês × 6 bancos × 2 requests = 24 requests
Budget manual: 120 → usando 20% ✅
```

### 6.3 Sync sob demanda (transações antigas)

```
Usuário precisa ver transação de 2 meses atrás
    │
    ├── 1. Verifica se já tem no cache
    │   └── Se sim → retorna do cache
    │
    ├── 2. Se não tem:
    │   ├── Verifica budget de transações antigas (4/mês)
    │   ├── Se tem budget → puxa da API
    │   ├── Se não tem → "Transações antigas indisponíveis até próximo mês"
    │   └── Salva no cache
    │
    └── 3. Retorna dados
```

---

## 7. Mapeamento de bancos

### Bancos do Caio (exemplo)

| # | Banco | Tipo | O que puxar | Produtos |
|---|-------|------|-------------|----------|
| 1 | Nubank | Débito + Crédito | Conta + Cartão | balance, transactions, creditCard |
| 2 | Inter | Débito + Pix + Investimentos | Conta + Investimentos | balance, transactions, investments |
| 3 | Bradesco | Débito | Conta | balance, transactions |
| 4 | Itaú | Crédito | Cartão | creditCard |
| 5 | XP | Investimentos | Investimentos | investments |
| 6 | BB | Débito + Crédito + Poupança | Conta + Cartão + Poupança | balance, transactions, creditCard |

### Configuração por banco

```typescript
const bankConfigs = [
  {
    id: "nubank",
    name: "Nubank",
    itemId: "item_xxx",  // ID da conexão na Pluggy
    products: ["balance", "transactions", "creditCard"],
    hasInvestments: false,
  },
  {
    id: "inter",
    name: "Inter",
    itemId: "item_yyy",
    products: ["balance", "transactions", "investments"],
    hasInvestments: true,
  },
  {
    id: "bradesco",
    name: "Bradesco",
    itemId: "item_zzz",
    products: ["balance", "transactions"],
    hasInvestments: false,
  },
  {
    id: "itau",
    name: "Itaú",
    itemId: "item_aaa",
    products: ["creditCard"],
    hasInvestments: false,
  },
  {
    id: "xp",
    name: "XP",
    itemId: "item_bbb",
    products: ["investments"],
    hasInvestments: true,
  },
  {
    id: "bb",
    name: "Banco do Brasil",
    itemId: "item_ccc",
    products: ["balance", "transactions", "creditCard"],
    hasInvestments: false,
  },
];
```

### Requests por sync completo

```
Banco         Saldo  Transações  Investimentos  Total
─────────────────────────────────────────────────────
Nubank         1        1            0           2
Inter          1        1            1           3
Bradesco       1        1            0           2
Itaú           0        0            0           0 (só cartão)
XP             0        0            1           1
BB             1        1            0           2
─────────────────────────────────────────────────────
Total por sync:                          10 requests
Total mês (4 syncs):                     40 requests
```

---

## 8. Estrutura de dados

### Cache local (SQLite)

```sql
-- Conexões com bancos
CREATE TABLE pluggy_items (
  id TEXT PRIMARY KEY,           -- item ID da Pluggy
  bank_id TEXT NOT NULL,         -- ex: "nubank"
  bank_name TEXT NOT NULL,
  status TEXT NOT NULL,          -- "synced", "pending", "error"
  last_synced_at TEXT,
  consent_expires_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Contas bancárias
CREATE TABLE pluggy_accounts (
  id TEXT PRIMARY KEY,           -- account ID da Pluggy
  item_id TEXT NOT NULL,
  type TEXT NOT NULL,            -- "BANK" ou "CREDIT"
  subtype TEXT NOT NULL,         -- "CHECKING_ACCOUNT", "SAVINGS_ACCOUNT", "CREDIT_CARD"
  name TEXT NOT NULL,
  balance REAL,
  currency_code TEXT DEFAULT 'BRL',
  last_updated_at TEXT,
  FOREIGN KEY (item_id) REFERENCES pluggy_items(id)
);

-- Transações
CREATE TABLE pluggy_transactions (
  id TEXT PRIMARY KEY,           -- transaction ID da Pluggy
  account_id TEXT NOT NULL,
  type TEXT NOT NULL,            -- "DEBIT" ou "CREDIT"
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  description TEXT,
  category TEXT,
  merchant_name TEXT,
  status TEXT DEFAULT 'POSTED',  -- "PENDING" ou "POSTED"
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES pluggy_accounts(id)
);

-- Investimentos
CREATE TABLE pluggy_investments (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  amount REAL,
  balance REAL,
  annual_rate REAL,
  due_date TEXT,
  last_updated_at TEXT,
  FOREIGN KEY (item_id) REFERENCES pluggy_items(id)
);

-- Rate limit budget
CREATE TABLE pluggy_budget (
  id TEXT PRIMARY KEY,           -- "auto" ou "manual"
  max_requests_per_month INTEGER NOT NULL,
  used_this_month INTEGER DEFAULT 0,
  last_reset_at TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Histórico de syncs
CREATE TABLE pluggy_sync_log (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  sync_type TEXT NOT NULL,       -- "auto" ou "manual"
  products_synced TEXT NOT NULL, -- JSON array
  requests_used INTEGER NOT NULL,
  status TEXT NOT NULL,          -- "success", "partial", "error"
  error_message TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  FOREIGN KEY (item_id) REFERENCES pluggy_items(id)
);
```

### Mapeamento Pluggy → Monex

| Pluggy | Monex |
|--------|-------|
| Account (BANK) | Account |
| Account (CREDIT) | Card |
| Transaction | Transaction (status: "received" ou "paid") |
| Investment | Investment |
| Category | Category (sugestão) |

---

## 9. Fases de implementação

### Fase 1: Setup inicial (1-2 dias)

**Objetivo:** Configurar Pluggy e criar tabelas no SQLite

- [ ] Criar conta em meu.pluggy.ai
- [ ] Conectar bancos no Meu Pluggy
- [ ] Criar aplicação em dashboard.pluggy.ai
- [ ] Pegar CLIENT_ID e CLIENT_SECRET
- [ ] Instalar `pluggy-sdk`: `npm install pluggy-sdk`
- [ ] Criar tabelas SQLite (pluggy_items, pluggy_accounts, etc.)
- [ ] Criar variáveis de ambiente: `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`

**Arquivos:**
- `src/lib/pluggy/config.ts` — credenciais e config
- `src/lib/pluggy/client.ts` — instância do SDK
- `src/lib/pluggy/schema.ts` — schema do SQLite

### Fase 2: Cache local (2-3 dias)

**Objetivo:** Criar camada de cache com SQLite

- [ ] Criar funções de CRUD pra cada tabela
- [ ] Implementar `getCachedAccounts()`, `getCachedTransactions()`, etc.
- [ ] Implementar `saveAccounts()`, `saveTransactions()`, etc.
- [ ] Implementar `getLastSyncAt()`, `updateLastSyncAt()`
- [ ] Testar leitura/escrita

**Arquivos:**
- `src/lib/pluggy/cache.ts` — funções de cache

### Fase 3: Rate limit budget (1-2 dias)

**Objetivo:** Sistema de controle de requests

- [ ] Criar tabela `pluggy_budget`
- [ ] Implementar `checkBudget(type)` — verifica se tem budget
- [ ] Implementar `consumeBudget(type, count)` — consome budget
- [ ] Implementar `resetBudget()` — reseta no dia 1
- [ ] Implementar `getBudgetStatus()` — retorna status pro UI

**Arquivos:**
- `src/lib/pluggy/budget.ts` — lógica de budget

### Fase 4: Sync engine (3-4 dias)

**Objetivo:** Motor de sincronização com Pluggy

- [ ] Implementar `syncAccounts(itemId)` — puxa contas e saldos
- [ ] Implementar `syncTransactions(itemId, from)` — puxa transações
- [ ] Implementar `syncInvestments(itemId)` — puxa investimentos
- [ ] Implementar `syncAll(type)` — sincroniza tudo
- [ ] Implementar `autoSync()` — sync automático semanal
- [ ] Implementar `manualSync(products)` — sync manual sob demanda
- [ ] Integrar com budget (verificar antes de cada request)

**Arquivos:**
- `src/lib/pluggy/sync.ts` — motor de sync

### Fase 5: UI de configuração (2-3 dias)

**Objetivo:** Tela pra gerenciar conexões

- [ ] Tela "Conexões bancárias" nas configurações
- [ ] Lista de bancos conectados com status
- [ ] Botão "Conectar novo banco"
- [ ] Botão "Desconectar banco"
- [ ] Indicador de último sync
- [ ] Indicador de budget restante
- [ ] Botão "Atualizar agora"

**Arquivos:**
- `src/components/pluggy-settings.tsx` — tela de config

### Fase 6: Importação automática (3-4 dias)

**Objetivo:** Puxar transações e sugerir categorias

- [ ] Importar transações da Pluggy como `ImportedStatementItem`
- [ ] Mapear categorias Pluggy → categorias Monex
- [ ] Deduplicar transações (Pluggy ID como chave)
- [ ] Sugerir categorias baseado na Pluggy
- [ ] Interface de review (usuário confirma/ignora)

**Arquivos:**
- `src/lib/pluggy/import.ts` — lógica de importação
- `src/components/pluggy-import-review.tsx` — tela de review

### Fase 7: Dashboard de saldos (2-3 dias)

**Objetivo:** Visão consolidada dos saldos

- [ ] Card com saldo total de todas as contas
- [ ] Lista de contas com saldo individual
- [ ] Gráfico de evolução do patrimônio
- [ ] Comparativo mês a mês

**Arquivos:**
- `src/components/pluggy-dashboard.tsx` — dashboard

### Fase 8: Investimentos (2-3 dias)

**Objetivo:** Rastrear investimentos

- [ ] Lista de investimentos com valor atual
- [ ] Rendimento mensal
- [ ] Histórico de aplicações/resgates
- [ ] Integrar com tela de investimentos existente

**Arquivos:**
- `src/lib/pluggy/investments.ts` — lógica de investimentos

---

## 10. Checklist de validação

### Configuração
- [ ] Conta criada em meu.pluggy.ai
- [ ] 6 bancos conectados
- [ ] Aplicação criada em dashboard.pluggy.ai
- [ ] CLIENT_ID e CLIENT_SECRET configurados
- [ ] SDK instalado e funcionando

### Cache
- [ ] Tabelas SQLite criadas
- [ ] Leitura/escrita funcionando
- [ ] Cache persiste entre reinícios

### Budget
- [ ] Budget auto sync configurado (300/mês)
- [ ] Budget manual sync configurado (120/mês)
- [ ] Reset automático no dia 1
- [ ] Avisos quando budget tá baixo

### Sync
- [ ] Auto sync roda 1x/semana
- [ ] Manual sync funciona sob demanda
- [ ] Transações antigas sob demanda
- [ ] Deduplicação funciona (não duplica transações)
- [ ] Erros são tratados e logados

### UI
- [ ] Tela de configuração mostra bancos conectados
- [ ] Indicador de último sync funciona
- [ ] Indicador de budget restante funciona
- [ ] Botão "Atualizar agora" funciona
- [ ] Dashboard mostra saldos corretos

### Integração
- [ ] Transações Pluggy viram transactions Monex
- [ ] Contas Pluggy viram accounts Monex
- [ ] Cartões Pluggy viram cards Monex
- [ ] Investimentos Pluggy viram investments Monex
- [ ] Categorização é sugerida corretamente

---

## Referências

| Recurso | URL |
|---------|-----|
| Meu Pluggy | [meu.pluggy.ai](https://meu.pluggy.ai) |
| Dashboard | [dashboard.pluggy.ai](https://dashboard.pluggy.ai) |
| Documentação API | [docs.pluggy.ai](https://docs.pluggy.ai) |
| SDK Node.js | [github.com/pluggyai/pluggy-node](https://github.com/pluggyai/pluggy-node) |
| Quickstart Next.js | [github.com/pluggyai/quickstart](https://github.com/pluggyai/quickstart) |
| Exemplo pessoal | [github.com/pluggyai/my-expenses](https://github.com/pluggyai/my-expenses) |
| Discord | [discord.gg/EanrwJADby](https://discord.gg/EanrwJADby) |
