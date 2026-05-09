import postgres from 'postgres'

// Cliente PostgreSQL direto — substitui PostgREST do Supabase para queries de dados.
// Supabase Auth (login/sessão) continua usando @supabase/ssr — não passa por aqui.

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL não definida. Configure a variável de ambiente.')
}

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
  sql = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    onnotice: notice => console.log('PG Notice:', notice),
  })
  console.log('PostgreSQL client initialized')
}

export default sql
