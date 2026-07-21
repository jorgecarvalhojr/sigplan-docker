'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, X, MessageSquare, Users, FileEdit, Save, ChevronDown, ChevronUp, ExternalLink, Settings, History, Building2, Plus, AlertTriangle, ArrowRight, Edit3, Trash2, ClipboardList, Loader2 } from 'lucide-react'
import { STATUS_CONFIG, BLOCO_LABELS } from '@/lib/utils'
import type { Profile } from '@/lib/types'

type AdminTab = 'observacoes' | 'conteudo' | 'usuarios' | 'setores' | 'config' | 'solicitacoes' | 'log'

// Tabs acessíveis pelo perfil master (gestão de projetos)
const MASTER_TABS: AdminTab[] = ['usuarios', 'config', 'solicitacoes', 'log']

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('observacoes')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function check() {
      const res = await fetch('/api/auth/session')
      if (!res.ok) { router.push('/login'); return }
      const session = await res.json()
      const user = session.user

      const profileRes = await fetch('/api/dados/perfil')
      if (!profileRes.ok) { router.push('/login'); return }
      const data = await profileRes.json()

      if (!data || (data.role !== 'admin' && data.role !== 'master')) { router.push('/dashboard'); return }
      setProfile(data)
      // Master inicia na tab solicitações
      if (data.role === 'master') setTab('solicitacoes')
      setLoading(false)
    }
    check()
  }, [])

  if (loading) return <div className="flex justify-center py-20"><div className="animate-pulse text-sedec-500">Carregando...</div></div>

  const isMaster = profile?.role === 'master'

  const allTabs = [
    { key: 'observacoes' as const, label: 'Observações', icon: MessageSquare },
    { key: 'conteudo' as const, label: 'Editar Conteúdo', icon: FileEdit },
    { key: 'usuarios' as const, label: 'Usuários', icon: Users },
    { key: 'setores' as const, label: 'Setores', icon: Building2 },
    { key: 'config' as const, label: 'Configurações', icon: Settings },
    { key: 'solicitacoes' as const, label: 'Solicitações', icon: ClipboardList },
    { key: 'log' as const, label: 'Log de Alterações', icon: History },
  ]

  // Master só vê tabs de configurações de projetos e log
  const tabs = isMaster ? allTabs.filter(t => MASTER_TABS.includes(t.key)) : allTabs

  return (
    <div>
      <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-sm text-sedec-500 hover:text-sedec-700 mb-4">
        <ArrowLeft size={16} /> Voltar ao painel
      </button>

      <h1 className="text-2xl font-bold text-gray-800 mb-6">Administração</h1>

      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-sedec-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'observacoes' && <ObservacoesAdmin />}
      {tab === 'conteudo' && <ConteudoAdmin />}
      {tab === 'usuarios' && <UsuariosAdmin isMaster={isMaster} adminProfile={profile} />}
      {tab === 'setores' && <SetoresAdmin />}
      {tab === 'config' && <ConfiguracoesAdmin isMaster={isMaster} />}
      {tab === 'solicitacoes' && <SolicitacoesAdmin />}
      {tab === 'log' && <AuditLogAdmin />}
    </div>
  )
}

// ============================================================
// OBSERVAÇÕES
// ============================================================

