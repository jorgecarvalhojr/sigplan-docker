# Migração Sigplan → Docker + MinIO + PostgreSQL + GitLab CI

> **Documento de contexto para continuidade por outra IA.**  
> Última atualização: 2026-05-05  
> Status: **AGUARDANDO EXECUÇÃO** (plano aprovado pelo usuário)

---

## 1. O que é este projeto

**Sigplan** é uma aplicação Next.js 14 (App Router, TypeScript, Tailwind) hospedada no repositório GitLab do usuário. É um sistema de gerenciamento de projetos institucionais (`enquadramentos-app-projetos`).

**Caminho local**: `d:\OneDrive\Sigplan`

---

## 2. Estado atual (ANTES da migração)

### Stack atual
| Camada | Tecnologia atual |
|---|---|
| Frontend/Backend | Next.js 14 App Router |
| Autenticação | Supabase Cloud (GoTrue, JWT, cookies) |
| Banco de dados | Supabase Cloud (PostgREST sobre PostgreSQL 17) |
| Storage de arquivos | Supabase Storage (bucket `resultados`, PDFs) |
| Deploy | Vercel (provavelmente) |
| CI/CD | Não existe ainda |

### Variáveis de ambiente atuais (`.env.local.example`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key-aqui
# Também existe SUPABASE_SERVICE_ROLE_KEY (não estava no .example)
```

### Clientes Supabase usados no código
- `src/lib/supabase.ts` — `createBrowserClient` (client-side auth)
- `src/lib/supabase-server.ts` — `createServerClient` com cookies (server-side auth)
- `src/lib/supabase-admin.ts` — `createClient` com service_role (admin operations)

### Arquivos críticos de banco (SQL)
- `D:\sigplan.sql` — dump completo do cluster Supabase (16425 linhas, 1.5MB)
- `d:\OneDrive\Sigplan\supabase\migrations\` — 15 arquivos de migration incrementais
  - O mais importante: `20260306135625_schema_completo.sql` (95KB) — schema `public` completo
- `d:\OneDrive\Sigplan\supabase\` — config local do Supabase CLI

---

## 3. O que o usuário quer (DEPOIS da migração)

### Objetivo principal
Eliminar dependência de billing do Supabase (banco e storage), mantendo apenas o **Supabase Auth** (gratuito, sem limite relevante de usuários).

### Stack alvo
| Camada | Tecnologia alvo |
|---|---|
| Auth | Supabase Cloud (apenas GoTrue/JWT) — **sem mudança** |
| Banco de dados local | PostgreSQL 17 em container Docker |
| Banco de dados produção | PostgreSQL externo no servidor (já configurado) |
| Storage de PDFs | MinIO em container Docker (S3-compatible) |
| Deploy local | `docker-compose.yml` + `docker-compose.override.yml` |
| Deploy produção | `docker-compose.yml` + SSH via GitLab CI |
| CI/CD | GitLab CI com `.gitlab-ci.yml` e variáveis de ambiente dinâmicas |

---

## 4. Arquitetura definida

```
LOCAL (docker-compose.yml + override):
  - app (Next.js :3000)
  - postgres (PostgreSQL 17 :5432)
  - minio (MinIO :9000, console :9001)
  - createbuckets (MinIO MC - cria bucket 'resultados')

PRODUÇÃO (docker-compose.yml):
  - app (Next.js :3000, imagem do registry GitLab)
  - minio (MinIO :9000)
  - SEM postgres (usa servidor externo)

CLOUD (Supabase - mantido apenas):
  - GoTrue Auth (login email/senha, JWT, sessions)
  - Sem banco, sem storage
