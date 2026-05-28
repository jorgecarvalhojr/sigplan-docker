'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, User } from 'lucide-react'

export default function PerfilPage() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const [nome, setNome] = useState('')
  const [savingNome, setSavingNome] = useState(false)
  const [nomeSaved, setNomeSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/auth/session')
      if (!res.ok) { router.push('/login'); return }

      const profileRes = await fetch('/api/dados/perfil')
      if (profileRes.ok) {
        const data = await profileRes.json()
        setProfile(data)
        setNome(data.nome)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSaveNome() {
    if (!profile || !nome.trim()) return
    setSavingNome(true)
    const res = await fetch('/api/dados/perfil', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: nome.trim() }),
    })
    if (!res.ok) {
      const err = await res.json()
      alert(`Erro: ${err.error}`)
    } else {
      setProfile((p: any) => ({ ...p, nome: nome.trim() }))
      setNomeSaved(true)
      setTimeout(() => setNomeSaved(false), 2000)
    }
    setSavingNome(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-sedec-500 font-medium">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={16} /> Voltar
      </button>

      <h1 className="text-xl font-bold text-gray-800 mb-6">Meu Perfil</h1>

      <div className="card p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-4">
          <User size={18} className="text-sedec-500" /> Dados Pessoais
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={nome}
                onChange={e => setNome(e.target.value)}
                className="input-field flex-1"
              />
              <button
                onClick={handleSaveNome}
                disabled={savingNome || nome.trim() === profile?.nome}
                className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
              >
                {savingNome ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
            {nomeSaved && <span className="text-xs text-green-600 mt-1">Salvo!</span>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="text" value={profile?.email || ''} disabled
              className="input-field bg-gray-50 text-gray-500 cursor-not-allowed" />
            <p className="text-xs text-gray-400 mt-1">O email só pode ser alterado por um administrador.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Setor</label>
            <input type="text"
              value={profile?.setores ? `${profile.setores.codigo} — ${profile.setores.nome_completo}` : 'Sem setor'}
              disabled
              className="input-field bg-gray-50 text-gray-500 cursor-not-allowed" />
          </div>
        </div>
      </div>
    </div>
  )
}
