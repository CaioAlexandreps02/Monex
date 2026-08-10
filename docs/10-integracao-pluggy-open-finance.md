# Integração Pluggy — Open Finance no Monex

> Data: 05/08/2026
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
| 11 | Como adicionar novos bancos (extensibilidade) |

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
│  Nubank · Inter · Mercado Pago · C6 · Shopee · etc    │
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
5 bancos × 3 requests = 15 requests/semana
15 × 4 semanas = 60 requests/mês
Budget auto: 300 → usando 20% ✅
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
2 syncs manuais/mês × 5 bancos × 2 requests = 20 requests
Budget manual: 120 → usando 17% ✅
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

### Bancos conectados (fase atual)

| # | Banco | Conector Pluggy | Tipo | Sync | Produtos |
|---|-------|-----------------|------|------|----------|
| 1 | Nubank | `[OF] Nubank` (id ~610) | Débito + Crédito | Semanal | ACCOUNTS, TRANSACTIONS, CREDIT_CARDS |
| 2 | Inter | `[OF] Inter` (id ~602) | Débito + Crédito | Semanal | ACCOUNTS, TRANSACTIONS, CREDIT_CARDS, INVESTMENTS |
| 3 | Mercado Pago | `[OF] Mercado Pago` (id ~606) | Débito + Pix | Mensal | ACCOUNTS, TRANSACTIONS |
| 4 | C6 Bank | `[OF] C6 Bank` (id ~630) | Débito + Pix | Mensal | ACCOUNTS, TRANSACTIONS |
| 5 | Shopee | `[OF] Shopee` (id ~640) | Parcelamento interno | Mensal | ACCOUNTS, TRANSACTIONS |

> **Nota sobre Shopee:** conector adicionado no changelog de julho/2025. Pode ter cobertura limitada. Testar antes de confiar.

### Bancos NÃO suportados

| Banco/Marca | Motivo |
|-------------|--------|
| VR Benefícios | Empresa de voucher/benefício — não é instituição financeira regulada. Classificação "Payment Processor" no Pluggy. Open Finance não suporta esse tipo. |
| Alelo | Mesmo motivo que VR. Empresa de vale-alimentação/refeição. |
| Pluxee (antiga Sodexo) | Mesmo motivo. Empresa de voucher. |
| Ticket (Edenred) | Mesmo motivo. Empresa de voucher. |
| Aliexpress | Marketplace chinês — não tem presença financeira no Brasil nem instituição regulada pelo BACEN. |

> **Alternativa para VR/Alelo:** se no futuro o Pluggy lançar conectores diretos para essas empresas de benefício, basta adicionar na lista abaixo. A arquitetura já suporta.

### Configuração por banco

```typescript
type BankConfig = {
  id: string;                    // ID interno do Monex
  connectorId: number;           // ID do conector no Pluggy
  name: string;                  // Nome exibido ao usuário
  nickname?: string;             // Apelido (ex: "Nubank")
  syncFrequency: "weekly" | "monthly";
  products: string[];            // Produtos que o conector expõe
  user?: "personal" | "business";
};

const BANK_CONFIGS: BankConfig[] = [
  {
    id: "nubank",
    connectorId: 610,            // ID do conector Open Finance da Nubank
    name: "Nubank",
    nickname: "Nubank",
    syncFrequency: "weekly",
    products: ["ACCOUNTS", "TRANSACTIONS", "CREDIT_CARDS"],
    user: "personal",
  },
  {
    id: "inter",
    connectorId: 602,
    name: "Inter",
    nickname: "Inter",
    syncFrequency: "weekly",
    products: ["ACCOUNTS", "TRANSACTIONS", "CREDIT_CARDS", "INVESTMENTS"],
    user: "personal",
  },
  {
    id: "mercadopago",
    connectorId: 606,
    name: "Mercado Pago",
    nickname: "Mercado Pago",
    syncFrequency: "monthly",
    products: ["ACCOUNTS", "TRANSACTIONS"],
    user: "personal",
  },
  {
    id: "c6",
    connectorId: 630,
    name: "C6 Bank",
    nickname: "C6",
    syncFrequency: "monthly",
    products: ["ACCOUNTS", "TRANSACTIONS"],
    user: "personal",
  },
  {
    id: "shopee",
    connectorId: 640,
    name: "Shopee",
    nickname: "Shopee",
    syncFrequency: "monthly",
    products: ["ACCOUNTS", "TRANSACTIONS"],
    user: "personal",
  },
];
```

### Requests por sync completo

```
Banco           Saldo  Transações  Cartão  Invest.  Total
──────────────────────────────────────────────────────────
Nubank            1        1         1       0        3
Inter             1        1         1       1        4
Mercado Pago      1        1         0       0        2
C6 Bank           1        1         0       0        2
Shopee            1        1         0       0        2
──────────────────────────────────────────────────────────
Total por sync:                               13 requests
Total mês - auto (4 syncs):                   52 requests
Total mês - manual (estimado):                ~20 requests
Total mês:                                   ~72 requests
Budget disponível:                           420 requests ✅
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
- [ ] 5 bancos conectados (Nubank, Inter, Mercado Pago, C6, Shopee)
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

## 11. Como adicionar novos bancos (extensibilidade)

A arquitetura do Monex com Pluggy é **genérica por design** — o sync engine não depende de qual banco é. Adicionar um banco novo é basicamente **configuração, não código**.

### Passo a passo

#### 1. Descobrir se o banco existe no Pluggy

```typescript
// Consultar a API
const connectors = await pluggy.fetchConnectors({ isOpenFinance: true });