```

#### [NEW] `docker-compose.yml` (base / produção)
```yaml
services:
  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    restart: unless-stopped

  createbuckets:
    image: minio/mc
    depends_on: [minio]
    entrypoint: >
      /bin/sh -c "
        sleep 5;
        mc alias set local http://minio:9000 $${MINIO_ACCESS_KEY} $${MINIO_SECRET_KEY};
        mc mb --ignore-existing local/${MINIO_BUCKET_RESULTADOS};
      "

  app:
    image: ${CI_REGISTRY_IMAGE:-sigplan}:${CI_COMMIT_SHA:-latest}
    env_file: .env
    ports:
      - "3000:3000"
    depends_on: [minio]
    restart: unless-stopped

volumes:
  minio_data:
```

#### [NEW] `docker-compose.override.yml` (local — aplicado automaticamente)
```yaml
# Aplicado automaticamente pelo Docker Compose em ambiente local.
# Em produção: docker-compose -f docker-compose.yml up -d
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/init:/docker-entrypoint-initdb.d:ro
    ports:
      - "5432:5432"

  app:
    build: .           # constrói localmente em vez de usar imagem do registry
    env_file: .env.local
    depends_on:
      - postgres
      - minio
    volumes:
      - .:/app         # hot-reload do código
      - /app/node_modules
      - /app/.next

volumes:
  postgres_data:
```

---

## 5. Mapa completo de mudanças necessárias

### 5.1 Novos arquivos a criar

| Arquivo | Propósito |
|---|---|
| `Dockerfile` | Build multi-stage da app Next.js |
| `docker-compose.yml` | Base (produção): app + minio |
| `docker-compose.override.yml` | Override local (auto-aplicado): adiciona postgres, ajusta volumes/portas |
| `.env.template` | Template de variáveis para `envsubst` no CI |
| `.env.local.example` (atualizar) | Exemplo atualizado com todas as variáveis |
| `.gitlab-ci.yml` | Pipeline GitLab com stages build/deploy-local/deploy-prod |
| `docker/init/00-extensions.sql` | Extensões PostgreSQL (uuid-ossp, pgcrypto) |
| `docker/init/01-schema.sql` | Schema `public` extraído das migrations |
| `src/lib/db.ts` | Cliente PostgreSQL direto (pacote `postgres`) |

### 5.2 Arquivos a modificar

| Arquivo | O que muda |
|---|---|
| `src/lib/supabase-admin.ts` | Manter apenas para Auth Admin API (remover uso em dados) |
| `src/lib/resultados-storage.ts` | Reescrever internamente: Supabase Storage → MinIO S3 SDK |
| `src/middleware.ts` | `from('profiles').select('role')` → `sql` direto |
| `src/app/api/admin/create-gestor/route.ts` | `rpc('admin_create_user')` → Auth Admin API + sql INSERT |
| `src/app/api/admin/delete-user/route.ts` | `rpc('admin_delete_user')` → Auth Admin API + sql SELECT |
| `src/app/api/admin/reset-password/route.ts` | `rpc('admin_update_user_password')` → Auth Admin API + sql UPDATE |
| `src/app/api/admin/update-user/route.ts` | `rpc('admin_update_user_email')` → Auth Admin API + sql UPDATE |
| `src/app/api/auth/auto-confirm/route.ts` | `rpc('admin_confirm_user_email')` → Auth Admin API + sql |
| `src/app/api/resultados/upload/route.ts` | `adminClient.from(...)` → sql direto |
| `package.json` | Adicionar: `postgres`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` |

### 5.3 Arquivos que NÃO mudam (confirmado)
- `src/lib/supabase.ts` — browser client para auth
- `src/lib/supabase-server.ts` — server client para auth
- `src/app/api/resultados/download/route.ts` — interface pública mantida
- `src/app/login/**` — login via Supabase Auth, sem mudança
- Todos os componentes de UI

---

## 6. Detalhes críticos de implementação

### 6.1 Schema SQL para Docker init

**NÃO usar** o `D:\sigplan.sql` completo (tem schemas Supabase específicos).
**USAR** as migrations em `supabase/migrations/` na ordem cronológica:

