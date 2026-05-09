'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, BellRing } from 'lucide-react'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

type PushState = 'loading' | 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'

export default function PushNotificationManager() {
  const [state, setState] = useState<PushState>('loading')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    checkStatus()
  }, [])

  async function checkStatus() {
    // Check browser support
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setState('unsupported')
      return
    }

    // Check if permission was denied
    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }

    try {
      // Register service worker
      const registration = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
      await navigator.serviceWorker.ready

      // Check existing subscription
      const subscription = await registration.pushManager.getSubscription()
      setState(subscription ? 'subscribed' : 'unsubscribed')
    } catch (err) {
      console.error('[Push] Erro ao verificar status:', err)
      setState('unsupported')
    }
  }

  async function subscribe() {
    setBusy(true)
    try {
      const registration = await navigator.serviceWorker.ready

      // Request permission
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState('denied')
        setBusy(false)
        return
      }

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      })

      const subJSON = subscription.toJSON()

      // Send subscription to server
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subJSON.endpoint,
          keys: {
            p256dh: subJSON.keys?.p256dh,
            auth: subJSON.keys?.auth,
          },
        }),
      })

      if (!res.ok) throw new Error('Falha ao salvar inscrição')

      setState('subscribed')
    } catch (err) {
      console.error('[Push] Erro ao se inscrever:', err)
      // Re-check state
      await checkStatus()
    } finally {
      setBusy(false)
    }
  }

  async function unsubscribe() {
    setBusy(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        const endpoint = subscription.endpoint

        // Unsubscribe from browser
        await subscription.unsubscribe()

        // Remove from server
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        })
      }

      setState('unsubscribed')
    } catch (err) {
      console.error('[Push] Erro ao cancelar inscrição:', err)
      await checkStatus()
    } finally {
      setBusy(false)
    }
  }

  // Don't render anything if unsupported or loading
  if (state === 'loading' || state === 'unsupported') return null

  if (state === 'denied') {
    return (
      <button
        className="flex items-center gap-1.5 text-gray-500 text-xs cursor-not-allowed"
        title="Notificações bloqueadas no navegador. Acesse as configurações do navegador para desbloquear."
        disabled
      >
        <BellOff size={14} />
        <span className="hidden sm:inline">Bloqueado</span>
      </button>
    )
  }

  if (state === 'subscribed') {
    return (
      <button
        onClick={unsubscribe}
        disabled={busy}
        className="flex items-center gap-1.5 text-green-400 hover:text-green-300 text-xs transition-colors"
        title="Notificações ativadas. Clique para desativar."
      >
        <BellRing size={14} className={busy ? 'animate-pulse' : ''} />
        <span className="hidden sm:inline">{busy ? '...' : 'Push ativo'}</span>
      </button>
    )
  }

  // unsubscribed
  return (
    <button
      onClick={subscribe}
      disabled={busy}
      className="flex items-center gap-1.5 text-gray-400 hover:text-yellow-400 text-xs transition-colors"
      title="Ativar notificações push neste dispositivo"
    >
      <Bell size={14} className={busy ? 'animate-pulse' : ''} />
      <span className="hidden sm:inline">{busy ? 'Ativando...' : 'Ativar push'}</span>
    </button>
  )
}