// Filtrar pelo nome
const banco = connectors.results.find(c =>
  c.name.toLowerCase().includes("nome do banco")
);

if (banco) {
  console.log(`ID: ${banco.id}`);
  console.log(`Produtos: ${banco.products}`);
  console.log(`Contexto: ${banco.personal ? "Personal" : "Business"}`);
}
```

Ou consultar a tabela de cobertura: [docs.pluggy.ai/docs/open-finance-institutions-coverage](https://docs.pluggy.ai/docs/open-finance-institutions-coverage)

#### 2. Verificar quais produtos o conector expõe

Nem todo banco tem tudo. Verificar antes:

| Produto | O que significa |
|---------|----------------|
| `ACCOUNTS` | Contas bancárias (corrente, poupança) |
| `TRANSACTIONS` | Extratos/transações |
| `CREDIT_CARDS` | Cartões de crédito |
| `INVESTMENTS` | Investimentos |
| `LOANS` | Empréstimos/financiamentos |

Se o banco não tem `CREDIT_CARDS`, não adicione esse produto na config.

#### 3. Adicionar o objeto na lista `BANK_CONFIGS`

```typescript
{
  id: "nome-banco",              // ID kebab-case sem acentos
  connectorId: 6XX,              // ID do conector (descoberto no passo 1)
  name: "Nome do Banco",         // Nome completo
  nickname: "Apelido",           // Nome curto pro usuário
  syncFrequency: "monthly",      // "weekly" ou "monthly"
  products: ["ACCOUNTS", "TRANSACTIONS"],  // O que o conector expõe
  user: "personal",              // "personal" ou "business"
}
```

#### 4. Atualizar o orçamento (se necessário)

Se o novo banco many requests, recalcular:

```
Budget auto = 300 requests/mês
Budget manual = 120 requests/mês

Novo banco consome ~4 requests/sync
4 syncs/mês × 4 = 16 requests/mês a mais

Ainda cabe no budget? → Adiciona
Não cabe? → Aumenta o budget ou reduz a frequência
```

#### 5. Testar

1. Conectar o banco no Meu Pluggy
2. Rodar sync manual no Monex
3. Verificar se dados aparecem corretamente
4. Verificar se budget não estourou

### Exemplo: adicionando BTG Pactual

```typescript
// 1. Consultar API
const btg = connectors.find(c => c.name.includes("BTG"));
// → { id: 604, name: "BTGPactual", products: ["ACCOUNTS", "TRANSACTIONS", "INVESTMENTS"] }

// 2. Adicionar na config
{
  id: "btg",
  connectorId: 604,
  name: "BTGPactual",
  nickname: "BTG",
  syncFrequency: "weekly",
  products: ["ACCOUNTS", "TRANSACTIONS", "INVESTMENTS"],
  user: "personal",
}

// 3. Pronto — o sync engine já puxa os dados automaticamente
```

### O que NÃO precisa mudar ao adicionar banco

- ❌ Sync engine (genérica)
- ❌ Cache local (SQLite genérico)
- ❌ Budget system (independente por banco)
- ❌ UI de configuração (lista dinâmica)
- ❌ Importação de transações (genérica)

### O que pode precisar mudar

- ⚠️ Mapeamento de categorias (se o banco usa categorias diferentes)
- ⚠️ Formato de investimentos (cada banco expõe de um jeito)
- ⚠️ Lógica de deduplicação ( IDs diferentes por banco)

---

## Status implementado no Monex

Data de atualizacao: 10/08/2026

### Ja feito

- [x] Endpoint server-side para criar Connect Token: `src/app/api/connect-token/route.ts`
- [x] Widget `react-pluggy-connect` integrado na area `Importar > Origens automaticas > Open Finance`
- [x] Callback de sucesso salvando a origem Open Finance como ativa e registrando o `itemId`
- [x] Endpoint de webhook publico preparado: `src/app/api/webhooks/pluggy/route.ts`
- [x] Variaveis de ambiente documentadas em `.env.example`

### Como configurar o webhook na Pluggy

Na tela "Configurar Webhooks", usar a URL publica do deploy:

```text
https://seu-dominio.com/api/webhooks/pluggy
```

Em desenvolvimento local, `localhost` nao serve para essa tela. Para testar antes do deploy, usar um tunel HTTPS temporario, como `ngrok` ou o dominio temporario de preview da Vercel.

### O que o webhook faz hoje

- Recebe eventos da Pluggy em `POST /api/webhooks/pluggy`
- Responde `2xx` com `{ received: true }`
- Registra evento, `eventId` e `itemId` no log do servidor
- Se o Supabase estiver configurado, atualiza a configuracao `open-finance` em `app_state`
- Em `item/created` e `item/updated`, marca Open Finance como ativo
- Em `item/error`, marca como precisando de autorizacao

### Proxima etapa

- Buscar contas, saldos, cartoes e transacoes da Pluggy usando o `itemId`
- Transformar transacoes da Pluggy em `ImportedStatementItem`
- Reusar a revisao/importacao atual para categorizar, deduplicar e confirmar gastos
- Criar sync manual "Atualizar agora"
- Depois criar sync automatico com budget/rate limit

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
