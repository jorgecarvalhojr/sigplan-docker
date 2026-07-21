import postgres from 'postgres'

// Cliente PostgreSQL direto — substitui PostgREST do Supabase para queries de dados.
// Supabase Auth (login/sessão) continua usando @supabase/ssr — não passa por aqui.
//
// Conexão via variáveis separadas (DB_HOST, DB_PORT, ...) em vez de uma única
// DATABASE_URL — facilita ter valores distintos por ambiente no GitLab CI.

// Bypass apenas durante o build do Next.js (npm run build no Dockerfile)
// Em runtime (servidor rodando), sempre conecta no banco real
const isBuild = process.env.NEXT_PHASE === 'phase-production-build'

let sql: any

if (isBuild) {
  console.log('PostgreSQL client bypass (build phase)')
  sql = (() => {
    const fn: any = () => Promise.resolve([])
    fn.array = (arr: any) => arr
    return fn
  })()
} else {
  const host = process.env.DB_HOST
  const database = process.env.DB_NAME
  const username = process.env.DB_USER
  const password = process.env.DB_PASSWORD

  if (!host || !database || !username || !password) {
    throw new Error('Variáveis de banco de dados não definidas (DB_HOST, DB_NAME, DB_USER, DB_PASSWORD).')
  }

  sql = postgres({
    host,
    port: parseInt(process.env.DB_PORT || '5432'),
    database,
    username,
    password,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    onnotice: notice => console.log('PG Notice:', notice),
  })
  console.log('PostgreSQL client initialized')
}

export default sql
