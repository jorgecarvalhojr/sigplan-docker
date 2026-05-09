'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { FileBarChart, Search, CheckSquare, Square, Loader2, Filter, Info, Pause, X } from 'lucide-react'
import type { Profile } from '@/lib/types'
import { generateReportPDF } from '@/lib/generate-report-pdf'
import UserAutocompleteSelect from '@/components/UserAutocompleteSelect'

interface ProjetoItem {
  id: number
  nome: string
  descricao: string
  setor_lider_codigo: string
  setor_lider_nome: string
  acoes: { numero: string; nome: string; oe_codigo: string }[]
  tipo_acao: string[]
  setores_participantes: string[]
  responsavel_id: string | null
  responsaveis_entrega: string[]
  responsaveis_atividade: string[]
  participantes_atividade: string[]
  status: string
  status_projeto: string
}

export default function RelatoriosPage() {
  const router = useRouter()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  // Projects
  const [projetos, setProjetos] = useState<ProjetoItem[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // Sections
  const [sections, setSections] = useState({
    projeto: true,
    entregas: true,
    atividades: true,
  })
  const [reportName, setReportName] = useState('')

  // Filters
  const [searchText, setSearchText] = useState('')
  const [oeFilter, setOeFilter] = useState('')
  const [acaoFilter, setAcaoFilter] = useState('')
  const [setorFilter, setSetorFilter] = useState('')
  const [tipoAcaoFilter, setTipoAcaoFilter] = useState('')
  const [responsavelFilter, setResponsavelFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativos' | 'concluidos' | 'hibernando'>('todos')
  const [showFilters, setShowFilters] = useState(false)

  // Reference data for filters
  const [oes, setOes] = useState<{ codigo: string; nome: string }[]>([])
  const [acoesRef, setAcoesRef] = useState<{ numero: string; nome: string; oe_codigo: string }[]>([])
  const [setores, setSetores] = useState<{ id: number; codigo: string; nome_completo: string }[]>([])
  const [eligibleUsers, setEligibleUsers] = useState<{ id: string; nome: string; setor_id: number | null; setor_codigo: string | null }[]>([])

  useEffect(() => {
    async function load() {
      // Auth via API local
      const sessionRes = await fetch('/api/auth/session')
      if (!sessionRes.ok) { router.push('/login'); return }
      const session = await sessionRes.json()
      const user = session.user

      // Dados via PostgreSQL Docker
      const res = await fetch('/api/dados/relatorios')
      if (res.status === 403) { router.push('/dashboard'); return }
      if (!res.ok) { setLoading(false); return }

      const data = await res.json()

      setProfile(data.profile as Profile)
      setOes(data.objetivos || [])
      setAcoesRef((data.acoes || []).map((a: any) => ({
        numero: a.numero, nome: a.nome, oe_codigo: a.oe_codigo || '',
      })))
      setSetores(data.setores || [])
      setEligibleUsers((data.profiles || []).map((u: any) => ({
        id: u.id, nome: u.nome,
        setor_id: u.setor_id, setor_codigo: u.setores?.codigo || null,
      })))

      const setoresData = data.setores || []
      const cards: ProjetoItem[] = (data.projetos || []).map((p: any) => {
        const respEntregaSet = new Set<string>()
        const respAtividadeSet = new Set<string>()
        const partAtividadeSet = new Set<string>()
        const setorSet = new Set<string>()

        p.entregas?.forEach((e: any) => {
          if (e.responsavel_entrega_id) respEntregaSet.add(e.responsavel_entrega_id)
          if (e.orgao_responsavel_setor_id) {
            const setorResp = setoresData.find((st: any) => st.id === e.orgao_responsavel_setor_id)
            if (setorResp) setorSet.add(setorResp.codigo)
          }
          e.entrega_participantes?.forEach((ep: any) => {
            if (ep.tipo_participante === 'setor' && ep.setor_codigo) setorSet.add(ep.setor_codigo)
            else if (ep.tipo_participante === 'externo_subsegop') setorSet.add('Ext. SUBSEGOP')
            else if (ep.tipo_participante === 'externo_sedec') setorSet.add('Ext. SEDEC')
          })
          e.atividades?.forEach((a: any) => {
            if (a.responsavel_atividade_id) respAtividadeSet.add(a.responsavel_atividade_id)
            a.atividade_participantes?.forEach((ap: any) => {
              if (ap.user_id) partAtividadeSet.add(ap.user_id)
              if (ap.tipo_participante === 'setor' && ap.setor_codigo) setorSet.add(ap.setor_codigo)
              else if (ap.tipo_participante === 'externo_subsegop') setorSet.add('Ext. SUBSEGOP')
              else if (ap.tipo_participante === 'externo_sedec') setorSet.add('Ext. SEDEC')
            })
          })
        })

        const entregas = p.entregas || []
        let status_projeto = 'em_andamento'
        if (p.status === 'hibernando') {
          status_projeto = 'hibernando'
        } else if (entregas.length > 0) {
          if (entregas.every((e: any) => e.status === 'cancelada')) status_projeto = 'cancelado'
          else if (entregas.every((e: any) => e.status === 'resolvida' || e.status === 'cancelada') && entregas.some((e: any) => e.status === 'resolvida')) status_projeto = 'concluido'
        }

        return {
          id: p.id, nome: p.nome, descricao: p.descricao,
          setor_lider_codigo: p.setor_lider_codigo || '',
          setor_lider_nome: p.setor_lider_nome || '',
          acoes: (p.acoes || []),
          tipo_acao: p.tipo_acao || [],
          setores_participantes: Array.from(setorSet),
          responsavel_id: p.responsavel_id || null,
          responsaveis_entrega: Array.from(respEntregaSet),
          responsaveis_atividade: Array.from(respAtividadeSet),
          participantes_atividade: Array.from(partAtividadeSet),
          status: p.status || 'ativo',
          status_projeto,
        }
      })
      setProjetos(cards)
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

  // Reset acao when OE changes
  useEffect(() => { setAcaoFilter('') }, [oeFilter])

  // Filtered projects
  const filteredProjetos = useMemo(() => {
    return projetos.filter(p => {
      if (searchText) {
        const s = searchText.toLowerCase()
        if (!p.nome.toLowerCase().includes(s) && !p.descricao.toLowerCase().includes(s)) return false
      }
      if (oeFilter) {
        if (!p.acoes.some(a => a.oe_codigo === oeFilter)) return false
      }
      if (acaoFilter) {
        if (!p.acoes.some(a => a.numero === acaoFilter)) return false
      }
      if (setorFilter) {
        const isLider = p.setor_lider_codigo === setorFilter
        const isParticipante = p.setores_participantes.includes(setorFilter)
        if (!isLider && !isParticipante) return false
      }
      if (tipoAcaoFilter) {
        if (!p.tipo_acao.includes(tipoAcaoFilter)) return false
      }
      if (responsavelFilter) {
        const isLider = p.responsavel_id === responsavelFilter
        const isRespEntrega = p.responsaveis_entrega.includes(responsavelFilter)
        const isRespAtividade = p.responsaveis_atividade.includes(responsavelFilter)
        const isPartAtividade = p.participantes_atividade.includes(responsavelFilter)
        if (!isLider && !isRespEntrega && !isRespAtividade && !isPartAtividade) return false
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
      return true
    })
  }, [projetos, searchText, oeFilter, acaoFilter, setorFilter, tipoAcaoFilter, responsavelFilter, statusFilter])

  const hasFilters = !!(searchText || oeFilter || acaoFilter || setorFilter || tipoAcaoFilter || responsavelFilter)

  function clearFilters() {
    setSearchText('')
    setOeFilter('')
    setAcaoFilter('')
    setSetorFilter('')
    setTipoAcaoFilter('')
    setResponsavelFilter('')
  }

  function toggleProject(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelectedIds(prev => {
      const next = new Set(prev)
      filteredProjetos.forEach(p => next.add(p.id))
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  async function handleGenerate() {
    setError('')

    if (!reportName.trim()) {
      setError('Informe o nome do relatório.')
      return
    }
    if (selectedIds.size === 0) {
      setError('Selecione pelo menos um projeto.')
      return
    }
    if (!sections.projeto && !sections.entregas && !sections.atividades) {
      setError('Selecione pelo menos uma seção.')
      return
    }

    setGenerating(true)
    try {
      await generateReportPDF(
        Array.from(selectedIds),
        { reportName: reportName.trim(), sections }
      )
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar relatório.')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-pulse text-sedec-500 font-medium">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <FileBarChart size={24} className="text-sedec-600" />
        <h1 className="text-2xl font-bold text-gray-800">Gerar Relatório PDF</h1>
      </div>

      {/* Nome do relatório */}
      <div className="card p-5 mb-4">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Nome do Relatório
        </label>
        <input
          type="text"
          className="input-field"
          placeholder="Ex: Relatório Trimestral Q1 2026"
          value={reportName}
          onChange={e => setReportName(e.target.value)}
        />
        <p className="text-xs text-gray-400 mt-1.5">
          O nome será usado como título do documento e no nome do arquivo (em snake_case, com data e hora).
        </p>
      </div>

      {/* Seções */}
      <div className="card p-5 mb-4">
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          Seções do Relatório
        </label>
        <div className="flex flex-wrap gap-3">
          {([
            { key: 'projeto' as const, label: 'Informações do Projeto' },
            { key: 'entregas' as const, label: 'Entregas' },
            { key: 'atividades' as const, label: 'Atividades' },
          ]).map(s => (
            <label
              key={s.key}
              className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg border cursor-pointer transition-all ${
                sections[s.key]
                  ? 'bg-sedec-50 border-sedec-300 text-sedec-700 font-medium'
                  : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <input
                type="checkbox"
                checked={sections[s.key]}
                onChange={() => setSections(prev => ({ ...prev, [s.key]: !prev[s.key] }))}
                className="accent-sedec-600"
              />
              {s.label}
            </label>
          ))}
        </div>
      </div>

      {/* Seleção de projetos */}
      <div className="card p-5 mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <label className="text-sm font-semibold text-gray-700 mr-auto">
            Projetos ({selectedIds.size} de {projetos.length} selecionados)
          </label>
          {/* Status filter toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button onClick={() => setStatusFilter('todos')}
              className={`px-2.5 py-1 text-xs font-medium transition-colors ${statusFilter === 'todos' ? 'bg-sedec-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              Todos
            </button>
            <button onClick={() => setStatusFilter('ativos')}
              className={`px-2.5 py-1 text-xs font-medium transition-colors ${statusFilter === 'ativos' ? 'bg-sedec-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              Ativos
            </button>
            <button onClick={() => setStatusFilter('concluidos')}
              className={`px-2.5 py-1 text-xs font-medium transition-colors ${statusFilter === 'concluidos' ? 'bg-sedec-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              Concluídos
            </button>
            <button onClick={() => setStatusFilter('hibernando')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-colors ${statusFilter === 'hibernando' ? 'bg-sedec-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              <Pause size={11} /> Hib.
            </button>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
              showFilters || hasFilters ? 'bg-sedec-50 border-sedec-300 text-sedec-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <Filter size={13} /> Filtros {hasFilters && '•'}
          </button>
        </div>

        {/* Filters panel */}
        {(showFilters || hasFilters) && (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-3 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
              <Filter size={14} /> Filtros
              {hasFilters && (
                <button onClick={clearFilters}
                  className="ml-auto text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                  <X size={13} /> Limpar
                </button>
              )}
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Buscar projeto..." value={searchText}
                onChange={e => setSearchText(e.target.value)} className="input-field pl-8"
                title="Busca por nome do projeto" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 cursor-help"
                title="Busca por nome do projeto"><Info size={12} /></span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* OE */}
              <div className="relative">
                <select value={oeFilter} onChange={e => setOeFilter(e.target.value)}
                  className="input-field"
                  title="Filtra projetos vinculados ao objetivo estratégico selecionado">
                  <option value="">Todos os objetivos</option>
                  {oes.map(o => <option key={o.codigo} value={o.codigo}>
                    {o.codigo} — {o.nome.substring(0, 60)}</option>)}
                </select>
                <span className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-300 cursor-help pointer-events-none"
                  title="Filtra projetos vinculados ao objetivo estratégico selecionado"><Info size={12} /></span>
              </div>

              {/* Ação */}
              <div className="relative">
                <select value={acaoFilter} onChange={e => setAcaoFilter(e.target.value)}
                  className="input-field"
                  title="Filtra projetos vinculados à ação estratégica selecionada (depende do filtro de objetivo)">
                  <option value="">Todas as ações</option>
                  {filteredAcoes.map(a => <option key={a.numero} value={a.numero}>
                    AE {a.numero}</option>)}
                </select>
                <span className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-300 cursor-help pointer-events-none"
                  title="Filtra projetos vinculados à ação estratégica selecionada (depende do filtro de objetivo)"><Info size={12} /></span>
              </div>

              {/* Setor */}
              <div className="relative">
                <select value={setorFilter} onChange={e => setSetorFilter(e.target.value)}
                  className="input-field"
                  title="Filtra por setor líder, setor responsável pela entrega ou setores participantes">
                  <option value="">Todos os setores</option>
                  {setores.map(s => <option key={s.codigo} value={s.codigo}>
                    {s.codigo}</option>)}
                </select>
                <span className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-300 cursor-help pointer-events-none"
                  title="Filtra por setor líder, setor responsável pela entrega ou setores participantes"><Info size={12} /></span>
              </div>

              {/* Tipo ação */}
              <div className="relative">
                <select value={tipoAcaoFilter} onChange={e => setTipoAcaoFilter(e.target.value)}
                  className="input-field"
                  title="Filtra pelo tipo de ação estratégica vinculada ao projeto">
                  <option value="">Todos os tipos de ação</option>
                  {['Prevenção', 'Mitigação', 'Preparação', 'Resposta', 'Recuperação', 'Gestão/Governança', 'Inovação', 'Integração']
                    .map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <span className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-300 cursor-help pointer-events-none"
                  title="Filtra pelo tipo de ação estratégica vinculada ao projeto"><Info size={12} /></span>
              </div>
            </div>

            {/* Responsável */}
            <div className="relative"
              title="Filtra projetos onde o usuário é líder do projeto, responsável ou participante de entrega/atividade">
              <UserAutocompleteSelect
                value={responsavelFilter || null}
                onChange={val => setResponsavelFilter(val || '')}
                users={filteredEligibleUsers}
                placeholder="Responsável/Participante"
              />
            </div>
          </div>
        )}

        {/* Actions + list */}
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <div className="flex gap-2 ml-auto">
            <button onClick={selectAll} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1">
              <CheckSquare size={13} /> Selecionar exibidos ({filteredProjetos.length})
            </button>
            <button onClick={clearSelection} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1">
              <Square size={13} /> Limpar seleção
            </button>
          </div>
        </div>

        {/* Project list */}
        <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
          {filteredProjetos.length === 0 && (
            <div className="text-center text-sm text-gray-400 py-6">Nenhum projeto encontrado com os filtros aplicados.</div>
          )}
          {filteredProjetos.map(p => (
            <label
              key={p.id}
              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${
                selectedIds.has(p.id) ? 'bg-sedec-50/50' : ''
              }`}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(p.id)}
                onChange={() => toggleProject(p.id)}
                className="accent-sedec-600 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <span className="text-sm text-gray-800 block truncate">{p.nome}</span>
                <span className="text-xs text-gray-400">
                  {p.setor_lider_codigo}
                  {p.acoes.length > 0 && ` · AE ${p.acoes.map(a => a.numero).join(', ')}`}
                </span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Erro */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 mb-4">
          {error}
        </div>
      )}

      {/* Botão gerar */}
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="btn-primary w-full py-3 text-base font-semibold flex items-center justify-center gap-2"
      >
        {generating ? (
          <>
            <Loader2 size={18} className="animate-spin" /> Gerando relatório...
          </>
        ) : (
          <>
            <FileBarChart size={18} /> Gerar PDF
          </>
        )}
      </button>
    </div>
  )
}
