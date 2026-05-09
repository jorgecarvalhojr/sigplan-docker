'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Eye, EyeOff, Lock, User, Building2, Calculator } from 'lucide-react'
import { useEffect } from 'react'

export default function LoginPage() {
  const [rg, setRg] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [profiles, setProfiles] = useState<any[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')
  
  // Anti-bot states
  const [challenge, setChallenge] = useState<{ question: string, token: string } | null>(null)
  const [challengeAnswer, setChallengeAnswer] = useState('')
  const [honeypot, setHoneypot] = useState('')

  const router = useRouter()

  const fetchChallenge = async () => {
    try {
      const res = await fetch('/api/auth/challenge')
      const data = await res.json()
      setChallenge({ question: data.question, token: data.challengeToken })
    } catch (err) {
      console.error('Erro ao carregar desafio anti-bot')
    }
  }

  useEffect(() => {
    fetchChallenge()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          rg, 
          password, 
          selectedProfileId: selectedProfileId || undefined,
          challengeAnswer,
          challengeToken: challenge?.token,
          website: honeypot // Honeypot field
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao realizar login')
      } else if (data.requiresRegistration) {
        // Redireciona para a página de registro com os dados pré-preenchidos
        const params = new URLSearchParams({
          rg: data.rg,
          nome: data.nome
        })
        router.push(`/registro?${params.toString()}`)
      } else if (data.requiresProfileSelection) {
        setProfiles(data.profiles)
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch (err) {
      setError('Erro de conexão com o servidor')
      fetchChallenge() // Gera novo desafio em caso de erro
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" />
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-orange-400 to-yellow-500" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <img src="/logo-sedec.png" alt="SEDEC-RJ" className="h-14" />
            <div className="w-px h-10 bg-gray-600" />
            <img src="/logo-sigplan.svg" alt="SIGPLAN" className="h-12" />
          </div>
          <h1 className="text-xl font-bold text-white">Sistema de Governança e Planejamento</h1>
          <p className="text-gray-400 mt-1 text-sm">SEDEC/RJ • Plano Estratégico 2024–2035</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800">Login CBMERJ</h2>
            <p className="text-sm text-gray-500 mt-2">
              {profiles.length > 0 ? 'Selecione por qual órgão deseja acessar' : 'Use seu RG e senha da rede CBMERJ'}
            </p>
          </div>

          <div className="space-y-4">
            {profiles.length === 0 ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">RG</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <User size={18} />
                    </div>
                    <input
                      type="text"
                      value={rg}
                      onChange={e => setRg(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500 bg-gray-50"
                      required
                      placeholder="0000000"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <Lock size={18} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500 bg-gray-50"
                      required
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Perfil (Órgão)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Building2 size={18} />
                  </div>
                  <select
                    value={selectedProfileId}
                    onChange={e => setSelectedProfileId(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500 bg-gray-50"
                    required
                  >
                    <option value="" disabled>Selecione um órgão...</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.setor_codigo} - {p.setor_nome || p.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Honeypot field - hidden from users */}
          <div className="hidden" aria-hidden="true">
            <input 
              type="text" 
              name="website" 
              value={honeypot} 
              onChange={e => setHoneypot(e.target.value)} 
              tabIndex={-1} 
              autoComplete="off" 
            />
          </div>

          {profiles.length === 0 && challenge && (
            <div className="space-y-2 p-4 bg-orange-50 rounded-xl border border-orange-100">
              <label className="flex items-center gap-2 text-sm font-medium text-orange-800">
                <Calculator size={16} />
                Desafio Anti-Robô
              </label>
              <div className="flex items-center gap-3">
                <span className="text-gray-700 font-bold whitespace-nowrap">{challenge.question}</span>
                <input
                  type="number"
                  value={challengeAnswer}
                  onChange={e => setChallengeAnswer(e.target.value)}
                  className="block w-20 px-3 py-1.5 border border-orange-200 rounded-lg focus:ring-orange-500 focus:border-orange-500 bg-white"
                  required
                  placeholder="?"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded flex items-start gap-3">
              <div className="mt-0.5"><Shield size={16} /></div>
              <p className="text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (profiles.length === 0 && !challengeAnswer) || (profiles.length > 0 && !selectedProfileId)}
            className="w-full py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Autenticando...' : profiles.length > 0 ? 'ACESSAR SISTEMA' : 'ENTRAR'}
          </button>

          {profiles.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setProfiles([])
                setSelectedProfileId('')
                setPassword('')
              }}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              Voltar
            </button>
          )}

          <div className="pt-4 border-t border-gray-100">
            <p className="text-center text-xs text-gray-400">
              Acesso restrito a militares e servidores autorizados pela SEDEC-RJ.
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
