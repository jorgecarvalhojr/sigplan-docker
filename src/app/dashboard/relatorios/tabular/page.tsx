'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileBarChart, Search, Filter, X, ChevronDown, ChevronRight,
  Loader2, ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react'
import type { Profile } from '@/lib/types'
import UserAutocompleteSelect from '@/components/UserAutocompleteSelect'
import { cn } from '@/lib/utils'

interface ProjetoTabular {
  id: number
  codigo_sequencial: number | null
  nome: string
  descricao: string
  responsavel_nome: string
  responsavel_id: string | null
  status: string
  status_projeto: 'em_andamento' | 'concluido' | 'cancelado' | 'hibernando'
  prioridade: string | null
  impacto: string | null
  condicao_execucao: string | null
  regime_acompanhamento: string | null
  observacao_relatorio: string | null
  prazo: string | null
  setor_lider_codigo: string
  acoes: { numero: string; oe_codigo: string }[]
  tipo_acao: string[]
  setores_participantes: string[]
  responsaveis_entrega: string[]
  responsaveis_atividade: string[]
  participantes_atividade: string[]
  entregas: EntregaTabular[]
}

interface EntregaTabular {
  id: number
  projeto_id: number
  nome: string
  prioridade: string | null
  responsavel_nome: string
  status: string
  data_inicio: string | null
  data_final_prevista: string | null
  observacao_relatorio: string | null
}

const PRIORIDADE_OPTIONS = [
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Média' },
  { value: 'baixa', label: 'Baixa' },
]

const IMPACTO_OPTIONS = [
  { value: 'alto', label: 'Alto' },
  { value: 'medio', label: 'Médio' },
  { value: 'baixo', label: 'Baixo' },
]

const CONDICAO_OPTIONS = [
  { value: 'livre', label: 'Livre' },
  { value: 'condicionada', label: 'Condicionada' },
]

const REGIME_OPTIONS = [
  { value: 'intensivo', label: 'Intensivo' },
  { value: 'regular', label: 'Regular' },
]

function prioridadeClasses(v: string | null) {
  if (v === 'alta') return 'bg-red-100 text-red-700 border-red-200'
  if (v === 'media') return 'bg-yellow-100 text-yellow-700 border-yellow-200'
  if (v === 'baixa') return 'bg-green-100 text-green-700 border-green-200'
  return 'bg-gray-100 text-gray-500 border-gray-200'
}

function impactoClasses(v: string | null) {
  if (v === 'alto') return 'bg-red-100 text-red-700 border-red-200'
  if (v === 'medio') return 'bg-yellow-100 text-yellow-700 border-yellow-200'
  if (v === 'baixo') return 'bg-green-100 text-green-700 border-green-200'
  return 'bg-gray-100 text-gray-500 border-gray-200'
}

function condicaoClasses(v: string | null) {
  if (v === 'livre') return 'bg-green-100 text-green-700 border-green-200'
  if (v === 'condicionada') return 'bg-orange-100 text-orange-700 border-orange-200'
  return 'bg-gray-100 text-gray-500 border-gray-200'
}

function regimeClasses(v: string | null) {
  if (v === 'intensivo') return 'bg-red-100 text-red-700 border-red-200'
  if (v === 'regular') return 'bg-blue-100 text-blue-700 border-blue-200'
  return 'bg-gray-100 text-gray-500 border-gray-200'
}

const STATUS_PROJETO_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  em_andamento: { label: 'Em andamento', color: 'text-blue-700', bg: 'bg-blue-100' },
  concluido: { label: 'Concluído', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  cancelado: { label: 'Cancelado', color: 'text-gray-600', bg: 'bg-gray-200' },
  hibernando: { label: 'Hibernando', color: 'text-indigo-700', bg: 'bg-indigo-100' },
}