```
20260306135625_schema_completo.sql  ← base do schema public
20260320133631_add_data_inicio_entrega.sql
20260320135942_fix_admin_auth_functions.sql
20260321140000_atividade_participantes_user_based.sql
20260322120000_permissoes_alertas.sql
20260322160000_integridade_dados.sql
20260325_melhorias_projetos.sql
20260326060000_02_perfil_solicitado.sql
20260328_campos_projeto_problema.sql
20260402_riscos_mensagens.sql
20260403_push_subscriptions.sql
20260406120000_master_pode_autorizar_e_zerar_senha.sql
20260406130000_projetos_codigo_sequencial.sql
20260407120000_resultados_produtos.sql
20260503_riscos_impacto.sql
```

**Adaptações necessárias** no `docker/init/01-schema.sql`:
- Remover referências a `auth.*` nas funções (as funções RPC de admin serão substituídas no TypeScript)
- Remover: `pg_graphql`, `supabase_vault` (extensões Supabase-específicas)
- Manter: `uuid-ossp`, `pgcrypto` (disponíveis no PostgreSQL puro)
- O trigger `handle_new_user` referencia `auth.users` — precisa ser adaptado ou removido (o insert no `profiles` será feito manualmente via código na rota `auto-confirm`)

### 6.2 Substituição das RPCs por Auth Admin API

As RPCs atualmente acessam `auth.users` diretamente. Com banco separado, usar:

```typescript
// Criar usuário
const { data: { user }, error } = await supabaseAdmin.auth.admin.createUser({
  email: email,
  password: tempPassword,
  email_confirm: true,
  user_metadata: { nome, setor_id }
})
// Depois: INSERT INTO profiles via sql`...`

// Deletar usuário
await supabaseAdmin.auth.admin.deleteUser(userId)
// Depois: DELETE FROM profiles via sql`...` (cascade cuida)

// Reset senha
await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword })

// Atualizar email
await supabaseAdmin.auth.admin.updateUserById(userId, { email: newEmail })

// Confirmar email
await supabaseAdmin.auth.admin.updateUserById(userId, { email_confirm: true })
```

### 6.3 MinIO (resultados-storage.ts)

Interface pública a manter **sem mudança**:
```typescript
uploadResultadoPDF(file, owner): Promise<ResultadoFileMeta>
deleteResultadoPDF(path): Promise<void>
getResultadoSignedUrl(path, ttlSeconds): Promise<string>
pathBelongsTo(path, owner): boolean
```

Implementação nova usando AWS SDK S3:
```typescript
import { S3Client, PutObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { GetObjectCommand } from '@aws-sdk/client-s3'

const s3 = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT,   // http://minio:9000 (local) ou https://... (prod)
  region: 'us-east-1',                    // MinIO ignora, mas SDK exige
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY!,
    secretAccessKey: process.env.MINIO_SECRET_KEY!,
  },
  forcePathStyle: true,  // OBRIGATÓRIO para MinIO
})
```

### 6.4 Middleware (profiles query)

```typescript
// ANTES (via PostgREST Supabase):
const { data: profile } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', user.id)
  .single()

// DEPOIS (via pg direto):
import sql from '@/lib/db'
const [profile] = await sql`SELECT role FROM profiles WHERE id = ${user.id}`
```

### 6.5 Variáveis de ambiente completas

```env
# Supabase Auth (mantido)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# PostgreSQL
DATABASE_URL=postgresql://sigplan:senha@postgres:5432/sigplan  # local
# DATABASE_URL=postgresql://user:senha@HOST_EXTERNO:5432/sigplan  # prod
POSTGRES_USER=sigplan
POSTGRES_PASSWORD=senha_segura
POSTGRES_DB=sigplan

# MinIO
MINIO_ENDPOINT=http://minio:9000       # local
# MINIO_ENDPOINT=https://minio.dominio.com  # prod
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET_RESULTADOS=resultados
MINIO_USE_SSL=false   # true em prod
```

---

