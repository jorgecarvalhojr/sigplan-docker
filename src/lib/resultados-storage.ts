/**
 * Módulo único de acesso ao storage de "Resultados e Produtos".
 *
 * Backend migrado de Supabase Storage → MinIO (S3-compatible).
 * A interface pública (funções exportadas) permanece IDÊNTICA —
 * nenhuma rota de API ou componente de UI precisa mudar.
 *
 *  - O banco guarda apenas um `path` lógico relativo (ex.
 *    `entregas/42/7d3f…b91.pdf`), nunca URLs do provedor.
 *  - A UI linka sempre para `/api/resultados/download?path=...`
 *  - Uploads passam por `/api/resultados/upload`
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// ─── Configuração do cliente S3/MinIO ────────────────────────────────────────

function createS3Client(customEndpoint?: string) {
  const endpoint = customEndpoint || process.env.MINIO_ENDPOINT
  if (!endpoint) throw new Error('MINIO_ENDPOINT não definida')

  return new S3Client({
    endpoint,
    region: process.env.MINIO_REGION || 'us-east-1', // MinIO ignora, mas SDK exige
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY!,
      secretAccessKey: process.env.MINIO_SECRET_KEY!,
    },
    forcePathStyle: true, // OBRIGATÓRIO para MinIO (bucket no path, não no host)
  })
}

// ─── Constantes públicas ──────────────────────────────────────────────────────

export const RESULTADOS_BUCKET = process.env.MINIO_BUCKET_RESULTADOS || 'resultados'
export const RESULTADOS_MAX_BYTES = 4 * 1024 * 1024 // 4 MB
export const RESULTADOS_ALLOWED_MIME = 'application/pdf'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ResultadoOwner =
  | { kind: 'entrega'; entregaId: number }
  | { kind: 'atividade'; atividadeId: number }

export interface ResultadoFileMeta {
  path: string
  nome: string
  tamanho: number
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

function ownerPrefix(owner: ResultadoOwner): string {
  if (owner.kind === 'entrega') return `entregas/${owner.entregaId}`
  return `atividades/${owner.atividadeId}`
}

function randomId(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function sanitizeOriginalName(name: string): string {
  const base = name.replace(/[\r\n\t]/g, ' ').trim()
  return base.length > 180 ? base.slice(0, 180) : base
}

// ─── Interface pública ────────────────────────────────────────────────────────

/**
 * Faz upload do PDF para o MinIO.
 * Deve ser chamado apenas no server (rota de API).
 */
export async function uploadResultadoPDF(
  file: {
    arrayBuffer: () => Promise<ArrayBuffer>
    size: number
    type: string
    name: string
  },
  owner: ResultadoOwner
): Promise<ResultadoFileMeta> {
  if (file.type !== RESULTADOS_ALLOWED_MIME) {
    throw new Error('Formato inválido: apenas arquivos PDF são permitidos.')
  }
  if (file.size > RESULTADOS_MAX_BYTES) {
    throw new Error('Arquivo excede o tamanho máximo de 4 MB.')
  }
  if (file.size <= 0) {
    throw new Error('Arquivo vazio.')
  }

  const s3 = createS3Client()
  const path = `${ownerPrefix(owner)}/${randomId()}.pdf`
  const buffer = Buffer.from(await file.arrayBuffer())

  await s3.send(new PutObjectCommand({
    Bucket: RESULTADOS_BUCKET,
    Key: path,
    Body: buffer,
    ContentType: RESULTADOS_ALLOWED_MIME,
    ContentLength: file.size,
  }))

  return {
    path,
    nome: sanitizeOriginalName(file.name) || 'arquivo.pdf',
    tamanho: file.size,
  }
}

/**
 * Remove um arquivo pelo path lógico.
 * Falhas são ignoradas para não bloquear remoção de metadados no banco.
 */
export async function deleteResultadoPDF(path: string): Promise<void> {
  if (!path) return
  try {
    const s3 = createS3Client()
    await s3.send(new DeleteObjectsCommand({
      Bucket: RESULTADOS_BUCKET,
      Delete: {
        Objects: [{ Key: path }],
        Quiet: true,
      },
    }))
  } catch {
    // Ignorar falhas — pior caso: arquivo órfão no bucket
  }
}

/**
 * Gera uma URL assinada de curta duração para download.
 * A rota `/api/resultados/download` redireciona o usuário para essa URL.
 */
export async function getResultadoSignedUrl(
  path: string,
  ttlSeconds: number = 60
): Promise<string> {
  if (!path) throw new Error('Path obrigatório.')

  // Para gerar a URL assinada, usamos o endpoint externo (ex.: localhost)
  // se disponível, para que o navegador consiga acessar.
  const endpoint = process.env.MINIO_ENDPOINT_EXTERNAL || process.env.MINIO_ENDPOINT
  const s3 = createS3Client(endpoint)
  const command = new GetObjectCommand({
    Bucket: RESULTADOS_BUCKET,
    Key: path,
  })

  const url = await getSignedUrl(s3, command, { expiresIn: ttlSeconds })
  return url
}

/**
 * Verifica se um path pertence ao prefixo esperado de uma entidade.
 * Usado pelas rotas de API para impedir acesso cruzado.
 */
export function pathBelongsTo(path: string, owner: ResultadoOwner): boolean {
  return path.startsWith(ownerPrefix(owner) + '/')
}