const STATUS_ENTREGA_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  aberta: { label: 'Aberta', color: 'text-gray-700', bg: 'bg-gray-100' },
  em_andamento: { label: 'Em andamento', color: 'text-blue-700', bg: 'bg-blue-100' },
  aguardando: { label: 'Aguardando', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  resolvida: { label: 'Resolvida', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  cancelada: { label: 'Cancelada', color: 'text-gray-600', bg: 'bg-gray-200' },
}

function formatDate(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

export default function RelatorioTabularPage() {
  const router = useRouter()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [projetos, setProjetos] = useState<ProjetoTabular[]>([])

  // Filters
  const [searchText, setSearchText] = useState('')
  const [oeFilter, setOeFilter] = useState('')
  const [acaoFilter, setAcaoFilter] = useState('')
  const [setorFilter, setSetorFilter] = useState('')
  const [tipoAcaoFilter, setTipoAcaoFilter] = useState('')
  const [responsavelFilter, setResponsavelFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativos' | 'concluidos' | 'hibernando'>('ativos')
  const [prioridadeFilter, setPrioridadeFilter] = useState('')
  const [impactoFilter, setImpactoFilter] = useState('')
  const [condicaoFilter, setCondicaoFilter] = useState('')
  const [regimeFilter, setRegimeFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Reference data
  const [oes, setOes] = useState<{ codigo: string; nome: string }[]>([])
  const [acoesRef, setAcoesRef] = useState<{ numero: string; nome: string; oe_codigo: string }[]>([])
  const [setores, setSetores] = useState<{ id: number; codigo: string; nome_completo: string }[]>([])
  const [eligibleUsers, setEligibleUsers] = useState<{ id: string; nome: string; setor_id: number | null; setor_codigo: string | null }[]>([])

  // Sorting
  const [sortField, setSortField] = useState<'id' | 'nome' | 'prazo' | 'setor'>('id')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Expand/collapse
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})

  // Saving indicator
  const [savingKey, setSavingKey] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/dados/relatorios/tabular')
      if (res.status === 401) { router.push('/login'); return }
      if (res.status === 403) { router.push('/dashboard'); return }
      if (!res.ok) { console.error('Erro ao carregar tabular'); setLoading(false); return }

      const data = await res.json()
      setProfile(data.profile as Profile)

      setOes(data.objetivos || [])
      setAcoesRef((data.acoes || []).map((a: any) => ({
        numero: a.numero, nome: a.nome, oe_codigo: a.oe_codigo || '',
      })))
      setSetores(data.setores || [])
      setEligibleUsers((data.profiles || []).map((u: any) => ({
        id: u.id, nome: u.nome,
        setor_id: u.setor_id, setor_codigo: u.setores?.codigo || u.setor_codigo || null,
      })))

      const rawProjetos: any[] = data.projetos || []

      const items: ProjetoTabular[] = rawProjetos.map((p: any) => {
        const respEntregaSet = new Set<string>()
        const respAtividadeSet = new Set<string>()
        const partAtividadeSet = new Set<string>()
        const setorSet = new Set<string>()

        let maxPrazo: string | null = null
        const entregasRaw: any[] = p.entregas || []

        const entregas: EntregaTabular[] = entregasRaw.map((e: any) => {
          if (e.responsavel_entrega_id) respEntregaSet.add(e.responsavel_entrega_id)
          if (e.orgao_responsavel_setor_id) {
            const setorResp = (data.setores || []).find((st: any) => st.id === e.orgao_responsavel_setor_id)
            if (setorResp) setorSet.add(setorResp.codigo)
          }
          ;(e.participantes || []).forEach((ep: any) => {
            if (ep.tipo_participante === 'setor' && ep.setor_codigo) setorSet.add(ep.setor_codigo)
            else if (ep.tipo_participante === 'externo_subsegop') setorSet.add('Ext. SUBSEGOP')
            else if (ep.tipo_participante === 'externo_sedec') setorSet.add('Ext. SEDEC')
          })
          ;(e.atividades || []).forEach((a: any) => {
            if (a.responsavel_atividade_id) respAtividadeSet.add(a.responsavel_atividade_id)
            ;(a.participantes || []).forEach((ap: any) => {
              if (ap.user_id) partAtividadeSet.add(ap.user_id)
              if (ap.tipo_participante === 'setor' && ap.setor_codigo) setorSet.add(ap.setor_codigo)
              else if (ap.tipo_participante === 'externo_subsegop') setorSet.add('Ext. SUBSEGOP')
              else if (ap.tipo_participante === 'externo_sedec') setorSet.add('Ext. SEDEC')
            })
          })

          if (e.data_final_prevista && (!maxPrazo || e.data_final_prevista > maxPrazo)) {
            maxPrazo = e.data_final_prevista
          }

          return {
            id: e.id,
            projeto_id: p.id,
            nome: e.nome,
            prioridade: e.prioridade || null,
            responsavel_nome: e.responsavel_nome || '—',
            status: e.status || 'aberta',
            data_inicio: e.data_inicio || null,
            data_final_prevista: e.data_final_prevista || null,
            observacao_relatorio: e.observacao_relatorio || null,
          }
        })

        let status_projeto: 'em_andamento' | 'concluido' | 'cancelado' | 'hibernando' = 'em_andamento'
        if (p.status === 'hibernando') {
          status_projeto = 'hibernando'
        } else if (entregasRaw.length > 0) {
          if (entregasRaw.every((e: any) => e.status === 'cancelada')) status_projeto = 'cancelado'
          else if (
            entregasRaw.every((e: any) => e.status === 'resolvida' || e.status === 'cancelada') &&
            entregasRaw.some((e: any) => e.status === 'resolvida')
          ) status_projeto = 'concluido'
        }

        return {
          id: p.id,
          codigo_sequencial: p.codigo_sequencial,
          nome: p.nome,
          descricao: p.descricao || '',
          responsavel_nome: p.responsavel_nome || '—',
          responsavel_id: p.responsavel_id || null,
          status: p.status || 'ativo',
          status_projeto,
          prioridade: p.prioridade || null,
          impacto: p.impacto || null,
          condicao_execucao: p.condicao_execucao || null,
          regime_acompanhamento: p.regime_acompanhamento || null,
          observacao_relatorio: p.observacao_relatorio || null,
          prazo: maxPrazo || p.data_inicio || null,
          setor_lider_codigo: p.setor_lider_codigo || '',
          acoes: (p.acoes || []).map((a: any) => ({
            numero: a.numero || '',
            oe_codigo: a.oe_codigo || '',
          })),
          tipo_acao: p.tipo_acao || [],
          setores_participantes: Array.from(setorSet),
          responsaveis_entrega: Array.from(respEntregaSet),
          responsaveis_atividade: Array.from(respAtividadeSet),
          participantes_atividade: Array.from(partAtividadeSet),
          entregas,
        }
      })

      setProjetos(items)
      setLoading(false)
    }
    load()
  }, [])

  // Filter dependencies
  const filteredAcoes = useMemo(() => {
    if (!oeFilter) return acoesRef
    return acoesRef.filter(a => a.oe_codigo === oeFilter)
  }, [acoesRef, oeFilter])

  const filteredEligibleUsers = useMemo(() => {
    if (!setorFilter) return eligibleUsers
    const setorObj = setores.find(s => s.codigo === setorFilter)
    if (!setorObj) return eligibleUsers
    return eligibleUsers.filter(u => u.setor_id === setorObj.id)
  }, [eligibleUsers, setorFilter, setores])

  useEffect(() => { setAcaoFilter('') }, [oeFilter])

  const filteredProjetos = useMemo(() => {
    return projetos.filter(p => {
      if (searchText) {
        const s = searchText.toLowerCase()
        if (!p.nome.toLowerCase().includes(s) && !p.descricao.toLowerCase().includes(s)) return false
      }
      if (oeFilter && !p.acoes.some(a => a.oe_codigo === oeFilter)) return false
      if (acaoFilter && !p.acoes.some(a => a.numero === acaoFilter)) return false
      if (setorFilter) {
        if (p.setor_lider_codigo !== setorFilter && !p.setores_participantes.includes(setorFilter)) return false
      }
      if (tipoAcaoFilter && !p.tipo_acao.includes(tipoAcaoFilter)) return false
      if (responsavelFilter) {
        const match =
          p.responsavel_id === responsavelFilter ||
          p.responsaveis_entrega.includes(responsavelFilter) ||
          p.responsaveis_atividade.includes(responsavelFilter) ||
          p.participantes_atividade.includes(responsavelFilter)
        if (!match) return false
      }
      if (statusFilter === 'ativos') {
        if (p.status === 'hibernando') return false
        if (p.status_projeto === 'concluido' || p.status_projeto === 'cancelado') return false
      } else if (statusFilter === 'concluidos') {
        if (p.status === 'hibernando') return false
        if (p.status_projeto !== 'concluido' && p.status_projeto !== 'cancelado') return false
      } else if (statusFilter === 'hibernando') {
        if (p.status !== 'hibernando') return false
      }
      if (prioridadeFilter && p.prioridade !== prioridadeFilter) return false
      if (impactoFilter && p.impacto !== impactoFilter) return false
      if (condicaoFilter && p.condicao_execucao !== condicaoFilter) return false
      if (regimeFilter && p.regime_acompanhamento !== regimeFilter) return false
      return true
    })
  }, [projetos, searchText, oeFilter, acaoFilter, setorFilter, tipoAcaoFilter, responsavelFilter, statusFilter, prioridadeFilter, impactoFilter, condicaoFilter, regimeFilter])

  const sortedProjetos = useMemo(() => {
    const sorted = [...filteredProjetos]
    sorted.sort((a, b) => {
      let cmp = 0
      if (sortField === 'id') cmp = (a.codigo_sequencial ?? 0) - (b.codigo_sequencial ?? 0)
      else if (sortField === 'nome') cmp = a.nome.localeCompare(b.nome)
      else if (sortField === 'prazo') {
        if (!a.prazo && !b.prazo) cmp = 0
        else if (!a.prazo) cmp = 1
        else if (!b.prazo) cmp = -1
        else cmp = a.prazo.localeCompare(b.prazo)
      } else if (sortField === 'setor') cmp = a.setor_lider_codigo.localeCompare(b.setor_lider_codigo)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [filteredProjetos, sortField, sortDir])

  const hasFilters = !!(searchText || oeFilter || acaoFilter || setorFilter || tipoAcaoFilter || responsavelFilter || prioridadeFilter || impactoFilter || condicaoFilter || regimeFilter)

  function clearFilters() {
    setSearchText('')
    setOeFilter('')
    setAcaoFilter('')
    setSetorFilter('')
    setTipoAcaoFilter('')
    setResponsavelFilter('')
    setPrioridadeFilter('')
    setImpactoFilter('')
    setCondicaoFilter('')
    setRegimeFilter('')
  }

  function toggleSort(field: 'id' | 'nome' | 'prazo' | 'setor') {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  function toggleExpand(id: number) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function expandAll() {
    const map: Record<number, boolean> = {}
    sortedProjetos.forEach(p => { if (p.entregas.length > 0) map[p.id] = true })
    setExpanded(map)
  }

  function collapseAll() {
    setExpanded({})
  }

  async function saveProjetoField(projetoId: number, field: string, value: string | null) {
    const key = `p-${projetoId}-${field}`
    setSavingKey(key)
    try {
      const res = await fetch('/api/dados/relatorios/tabular', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'projeto', id: projetoId, field, value: value || null }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert('Erro ao salvar: ' + (err.error || res.statusText))
      } else {
        setProjetos(prev => prev.map(p => p.id === projetoId ? { ...p, [field]: value || null } : p))
      }
    } catch (e: any) {
      alert('Erro ao salvar: ' + e.message)
    }
    setSavingKey(null)
  }

  async function saveEntregaField(entregaId: number, projetoId: number, field: string, value: string | null) {
    const key = `e-${entregaId}-${field}`
    setSavingKey(key)
    try {
      const res = await fetch('/api/dados/relatorios/tabular', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'entrega', id: entregaId, field, value: value || null }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert('Erro ao salvar: ' + (err.error || res.statusText))
      } else {
        setProjetos(prev => prev.map(p => {
          if (p.id !== projetoId) return p
          return { ...p, entregas: p.entregas.map(e => e.id === entregaId ? { ...e, [field]: value || null } : e) }
        }))
      }
    } catch (e: any) {
      alert('Erro ao salvar: ' + e.message)
    }
    setSavingKey(null)
  }

  function SortIcon({ field }: { field: 'id' | 'nome' | 'prazo' | 'setor' }) {
    if (sortField !== field) return <ArrowUpDown size={12} className="text-gray-400" />
    return sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-pulse text-sedec-500 font-medium">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="max-w-[1500px] mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <FileBarChart size={24} className="text-sedec-600" />
        <h1 className="text-2xl font-bold text-gray-800">Relatório Tabular</h1>
        <span className="text-sm text-gray-500 ml-2">
          {sortedProjetos.length} projeto{sortedProjetos.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Status + Filter controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {(['todos', 'ativos', 'concluidos', 'hibernando'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn('px-2.5 py-1 text-xs font-medium transition-colors',
                statusFilter === s ? 'bg-sedec-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}>
              {s === 'todos' ? 'Todos' : s === 'ativos' ? 'Ativos' : s === 'concluidos' ? 'Concluídos' : 'Hib.'}
            </button>
          ))}
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className={cn('flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border transition-colors',
            showFilters || hasFilters ? 'bg-sedec-50 border-sedec-300 text-sedec-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300')}>
          <Filter size={13} /> Filtros {hasFilters && '•'}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={expandAll} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">
            Expandir tudo
          </button>
          <button onClick={collapseAll} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">
            Retrair tudo
          </button>
        </div>
      </div>

      {/* Filters panel */}
      {(showFilters || hasFilters) && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
            <Filter size={14} /> Filtros
            {hasFilters && (
              <button onClick={clearFilters} className="ml-auto text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                <X size={13} /> Limpar
              </button>
            )}
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Buscar projeto..." value={searchText}
              onChange={e => setSearchText(e.target.value)} className="input-field pl-8" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <select value={oeFilter} onChange={e => setOeFilter(e.target.value)} className="input-field">
              <option value="">Todos os objetivos</option>
              {oes.map(o => <option key={o.codigo} value={o.codigo}>{o.codigo} — {o.nome.substring(0, 60)}</option>)}
            </select>

            <select value={acaoFilter} onChange={e => setAcaoFilter(e.target.value)} className="input-field">
              <option value="">Todas as ações</option>
              {filteredAcoes.map(a => <option key={a.numero} value={a.numero}>AE {a.numero}</option>)}
            </select>

            <select value={setorFilter} onChange={e => setSetorFilter(e.target.value)} className="input-field">
              <option value="">Todos os setores</option>
              {setores.map(s => <option key={s.codigo} value={s.codigo}>{s.codigo}</option>)}
            </select>

            <select value={tipoAcaoFilter} onChange={e => setTipoAcaoFilter(e.target.value)} className="input-field">
              <option value="">Todos os tipos</option>
              {['Prevenção', 'Mitigação', 'Preparação', 'Resposta', 'Recuperação', 'Gestão/Governança', 'Inovação', 'Integração'].map(t =>
                <option key={t} value={t}>{t}</option>)}
            </select>

            <UserAutocompleteSelect
              users={filteredEligibleUsers}
              value={responsavelFilter}
              onChange={(v: string | null) => setResponsavelFilter(v || '')}
              placeholder="Responsável / Participante"
            />

            <select value={prioridadeFilter} onChange={e => setPrioridadeFilter(e.target.value)}
              className={cn('input-field', prioridadeFilter && prioridadeClasses(prioridadeFilter))}>
              <option value="">Todas as prioridades</option>
              {PRIORIDADE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <select value={impactoFilter} onChange={e => setImpactoFilter(e.target.value)}
              className={cn('input-field', impactoFilter && impactoClasses(impactoFilter))}>
              <option value="">Todos os impactos</option>
              {IMPACTO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <select value={condicaoFilter} onChange={e => setCondicaoFilter(e.target.value)}
              className={cn('input-field', condicaoFilter && condicaoClasses(condicaoFilter))}>
              <option value="">Todas as condições</option>
              {CONDICAO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <select value={regimeFilter} onChange={e => setRegimeFilter(e.target.value)}
              className={cn('input-field', regimeFilter && regimeClasses(regimeFilter))}>
              <option value="">Todos os regimes</option>
              {REGIME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-sm min-w-[1200px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600 w-8"></th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600 cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('id')}>
                <span className="flex items-center gap-1">ID <SortIcon field="id" /></span>
              </th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600 cursor-pointer select-none" onClick={() => toggleSort('nome')}>
                <span className="flex items-center gap-1">Nome <SortIcon field="nome" /></span>
              </th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600 cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('setor')}>
                <span className="flex items-center gap-1">Setor <SortIcon field="setor" /></span>
              </th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">Prioridade</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Impacto</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">Cond. Exec.</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">Responsável</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600 cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('prazo')}>
                <span className="flex items-center gap-1">Prazo <SortIcon field="prazo" /></span>
              </th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Status</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">Regime/Início</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Observação</th>
            </tr>
          </thead>
          <tbody>
            {sortedProjetos.length === 0 && (
              <tr><td colSpan={12} className="px-4 py-8 text-center text-gray-500">Nenhum projeto encontrado.</td></tr>
            )}
            {sortedProjetos.map(p => {
              const isExpanded = expanded[p.id]
              const spCode = p.codigo_sequencial ? `SP-${String(p.codigo_sequencial).padStart(4, '0')}` : `#${p.id}`
              const stCfg = STATUS_PROJETO_CONFIG[p.status_projeto] || STATUS_PROJETO_CONFIG.em_andamento
              return (
                <ProjectRows key={p.id} p={p} isExpanded={isExpanded} spCode={spCode} stCfg={stCfg}
                  toggleExpand={toggleExpand} saveProjetoField={saveProjetoField} saveEntregaField={saveEntregaField}
                  savingKey={savingKey} router={router} />
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {sortedProjetos.length === 0 && (
          <div className="text-center text-gray-500 py-8">Nenhum projeto encontrado.</div>
        )}
        {sortedProjetos.map(p => {
          const isExpanded = expanded[p.id]
          const spCode = p.codigo_sequencial ? `SP-${String(p.codigo_sequencial).padStart(4, '0')}` : `#${p.id}`
          const stCfg = STATUS_PROJETO_CONFIG[p.status_projeto] || STATUS_PROJETO_CONFIG.em_andamento
          return (
            <div key={p.id} className="card p-4">
              {/* Project header */}
              <div className="flex items-start gap-2 mb-3">
                <button onClick={() => toggleExpand(p.id)} className="mt-0.5 text-gray-400 hover:text-gray-600" disabled={p.entregas.length === 0}>
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <div className="flex-1 min-w-0">
                  <button onClick={() => router.push(`/dashboard/projetos/${p.id}`)}
                    className="text-sedec-600 hover:underline font-semibold text-sm text-left">
                    {spCode} — {p.nome}
                  </button>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', stCfg.bg, stCfg.color)}>{stCfg.label}</span>
                    {p.entregas.length > 0 && (
                      <span className="text-xs text-gray-400">{p.entregas.length} entrega{p.entregas.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Project fields */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-xs text-gray-500 block">Setor Líder</span>
                  <span className="text-gray-800 font-mono">{p.setor_lider_codigo}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Responsável</span>
                  <span className="text-gray-800">{p.responsavel_nome}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Prazo</span>
                  <span className="text-gray-800">{formatDate(p.prazo)}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Prioridade</span>
                  <select value={p.prioridade || ''}
                    onChange={e => saveProjetoField(p.id, 'prioridade', e.target.value || null)}
                    className={cn('text-xs rounded-md border px-2 py-1 w-full font-medium', prioridadeClasses(p.prioridade))}>
                    <option value="">—</option>
                    {PRIORIDADE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Impacto</span>
                  <select value={p.impacto || ''}
                    onChange={e => saveProjetoField(p.id, 'impacto', e.target.value || null)}
                    className={cn('text-xs rounded-md border px-2 py-1 w-full font-medium', impactoClasses(p.impacto))}>
                    <option value="">—</option>
                    {IMPACTO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Cond. Execução</span>
                  <select value={p.condicao_execucao || ''}
                    onChange={e => saveProjetoField(p.id, 'condicao_execucao', e.target.value || null)}
                    className={cn('text-xs rounded-md border px-2 py-1 w-full font-medium', condicaoClasses(p.condicao_execucao))}>
                    <option value="">—</option>
                    {CONDICAO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Regime</span>
                  <select value={p.regime_acompanhamento || ''}
                    onChange={e => saveProjetoField(p.id, 'regime_acompanhamento', e.target.value || null)}
                    className={cn('text-xs rounded-md border px-2 py-1 w-full font-medium', regimeClasses(p.regime_acompanhamento))}>
                    <option value="">—</option>
                    {REGIME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-2">
                <span className="text-xs text-gray-500 block mb-1">Observação</span>
                <input type="text" maxLength={150} value={p.observacao_relatorio || ''}
                  onChange={e => setProjetos(prev => prev.map(pp => pp.id === p.id ? { ...pp, observacao_relatorio: e.target.value } : pp))}
                  onBlur={e => saveProjetoField(p.id, 'observacao_relatorio', e.target.value || null)}
                  className="input-field text-xs" placeholder="Observação..." />
              </div>

              {/* Entregas (expanded) */}
              {isExpanded && p.entregas.length > 0 && (
                <div className="mt-3 border-l-2 border-sedec-200 pl-3 space-y-3">
                  {p.entregas.map(e => {
                    const eCfg = STATUS_ENTREGA_CONFIG[e.status] || STATUS_ENTREGA_CONFIG.aberta
                    return (
                      <div key={e.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="font-medium text-sm text-gray-800 mb-2">{e.nome}</div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-xs text-gray-500 block">Responsável</span>
                            <span className="text-gray-800">{e.responsavel_nome}</span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 block">Status</span>
                            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', eCfg.bg, eCfg.color)}>{eCfg.label}</span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 block">Início</span>
                            <span className="text-gray-800">{formatDate(e.data_inicio)}</span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 block">Prazo</span>
                            <span className="text-gray-800">{formatDate(e.data_final_prevista)}</span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 block">Prioridade</span>
                            <select value={e.prioridade || ''}
                              onChange={ev => saveEntregaField(e.id, p.id, 'prioridade', ev.target.value || null)}
                              className={cn('text-xs rounded-md border px-2 py-1 w-full font-medium', prioridadeClasses(e.prioridade))}>
                              <option value="">—</option>
                              {PRIORIDADE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="mt-2">
                          <span className="text-xs text-gray-500 block mb-1">Observação</span>
                          <input type="text" maxLength={150} value={e.observacao_relatorio || ''}
                            onChange={ev => setProjetos(prev => prev.map(pp => {
                              if (pp.id !== p.id) return pp
                              return { ...pp, entregas: pp.entregas.map(ee => ee.id === e.id ? { ...ee, observacao_relatorio: ev.target.value } : ee) }
                            }))}
                            onBlur={ev => saveEntregaField(e.id, p.id, 'observacao_relatorio', ev.target.value || null)}
                            className="input-field text-xs" placeholder="Observação..." />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ProjectRows({
  p, isExpanded, spCode, stCfg, toggleExpand, saveProjetoField, saveEntregaField, savingKey, router
}: {
  p: ProjetoTabular
  isExpanded: boolean
  spCode: string
  stCfg: { label: string; color: string; bg: string }
  toggleExpand: (id: number) => void
  saveProjetoField: (id: number, field: string, value: string | null) => Promise<void>
  saveEntregaField: (id: number, pid: number, field: string, value: string | null) => Promise<void>
  savingKey: string | null
  router: any
}) {
  const [obsLocal, setObsLocal] = useState(p.observacao_relatorio || '')
  const [entregaObs, setEntregaObs] = useState<Record<number, string>>({})

  useEffect(() => { setObsLocal(p.observacao_relatorio || '') }, [p.observacao_relatorio])

  function getEntregaObs(e: EntregaTabular) {
    return entregaObs[e.id] !== undefined ? entregaObs[e.id] : (e.observacao_relatorio || '')
  }

  return (
    <>
      <tr className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
        <td className="px-3 py-2">
          <button onClick={() => toggleExpand(p.id)} disabled={p.entregas.length === 0}
            className={cn('text-gray-400 hover:text-gray-600', p.entregas.length === 0 && 'opacity-30 cursor-default')}>
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </td>
        <td className="px-3 py-2 whitespace-nowrap">
          <button onClick={() => router.push(`/dashboard/projetos/${p.id}`)}
            className="text-sedec-600 hover:underline font-medium text-xs">{spCode}</button>
        </td>
        <td className="px-3 py-2 max-w-[200px]">
          <button onClick={() => router.push(`/dashboard/projetos/${p.id}`)}
            className="text-sedec-600 hover:underline text-left text-xs font-medium truncate block max-w-[200px]"
            title={p.nome}>{p.nome}</button>
        </td>
        <td className="px-3 py-2 text-xs text-gray-700 font-mono whitespace-nowrap">{p.setor_lider_codigo}</td>
        <td className="px-3 py-2">
          <select value={p.prioridade || ''}
            onChange={e => saveProjetoField(p.id, 'prioridade', e.target.value || null)}
            className={cn('text-xs rounded-md border px-2 py-1 font-medium cursor-pointer', prioridadeClasses(p.prioridade))}>
            <option value="">—</option>
            {PRIORIDADE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </td>
        <td className="px-3 py-2">
          <select value={p.impacto || ''}
            onChange={e => saveProjetoField(p.id, 'impacto', e.target.value || null)}
            className={cn('text-xs rounded-md border px-2 py-1 font-medium cursor-pointer', impactoClasses(p.impacto))}>
            <option value="">—</option>
            {IMPACTO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </td>
        <td className="px-3 py-2">
          <select value={p.condicao_execucao || ''}
            onChange={e => saveProjetoField(p.id, 'condicao_execucao', e.target.value || null)}
            className={cn('text-xs rounded-md border px-2 py-1 font-medium cursor-pointer', condicaoClasses(p.condicao_execucao))}>
            <option value="">—</option>
            {CONDICAO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </td>
        <td className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap">{p.responsavel_nome}</td>
        <td className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap">{formatDate(p.prazo)}</td>
        <td className="px-3 py-2">
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap', stCfg.bg, stCfg.color)}>{stCfg.label}</span>
        </td>
        <td className="px-3 py-2">
          <select value={p.regime_acompanhamento || ''}
            onChange={e => saveProjetoField(p.id, 'regime_acompanhamento', e.target.value || null)}
            className={cn('text-xs rounded-md border px-2 py-1 font-medium cursor-pointer', regimeClasses(p.regime_acompanhamento))}>
            <option value="">—</option>
            {REGIME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </td>
        <td className="px-3 py-2">
          <div className="relative">
            <input type="text" maxLength={150} value={obsLocal}
              onChange={e => setObsLocal(e.target.value)}
              onBlur={() => saveProjetoField(p.id, 'observacao_relatorio', obsLocal || null)}
              className="text-xs border border-gray-200 rounded-md px-2 py-1 w-full min-w-[120px] focus:ring-1 focus:ring-sedec-300 focus:border-sedec-300 outline-none"
              placeholder="..." />
            {savingKey === `p-${p.id}-observacao_relatorio` && (
              <Loader2 size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-sedec-500 animate-spin" />
            )}
          </div>
        </td>
      </tr>
      {isExpanded && p.entregas.map(e => {
        const eCfg = STATUS_ENTREGA_CONFIG[e.status] || STATUS_ENTREGA_CONFIG.aberta
        return (
          <tr key={e.id} className="bg-sedec-50/30 border-b border-gray-100">
            <td className="px-3 py-2"></td>
            <td colSpan={3} className="px-3 py-2">
              <div className="flex items-center gap-2 pl-4">
                <div className="w-1 h-4 bg-sedec-300 rounded-full flex-shrink-0"></div>
                <span className="text-xs text-gray-700 font-medium truncate max-w-[280px]" title={e.nome}>{e.nome}</span>
              </div>
            </td>
            <td className="px-3 py-2">
              <select value={e.prioridade || ''}
                onChange={ev => saveEntregaField(e.id, p.id, 'prioridade', ev.target.value || null)}
                className={cn('text-xs rounded-md border px-2 py-1 font-medium cursor-pointer', prioridadeClasses(e.prioridade))}>
                <option value="">—</option>
                {PRIORIDADE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </td>
            <td className="px-3 py-2"></td>
            <td className="px-3 py-2"></td>
            <td className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap">{e.responsavel_nome}</td>
            <td className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap">{formatDate(e.data_final_prevista)}</td>
            <td className="px-3 py-2">
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap', eCfg.bg, eCfg.color)}>{eCfg.label}</span>
            </td>
            <td className="px-3 py-2">
              <span className="text-xs text-gray-500">{formatDate(e.data_inicio)}</span>
            </td>
            <td className="px-3 py-2">
              <div className="relative">
                <input type="text" maxLength={150} value={getEntregaObs(e)}
                  onChange={ev => setEntregaObs(prev => ({ ...prev, [e.id]: ev.target.value }))}
                  onBlur={ev => saveEntregaField(e.id, p.id, 'observacao_relatorio', ev.target.value || null)}
                  className="text-xs border border-gray-200 rounded-md px-2 py-1 w-full min-w-[120px] focus:ring-1 focus:ring-sedec-300 focus:border-sedec-300 outline-none"
                  placeholder="..." />
                {savingKey === `e-${e.id}-observacao_relatorio` && (
                  <Loader2 size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-sedec-500 animate-spin" />
                )}
              </div>
            </td>
          </tr>
        )
      })}
    </>
  )
}
