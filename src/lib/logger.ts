import { promises as fs } from 'fs'
import path from 'path'
import { createTransport } from 'nodemailer'

const LOG_DIR = process.env.LOG_DIR || '/app/logs'
const LOG_MAIL_TO = process.env.LOG_MAIL_TO || 'marciofmar@gmail.com'
const LOG_MAIL_THROTTLE_MS = parseInt(process.env.LOG_MAIL_THROTTLE_SECONDS || '300') * 1000

// Throttle em memória: assinatura → timestamp do último envio
const throttleMap = new Map<string, number>()

function today(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

function nowStr(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

function signature(level: string, message: string, context?: unknown): string {
  const base = `${level}|${message}`
  if (context instanceof Error) return base + `|${context.constructor.name}|${context.message}`
  return base
}

async function writeToFile(level: string, message: string, context?: unknown): Promise<void> {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true })
    const file = path.join(LOG_DIR, `${today()}.log`)
    const contextStr = context ? '\n  ' + (context instanceof Error
      ? `${context.stack}`
      : JSON.stringify(context, null, 2)) : ''
    const line = `[${nowStr()}] [${level.toUpperCase()}] ${message}${contextStr}\n`
    await fs.appendFile(file, line, 'utf8')
  } catch {
    // Falha de I/O não pode derrubar a requisição
  }
}

async function sendMail(level: string, message: string, context?: unknown): Promise<void> {
  const host = process.env.MAIL_HOST
  const port = parseInt(process.env.MAIL_PORT || '587')
  const user = process.env.MAIL_USER
  const pass = process.env.MAIL_PASSWORD

  if (!host || !user || !pass) return

  const transport = createTransport({
    host,
    port,
    secure: false,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  })

  const contextHtml = context
    ? `<pre style="background:#f5f5f5;padding:12px;font-size:12px;overflow:auto">${
        context instanceof Error ? context.stack : JSON.stringify(context, null, 2)
      }</pre>`
    : ''

  await transport.sendMail({
    from: `"SIGPLAN Logs" <${user}>`,
    to: LOG_MAIL_TO,
    subject: `[SIGPLAN] ${level.toUpperCase()}: ${message.slice(0, 80)}`,
    html: `
      <div style="font-family:monospace">
        <table style="border-collapse:collapse;margin-bottom:16px">
          <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Data/Hora</td><td>${nowStr()}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Nível</td><td>${level.toUpperCase()}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Mensagem</td><td>${message}</td></tr>
        </table>
        ${contextHtml}
      </div>`,
  })
}

async function log(level: 'error' | 'warn', message: string, context?: unknown): Promise<void> {
  // Sempre grava no arquivo
  writeToFile(level, message, context).catch(() => {})

  // Email só para erros, com throttle
  if (level !== 'error') return

  const sig = signature(level, message, context)
  const last = throttleMap.get(sig) ?? 0
  if (Date.now() - last < LOG_MAIL_THROTTLE_MS) return

  throttleMap.set(sig, Date.now())

  sendMail(level, message, context).catch(e => {
    console.error('[logger] falha ao enviar email de log:', e?.message)
  })
}

const logger = {
  error: (message: string, context?: unknown) => {
    console.error(`[ERROR] ${message}`, context ?? '')
    log('error', message, context)
  },
  warn: (message: string, context?: unknown) => {
    console.warn(`[WARN] ${message}`, context ?? '')
    log('warn', message, context)
  },
}

export default logger
