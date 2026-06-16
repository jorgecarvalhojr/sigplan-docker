/**
 * Módulo único de acesso ao storage de "Resultados e Produtos".
 *
 * Backend: sistema de arquivos local, persistido num volume Docker
 * (`resultados_data:/app/storage`). Não depende de nenhum serviço
 * externo (S3, MinIO, etc.) nem de configurações extras de rede/infra —
 * tudo fica contido no próprio container/volume do Docker.
 *
 *  - O banco guarda apenas um `path` lógico relativo (ex.
 *    `entregas/42/7d3f…b91.pdf`), nunca caminhos absolutos.
 *  - A UI linka sempre para `/api/resultados/download?path=...`
 *  - Uploads passam por `/api/resultados/upload`
 */

import { promises as fs } from 'fs'
import path from 'path'

// ─── Configuração do diretório de armazenamento ──────────────────────────────

const STORAGE_ROOT = process.env.RESULTADOS_STORAGE_DIR || '/app/storage/resultados'

// ─── Constantes públicas ──────────────────────────────────────────────────────

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

/**
 * Resolve um path lógico relativo para um caminho absoluto dentro de
 * STORAGE_ROOT, recusando qualquer tentativa de escapar do diretório
 * (ex. via `../`).
 */
function resolveSafePath(relPath: string): string {
  const root = path.resolve(STORAGE_ROOT)
  const full = path.resolve(root, relPath)
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new Error('Path inválido.')
  }
  return full
}

// ─── Interface pública ────────────────────────────────────────────────────────

/**
 * Salva o PDF em disco, dentro do volume de storage.
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

  const relPath = `${ownerPrefix(owner)}/${randomId()}.pdf`
  const fullPath = resolveSafePath(relPath)
  const buffer = Buffer.from(await file.arrayBuffer())

  await fs.mkdir(path.dirname(fullPath), { recursive: true })
  await fs.writeFile(fullPath, buffer)

  return {
    path: relPath,
    nome: sanitizeOriginalName(file.name) || 'arquivo.pdf',
    tamanho: file.size,
  }
}

/**
 * Remove um arquivo pelo path lógico.
 * Falhas são ignoradas para não bloquear remoção de metadados no banco.
 */
export async function deleteResultadoPDF(relPath: string): Promise<void> {
  if (!relPath) return
  try {
    const fullPath = resolveSafePath(relPath)
    await fs.unlink(fullPath)
  } catch {
    // Ignorar falhas — pior caso: arquivo órfão no volume
  }
}

/**
 * Lê o arquivo diretamente do disco e retorna seus bytes e metadados.
 */
export async function getResultadoObjectData(relPath: string): Promise<{ buffer: Uint8Array, contentType: string, contentLength: number }> {
  if (!relPath) throw new Error('Path obrigatório.')

  const fullPath = resolveSafePath(relPath)
  const buffer = await fs.readFile(fullPath)

  return {
    buffer,
    contentType: RESULTADOS_ALLOWED_MIME,
    contentLength: buffer.length,
  }
}

/**
 * Verifica se um path pertence ao prefixo esperado de uma entidade.
 * Usado pelas rotas de API para impedir acesso cruzado.
 */
export function pathBelongsTo(path: string, owner: ResultadoOwner): boolean {
  return path.startsWith(ownerPrefix(owner) + '/')
}