function ObservacoesAdmin() {
  const [obs, setObs] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState('em_analise')
  const [blocoFilter, setBlocoFilter] = useState('')
  const [resposta, setResposta] = useState<Record<number, string>>({})
  const [updating, setUpdating] = useState<number | null>(null)

  useEffect(() => { loadObs() }, [statusFilter, blocoFilter])

  async function loadObs() {
    const params = new URLSearchParams({ type: 'observacoes' })
    if (statusFilter) params.append('status', statusFilter)
    if (blocoFilter) params.append('bloco', blocoFilter)
    
    const res = await fetch(`/api/admin?${params.toString()}`)
    if (res.ok) {
      const data = await res.json()
      setObs(data.map((o: any) => ({
        ...o,
        acoes_estrategicas: { numero: o.acao_numero, nome: o.acao_nome }
      })))
    }
  }

  async function updateStatus(id: number, status: string) {
    setUpdating(id)
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_obs',
        payload: { id, status, resposta_admin: resposta[id] || null }
      })
    })

    if (!res.ok) {
      const error = await res.json()
      alert(`Erro: ${error.error}`)
    }

    setUpdating(null)
    loadObs()
  }

  return (
    <div>
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-gray-500 font-medium">Status:</span>
          {(['em_analise', 'absorvida', 'indeferida', ''] as const).map(s => (
            <button key={s || 'all'} onClick={() => setStatusFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${statusFilter === s
                ? 'bg-sedec-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {s ? STATUS_CONFIG[s]?.label : 'Todas'}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-500 font-medium">Bloco:</span>
          <button onClick={() => setBlocoFilter('')}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${!blocoFilter
              ? 'bg-sedec-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            Todos
          </button>
          {Object.entries(BLOCO_LABELS).map(([key, label]) => (
            <button key={key} onClick={() => setBlocoFilter(key)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${blocoFilter === key
                ? 'bg-sedec-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {label.length > 20 ? label.substring(0, 20) + '…' : label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-3">{obs.length} observação(ões)</p>

      <div className="space-y-3">
        {obs.map(o => {
          const st = STATUS_CONFIG[o.status] || STATUS_CONFIG.em_analise
          return (
            <div key={o.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-sedec-600">AE {o.acoes_estrategicas.numero}</span>
                    <span className="text-xs bg-sedec-50 text-sedec-600 px-2 py-0.5 rounded-full font-medium">
                      {BLOCO_LABELS[o.bloco] || o.bloco}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{o.acoes_estrategicas.nome}</p>
                </div>
                <span className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${st.bg} ${st.color}`}>
                  {st.label}
                </span>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 mb-3 text-sm text-gray-700">{o.conteudo}</div>

              <div className="flex items-center gap-2 text-xs text-gray-400 mb-3 flex-wrap">
                <span className="font-medium text-gray-500">{o.autor_nome}</span>
                {o.autor_setor && <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-500">{o.autor_setor}</span>}
                <span>•</span>
                <span>{new Date(o.created_at).toLocaleDateString('pt-BR')} às {new Date(o.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              {o.status === 'em_analise' && (
                <div className="border-t border-gray-100 pt-3">
                  <textarea value={resposta[o.id] || ''}
                    onChange={e => setResposta(prev => ({ ...prev, [o.id]: e.target.value }))}
                    placeholder="Resposta (opcional)..."
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none mb-2" rows={2} />
                  <div className="flex gap-2">
                    <button onClick={() => updateStatus(o.id, 'absorvida')} disabled={updating === o.id}
                      className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg font-medium hover:bg-green-200">
                      <Check size={14} /> Absorver
                    </button>
                    <button onClick={() => updateStatus(o.id, 'indeferida')} disabled={updating === o.id}
                      className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg font-medium hover:bg-red-200">
                      <X size={14} /> Indeferir
                    </button>
                  </div>
                </div>
              )}

              {o.resposta_admin && (
                <div className="mt-2 bg-blue-50 rounded-lg p-3 text-sm text-blue-700 italic">
                  <span className="font-medium">Resposta: </span>{o.resposta_admin}
                </div>
              )}
            </div>
          )
        })}
        {obs.length === 0 && <p className="text-center text-gray-400 py-8">Nenhuma observação encontrada.</p>}
      </div>
    </div>
  )
}

// ============================================================
// EDIÇÃO DE CONTEÚDO
// ============================================================

function ConteudoAdmin() {
  const [acoes, setAcoes] = useState<any[]>([])
  const [selectedAcao, setSelectedAcao] = useState<any>(null)
  const [editData, setEditData] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null)
  const [destaque, setDestaque] = useState<any>(null)
  const [destaqueLinhas, setDestaqueLinhas] = useState<any[]>([])
  const [panoramico, setPanoramico] = useState<any[]>([])
  const [fichas, setFichas] = useState<any[]>([])
  const [fundamentacao, setFundamentacao] = useState<any>(null)
  const [fundItens, setFundItens] = useState<any[]>([])
  const [setoresList, setSetoresList] = useState<any[]>([])
  const [panSetores, setPanSetores] = useState<Record<number, any[]>>({})  // panoramico_linha_id → [{id, setor_id, tipo_participacao}]
  const [fichaSetores, setFichaSetores] = useState<Record<number, any[]>>({})  // ficha_id → [{id, setor_id, tipo_participacao}]
  const router = useRouter()

  useEffect(() => {
    fetch('/api/admin/conteudo').then(res => res.json()).then(data => { if (Array.isArray(data)) setAcoes(data) })
    fetch('/api/admin?type=setores').then(res => res.json()).then(data => { if (Array.isArray(data)) setSetoresList(data) })
  }, [])

  async function selectAcao(acao: any) {
    setSelectedAcao(acao)
    setExpandedBlock(null)
    setSaved(null)

    const res = await fetch(`/api/admin/conteudo?acaoId=${acao.id}`)
    if (res.ok) {
      const data = await res.json()
      const { acao: full, destaque: destData, destaqueLinhas: linhas, panoramico: panData, panSetores: psData, fichas: fichasData, fichaSetores: fsData, fundamentacao: fundData, fundItens: itens } = data
      
      setEditData({
        descricao_o_que: full.descricao_o_que || '',
        descricao_para_que: full.descricao_para_que || '',
        ancoragem: full.ancoragem || '',
        nota_arranjo_institucional: full.nota_arranjo_institucional || '',
      })

      setDestaque(destData)
      setDestaqueLinhas(linhas || [])
      setPanoramico(panData || [])

      const psMap: Record<number, any[]> = {}
      panData?.forEach((p: any) => { psMap[p.id] = [] })
      psData?.forEach((ps: any) => { if (psMap[ps.panoramico_linha_id]) psMap[ps.panoramico_linha_id].push(ps) })
      setPanSetores(psMap)

      setFichas(fichasData || [])
      const fsMap: Record<number, any[]> = {}
      fichasData?.forEach((f: any) => { fsMap[f.id] = [] })
      fsData?.forEach((fs: any) => { if (fsMap[fs.ficha_id]) fsMap[fs.ficha_id].push(fs) })
      setFichaSetores(fsMap)

      setFundamentacao(fundData)
      setFundItens(itens || [])
    }
  }

  async function saveField(field: string) {
    if (!selectedAcao) return
    setSaving(field)
    const res = await fetch('/api/admin/conteudo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_acao_field',
        payload: { id: selectedAcao.id, field, value: editData[field] || null }
      })
    })
    if (!res.ok) {
      const error = await res.json()
      alert(`Erro: ${error.error}`)
    } else {
      setSaved(field); setTimeout(() => setSaved(null), 2500)
    }
    setSaving(null)
  }

  async function saveDestaqueLinha(id: number) {
    const item = destaqueLinhas.find(x => x.id === id)
    if (!item) return
    const key = `dl-${id}`
    setSaving(key)
    const res = await fetch('/api/admin/conteudo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_destaque_linha',
        payload: { id, conteudo: item.conteudo }
      })
    })
    if (!res.ok) {
      const error = await res.json()
      alert(`Erro: ${error.error}`)
    } else {
      setSaved(key); setTimeout(() => setSaved(null), 2500)
    }
    setSaving(null)
  }

  async function savePanoramicoLinha(id: number) {
    const item = panoramico.find(x => x.id === id)
    if (!item) return
    const key = `pan-${id}`
    setSaving(key)
    const res = await fetch('/api/admin/conteudo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_panoramico_linha',
        payload: item
      })
    })
    if (!res.ok) {
      const error = await res.json()
      alert(`Erro: ${error.error}`)
    } else {
      setSaved(key); setTimeout(() => setSaved(null), 2500)
    }
    setSaving(null)
  }

  async function saveFichaField(fichaId: number, field: string) {
    const item = fichas.find(x => x.id === fichaId)
    if (!item) return
    const key = `f-${fichaId}-${field}`
    setSaving(key)
    // Limpa linhas vazias dos campos array antes de salvar
    let value = item[field]
    if (Array.isArray(value)) {
      value = value.filter((l: string) => l.trim())
      setFichas(prev => prev.map(x => x.id === fichaId ? { ...x, [field]: value } : x))
    }
    const res = await fetch('/api/admin/conteudo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_ficha_field',
        payload: { id: fichaId, field, value }
      })
    })
    if (!res.ok) {
      const error = await res.json()
      alert(`Erro: ${error.error}`)
    } else {
      setSaved(key); setTimeout(() => setSaved(null), 2500)
    }
    setSaving(null)
  }

  async function saveFund(field: string) {
    if (!fundamentacao) return
    const key = `fund-${field}`
    setSaving(key)
    const res = await fetch('/api/admin/conteudo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_fund_field',
        payload: { id: fundamentacao.id, field, value: fundamentacao[field] }
      })
    })
    if (!res.ok) {
      const error = await res.json()
      alert(`Erro: ${error.error}`)
    } else {
      setSaved(key); setTimeout(() => setSaved(null), 2500)
    }
    setSaving(null)
  }

  async function saveFundItem(id: number) {
    const item = fundItens.find(x => x.id === id)
    if (!item) return
    const key = `fi-${id}`
    setSaving(key)
    const res = await fetch('/api/admin/conteudo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_fund_item',
        payload: { id, conteudo: item.conteudo }
      })
    })
    if (!res.ok) {
      const error = await res.json()
      alert(`Erro: ${error.error}`)
    } else {
      setSaved(key); setTimeout(() => setSaved(null), 2500)
    }
    setSaving(null)
  }

  // ---- ADICIONAR / REMOVER PANORÂMICO ----

  async function addPanoramicoLinha() {
    if (!selectedAcao) return
    const maxOrdem = panoramico.reduce((m, p) => Math.max(m, p.ordem || 0), 0)
    const res = await fetch('/api/admin/conteudo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_panoramico_linha',
        payload: {
          acaoId: selectedAcao.id,
          ordem: maxOrdem + 1,
          setor_display: 'Novo Setor',
          papel: '',
          sintese_contribuicao: '',
          nao_faz: '',
        }
      })
    })
    if (res.ok) {
      const data = await res.json()
      setPanoramico(prev => [...prev, data])
    } else {
      const error = await res.json()
      alert(`Erro: ${error.error}`)
    }
  }

  async function deletePanoramicoLinha(id: number) {
    const item = panoramico.find(x => x.id === id)
    if (!confirm(`Remover "${item?.setor_display}" do quadro panorâmico?`)) return
    const res = await fetch('/api/admin/conteudo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_panoramico_linha', payload: { id } })
    })
    if (res.ok) {
      setPanoramico(prev => prev.filter(x => x.id !== id))
    } else {
      const error = await res.json()
      alert(`Erro: ${error.error}`)
    }
  }

  async function savePanoramicoMeta(id: number) {
    const item = panoramico.find(x => x.id === id)
    if (!item) return
    const key = `pan-meta-${id}`
    setSaving(key)
    const res = await fetch('/api/admin/conteudo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_panoramico_linha', payload: item })
    })
    if (res.ok) {
      setSaved(key); setTimeout(() => setSaved(null), 2500)
    } else {
      const error = await res.json()
      alert(`Erro: ${error.error}`)
    }
    setSaving(null)
  }

  // ---- ADICIONAR / REMOVER FICHAS ----

  async function addFicha() {
    if (!selectedAcao) return
    const maxOrdem = fichas.reduce((m, f) => Math.max(m, f.ordem || 0), 0)
    const res = await fetch('/api/admin/conteudo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_ficha',
        payload: {
          acaoId: selectedAcao.id,
          ordem: maxOrdem + 1,
          titulo: 'Nova Ficha — Setor',
          setor_display: 'Novo Setor',
          papel: '',
          justificativa: '',
          contribuicao_esperada: [],
          nao_escopo: [],
          dependencias_criticas: [],
        }
      })
    })
    if (res.ok) {
      const data = await res.json()
      setFichas(prev => [...prev, data])
    } else {
      const error = await res.json()
      alert(`Erro: ${error.error}`)
    }
  }

  async function deleteFicha(id: number) {
    const item = fichas.find(x => x.id === id)
    if (!confirm(`Remover ficha "${item?.titulo}"? Esta ação é permanente.`)) return
    const res = await fetch('/api/admin/conteudo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_ficha', payload: { id } })
    })
    if (res.ok) {
      setFichas(prev => prev.filter(x => x.id !== id))
    } else {
      const error = await res.json()
      alert(`Erro: ${error.error}`)
    }
  }

  async function saveFichaMeta(fichaId: number) {
    const item = fichas.find(x => x.id === fichaId)
    if (!item) return
    const key = `f-meta-${fichaId}`
    setSaving(key)
    const res = await fetch('/api/admin/conteudo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_ficha_meta',
        payload: { id: fichaId, titulo: item.titulo, setor_display: item.setor_display, papel: item.papel }
      })
    })
    if (res.ok) {
      setSaved(key); setTimeout(() => setSaved(null), 2500)
    } else {
      const error = await res.json()
      alert(`Erro: ${error.error}`)
    }
    setSaving(null)
  }

  // ---- VINCULAÇÕES N:N (panoramico_setores / ficha_setores) ----

  const TIPOS_PARTICIPACAO = [
    { value: 'principal', label: 'Principal' },
    { value: 'coordenador', label: 'Coordenador' },
    { value: 'participante', label: 'Participante' },
    { value: 'aval', label: 'Aval' },
    { value: 'superior', label: 'Superior' },
    { value: 'destaque', label: 'Destaque' },
  ]

  async function addPanSetor(panLinhaId: number, setorId: number, tipo: string) {
    const res = await fetch('/api/admin/conteudo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_pan_setor',
        payload: { panLinhaId, setorId, tipo }
      })
    })
    if (res.ok) {
      const data = await res.json()
      setPanSetores(prev => ({ ...prev, [panLinhaId]: [...(prev[panLinhaId] || []), data] }))
    } else {
      const error = await res.json()
      alert(`Erro: ${error.error}`)
    }
  }

  async function removePanSetor(panLinhaId: number, vinculoId: number) {
    const res = await fetch('/api/admin/conteudo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove_pan_setor', payload: { id: vinculoId } })
    })
    if (res.ok) {
      setPanSetores(prev => ({ ...prev, [panLinhaId]: (prev[panLinhaId] || []).filter(x => x.id !== vinculoId) }))
    } else {
      const error = await res.json()
      alert(`Erro: ${error.error}`)
    }
  }

  async function addFichaSetor(fichaId: number, setorId: number, tipo: string) {
    const res = await fetch('/api/admin/conteudo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_ficha_setor',
        payload: { fichaId, setorId, tipo }
      })
    })
    if (res.ok) {
      const data = await res.json()
      setFichaSetores(prev => ({ ...prev, [fichaId]: [...(prev[fichaId] || []), data] }))
    } else {
      const error = await res.json()
      alert(`Erro: ${error.error}`)
    }
  }

  async function removeFichaSetor(fichaId: number, vinculoId: number) {
    const res = await fetch('/api/admin/conteudo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove_ficha_setor', payload: { id: vinculoId } })
    })
    if (res.ok) {
      setFichaSetores(prev => ({ ...prev, [fichaId]: (prev[fichaId] || []).filter(x => x.id !== vinculoId) }))
    } else {
      const error = await res.json()
      alert(`Erro: ${error.error}`)
    }
  }

  function VinculoSetorManager({ vinculos, onAdd, onRemove }: {
    vinculos: any[]; onAdd: (setorId: number, tipo: string) => void; onRemove: (vinculoId: number) => void
  }) {
    const [addingSetor, setAddingSetor] = useState(false)
    const [newSetorId, setNewSetorId] = useState<number | ''>('')
    const [newTipo, setNewTipo] = useState('principal')

    return (
      <div className="mt-2 border-t border-dashed border-gray-200 pt-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-gray-400 uppercase font-medium">Vínculos para filtro por setor</span>
          {!addingSetor && (
            <button onClick={() => setAddingSetor(true)} className="text-[10px] text-orange-500 hover:text-orange-700 font-medium">+ Vínculo</button>
          )}
        </div>
        {vinculos.length === 0 && !addingSetor && (
          <p className="text-[10px] text-gray-300 italic">Nenhum vínculo — este setor não aparece nos filtros.</p>
        )}
        <div className="space-y-1">
          {vinculos.map(v => {
            const setor = setoresList.find(s => s.id === v.setor_id)
            return (
              <div key={v.id} className="flex items-center gap-2 text-xs bg-gray-50 rounded px-2 py-1">
                <span className="font-medium text-sedec-600">{setor?.codigo || `#${v.setor_id}`}</span>
                <span className="text-gray-400">—</span>
                <span className="text-gray-600">{v.tipo_participacao}</span>
                <button onClick={() => onRemove(v.id)} className="ml-auto text-gray-300 hover:text-red-500"><X size={12} /></button>
              </div>
            )
          })}
        </div>
        {addingSetor && (
          <div className="flex items-end gap-2 mt-1.5">
            <select value={newSetorId} onChange={e => setNewSetorId(parseInt(e.target.value) || '')}
              className="flex-1 text-xs px-2 py-1.5 border border-gray-200 rounded-lg">
              <option value="">Selecione setor...</option>
              {setoresList.map(s => <option key={s.id} value={s.id}>{s.codigo} — {s.nome_completo}</option>)}
            </select>
            <select value={newTipo} onChange={e => setNewTipo(e.target.value)}
              className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg">
              {TIPOS_PARTICIPACAO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <button onClick={() => { if (newSetorId) { onAdd(newSetorId as number, newTipo); setNewSetorId(''); setAddingSetor(false) } }}
              className="text-xs bg-green-500 text-white px-2.5 py-1.5 rounded-lg hover:bg-green-600">OK</button>
            <button onClick={() => setAddingSetor(false)} className="text-xs text-gray-400 px-2 py-1.5">Cancelar</button>
          </div>
        )}
      </div>
    )
  }

  function SaveBtn({ id, onClick }: { id: string; onClick: () => void }) {
    const isSaving = saving === id
    const isSaved = saved === id
    return (
      <button onClick={onClick} disabled={isSaving}
        className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
          isSaved ? 'bg-green-100 text-green-700' : 'bg-sedec-600 text-white hover:bg-sedec-700'
        } disabled:opacity-50`}>
        {isSaving ? '...' : isSaved ? <><Check size={12} /> Salvo!</> : <><Save size={12} /> Salvar</>}
      </button>
    )
  }

  function toggleBlock(k: string) { setExpandedBlock(expandedBlock === k ? null : k) }

  function BlockHeader({ id, label, count }: { id: string; label: string; count?: number }) {
    return (
      <button onClick={() => toggleBlock(id)}
        className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
        <span className="font-semibold text-gray-700 text-sm">
          {label} {count !== undefined && <span className="text-gray-400 font-normal">({count})</span>}
        </span>
        {expandedBlock === id ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>
    )
  }

  function arrayToText(arr: string[]) { return (arr || []).join('\n') }
  function textToArray(text: string) { return text.split('\n') }
  function textToArrayClean(text: string) { return text.split('\n').filter(l => l.trim()) }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-1">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden sticky top-24">
          <div className="p-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">Ações Estratégicas</h3>
          </div>
          <div className="max-h-[70vh] overflow-y-auto divide-y divide-gray-100">
            {acoes.map(a => (
              <button key={a.id} onClick={() => selectAcao(a)}
                className={`w-full text-left px-3 py-2.5 text-xs hover:bg-gray-50 ${
                  selectedAcao?.id === a.id ? 'bg-sedec-50 border-l-4 border-sedec-500' : ''
                }`}>
                <span className="font-bold text-sedec-600">AE {a.numero}</span>
                <p className="text-gray-500 line-clamp-1 mt-0.5">{a.nome}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="lg:col-span-3">
        {!selectedAcao ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            Selecione uma ação na lista para editar.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-sedec-600">AE {selectedAcao.numero}</h2>
                <p className="text-sm text-gray-500">{selectedAcao.nome}</p>
              </div>
              <button onClick={() => router.push(`/dashboard/acao/${selectedAcao.numero}`)}
                className="flex items-center gap-1 text-xs text-sedec-500 hover:text-sedec-700">
                <ExternalLink size={14} /> Ver página
              </button>
            </div>

            {/* Descrição */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <BlockHeader id="descricao" label="Descrição da Ação" />
              {expandedBlock === 'descricao' && (
                <div className="p-4 space-y-4 border-t border-gray-100">
                  <div>
                    <label className="text-xs font-bold text-blue-600 block mb-1">O QUÊ</label>
                    <textarea value={editData.descricao_o_que} onChange={e => setEditData(p => ({ ...p, descricao_o_que: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-y" rows={4} />
                    <div className="mt-2"><SaveBtn id="descricao_o_que" onClick={() => saveField('descricao_o_que')} /></div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-green-600 block mb-1">PARA QUÊ</label>
                    <textarea value={editData.descricao_para_que} onChange={e => setEditData(p => ({ ...p, descricao_para_que: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-y" rows={4} />
                    <div className="mt-2"><SaveBtn id="descricao_para_que" onClick={() => saveField('descricao_para_que')} /></div>
                  </div>
                </div>
              )}
            </div>

            {/* Ancoragem */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <BlockHeader id="ancoragem" label="Ancoragem Estratégica" />
              {expandedBlock === 'ancoragem' && (
                <div className="p-4 border-t border-gray-100">
                  <textarea value={editData.ancoragem} onChange={e => setEditData(p => ({ ...p, ancoragem: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-y" rows={10} />
                  <div className="mt-2"><SaveBtn id="ancoragem" onClick={() => saveField('ancoragem')} /></div>
                </div>
              )}
            </div>

            {/* Destaque */}
            {destaque && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <BlockHeader id="destaque" label="Destaque Estratégico" count={destaqueLinhas.length} />
                {expandedBlock === 'destaque' && (
                  <div className="p-4 space-y-3 border-t border-gray-100">
                    {destaqueLinhas.map(l => (
                      <div key={l.id} className="border border-gray-200 rounded-lg p-3">
                        <label className="text-xs font-bold text-sedec-600 block mb-1">{l.label || '(header)'}</label>
                        <textarea value={l.conteudo || ''} onChange={e => setDestaqueLinhas(prev => prev.map(x => x.id === l.id ? { ...x, conteudo: e.target.value } : x))}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-y" rows={3} />
                        <div className="mt-2"><SaveBtn id={`dl-${l.id}`} onClick={() => saveDestaqueLinha(l.id)} /></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Panorâmico */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <BlockHeader id="panoramico" label="Quadro Panorâmico" count={panoramico.length} />
                {expandedBlock === 'panoramico' && (
                  <div className="p-4 space-y-3 border-t border-gray-100">
                    {panoramico.map(p => (
                      <div key={p.id} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-gray-400 uppercase">Setor (display)</label>
                              <input type="text" value={p.setor_display || ''} onChange={e => setPanoramico(prev => prev.map(x => x.id === p.id ? { ...x, setor_display: e.target.value } : x))}
                                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg font-bold text-sedec-600" />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-400 uppercase">Papel</label>
                              <input type="text" value={p.papel || ''} onChange={e => setPanoramico(prev => prev.map(x => x.id === p.id ? { ...x, papel: e.target.value } : x))}
                                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg" />
                            </div>
                          </div>
                          <button onClick={() => deletePanoramicoLinha(p.id)} className="text-gray-300 hover:text-red-500 mt-4 shrink-0" title="Remover">
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <label className="text-xs text-gray-500">Síntese da Contribuição</label>
                            <textarea value={p.sintese_contribuicao || ''} onChange={e => setPanoramico(prev => prev.map(x => x.id === p.id ? { ...x, sintese_contribuicao: e.target.value } : x))}
                              className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg resize-y" rows={2} />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">NÃO faz</label>
                            <textarea value={p.nao_faz || ''} onChange={e => setPanoramico(prev => prev.map(x => x.id === p.id ? { ...x, nao_faz: e.target.value } : x))}
                              className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg resize-y" rows={2} />
                          </div>
                          <SaveBtn id={`pan-meta-${p.id}`} onClick={() => savePanoramicoMeta(p.id)} />
                          <VinculoSetorManager
                            vinculos={panSetores[p.id] || []}
                            onAdd={(setorId, tipo) => addPanSetor(p.id, setorId, tipo)}
                            onRemove={(vinculoId) => removePanSetor(p.id, vinculoId)}
                          />
                        </div>
                      </div>
                    ))}
                    <button onClick={addPanoramicoLinha}
                      className="flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-700 font-medium mt-2">
                      <Plus size={14} /> Adicionar setor ao quadro panorâmico
                    </button>
                  </div>
                )}
              </div>

            {/* Fichas */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <BlockHeader id="fichas" label="Fichas Detalhadas" count={fichas.length} />
                {expandedBlock === 'fichas' && (
                  <div className="p-4 space-y-3 border-t border-gray-100">
                    {fichas.map(f => (
                      <FichaEditor key={f.id} ficha={f} saving={saving} saved={saved}
                        onChange={(field, val) => setFichas(prev => prev.map(x => x.id === f.id ? { ...x, [field]: val } : x))}
                        onSave={(field) => saveFichaField(f.id, field)}
                        onSaveMeta={() => saveFichaMeta(f.id)}
                        onDelete={() => deleteFicha(f.id)}
                        vinculos={fichaSetores[f.id] || []}
                        onAddVinculo={(setorId, tipo) => addFichaSetor(f.id, setorId, tipo)}
                        onRemoveVinculo={(vinculoId) => removeFichaSetor(f.id, vinculoId)}
                        setoresList={setoresList}
                        SaveBtn={SaveBtn} arrayToText={arrayToText} textToArray={textToArray} />
                    ))}
                    <button onClick={addFicha}
                      className="flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-700 font-medium mt-2">
                      <Plus size={14} /> Adicionar ficha detalhada
                    </button>
                  </div>
                )}
              </div>

            {/* Fundamentação */}
            {fundamentacao && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <BlockHeader id="fundamentacao" label="Fundamentação" count={fundItens.length} />
                {expandedBlock === 'fundamentacao' && (
                  <div className="p-4 space-y-3 border-t border-gray-100">
                    <div>
                      <label className="text-xs font-medium text-gray-500">Introdução</label>
                      <textarea value={fundamentacao.introducao || ''} onChange={e => setFundamentacao((p: any) => ({ ...p, introducao: e.target.value }))}
                        className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg resize-y" rows={3} />
                      <div className="mt-2"><SaveBtn id="fund-introducao" onClick={() => saveFund('introducao')} /></div>
                    </div>
                    {fundItens.map(item => (
                      <div key={item.id} className="border border-gray-200 rounded-lg p-3">
                        <label className="text-xs font-medium text-gray-500">Item {item.ordem}</label>
                        <textarea value={item.conteudo} onChange={e => setFundItens(prev => prev.map(x => x.id === item.id ? { ...x, conteudo: e.target.value } : x))}
                          className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg resize-y" rows={3} />
                        <div className="mt-2"><SaveBtn id={`fi-${item.id}`} onClick={() => saveFundItem(item.id)} /></div>
                      </div>
                    ))}
                    <div>
                      <label className="text-xs font-medium text-gray-500">Conclusão</label>
                      <textarea value={fundamentacao.conclusao || ''} onChange={e => setFundamentacao((p: any) => ({ ...p, conclusao: e.target.value }))}
                        className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg resize-y" rows={3} />
                      <div className="mt-2"><SaveBtn id="fund-conclusao" onClick={() => saveFund('conclusao')} /></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Nota */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <BlockHeader id="nota" label="Nota sobre Arranjo Institucional" />
              {expandedBlock === 'nota' && (
                <div className="p-4 border-t border-gray-100">
                  <textarea value={editData.nota_arranjo_institucional} onChange={e => setEditData(p => ({ ...p, nota_arranjo_institucional: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-y" rows={6} />
                  <div className="mt-2 flex items-center gap-3">
                    <SaveBtn id="nota_arranjo_institucional" onClick={() => saveField('nota_arranjo_institucional')} />
                    <span className="text-xs text-gray-400">Deixe vazio se esta ação não possui nota.</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// EDITOR DE FICHA
// ============================================================

function FichaEditor({ ficha, saving, saved, onChange, onSave, onSaveMeta, onDelete, vinculos, onAddVinculo, onRemoveVinculo, setoresList, SaveBtn, arrayToText, textToArray }: {
  ficha: any; saving: string | null; saved: string | null
  onChange: (field: string, value: any) => void
  onSave: (field: string) => void
  onSaveMeta: () => void
  onDelete: () => void
  vinculos: any[]
  onAddVinculo: (setorId: number, tipo: string) => void
  onRemoveVinculo: (vinculoId: number) => void
  setoresList: any[]
  SaveBtn: any; arrayToText: (a: string[]) => string; textToArray: (t: string) => string[]
}) {
  const [open, setOpen] = useState(false)
  const [addingVinculo, setAddingVinculo] = useState(false)
  const [newSetorId, setNewSetorId] = useState<number | ''>('')
  const [newTipo, setNewTipo] = useState('principal')

  const TIPOS = [
    { value: 'principal', label: 'Principal' },
    { value: 'coordenador', label: 'Coordenador' },
    { value: 'participante', label: 'Participante' },
    { value: 'aval', label: 'Aval' },
    { value: 'superior', label: 'Superior' },
    { value: 'destaque', label: 'Destaque' },
  ]

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-sedec-50 px-4 py-3 flex items-center justify-between">
        <button onClick={() => setOpen(!open)}
          className="flex-1 flex items-center justify-between text-sm font-medium text-sedec-700 hover:text-sedec-800 text-left">
          <span>{ficha.titulo}</span>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <button onClick={onDelete} className="text-gray-300 hover:text-red-500 ml-2 shrink-0" title="Remover ficha">
          <Trash2 size={15} />
        </button>
      </div>
      {open && (
        <div className="p-4 space-y-4">
          {/* Meta: título, setor_display, papel */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-2 border border-dashed border-gray-300">
            <span className="text-[10px] text-gray-400 uppercase font-medium">Identificação da ficha</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-gray-400">Título</label>
                <input type="text" value={ficha.titulo || ''} onChange={e => onChange('titulo', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400">Setor (display)</label>
                <input type="text" value={ficha.setor_display || ''} onChange={e => onChange('setor_display', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg font-bold text-sedec-600" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400">Papel</label>
                <input type="text" value={ficha.papel || ''} onChange={e => onChange('papel', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg" />
              </div>
            </div>
            <SaveBtn id={`f-meta-${ficha.id}`} onClick={onSaveMeta} />
          </div>

          {/* Vínculos N:N para filtro */}
          <div className="bg-gray-50 rounded-lg p-3 border border-dashed border-gray-300">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-400 uppercase font-medium">Vínculos para filtro por setor</span>
              {!addingVinculo && (
                <button onClick={() => setAddingVinculo(true)} className="text-[10px] text-orange-500 hover:text-orange-700 font-medium">+ Vínculo</button>
              )}
            </div>
            {vinculos.length === 0 && !addingVinculo && (
              <p className="text-[10px] text-gray-300 italic">Nenhum vínculo — esta ficha não aparece nos filtros por setor.</p>
            )}
            <div className="space-y-1">
              {vinculos.map(v => {
                const setor = setoresList.find(s => s.id === v.setor_id)
                return (
                  <div key={v.id} className="flex items-center gap-2 text-xs bg-white rounded px-2 py-1 border border-gray-100">
                    <span className="font-medium text-sedec-600">{setor?.codigo || `#${v.setor_id}`}</span>
                    <span className="text-gray-400">—</span>
                    <span className="text-gray-600">{v.tipo_participacao}</span>
                    <button onClick={() => onRemoveVinculo(v.id)} className="ml-auto text-gray-300 hover:text-red-500"><X size={12} /></button>
                  </div>
                )
              })}
            </div>
            {addingVinculo && (
              <div className="flex items-end gap-2 mt-1.5">
                <select value={newSetorId} onChange={e => setNewSetorId(parseInt(e.target.value) || '')}
                  className="flex-1 text-xs px-2 py-1.5 border border-gray-200 rounded-lg">
                  <option value="">Selecione setor...</option>
                  {setoresList.map(s => <option key={s.id} value={s.id}>{s.codigo} — {s.nome_completo}</option>)}
                </select>
                <select value={newTipo} onChange={e => setNewTipo(e.target.value)}
                  className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg">
                  {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <button onClick={() => { if (newSetorId) { onAddVinculo(newSetorId as number, newTipo); setNewSetorId(''); setAddingVinculo(false) } }}
                  className="text-xs bg-green-500 text-white px-2.5 py-1.5 rounded-lg hover:bg-green-600">OK</button>
                <button onClick={() => setAddingVinculo(false)} className="text-xs text-gray-400 px-2 py-1.5">Cancelar</button>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500">Justificativa</label>
            <textarea value={ficha.justificativa || ''} onChange={e => onChange('justificativa', e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg resize-y" rows={4} />
            <div className="mt-1"><SaveBtn id={`f-${ficha.id}-justificativa`} onClick={() => onSave('justificativa')} /></div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Contribuição esperada <span className="text-gray-400">(um item por linha)</span></label>
            <textarea value={arrayToText(ficha.contribuicao_esperada)} onChange={e => onChange('contribuicao_esperada', textToArray(e.target.value))}
              className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg resize-y font-mono" rows={4} />
            <div className="mt-1"><SaveBtn id={`f-${ficha.id}-contribuicao_esperada`} onClick={() => onSave('contribuicao_esperada')} /></div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">NÃO-ESCOPO <span className="text-gray-400">(um item por linha)</span></label>
            <textarea value={arrayToText(ficha.nao_escopo)} onChange={e => onChange('nao_escopo', textToArray(e.target.value))}
              className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg resize-y font-mono" rows={3} />
            <div className="mt-1"><SaveBtn id={`f-${ficha.id}-nao_escopo`} onClick={() => onSave('nao_escopo')} /></div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Dependências críticas <span className="text-gray-400">(um item por linha)</span></label>
            <textarea value={arrayToText(ficha.dependencias_criticas)} onChange={e => onChange('dependencias_criticas', textToArray(e.target.value))}
              className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg resize-y font-mono" rows={3} />
            <div className="mt-1"><SaveBtn id={`f-${ficha.id}-dependencias_criticas`} onClick={() => onSave('dependencias_criticas')} /></div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// USUÁRIOS
// ============================================================

function UsuariosAdmin({ isMaster = false, adminProfile: profile }: { isMaster?: boolean; adminProfile?: Profile | null }) {
  const [users, setUsers] = useState<any[]>([])
  const [setores, setSetores] = useState<any[]>([])
  const [setoresCadastro, setSetoresCadastro] = useState<any[]>([])
  const [editingNome, setEditingNome] = useState<string | null>(null)
  const [editingEmail, setEditingEmail] = useState<string | null>(null)
  const [editNomeValue, setEditNomeValue] = useState('')
  const [editEmailValue, setEditEmailValue] = useState('')
  const [savingUser, setSavingUser] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin?type=usuarios').then(res => res.json()).then(data => { if (Array.isArray(data)) setUsers(data) })
    fetch('/api/admin?type=setores').then(res => res.json()).then(data => {
      if (Array.isArray(data)) {
        setSetores(data)
        setSetoresCadastro(data.filter((s: any) => s.visivel_cadastro))
      }
    })
  }, [])

  async function updateRole(userId: string, newRole: string) {
    if (newRole === 'usuario' || newRole === 'solicitante') {
      const roleLabel = newRole === 'usuario' ? 'Usuário' : 'Solicitante'
      if (!confirm(`Alterar perfil para '${roleLabel}' remove todas as permissões de edição. Confirma?`)) return
    }
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_user_role', payload: { userId, role: newRole } })
    })
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
    } else {
      const error = await res.json()
      alert(`Erro: ${error.error}`)
    }
  }

  async function updateSetor(userId: string, setorId: number | null) {
    const user = users.find(u => u.id === userId)
    if (!user) return
    const oldSetorId = user.setor_id
    if (oldSetorId === setorId) return

    const oldSetor = setores.find((s: any) => s.id === oldSetorId)
    const newSetor = setores.find((s: any) => s.id === setorId)
    const oldSetorCodigo = oldSetor?.codigo || 'Nenhum'
    const newSetorCodigo = newSetor?.codigo || 'Nenhum'

    try {
      const impactRes = await fetch(`/api/admin?type=user_setor_impact&userId=${userId}&oldSetorId=${oldSetorId}&newSetorId=${setorId}`)
      const impact = await impactRes.json()
      
      const { entregasCount, atividadesCount, projetosPerdeCount, projetosGanhaCount } = impact
      const hasImpact = entregasCount > 0 || atividadesCount > 0 || projetosPerdeCount > 0 || projetosGanhaCount > 0
      
      const impactoMsg = hasImpact
        ? `\n\nImpacto:\n- Perderá acesso a ${projetosPerdeCount} projetos como setor líder\n- Será removido como responsável de ${entregasCount} entregas (setor incompatível)\n- Será removido como responsável de ${atividadesCount} atividades (setor incompatível)\n- Ganhará acesso a ${projetosGanhaCount} projetos pelo novo setor\n\nOs vínculos incompatíveis serão removidos automaticamente. Confirma?`
        : '\n\nNenhum impacto identificado em projetos ou entregas. Confirma?'

      if (!confirm(`Trocar setor de ${user.nome || 'usuário'} de ${oldSetorCodigo} para ${newSetorCodigo}?${impactoMsg}`)) return

      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_user_setor', payload: { userId, setorId } })
      })

      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, setor_id: setorId } : u))
      } else {
        const error = await res.json()
        alert(`Erro: ${error.error}`)
      }
    } catch (err) {
      console.error(err)
      alert('Erro ao verificar impacto ou salvar alteração.')
    }
  }

  async function saveNome(userId: string) {
    if (!editNomeValue.trim()) return
    setSavingUser(userId)
    const res = await fetch('/api/admin/update-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, nome: editNomeValue.trim() }),
    })
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, nome: editNomeValue.trim() } : u))
      setEditingNome(null)
    } else {
      const data = await res.json()
      alert(`Erro: ${data.error}`)
    }
    setSavingUser(null)
  }

  async function saveEmail(userId: string) {
    if (!editEmailValue.trim()) return
    setSavingUser(userId)
    const res = await fetch('/api/admin/update-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, email: editEmailValue.trim() }),
    })
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, email: editEmailValue.trim() } : u))
      setEditingEmail(null)
    } else {
      const data = await res.json()
      alert(`Erro: ${data.error}`)
    }
    setSavingUser(null)
  }


  async function handleDeleteUser(userId: string) {
    setSavingUser(userId)
    const res = await fetch('/api/admin/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    if (res.ok) {
      setUsers(prev => prev.filter(u => u.id !== userId))
      setDeleteConfirm(null)
    } else {
      const data = await res.json()
      alert(`Erro: ${data.error}`)
    }
    setSavingUser(null)
  }

  const pendingSolicitantes = users.filter(u => u.role === 'solicitante').length

  return (
    <div className="space-y-3">
      {pendingSolicitantes > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 flex items-center gap-2">
          <span className="bg-yellow-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">{pendingSolicitantes}</span>
          <span className="text-sm text-yellow-800 font-medium">cadastro(s) aguardando aprovação</span>
          <span className="text-xs text-yellow-600 ml-1">— altere o perfil para aprovar o acesso</span>
        </div>
      )}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left font-medium text-gray-600">Nome</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Setor</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Perfil</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map(u => (
              <tr key={u.id} className={`hover:bg-gray-50 ${u.role === 'solicitante' ? 'bg-yellow-50/50' : ''}`}>
                <td className="px-4 py-3">
                  {u.role === 'solicitante' && u.perfil_solicitado && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium mb-0.5 inline-block ${
                      u.perfil_solicitado === 'gestor' ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-gray-50 text-gray-500 border border-gray-200'
                    }`}>
                      Solicitou: {u.perfil_solicitado === 'gestor' ? 'Gestor' : 'Usuário'}
                    </span>
                  )}
                  {(isMaster && (u.role === 'admin' || u.role === 'master')) ? (
                    <span className="font-medium text-gray-800 text-left">{u.nome}</span>
                  ) : editingNome === u.id ? (
                    <div className="flex items-center gap-1">
                      <input type="text" value={editNomeValue} onChange={e => setEditNomeValue(e.target.value)}
                        className="text-xs border border-gray-300 rounded px-2 py-1 w-36"
                        onKeyDown={e => { if (e.key === 'Enter') saveNome(u.id); if (e.key === 'Escape') setEditingNome(null) }}
                        autoFocus />
                      <button onClick={() => saveNome(u.id)} disabled={savingUser === u.id}
                        className="text-xs text-green-600 hover:text-green-800 font-medium">OK</button>
                      <button onClick={() => setEditingNome(null)}
                        className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditingNome(u.id); setEditNomeValue(u.nome) }}
                      className="font-medium text-gray-800 hover:text-sedec-500 text-left" title="Clique para editar">
                      {u.nome}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingEmail === u.id ? (
                    <div className="flex items-center gap-1">
                      <input type="email" value={editEmailValue} onChange={e => setEditEmailValue(e.target.value)}
                        className="text-xs border border-gray-300 rounded px-2 py-1 w-48"
                        onKeyDown={e => { if (e.key === 'Enter') saveEmail(u.id); if (e.key === 'Escape') setEditingEmail(null) }}
                        autoFocus />
                      <button onClick={() => saveEmail(u.id)} disabled={savingUser === u.id}
                        className="text-xs text-green-600 hover:text-green-800 font-medium">OK</button>
                      <button onClick={() => setEditingEmail(null)}
                        className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditingEmail(u.id); setEditEmailValue(u.email) }}
                      className="text-gray-500 hover:text-sedec-500 text-left" title="Clique para editar">
                      {u.email}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  {u.role === 'admin' ? (
                    <span className="text-xs text-gray-400">—</span>
                  ) : (
                    <select disabled={isMaster && (u.role === 'admin' || u.role === 'master')} value={u.setor_id || ''} onChange={e => updateSetor(u.id, e.target.value ? Number(e.target.value) : null)}
                      className="text-xs border border-gray-200 rounded px-2 py-1 disabled:opacity-75 disabled:bg-gray-50">
                      <option value="">Sem setor</option>
                      {setoresCadastro.map(s => <option key={s.id} value={s.id}>{s.codigo}</option>)}
                    </select>
                  )}
                </td>
                <td className="px-4 py-3">
                  <select disabled={isMaster && (u.role === 'admin' || u.role === 'master')} value={u.role} onChange={e => updateRole(u.id, e.target.value)}
                    className={`text-xs font-medium rounded px-2 py-1 border disabled:opacity-75 ${
                      u.role === 'admin' ? 'bg-purple-50 border-purple-200 text-purple-700' :
                      u.role === 'master' ? 'bg-orange-50 border-orange-200 text-orange-700' :
                      u.role === 'gestor' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                      u.role === 'solicitante' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' :
                      'bg-gray-50 border-gray-200 text-gray-600'
                    }`}>
                    <option value="solicitante">Solicitante</option>
                    <option value="usuario">Usuário</option>
                    <option value="gestor">Gestor</option>
                    {!isMaster && <option value="master">Master</option>}
                    {!isMaster && <option value="admin">Admin</option>}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1.5 items-start">
                    {/* Excluir usuário */}
                    {(!isMaster || (u.role !== 'admin' && u.role !== 'master')) && (deleteConfirm === u.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-500">Excluir?</span>
                        <button onClick={() => handleDeleteUser(u.id)} disabled={savingUser === u.id}
                          className="text-[10px] text-red-600 hover:text-red-800 font-medium flex items-center gap-1">
                          <Trash2 size={10} /> {savingUser === u.id ? '...' : 'Sim'}
                        </button>
                        <button onClick={() => setDeleteConfirm(null)}
                          className="text-[10px] text-gray-400 hover:text-gray-600">Não</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(u.id)}
                        className="text-[10px] text-gray-400 hover:text-red-600 font-medium whitespace-nowrap flex items-center gap-1">
                        <Trash2 size={12} /> Excluir usuário
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  )
}

// ============================================================
// CONFIGURAÇÕES
// ============================================================

function ConfiguracoesAdmin({ isMaster = false }: { isMaster?: boolean }) {
  const [configs, setConfigs] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin?type=config').then(res => res.json()).then(data => {
      if (Array.isArray(data)) {
        const map: Record<string, string> = {}
        data.forEach((c: any) => { map[c.chave] = c.valor })
        setConfigs(map)
      }
    })
  }, [])

  async function toggle(chave: string) {
    const novoValor = configs[chave] === 'true' ? 'false' : 'true'
    setSaving(chave)

    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_config', payload: { chave, valor: novoValor } })
    })

    if (res.ok) {
      setConfigs(prev => ({ ...prev, [chave]: novoValor }))
      setSaved(chave)
      setTimeout(() => setSaved(null), 2000)
    } else {
      const error = await res.json()
      alert(`Erro: ${error.error}`)
    }
    setSaving(null)
  }

  const items = [
    {
      grupo: 'Observações',
      adminOnly: true,
      toggles: [
        {
          chave: 'obs_permitir_criacao',
          titulo: 'Permitir criação de observações',
          descricao: 'Quando desligado, usuários não conseguem submeter novas observações em nenhuma ação. Observações existentes permanecem visíveis conforme a configuração abaixo.',
          ligado: 'Usuários podem criar observações',
          desligado: 'Criação de observações bloqueada',
        },
        {
          chave: 'obs_exibir_para_usuarios',
          titulo: 'Exibir observações na visualização',
          descricao: 'Quando desligado, as observações não aparecem na tela de detalhe da ação para usuários comuns. Admins continuam vendo tudo na área administrativa.',
          ligado: 'Observações visíveis para todos',
          desligado: 'Observações ocultas para usuários',
        },
      ],
    },
    {
      grupo: 'Módulo de Projetos — Projetos e Entregas',
      toggles: [
        {
          chave: 'proj_permitir_cadastro',
          titulo: 'Permitir cadastro de projetos/entregas',
          descricao: 'Quando desligado, apenas administradores podem criar novos projetos e entregas. Gestores ficam somente com visualização.',
          ligado: 'Gestores podem cadastrar',
          desligado: 'Só admin pode cadastrar',
        },
        {
          chave: 'proj_permitir_edicao',
          titulo: 'Permitir edição/exclusão de projetos/entregas',
          descricao: 'Quando desligado, apenas administradores podem editar ou excluir projetos e entregas. Gestores ficam somente com visualização.',
          ligado: 'Gestores podem editar/excluir',
          desligado: 'Só admin pode editar/excluir',
        },
        {
          chave: 'proj_permitir_edicao_datas',
          titulo: 'Permitir edição de quinzenas das entregas',
          descricao: 'Quando desligado, as quinzenas das entregas ficam travadas para gestores, mesmo que a edição geral esteja habilitada. Admins sempre podem alterar.',
          ligado: 'Gestores podem alterar quinzenas',
          desligado: 'Quinzenas travadas para gestores',
        },
      ],
    },
    {
      grupo: 'Módulo de Projetos — Atividades',
      toggles: [
        {
          chave: 'proj_permitir_cadastro_atividades',
          titulo: 'Permitir cadastro de atividades',
          descricao: 'Quando desligado, apenas administradores podem criar novas atividades. Gestores ficam somente com visualização.',
          ligado: 'Gestores podem cadastrar atividades',
          desligado: 'Só admin pode cadastrar atividades',
        },
        {
          chave: 'proj_permitir_edicao_atividades',
          titulo: 'Permitir edição/exclusão de atividades',
          descricao: 'Quando desligado, apenas administradores podem editar ou excluir atividades. Gestores ficam somente com visualização.',
          ligado: 'Gestores podem editar/excluir atividades',
          desligado: 'Só admin pode editar/excluir atividades',
        },
        {
          chave: 'proj_permitir_edicao_datas_atividades',
          titulo: 'Permitir edição de datas das atividades',
          descricao: 'Quando desligado, as datas das atividades ficam travadas para gestores, mesmo que a edição geral esteja habilitada. Admins sempre podem alterar.',
          ligado: 'Gestores podem alterar datas',
          desligado: 'Datas travadas para gestores',
        },
      ],
    },
    {
      grupo: 'Módulo de Projetos — Fluxo de Aprovação',
      toggles: [
        {
          chave: 'proj_exigir_aprovacao_edicao',
          titulo: 'Exigir aprovação para edições/exclusões de gestores',
          descricao: 'Quando ligado, as edições e exclusões feitas por gestores ficam pendentes de aprovação pelo Gabinete de Gestão de Projetos. Quando desligado, gestores podem editar/excluir diretamente sem enviar solicitação.',
          ligado: 'Gestores precisam de aprovação',
          desligado: 'Gestores editam/excluem diretamente',
        },
      ],
    },
  ]

  // Master só vê configurações do módulo de projetos; itens adminOnly ficam ocultos para master
  const visibleItems = isMaster
    ? items.filter(g => g.grupo.startsWith('Módulo de Projetos'))
    : items.filter(g => !(g as any).adminOnly || !isMaster)

  return (
    <div className="max-w-2xl">
      {visibleItems.map(group => (
        <div key={group.grupo} className="mb-8">
          <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">{group.grupo}</h3>
          <div className="space-y-4">
            {group.toggles.map(item => {
              const ativo = configs[item.chave] === 'true'
              const isSaving = saving === item.chave
              const isSaved = saved === item.chave

              return (
                <div key={item.chave} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-800">{item.titulo}</h3>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.descricao}</p>
                      <div className="mt-2">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                          ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${ativo ? 'bg-green-500' : 'bg-red-500'}`} />
                          {ativo ? item.ligado : item.desligado}
                        </span>
                        {isSaved && <span className="text-xs text-green-600 ml-2">Salvo!</span>}
                      </div>
                    </div>

                    <button
                      onClick={() => toggle(item.chave)}
                      disabled={isSaving}
                      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out disabled:opacity-50 ${
                        ativo ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                      role="switch"
                      aria-checked={ativo}
                    >
                      <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        ativo ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-xs text-amber-700 leading-relaxed">
          <span className="font-semibold">Nota:</span> Estas configurações têm efeito imediato. 
          Usuários que estiverem com a página aberta verão a mudança ao navegar para outra página ou recarregar.
        </p>
      </div>
    </div>
  )
}

