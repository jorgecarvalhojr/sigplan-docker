'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Filter, X, ChevronRight, Target, Compass, Star, Users2 } from 'lucide-react'

interface AcaoCard {
  id: number
  numero: string
  nome: string
  eixo: string
  oe: string
  estrategia: string
}

// Ordena números de ação como numéricos: 1.1.3, 2.1.1, ..., 10.1.2
function compareNumero(a: string, b: string): number {
  const partsA = a.split('.').map(Number)
  const partsB = b.split('.').map(Number)
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const diff = (partsA[i] || 0) - (partsB[i] || 0)
    if (diff !== 0) return diff
  }
  return 0
}

export default function DashboardPage() {
  const [acoes, setAcoes] = useState<AcaoCard[]>([])
  const [setores, setSetores] = useState<{ codigo: string; nome_completo: string }[]>([])
  const [eixos, setEixos] = useState<{ codigo: string; nome: string }[]>([])
  const [oes, setOes] = useState<{ codigo: string; nome: string }[]>([])
  const [setorFilter, setSetorFilter] = useState('')
  const [eixoFilter, setEixoFilter] = useState('')
  const [oeFilter, setOeFilter] = useState('')
  const [search, setSearch] = useState('')
  // Mapa: setor_codigo → { especifico: [acao_ids], conjunto: [acao_ids] }
  const [setorAcoes, setSetorAcoes] = useState<Record<string, { especifico: number[]; conjunto: number[] }>>({})
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Inicializa filtros a partir da URL (restaura estado ao voltar)
  useEffect(() => {
    const s = searchParams.get('setor')
    const e = searchParams.get('eixo')
    const o = searchParams.get('oe')
    const q = searchParams.get('q')
    if (s) setSetorFilter(s)
    if (e) setEixoFilter(e)
    if (o) setOeFilter(o)
    if (q) setSearch(q)
  }, [])

  // Monta query string com filtros ativos (para navegação)
  function buildFilterParams(): string {
    const params = new URLSearchParams()
    if (setorFilter) params.set('setor', setorFilter)
    if (eixoFilter) params.set('eixo', eixoFilter)
    if (oeFilter) params.set('oe', oeFilter)
    if (search) params.set('q', search)
    const qs = params.toString()
    return qs ? `?${qs}` : ''
  }

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/dashboard/data')
        if (!res.ok) {
          if (res.status === 401) router.push('/login')
          return
        }
        const data = await res.json()

        // 1. Processar Ações
        if (data.acoes) {
          const sorted = data.acoes
            .map((a: any) => ({
              id: a.id,
              numero: a.numero,
              nome: a.nome,
              eixo: a.eixo_nome || '',
              oe: a.oe_nome || '',
              estrategia: a.estrategia_nome || '',
            }))
            .sort((a: any, b: any) => compareNumero(a.numero, b.numero))
          setAcoes(sorted)
        }

        // 2. Setar Filtros
        if (data.setores) setSetores(data.setores)
        if (data.eixos) setEixos(data.eixos)
        if (data.oes) setOes(data.oes)

        // 3. Mapeamento Setor-Ação
        if (data.fichaSetores) {
          const ESPECIFICO = new Set(['principal', 'coordenador'])
          const map: Record<string, { especifico: Set<number>; conjunto: Set<number> }> = {}
          
          data.fichaSetores.forEach((fs: any) => {
            const cod = fs.setor_codigo
            if (!cod) return
            if (!map[cod]) map[cod] = { especifico: new Set(), conjunto: new Set() }
            const acaoId = fs.acao_estrategica_id
            if (ESPECIFICO.has(fs.tipo_participacao)) {
              map[cod].especifico.add(acaoId)
            } else {
              map[cod].conjunto.add(acaoId)
            }
          })

          const result: Record<string, { especifico: number[]; conjunto: number[] }> = {}
          for (const [k, v] of Object.entries(map)) {
            const especificoArr = Array.from(v.especifico)
            const conjuntoArr = Array.from(v.conjunto).filter(id => !v.especifico.has(id))
            result[k] = { especifico: especificoArr, conjunto: conjuntoArr }
          }
          setSetorAcoes(result)
        }
      } catch (err) {
        console.error('Erro ao carregar dashboard', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Aplica filtros de busca, eixo e OE (sem setor — setor é tratado na renderização)
  const baseFiltered = useMemo(() => {
    let result = acoes

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(a =>
        a.numero.includes(q) || a.nome.toLowerCase().includes(q)
      )
    }

    if (eixoFilter) {
      result = result.filter(a => a.eixo.includes(eixoFilter))
    }

    if (oeFilter) {
      result = result.filter(a => a.oe.includes(oeFilter))
    }

    return result
  }, [acoes, search, eixoFilter, oeFilter])

  // Quando tem filtro de setor: separa em 2 grupos
  // Quando não tem: retorna lista plana
  const { grouped, flat } = useMemo(() => {
    if (!setorFilter) {
      return { grouped: null, flat: baseFiltered }
    }

    const mapping = setorAcoes[setorFilter]
    if (!mapping) {
      return { grouped: { especifico: [], conjunto: [] }, flat: null }
    }

    const especifico = baseFiltered
      .filter(a => mapping.especifico.includes(a.id))
      .sort((a, b) => compareNumero(a.numero, b.numero))
    const conjunto = baseFiltered
      .filter(a => mapping.conjunto.includes(a.id))
      .sort((a, b) => compareNumero(a.numero, b.numero))

    return { grouped: { especifico, conjunto }, flat: null }
  }, [baseFiltered, setorFilter, setorAcoes])

  const totalFiltered = flat ? flat.length : (grouped ? grouped.especifico.length + grouped.conjunto.length : 0)
  const hasFilters = search || eixoFilter || oeFilter || setorFilter

  function clearFilters() {
    setSearch(''); setEixoFilter(''); setOeFilter(''); setSetorFilter('')
  }

  function eixoShort(nome: string) {
    const m = nome.match(/EIXO\s*(\d+)/)
    return m ? `Eixo ${m[1]}` : nome.substring(0, 15)
  }

  function eixoColor(nome: string): string {
    const m = nome.match(/EIXO\s*(\d+)/)
    if (!m) return 'bg-gray-100 text-gray-700'
    const colors: Record<string, string> = {
      '1': 'bg-blue-100 text-blue-700',
      '2': 'bg-amber-100 text-amber-700',
      '3': 'bg-emerald-100 text-emerald-700',
      '4': 'bg-purple-100 text-purple-700',
      '5': 'bg-rose-100 text-rose-700',
    }
    return colors[m[1]] || 'bg-gray-100 text-gray-700'
  }

  function renderCard(acao: AcaoCard, subtle?: boolean) {
    return (
      <button
        key={acao.id}
        onClick={() => router.push(`/dashboard/acao/${acao.numero}${buildFilterParams()}`)}
        className={`card p-5 text-left group hover:border-orange-300 transition-colors ${subtle ? 'opacity-70 border-dashed' : ''}`}
      >
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-orange-400 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-xl" />
        <div className="flex items-start justify-between mb-3">
          <span className="text-lg font-bold text-sedec-600">AE {acao.numero}</span>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${eixoColor(acao.eixo)}`}>
            {eixoShort(acao.eixo)}
          </span>
        </div>

        <h3 className="text-sm font-semibold text-gray-800 mb-3 leading-snug min-h-[2.5rem] line-clamp-2 group-hover:line-clamp-none">
          {acao.nome}
        </h3>

        <div className="space-y-1.5 text-xs text-gray-500">
          <div className="flex items-start gap-1.5">
            <Target size={12} className="mt-0.5 shrink-0 text-gray-400" />
            <span className="line-clamp-1">{acao.oe}</span>
          </div>
          <div className="flex items-start gap-1.5">
            <Compass size={12} className="mt-0.5 shrink-0 text-gray-400" />
            <span className="line-clamp-1">{acao.estrategia}</span>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center text-xs text-orange-600 font-medium group-hover:text-orange-700">
          Ver enquadramento completo
          <ChevronRight size={14} className="ml-1 group-hover:translate-x-1 transition-transform" />
        </div>
      </button>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-sedec-500 font-medium">Carregando ações estratégicas...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Ações Estratégicas Prioritárias</h1>
        <p className="text-gray-500 text-sm mt-1">Enquadramentos Estratégicos Setoriais — Exercício 2026</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
          <Filter size={16} />
          Filtros
          {hasFilters && (
            <button onClick={clearFilters} className="ml-auto text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
              <X size={14} /> Limpar filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por número ou nome..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pl-9"
            />
          </div>

          <select value={setorFilter} onChange={e => setSetorFilter(e.target.value)} className="input-field">
            <option value="">Todos os setores</option>
            {setores.map(s => (
              <option key={s.codigo} value={s.codigo}>{s.codigo} — {s.nome_completo}</option>
            ))}
          </select>

          <select value={eixoFilter} onChange={e => setEixoFilter(e.target.value)} className="input-field">
            <option value="">Todos os eixos</option>
            {eixos.map(e => (
              <option key={e.codigo} value={e.nome}>{e.nome}</option>
            ))}
          </select>

          <select value={oeFilter} onChange={e => setOeFilter(e.target.value)} className="input-field">
            <option value="">Todos os OEs</option>
            {oes.map(o => (
              <option key={o.codigo} value={o.nome}>{o.codigo} — {o.nome.substring(0, 50)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-500 mb-4">
        {totalFiltered} de {acoes.length} ações
        {hasFilters && ' (filtradas)'}
      </div>

      {/* === SEM FILTRO DE SETOR: lista plana === */}
      {flat && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
          {flat.map(acao => renderCard(acao))}
        </div>
      )}

      {/* === COM FILTRO DE SETOR: 2 grupos === */}
      {grouped && (
        <div className="space-y-8">
          {/* Grupo 1: Participação específica */}
          {grouped.especifico.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-1 pb-2 border-b-2 border-orange-300">
                <Star size={16} className="text-orange-500" />
                <h2 className="text-sm font-bold text-gray-700">
                  Participação específica
                </h2>
                <span className="text-xs text-gray-400 ml-1">
                  {grouped.especifico.length} {grouped.especifico.length === 1 ? 'ação' : 'ações'}
                </span>
              </div>
              <p className="text-xs text-gray-400 mb-3">
                O setor possui ficha própria com papel, contribuição e escopo definidos.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
                {grouped.especifico.map(acao => renderCard(acao))}
              </div>
            </div>
          )}

          {/* Grupo 2: Participação em conjunto */}
          {grouped.conjunto.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-1 pb-2 border-b-2 border-gray-300">
                <Users2 size={16} className="text-gray-400" />
                <h2 className="text-sm font-bold text-gray-500">
                  Participação em conjunto
                </h2>
                <span className="text-xs text-gray-400 ml-1">
                  {grouped.conjunto.length} {grouped.conjunto.length === 1 ? 'ação' : 'ações'}
                </span>
              </div>
              <p className="text-xs text-gray-400 mb-3">
                O setor participa dentro de um grupo mais amplo (apoio, validação ou atuação passiva).
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
                {grouped.conjunto.map(acao => renderCard(acao, true))}
              </div>
            </div>
          )}

          {grouped.especifico.length === 0 && grouped.conjunto.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              Nenhuma ação encontrada para este setor com os filtros aplicados.
            </div>
          )}
        </div>
      )}

      {flat && flat.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          Nenhuma ação encontrada com os filtros aplicados.
        </div>
      )}
    </div>
  )
}
