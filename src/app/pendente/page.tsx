'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, LogOut } from 'lucide-react'

export default function PendentePage() {
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch('/api/auth/session')
        if (res.status === 401) {
          router.push('/login')
          return
        }
        const session = await res.json()
        if (session.user && session.user.role !== 'solicitante') {
          router.push('/dashboard')
          return
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    check()
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="bg-yellow-500/20 p-4 rounded-full">
            <Clock size={40} className="text-yellow-400" />
          </div>
        </div>

        <h1 className="text-xl font-bold text-white mb-2">Cadastro em Análise</h1>

        <p className="text-gray-400 text-sm leading-relaxed mb-6">
          Sua conta foi identificada no sistema CBMERJ, mas seu acesso ao Sigplan ainda 
          está aguardando aprovação de um administrador.
        </p>

        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white transition-colors text-sm"
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </div>
  )
}