## 7. GitLab CI — estrutura de variáveis

No painel GitLab → Settings → CI/CD → Variables:

### Ambiente `local` (branch `develop`)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL` = `postgresql://sigplan:${POSTGRES_PASSWORD}@postgres:5432/sigplan`
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `MINIO_ENDPOINT` = `http://minio:9000`
- `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`
- `MINIO_BUCKET_RESULTADOS` = `resultados`
- `MINIO_USE_SSL` = `false`

### Ambiente `production` (branch `main`)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL` = conexão ao servidor PostgreSQL externo
- `MINIO_ENDPOINT` = URL pública do MinIO no servidor
- `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` (credenciais seguras)
- `MINIO_USE_SSL` = `true`
- `PROD_SERVER` = `user@ip-servidor` (para SSH no deploy)

---

## 8. Checklist de execução

### Fase 1 — Infraestrutura base
- [ ] `npm install postgres @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
- [ ] Criar `src/lib/db.ts`
- [ ] Criar `docker/init/00-extensions.sql`
- [ ] Criar `docker/init/01-schema.sql` (baseado nas migrations, adaptado)
- [ ] Criar `Dockerfile`
- [ ] Criar `docker-compose.yml` (base/produção)
- [ ] Criar `docker-compose.override.yml` (local)
- [ ] Criar `.env.template`
- [ ] Atualizar `.env.local.example`

### Fase 2 — Migrar Storage
- [ ] Reescrever `src/lib/resultados-storage.ts` (MinIO S3)
- [ ] Testar: `docker-compose -f docker-compose.local.yml up minio`
- [ ] Verificar upload/download/presigned URL

### Fase 3 — Migrar queries
- [ ] `src/middleware.ts`
- [ ] `src/app/api/admin/create-gestor/route.ts`
- [ ] `src/app/api/admin/delete-user/route.ts`
- [ ] `src/app/api/admin/reset-password/route.ts`
- [ ] `src/app/api/admin/update-user/route.ts`
- [ ] `src/app/api/auth/auto-confirm/route.ts`
- [ ] `src/app/api/resultados/upload/route.ts`
- [ ] Auditar `src/app/dashboard/` (Server Components com queries)

### Fase 4 — GitLab CI/CD
- [ ] Criar `.gitlab-ci.yml`
- [ ] Criar `docker-compose.prod.yml`
- [ ] Configurar variáveis no painel GitLab

### Fase 5 — Migrar dados
- [ ] `docker-compose -f docker-compose.local.yml up -d`
- [ ] Importar dados `public` do `sigplan.sql`
- [ ] Script de migração de arquivos: Supabase Storage → MinIO

---

## 9. Notas importantes para a IA executora

1. **NÃO modificar** `supabase-server.ts` e `supabase.ts` — usados exclusivamente para auth, permanecem iguais.

2. **O trigger `handle_new_user`** no schema SQL referencia `auth.users`. No banco Docker separado, esse trigger não funciona (pois `auth.users` não existe lá). O profile deve ser criado manualmente na rota `auto-confirm` após o Supabase criar o usuário — isso **já é feito como fallback** no código atual da rota.

3. **Funções RPC que ficam no banco Docker** (não tocam `auth.*`): `admin_delete_setor`, `admin_update_acao_campo`, `admin_update_observacao`, `check_setor_dependencies`, `update_updated_at`. Estas permanecem como stored procedures e serão chamadas via `sql` driver.

4. **RLS (Row Level Security)**: O Supabase usa RLS com `auth.uid()`. Com banco Docker puro, RLS não faz sentido (a aplicação é o único cliente). Remover RLS policies e `auth.uid()` das funções no schema Docker.

5. **`forcePathStyle: true`** é obrigatório no SDK S3 para MinIO (caso contrário, tenta acessar `bucket.endpoint` ao invés de `endpoint/bucket`).

6. **Portas**: MinIO console fica em `:9001`, API S3 em `:9000`.
