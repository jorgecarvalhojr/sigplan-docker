'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Shield, User, Mail, Building2, ArrowLeft, Loader2 } from 'lucide-react'

function RegistroForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [rg, setRg] = useState(searchParams.get('rg') || '')
  const [nome, setNome] = useState(searchParams.get('nome') || '')
  const [email, setEmail] = useState('')
  const [setorId, setSetorId] = useState('')
  
  const [setores, setSetores] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchingSetores, setFetchingSetores] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadSetores() {
      try {
        const res = await fetch('/api/setores')
        if (res.ok) {
          const data = await res.json()
          setSetores(data)
        }
      } catch (err) {
        console.error('Erro ao carregar setores', err)
      } finally {
        setFetchingSetores(false)
      }
    }
    loadSetores()
  }, [])

  // Lookup legacy data when email is filled
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (email.includes('@') && email.includes('.')) {
        try {
          const res = await fetch(`/api/auth/lookup-legacy?email=${encodeURIComponent(email)}`)
          if (res.ok) {
            const data = await res.json()
            if (data.found && data.setor_id) {
              setSetorId(data.setor_id.toString())
              // Opcional: Avisar o usuário que recuperamos o setor
            }
          }
        } catch (err) {
          console.warn('Erro ao buscar dados legados', err)
        }
      }
    }, 500) // Debounce

    return () => clearTimeout(timer)
  }, [email])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !setorId) {
      setError('Por favor, preencha todos os campos.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rg, nome, email, setorId: parseInt(setorId) }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao realizar cadastro')
      } else {
        router.push('/pendente')
        router.refresh()
      }
    } catch (err) {
      setError('Erro de conexão com o servidor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" />
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-orange-400 to-yellow-500" />

      <div className="w-full max-w-lg relative z-10 py-10">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <img src="/logo-sedec.png" alt="SEDEC-RJ" className="h-14" />
            <div className="w-px h-10 bg-gray-600" />
            <img src="/logo-sigplan.svg" alt="SIGPLAN" className="h-12" />
          </div>
          <h1 className="text-xl font-bold text-white">Solicitar Acesso ao Sigplan</h1>
          <p className="text-gray-400 mt-1 text-sm">Complete seus dados para análise do gestor</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">RG (CBMERJ)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  value={rg}
                  disabled
                  className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  value={nome}
                  disabled
                  className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail Institucional ou Pessoal</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Mail size={18} />
              </div>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500 bg-gray-50"
                required
                placeholder="exemplo@email.com"
              />
            </div>
            <p className="mt-1 text-xs text-gray-400 italic">Usado para notificações e login futuro.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Setor / Órgão</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Building2 size={18} />
              </div>
              {fetchingSetores ? (
                <div className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-400 flex items-center">
                  <Loader2 size={16} className="animate-spin mr-2" />
                  Carregando setores...
                </div>
              ) : (
                <select
                  value={setorId}
                  onChange={e => setSetorId(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500 bg-gray-50"
                  required
                >
                  <option value="" disabled>Selecione seu setor...</option>
                  {setores.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.codigo} - {s.nome_completo}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded flex items-start gap-3">
              <div className="mt-0.5"><Shield size={16} /></div>
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button
              type="submit"
              disabled={loading || fetchingSetores}
              className="w-full py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Processando...' : 'SOLICITAR CADASTRO'}
            </button>
            
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 py-2"
            >
              <ArrowLeft size={16} />
              Voltar para o Login
            </button>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <p className="text-center text-xs text-gray-400 leading-relaxed">
              Ao solicitar o cadastro, seus dados passarão por uma análise de perfil. 
              Você será notificado por e-mail quando o acesso for liberado.
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function RegistroPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Carregando...</div>}>
      <RegistroForm />
    </Suspense>
  )
}
