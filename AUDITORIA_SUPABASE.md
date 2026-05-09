# Auditoria Completa — Usos do Supabase no Projeto

> Última atualização: 2026-05-05  
> **LEGENDA**: ✅ Migrado | ⚠️ Pendente | 🔵 OK (apenas auth, não mudar)

---

## APIs de Rota (`src/app/api/`) — Status

| Arquivo | Situação | Tipo de uso |
|---|---|---|
| `api/admin/create-gestor/route.ts` | ✅ Migrado | Auth Admin API + sql |
| `api/admin/delete-user/route.ts` | ✅ Migrado | Auth Admin API + sql |
| `api/admin/reset-password/route.ts` | ✅ Migrado | Auth Admin API + sql |
| `api/admin/update-user/route.ts` | ✅ Migrado | Auth Admin API + sql |
| `api/auth/auto-confirm/route.ts` | ✅ Migrado | Auth Admin API + sql |
| `api/auth/profile/route.ts` | ✅ Criado (novo) | sql direto |
| `api/auth/login-reset/route.ts` | 🔵 OK | Auth Admin API apenas |
| `api/resultados/upload/route.ts` | ✅ Migrado | sql direto |
| `api/resultados/delete/route.ts` | ✅ Migrado | sql direto |
| `api/resultados/download/route.ts` | 🔵 OK | auth.getUser() apenas |
| `api/push/subscribe/route.ts` | ✅ Migrado | auth.getUser() + sql |
| `api/push/unsubscribe/route.ts` | ✅ Migrado | auth.getUser() + sql |
| `api/push/send/route.ts` | 🔵 OK | auth.getUser() apenas |

---

## Dashboard Pages — Status e Estratégia

> **CONTEXTO CRÍTICO**: Todas as páginas do dashboard são **`'use client'`** 
> (Client Components com `useEffect`). Elas usam o cliente browser (`createClient()`)
> para fazer queries — isso passa pelo PostgREST do Supabase.
>
> **ESTRATÉGIA ADOTADA**: Criar **rotas de API** dedicadas para cada conjunto de dados
> e migrar os Client Components para usar `fetch('/api/...')` em vez de `.from()` direto.
>
> Esta é a abordagem correta para Next.js App Router: o banco não deve ser acessado
> diretamente pelo browser — apenas por Server Components ou Route Handlers.

### Análise por arquivo

| Arquivo | Status | Queries de dados identificadas |
|---|---|---|
| `dashboard/layout.tsx` | 🔵 OK | Sem queries (apenas layout) |
| `dashboard/page.tsx` | 🔵 OK | Sem queries diretas de dados |
| `dashboard/perfil/page.tsx` | ⚠️ Pendente | `profiles`, `supabase.auth.updateUser`, `supabase.auth.signInWithPassword` |
| `dashboard/acao/[numero]/page.tsx` | ⚠️ Pendente | `profiles`, `acoes_estrategicas`, `destaques_estrategicos`, `panoramico_linhas`, `fichas`, `fundamentacoes`, `configuracoes`, `observacoes` |
| `dashboard/projetos/page.tsx` | ⚠️ Pendente | `profiles`, `configuracoes`, `objetivos_estrategicos`, `acoes_estrategicas`, `setores`, `projetos` (com deep joins), `solicitacoes_alteracao`, `mensagens_projeto`, `mensagem_leituras`, `mensagem_destinatarios` |
| `dashboard/projetos/novo/page.tsx` | ⚠️ Pendente | `profiles`, `setores`, `acoes_estrategicas`, `configuracoes`, INSERT em `projetos`, `entregas`, `atividades`, `audit_log`, `alertas` |
| `dashboard/projetos/[id]/page.tsx` | ⚠️ Pendente | Todas as tabelas + mutations |
| `dashboard/calendario/page.tsx` | ⚠️ Pendente | `profiles`, `objetivos_estrategicos`, `acoes_estrategicas`, `setores`, `projetos`, `configuracoes`, `solicitacoes_alteracao` + mutations |
| `dashboard/painel-gantt/page.tsx` | ⚠️ Pendente | `profiles`, `setores`, `projetos` (deep join) |
| `dashboard/relatorios/page.tsx` | ⚠️ Pendente | `objetivos_estrategicos`, `acoes_estrategicas`, `setores`, `profiles`, `projetos` |

---

## Rotas de API a Criar (para substituir queries diretas do dashboard)

Cada página será migrada para `fetch('/api/dados/...')` em vez de Supabase direto:

| Nova Rota | Dados servidos | Usado em |
|---|---|---|
| `GET /api/dados/contexto` | profile + configuracoes + setores | todas as páginas |
| `GET /api/dados/projetos` | projetos com joins completos + solicitações | `projetos/page.tsx`, `projetos/page.tsx` |
| `GET /api/dados/projeto/[id]` | projeto completo com entregas/atividades | `projetos/[id]/page.tsx` |
| `POST /api/dados/projeto` | INSERT projeto + entregas + atividades | `projetos/novo/page.tsx` |
| `GET /api/dados/acao/[numero]` | ação estratégica completa (destaques, fichas, etc.) | `acao/[numero]/page.tsx` |
| `GET /api/dados/calendario` | projetos + entregas + atividades por data | `calendario/page.tsx` |
| `GET /api/dados/gantt` | projetos com datas para Gantt | `painel-gantt/page.tsx` |
| `GET /api/dados/relatorios` | dados consolidados para relatórios | `relatorios/page.tsx` |
| `PATCH /api/dados/perfil` | UPDATE profiles.nome | `perfil/page.tsx` |

---

## Observações Importantes para a IA Executora

### 1. perfil/page.tsx
- `supabase.auth.signInWithPassword()` — **MANTER** (auth, OK)
- `supabase.auth.updateUser({ password })` — **MANTER** (auth, OK)  
- `supabase.from('profiles').select(...)` → criar `GET /api/dados/perfil`
- `supabase.from('profiles').update({ nome })` → criar `PATCH /api/dados/perfil`
- `supabase.from('profiles').update({ senha_zerada: false })` → criar `PATCH /api/dados/perfil`

### 2. Tabelas não mapeadas no schema Docker
As seguintes tabelas aparecem nos Client Components mas NÃO foram incluídas no `docker/init/01-schema.sql`:
- `mensagens_projeto` — sistema de mensagens internas (verificar migration)
- `mensagem_leituras` — leituras de mensagens (verificar migration)  
- `mensagem_destinatarios` — destinatários de mensagens (verificar migration)
- `alertas` — alertas do sistema (verificar migration)
- `indicadores` — indicadores de projeto (verificar migration)
- `solicitacoes_alteracao` — ✅ já está no schema

> ⚠️ **AÇÃO NECESSÁRIA**: Verificar as migrations restantes em  
> `supabase/migrations/` para encontrar a criação dessas tabelas e adicioná-las ao  
> `docker/init/01-schema.sql`

### 3. Abordagem para páginas grandes
As páginas `projetos/[id]/page.tsx` (mais de 200 chamadas `.from()`) e  
`projetos/novo/page.tsx` são muito grandes para migrar todas as queries de uma vez.  
**Recomendação**: migrar em fases usando o padrão:
1. Criar rota de API para dados de leitura (GET)
2. Substituir todos os `.from()` de SELECT pela chamada ao API
3. Criar rota para mutações (POST/PATCH/DELETE)
4. Substituir todas as mutações

### 4. Tabela `alertas`
Aparece em vários lugares como INSERT sem estrutura definida visível no schema.  
Verificar migration `20260322160000_integridade_dados.sql` ou similar.

---

## Checklist de Continuação

### APIs de dados a criar
- [ ] `src/app/api/dados/contexto/route.ts`
- [ ] `src/app/api/dados/perfil/route.ts`
- [ ] `src/app/api/dados/projetos/route.ts`
- [ ] `src/app/api/dados/projeto/[id]/route.ts`
- [ ] `src/app/api/dados/acao/[numero]/route.ts`
- [ ] `src/app/api/dados/calendario/route.ts`
- [ ] `src/app/api/dados/gantt/route.ts`
- [ ] `src/app/api/dados/relatorios/route.ts`

### Schema a completar
- [ ] Identificar e adicionar tabelas faltantes no `docker/init/01-schema.sql`:
  - `mensagens_projeto`
  - `mensagem_leituras`
  - `mensagem_destinatarios`
  - `alertas`
  - `indicadores`

### Dashboard pages a migrar (após criar as APIs acima)
- [ ] `dashboard/perfil/page.tsx`
- [ ] `dashboard/acao/[numero]/page.tsx`
- [ ] `dashboard/projetos/page.tsx`
- [ ] `dashboard/projetos/novo/page.tsx`
- [ ] `dashboard/projetos/[id]/page.tsx`
- [ ] `dashboard/calendario/page.tsx`
- [ ] `dashboard/painel-gantt/page.tsx`
- [ ] `dashboard/relatorios/page.tsx`