// ============================================================
// GESTÃO DE SETORES
// ============================================================

interface SetorRow {
  id: number
  codigo: string
  nome_completo: string
  created_at: string
  _deps?: { profiles: number; projetos: number; entrega_participantes: number; atividade_participantes: number; panoramico_setores: number; ficha_setores: number; total: number }
}

function SetoresAdmin() {
  const [setores, setSetores] = useState<SetorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Formulário de criação/edição
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formCodigo, setFormCodigo] = useState('')
  const [formNome, setFormNome] = useState('')

  // Modal de exclusão
  const [deleteTarget, setDeleteTarget] = useState<SetorRow | null>(null)
  const [transferToId, setTransferToId] = useState<string>('')
  const [checkingDeps, setCheckingDeps] = useState(false)

  useEffect(() => { loadSetores() }, [])

  async function loadSetores() {
    setLoading(true)
    const res = await fetch('/api/admin?type=setores')
    const data = await res.json()
    if (Array.isArray(data)) {
      // Carrega dependências para cada setor
      const withDeps = await Promise.all(data.map(async (s: any) => {
        const depRes = await fetch(`/api/admin?type=setores_deps&id=${s.id}`)
        const deps = await depRes.json()
        return { ...s, _deps: deps }
      }))
      setSetores(withDeps)
    }
    setLoading(false)
  }

  function startCreate() {
    setEditingId(null)
    setFormCodigo('')
    setFormNome('')
    setShowForm(true)
  }

  function startEdit(s: SetorRow) {
    setEditingId(s.id)
    setFormCodigo(s.codigo)
    setFormNome(s.nome_completo)
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setFormCodigo('')
    setFormNome('')
  }

  async function saveSetor() {
    if (!formCodigo.trim() || !formNome.trim()) {
      alert('Código e nome são obrigatórios.')
      return
    }

    setSaving(true)

    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save_setor',
        payload: { id: editingId, codigo: formCodigo.trim().toUpperCase(), nome_completo: formNome.trim() }
      })
    })

    if (res.ok) {
      setSaving(false)
      cancelForm()
      loadSetores()
    } else {
      const error = await res.json()
      alert(`Erro ao salvar: ${error.error}`)
      setSaving(false)
    }
  }

  async function startDelete(s: SetorRow) {
    setDeleteTarget(s)
    setTransferToId('')
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const deps = deleteTarget._deps

    if (deps && deps.total > 0 && !transferToId) {
      alert('Este setor possui dependências. Selecione um setor de destino para transferi-las.')
      return
    }

    setSaving(true)

    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete_setor',
        payload: { id: deleteTarget.id, transferToId: transferToId ? parseInt(transferToId) : null }
      })
    })

    if (res.ok) {
      setSaving(false)
      setDeleteTarget(null)
      loadSetores()
    } else {
      const error = await res.json()
      alert(`Erro ao excluir: ${error.error}`)
      setSaving(false)
    }
  }

  const depLabels: Record<string, string> = {
    profiles: 'Usuários vinculados',
    projetos: 'Projetos como líder',
    entrega_participantes: 'Participações em entregas',
    atividade_participantes: 'Participações em atividades',
    panoramico_setores: 'Quadros panorâmicos',
    ficha_setores: 'Fichas de enquadramento',
  }

  if (loading) return <div className="animate-pulse text-sedec-500 py-8 text-center">Carregando setores...</div>

  return (
    <div className="max-w-4xl">
      {/* Header + botão novo */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{setores.length} setor(es) cadastrado(s)</p>
        <button onClick={startCreate}
          className="flex items-center gap-1.5 text-sm bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg font-medium transition-colors">
          <Plus size={16} /> Novo setor
        </button>
      </div>

      {/* Formulário de criação/edição */}
      {showForm && (
        <div className="bg-blue-50 border border-blue-300 rounded-xl p-4 mb-4 space-y-3">
          <h3 className="text-sm font-bold text-gray-700">
            {editingId ? 'Editar setor' : 'Novo setor'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Código (sigla)</label>
              <input type="text" value={formCodigo}
                onChange={e => setFormCodigo(e.target.value.toUpperCase())}
                placeholder="Ex: ICTDEC"
                className="input-field text-sm uppercase" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-gray-500 block mb-1">Nome completo</label>
              <input type="text" value={formNome}
                onChange={e => setFormNome(e.target.value)}
                placeholder="Ex: Instituto Científico e Tecnológico de Defesa Civil"
                className="input-field text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={saveSetor} disabled={saving}
              className="flex items-center gap-1 text-xs bg-green-500 text-white px-3 py-1.5 rounded-lg font-medium disabled:opacity-50">
              <Save size={13} /> {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={cancelForm}
              className="flex items-center gap-1 text-xs text-gray-500 px-3 py-1.5">
              <X size={13} /> Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista de setores */}
      <div className="space-y-2">
        {setores.map(s => {
          const deps = s._deps
          const hasDeps = deps && deps.total > 0
          return (
            <div key={s.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-sedec-600">{s.codigo}</span>
                    <span className="text-sm text-gray-700">{s.nome_completo}</span>
                  </div>
                  {/* Dependências */}
                  {hasDeps && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Object.entries(depLabels).map(([key, label]) => {
                        const count = (deps as any)[key]
                        if (!count || count === 0) return null
                        return (
                          <span key={key} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            {label}: <span className="font-bold">{count}</span>
                          </span>
                        )
                      })}
                    </div>
                  )}
                  {!hasDeps && (
                    <span className="text-[10px] text-gray-400 mt-1 block">Sem dependências — pode ser excluído livremente</span>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => startEdit(s)} className="text-gray-400 hover:text-orange-500 p-1" title="Editar">
                    <Edit3 size={15} />
                  </button>
                  <button onClick={() => startDelete(s)} className="text-gray-400 hover:text-red-500 p-1" title="Excluir">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal de exclusão */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center gap-2 text-red-600 mb-4">
              <AlertTriangle size={20} />
              <h3 className="text-lg font-bold">Excluir setor</h3>
            </div>

            <p className="text-sm text-gray-700 mb-2">
              Você está prestes a excluir o setor <span className="font-bold">{deleteTarget.codigo}</span> ({deleteTarget.nome_completo}).
            </p>

            {deleteTarget._deps && deleteTarget._deps.total > 0 ? (
              <div className="space-y-3">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs font-bold text-amber-700 mb-2 flex items-center gap-1">
                    <AlertTriangle size={13} /> Este setor possui {deleteTarget._deps.total} dependência(s):
                  </p>
                  <div className="space-y-1">
                    {Object.entries(depLabels).map(([key, label]) => {
                      const count = (deleteTarget._deps as any)?.[key]
                      if (!count || count === 0) return null
                      return (
                        <div key={key} className="text-xs text-amber-800 flex justify-between">
                          <span>{label}</span>
                          <span className="font-bold">{count}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Transferir todas as dependências para:
                  </label>
                  <select value={transferToId} onChange={e => setTransferToId(e.target.value)}
                    className="input-field text-sm">
                    <option value="">— Selecione o setor de destino —</option>
                    {setores.filter(s => s.id !== deleteTarget.id).map(s => (
                      <option key={s.id} value={s.id}>{s.codigo} — {s.nome_completo}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Todos os usuários, projetos e participações serão transferidos para o setor selecionado antes da exclusão.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-xs text-green-700">
                  Este setor não possui dependências e pode ser excluído com segurança.
                </p>
              </div>
            )}

            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setDeleteTarget(null)}
                className="text-sm text-gray-500 px-4 py-2">
                Cancelar
              </button>
              <button onClick={confirmDelete} disabled={saving || (deleteTarget._deps?.total! > 0 && !transferToId)}
                className="flex items-center gap-1 text-sm bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50">
                <Trash2 size={14} /> {saving ? 'Excluindo...' : 'Confirmar exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nota informativa */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-6">
        <p className="text-xs text-blue-700 leading-relaxed">
          <span className="font-semibold">Sobre a exclusão:</span> Setores com dependências (usuários, projetos, participações)
          não podem ser excluídos diretamente. É necessário transferir todas as dependências para outro setor antes da exclusão.
          Campos de texto em registros históricos (como o nome do setor em observações) permanecem inalterados.
        </p>
      </div>
    </div>
  )
}

// ============================================================
// LOG DE ALTERAÇÕES (AUDITORIA)
// ============================================================

function SolicitacoesAdmin() {
  const [solicitacoes, setSolicitacoes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('em_analise')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [processing, setProcessing] = useState<number | null>(null)
  const [resposta, setResposta] = useState<Record<number, string>>({})

  useEffect(() => { loadSols() }, [filterStatus])

  async function loadSols() {
    setLoading(true)
    const res = await fetch(`/api/admin?type=solicitacoes&status=${filterStatus}`)
    if (res.ok) {
      const data = await res.json()
      setSolicitacoes(data)
    }
    setLoading(false)
  }

  async function avaliar(id: number, status: string) {
    setProcessing(id)
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'process_solicitacao',
        payload: { id, status, resposta_gestor: resposta[id] || null }
      })
    })
    if (!res.ok) {
      const error = await res.json()
      alert(`Erro: ${error.error}`)
    }
    setProcessing(null)
    setExpandedId(null)
    loadSols()
  }

  function formatDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    em_analise: { label: 'Em análise', color: 'bg-amber-100 text-amber-700' },
    deferida: { label: 'Aprovada', color: 'bg-green-100 text-green-700' },
    indeferida: { label: 'Recusada', color: 'bg-red-100 text-red-700' },
    cancelada: { label: 'Cancelada', color: 'bg-gray-100 text-gray-600' },
  }

  return (
    <div>
      <div className="flex gap-3 mb-4 flex-wrap">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input-field text-xs w-44">
          <option value="">Todas</option>
          <option value="em_analise">Em análise</option>
          <option value="deferida">Aprovadas</option>
          <option value="indeferida">Recusadas</option>
          <option value="cancelada">Canceladas</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Carregando...</div>
      ) : solicitacoes.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">Nenhuma solicitação encontrada.</div>
      ) : (
        <div className="space-y-3">
          {solicitacoes.map(sol => {
            const st = STATUS_LABELS[sol.status] || STATUS_LABELS.em_analise
            const isExpanded = expandedId === sol.id
            return (
              <div key={sol.id} className={`bg-white rounded-xl border overflow-hidden ${sol.status === 'em_analise' ? 'border-amber-300' : 'border-gray-200'}`}>
                <div className="p-4 cursor-pointer hover:bg-gray-50" onClick={() => { setExpandedId(isExpanded ? null : sol.id) }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                      <span className="text-xs font-medium text-gray-800">
                        {sol.tipo_operacao === 'edicao' ? 'Edição' : 'Exclusão'} de {sol.tipo_entidade}
                      </span>
                      <span className="text-xs text-gray-500">"{sol.entidade_nome}"</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{sol.solicitante_nome}</span>
                      <span>{formatDate(sol.created_at)}</span>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <span className="text-xs font-medium text-gray-500 block mb-1">Solicitante</span>
                        <span className="text-sm text-gray-700">{sol.solicitante_nome}</span>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-gray-500 block mb-1">Projeto</span>
                        <span className="text-sm text-gray-700">{sol.projeto_nome || `#${sol.projeto_id}`}</span>
                      </div>
                    </div>

                    {sol.status === 'em_analise' && (
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-gray-500 block mb-1">Resposta do Gestor (opcional)</label>
                          <input type="text" value={resposta[sol.id] || ''} onChange={e => setResposta(prev => ({ ...prev, [sol.id]: e.target.value }))}
                            placeholder="Motivo da decisão" className="input-field text-xs w-full" />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => avaliar(sol.id, 'deferida')} disabled={processing === sol.id}
                            className="flex items-center gap-1 text-xs bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 disabled:opacity-50">
                            <Check size={14} /> Aprovar e aplicar
                          </button>
                          <button onClick={() => avaliar(sol.id, 'indeferida')} disabled={processing === sol.id}
                            className="flex items-center gap-1 text-xs bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 disabled:opacity-50">
                            <X size={14} /> Recusar
                          </button>
                        </div>
                      </div>
                    )}

                    {sol.status !== 'em_analise' && sol.avaliador_nome && (
                      <div className="text-xs text-gray-500">
                        <span className="font-medium">Avaliado por:</span> {sol.avaliador_nome} em {formatDate(sol.analisado_em || sol.created_at)}
                        {sol.resposta_gestor && <span className="ml-2 italic">— {sol.resposta_gestor}</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AuditLogAdmin() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterEntidade, setFilterEntidade] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 30
  useEffect(() => { loadLogs() }, [filterEntidade, filterTipo, page])

  async function loadLogs() {
    setLoading(true)
    const params = new URLSearchParams({ type: 'audit_log' })
    if (filterEntidade) params.append('entidade', filterEntidade)
    if (filterTipo) params.append('tipo', filterTipo)
    
    const res = await fetch(`/api/admin?${params.toString()}`)
    if (res.ok) {
      const data = await res.json()
      setLogs(data)
    }
    setLoading(false)
  }

  const TIPO_LABELS: Record<string, { label: string; color: string }> = {
    create: { label: 'Criação', color: 'bg-green-100 text-green-700' },
    update: { label: 'Edição', color: 'bg-blue-100 text-blue-700' },
    delete: { label: 'Exclusão', color: 'bg-red-100 text-red-700' },
  }

  const ENTIDADE_LABELS: Record<string, string> = {
    projeto: 'Projeto',
    entrega: 'Entrega',
    atividade: 'Atividade',
    entrega_participante: 'Partic. Entrega',
    atividade_participante: 'Partic. Atividade',
  }

  function formatDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  const FIELD_LABELS: Record<string, string> = {
    nome: 'Nome', descricao: 'Descrição', problema_resolve: 'Problema que resolve',
    responsavel: 'Responsável', indicador_sucesso: 'Indicador de sucesso',
    tipo_acao: 'Tipo de ação', setor_lider_id: 'Setor líder',
    criterios_aceite: 'Critérios de aceite', dependencias_criticas: 'Dependências críticas',
    data_final_prevista: 'Quinzena', status: 'Status', motivo_status: 'Motivo do status',
    data_prevista: 'Data prevista', projeto_id: 'Projeto', solicitante: 'Solicitante',
  }

  function renderLogDetail(log: any) {
    const anterior = log.conteudo_anterior
    const novo = log.conteudo_novo

    if (log.tipo_acao === 'create') {
      return <span className="text-xs text-gray-600">{novo?.nome ? `"${novo.nome}"` : ''}</span>
    }

    if (log.tipo_acao === 'delete') {
      return <span className="text-xs text-gray-600">{anterior?.nome ? `"${anterior.nome}"` : ''}</span>
    }

    // update
    if (log.tipo_acao === 'update') {
      const norm = (v: any) => {
        if (v == null) return ''
        if (Array.isArray(v)) return v.join(', ')
        return String(v)
      }
      const nome = novo?.nome || anterior?.nome || ''
      const solicitante = novo?.solicitante || anterior?.solicitante

      // Campos comparáveis: usar apenas as chaves do novo (são os dados salvos)
      const novoKeys = novo ? Object.keys(novo).filter(k => k !== 'solicitante') : []
      const anteriorKeys = anterior ? Object.keys(anterior).filter(k => k !== 'solicitante') : []

      // Se ambos têm campos reais, comparar e mostrar apenas diffs
      const canCompare = anteriorKeys.length > 1 && novoKeys.length > 1
      const changes: { key: string; from: string; to: string }[] = []

      if (canCompare) {
        const allKeys = new Set([...anteriorKeys, ...novoKeys])
        allKeys.forEach(k => {
          const vOld = norm(anterior[k])
          const vNew = norm(novo[k])
          if (vOld !== vNew) changes.push({ key: k, from: vOld, to: vNew })
        })
      }

      return (
        <div>
          <span className="text-xs font-medium text-gray-700">"{nome}"</span>
          {solicitante && <span className="text-[10px] text-gray-400 ml-2">via solicitação de {solicitante}</span>}
          {canCompare && changes.length > 0 && (
            <div className="mt-1.5 space-y-1">
              {changes.map(c => (
                <div key={c.key} className="flex items-baseline gap-1.5 text-[11px] flex-wrap">
                  <span className="font-semibold text-gray-500 shrink-0">{FIELD_LABELS[c.key] || c.key}:</span>
                  <span className="text-red-400">{c.from || '(vazio)'}</span>
                  <span className="text-gray-400">→</span>
                  <span className="text-green-700 font-medium">{c.to || '(vazio)'}</span>
                </div>
              ))}
            </div>
          )}
          {canCompare && changes.length === 0 && (
            <span className="text-[10px] text-gray-400 ml-2">Sem alterações detectadas</span>
          )}
          {!canCompare && novoKeys.length > 0 && (
            <div className="mt-1 text-[10px] text-gray-500">
              {novoKeys.slice(0, 4).map(k => (
                <span key={k} className="mr-3">{FIELD_LABELS[k] || k}: {norm(novo[k]).substring(0, 50)}</span>
              ))}
            </div>
          )}
        </div>
      )
    }

    // Fallback
    const data = novo || anterior
    if (!data) return <span className="text-gray-300">—</span>
    return (
      <div className="text-[10px] text-gray-500 space-y-0.5">
        {Object.entries(data).slice(0, 4).map(([k, v]) => (
          <div key={k}><span className="font-medium text-gray-600">{FIELD_LABELS[k] || k}:</span> {String(v).substring(0, 80)}</div>
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select value={filterEntidade} onChange={e => { setFilterEntidade(e.target.value); setPage(0) }} className="input-field text-xs w-40">
          <option value="">Todas as entidades</option>
          {Object.entries(ENTIDADE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterTipo} onChange={e => { setFilterTipo(e.target.value); setPage(0) }} className="input-field text-xs w-36">
          <option value="">Todos os tipos</option>
          {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Carregando...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">Nenhum registro encontrado.</div>
      ) : (
        <>
          <div className="space-y-2">
            {logs.map(log => {
              const tipo = TIPO_LABELS[log.tipo_acao] || { label: log.tipo_acao, color: 'bg-gray-100 text-gray-600' }
              return (
                <div key={log.id} className="bg-white rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(log.created_at)}</span>
                    <span className="text-xs font-medium text-gray-700">{log.usuario_nome || '—'}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${tipo.color}`}>{tipo.label}</span>
                    <span className="text-xs text-gray-500">{ENTIDADE_LABELS[log.entidade] || log.entidade} #{log.entidade_id}</span>
                  </div>
                  {renderLogDetail(log)}
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-3">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
              className="text-xs text-sedec-500 hover:text-sedec-700 disabled:opacity-30 disabled:cursor-not-allowed">
              ← Anterior
            </button>
            <span className="text-xs text-gray-400">Página {page + 1}</span>
            <button disabled={logs.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}
              className="text-xs text-sedec-500 hover:text-sedec-700 disabled:opacity-30 disabled:cursor-not-allowed">
              Próxima →
            </button>
          </div>
        </>
      )}
    </div>
  )
}
