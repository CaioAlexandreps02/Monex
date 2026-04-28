# Monex

Aplicativo pessoal de organização financeira com foco em planejamento mensal simples, visão operacional em formato de planilha e fluxo local-first.

## Stack

- `Next.js 16`
- `React 19`
- `TypeScript`
- `Tailwind CSS 4`
- `Supabase` preparado para autenticação e banco

## Rodando localmente

No diretório do projeto:

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Variáveis de ambiente

Use o arquivo `.env.example` como base:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Estado atual do app

Hoje o Monex funciona em modo `local-first`:

- os dados da interface ficam persistidos em `localStorage`
- a navegação e os fluxos principais já estão organizados para uso real
- o schema do Supabase já foi preparado para a próxima etapa de persistência remota

Isso significa que, antes da integração com Supabase, os dados ainda ficam salvos apenas no navegador atual.

## Estrutura principal

- `src/components/finance-app.tsx`: núcleo da aplicação
- `src/components/finance-ui.tsx`: componentes visuais reutilizáveis
- `src/lib/mock-data.ts`: seed local
- `src/lib/finance.ts`: cálculos e agregações
- `src/types/finance.ts`: contratos de domínio
- `supabase/schema.sql`: schema inicial para o banco

## Preparação para Supabase

1. Crie um projeto no Supabase.
2. Abra o SQL Editor.
3. Rode o conteúdo de `supabase/schema.sql`.
4. Preencha as variáveis em `.env.local`.

Campos esperados:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Observação:

- o schema já cobre contas, cartões, transações, compras planejadas, valores fixos, configurações e planejamento mensal
- a UI ainda não consome Supabase diretamente; esta etapa prepara a base para a próxima integração

## Preparação para GitHub

1. Crie um repositório novo no GitHub.
2. Inicialize o git localmente, se ainda não estiver iniciado.
3. Faça o primeiro commit.
4. Adicione o remote e envie a branch principal.

Exemplo:

```bash
git init
git add .
git commit -m "Initial Monex app"
git branch -M main
git remote add origin <URL_DO_REPOSITORIO>
git push -u origin main
```

## Preparação para Vercel

1. Suba o projeto para o GitHub.
2. Importe o repositório na Vercel.
3. Configure as variáveis de ambiente do Supabase na Vercel.
4. Faça o deploy.

Checklist recomendado:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Próxima etapa recomendada

Depois do deploy inicial:

1. conectar autenticação com Supabase Auth
2. trocar o `localStorage` por leitura/escrita real no banco
3. proteger rotas privadas
4. sincronizar seeds locais com dados remotos do usuário
