import webpush from 'web-push'
import sql from './db'

// Lazy VAPID configuration — only runs when first push is sent (avoids build-time errors)
let vapidConfigured = false

function ensureVapidConfigured() {
  if (vapidConfigured) return
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:maradei.ictdec@gmail.com'

  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars.')
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
  vapidConfigured = true
}

interface PushPayload {
  title: string
  body: string
  url?: string
}

/**
 * Envia push notification para todos os dispositivos de um usuário.
 * Remove inscrições inválidas automaticamente (endpoint expirado/revogado).
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  ensureVapidConfigured()
  const subscriptions = await sql`
    SELECT id, endpoint, p256dh, auth
    FROM push_subscriptions
    WHERE user_id = ${userId}
  `

  if (!subscriptions || subscriptions.length === 0) {
    return { sent: 0, failed: 0 }
  }

  let sent = 0
  let failed = 0
  const invalidIds: number[] = []

  const payloadStr = JSON.stringify(payload)

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payloadStr,
        { TTL: 86400 } // 24 horas
      )
      sent++
    } catch (err: any) {
      failed++
      // 410 Gone ou 404 = inscrição inválida/expirada — remover
      if (err.statusCode === 410 || err.statusCode === 404) {
        invalidIds.push(sub.id)
      }
      console.error(`[Push] Falha ao enviar para user ${userId}, endpoint ${sub.endpoint.slice(0, 50)}...:`, err.statusCode || err.message)
    }
  }

  // Limpar inscrições inválidas
  if (invalidIds.length > 0) {
    await sql`DELETE FROM push_subscriptions WHERE id IN ${sql(invalidIds)}`
    console.log(`[Push] Removidas ${invalidIds.length} inscrição(ões) inválida(s) do user ${userId}`)
  }

  return { sent, failed }
}

/**
 * Envia push para múltiplos usuários (batch).
 * Útil para alertas que vão para vários destinatários.
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  ensureVapidConfigured()
  const uniqueIds = Array.from(new Set(userIds))
  await Promise.allSettled(
    uniqueIds.map(uid => sendPushToUser(uid, payload))
  )
}
