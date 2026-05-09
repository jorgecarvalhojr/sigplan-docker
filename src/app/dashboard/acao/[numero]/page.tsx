'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ChevronDown, ChevronUp, MessageSquarePlus, Send, Clock, CheckCircle, XCircle } from 'lucide-react'
import { BLOCO_LABELS, STATUS_CONFIG } from '@/lib/utils'
import type { AcaoEstrategica, DestaqueEstrategico, DestaqueLinha, PanoramicoLinha, Ficha, Fundamentacao, Observacao, Profile } from '@/lib/types'

type BlocoKey = keyof typeof BLOCO_LABELS

export default function AcaoPage() {
  const params = useParams()
  const numero = decodeURIComponent(params.numero as string)
  const router = useRouter()
  const searchParams = useSearchParams()

  const [acao, setAcao] = useState<any>(null)
  const [destaque, setDestaque] = useState<DestaqueEstrategico | null>(null)
  const [panoramico, setPanoramico] = useState<PanoramicoLinha[]>([])
  const [fichas, setFichas] = useState<Ficha[]>([])
  const [fundamentacao, setFundamentacao] = useState<Fundamentacao | null>(null)
  const [observacoes, setObservacoes] = useState<Observacao[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [obsForm, setObsForm] = useState<{ bloco: string; text: string } | null>(null)
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [obsPermitida, setObsPermitida] = useState(false)
  const [obsVisivel, setObsVisivel] = useState(false)
  const [configLoaded, setConfigLoaded] = useState(false)

  useEffect(() => {
    loadAll()
  }, [numero])

  async function loadAll() {
    setLoading(true)

    const sessionRes = await fetch('/api/auth/session')
    if (!sessionRes.ok) { router.push('/login'); setLoading(false); return }
    const session = await sessionRes.json()
    if (!session.user) { router.push('/login'); setLoading(false); return }
    setProfile(session.user as Profile)

    // Dados via PostgreSQL Docker
    const res = await fetch(`/api/dados/acao/${encodeURIComponent(numero)}`)
    if (!res.ok) { setLoading(false); return }
    const data = await res.json()

    if (data.profile) setProfile(data.profile as Profile)
    if (data.acao) setAcao(data.acao)
    else { setLoading(false); return }

    if (data.destaque) {
      data.destaque.linhas?.sort((a: any, b: any) => a.ordem - b.ordem)
      setDestaque(data.destaque)
    }
    if (data.panoramico) setPanoramico(data.panoramico)
    if (data.fichas) setFichas(data.fichas)
    if (data.fundamentacao) {
      data.fundamentacao.itens?.sort((a: any, b: any) => a.ordem - b.ordem)
      setFundamentacao(data.fundamentacao)
    }
    if (data.observacoes) setObservacoes(data.observacoes)

    // Configurações
    const cfg = data.configuracoes || {}
    setObsPermitida(cfg['obs_permitir_criacao'] !== 'false')
    setObsVisivel(cfg['obs_exibir_para_usuarios'] !== 'false')
    setConfigLoaded(true)

    setLoading(false)
  }

  function toggle(key: string) {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function submitObs() {
    if (!obsForm || !obsForm.text.trim() || !profile || !acao) return
    setSending(true)

    // Mutação via PostgreSQL Docker
    await fetch(`/api/dados/acao/${encodeURIComponent(numero)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_observacao',
        bloco: obsForm.bloco,
        conteudo: obsForm.text.trim(),
      }),
    })

    setObsForm(null)
    setSending(false)
    // Recarregar observações
    loadAll()
  }

  function obsForBloco(bloco: string) {
    return observacoes.filter(o => o.bloco === bloco)
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20">
      <div className="animate-pulse text-sedec-500">Carregando...</div>
    </div>
  }

  if (!acao) {
    return <div className="text-center py-20 text-gray-400">Ação não encontrada.</div>
  }

  const blocos: { key: BlocoKey; hasContent: boolean }[] = [
    { key: 'descricao', hasContent: !!(acao.descricao_o_que || acao.descricao_para_que) },
    { key: 'ancoragem', hasContent: !!acao.ancoragem },
    { key: 'destaque', hasContent: !!destaque },
    { key: 'panoramico', hasContent: panoramico.length > 0 },
    { key: 'fichas', hasContent: fichas.length > 0 },
    { key: 'fundamentacao', hasContent: !!fundamentacao },
    { key: 'nota_institucional', hasContent: !!acao.nota_arranjo_institucional },
  ]

  return (
    <div>
      {/* Back button */}
      <button onClick={() => router.push(`/dashboard${searchParams.toString() ? '?' + searchParams.toString() : ''}`)}
        className="flex items-center gap-2 text-sm text-sedec-500 hover:text-sedec-700 mb-4">
        <ArrowLeft size={16} /> Voltar às ações
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="h-1 bg-gradient-to-r from-orange-500 via-orange-400 to-yellow-500" />
        <div className="p-6">
          <div className="flex flex-wrap items-start gap-3 mb-3">
            <h1 className="text-2xl font-bold text-sedec-600">AE {acao.numero}</h1>
            {acao.eixo_prioritario && (
              <span className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1 rounded-full font-medium">
                {acao.eixo_prioritario.nome}
              </span>
            )}
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">{acao.nome}</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {acao.objetivo_estrategico && (
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="text-xs font-medium text-gray-500 block mb-1">Objetivo Estratégico</span>
                <span className="text-gray-700">{acao.objetivo_estrategico.nome}</span>
              </div>
            )}
            {acao.estrategia && (
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="text-xs font-medium text-gray-500 block mb-1">Estratégia</span>
                <span className="text-gray-700">{acao.estrategia.nome}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expandable sections */}
      <div className="space-y-3">
        {blocos.filter(b => b.hasContent).map(({ key }) => (
          <div key={key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Section header */}
            <button
              onClick={() => toggle(key)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <span className="font-semibold text-gray-800 text-sm sm:text-base">{BLOCO_LABELS[key]}</span>
              <div className="flex items-center gap-2">
                {configLoaded && obsVisivel && obsForBloco(key).length > 0 && (
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                    {obsForBloco(key).length} obs.
                  </span>
                )}
                {expanded[key] ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
              </div>
            </button>

            {/* Section content */}
            {expanded[key] && (
              <div className="border-t border-gray-100 p-5">
                {/* Content by type */}
                {key === 'descricao' && <DescricaoContent acao={acao} />}
                {key === 'ancoragem' && <AncoragemContent text={acao.ancoragem} />}
                {key === 'destaque' && destaque && <DestaqueContent destaque={destaque} />}
                {key === 'panoramico' && <PanoramicoContent linhas={panoramico} />}
                {key === 'fichas' && <FichasContent fichas={fichas} />}
                {key === 'fundamentacao' && fundamentacao && <FundamentacaoContent fund={fundamentacao} />}
                {key === 'nota_institucional' && <NotaContent text={acao.nota_arranjo_institucional} />}

                {/* Observações for this bloco */}
                {configLoaded && (obsVisivel || profile?.role === 'admin') && (
                  <ObservacoesSection
                    bloco={key}
                    obs={obsForBloco(key)}
                    obsForm={obsForm}
                    setObsForm={setObsForm}
                    submitObs={submitObs}
                    sending={sending}
                    podecriar={obsPermitida && profile?.role !== 'usuario'}
                  />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ===== CONTENT COMPONENTS =====

function DescricaoContent({ acao }: { acao: any }) {
  return (
    <div className="space-y-3">
      <div className="bg-blue-50 rounded-lg p-4">
        <span className="text-xs font-bold text-blue-600 block mb-1">O QUÊ</span>
        <p className="text-sm text-gray-700 leading-relaxed">{acao.descricao_o_que}</p>
      </div>
      <div className="bg-green-50 rounded-lg p-4">
        <span className="text-xs font-bold text-green-600 block mb-1">PARA QUÊ</span>
        <p className="text-sm text-gray-700 leading-relaxed">{acao.descricao_para_que}</p>
      </div>
    </div>
  )
}

function AncoragemContent({ text }: { text: string }) {
  return (
    <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
      {text.split('\n').map((p, i) => p.trim() ? <p key={i}>{p}</p> : null)}
    </div>
  )
}

function DestaqueContent({ destaque }: { destaque: DestaqueEstrategico }) {
  return (
    <div>
      {destaque.titulo && (
        <h3 className="font-semibold text-sedec-600 mb-3">{destaque.titulo}</h3>
      )}
      {destaque.header_contexto && (
        <div className="bg-sedec-600 text-white text-sm font-medium px-4 py-2 rounded-t-lg">
          {destaque.header_contexto}
        </div>
      )}
      <div className="border border-gray-200 rounded-b-lg divide-y divide-gray-200">
        {destaque.linhas.map((l) => (
          <div key={l.id} className="flex">
            {l.tipo === 'label_conteudo' ? (
              <>
                <div className="w-1/4 min-w-[140px] bg-sedec-50 px-4 py-3 text-sm font-semibold text-sedec-700 border-r border-gray-200">
                  {l.label}
                </div>
                <div className="flex-1 px-4 py-3 text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                  {l.conteudo}
                </div>
              </>
            ) : (
              <div className="w-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-600">
                {l.conteudo}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function PanoramicoContent({ linhas }: { linhas: PanoramicoLinha[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-sedec-600 text-white">
            <th className="px-4 py-3 text-left font-medium">Setor</th>
            <th className="px-4 py-3 text-left font-medium">Papel</th>
            <th className="px-4 py-3 text-left font-medium">Síntese da Contribuição</th>
            <th className="px-4 py-3 text-left font-medium">NÃO faz</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {linhas.map((l, i) => (
            <tr key={l.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{l.setor_display}</td>
              <td className="px-4 py-3 text-gray-700">{l.papel}</td>
              <td className="px-4 py-3 text-gray-700">{l.sintese_contribuicao}</td>
              <td className="px-4 py-3 text-gray-500 text-xs">{l.nao_faz}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FichasContent({ fichas }: { fichas: Ficha[] }) {
  const [expandedFicha, setExpandedFicha] = useState<number | null>(null)

  return (
    <div className="space-y-3">
      {fichas.map(f => (
        <div key={f.id} className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setExpandedFicha(expandedFicha === f.id ? null : f.id)}
            className="w-full bg-sedec-600 text-white px-4 py-3 flex items-center justify-between text-sm font-medium hover:bg-sedec-700"
          >
            <span>{f.titulo}</span>
            {expandedFicha === f.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          {expandedFicha === f.id && (
            <div className="divide-y divide-gray-200">
              <FichaRow label="Setor" value={f.setor_display} />
              <FichaRow label="Papel" value={f.papel} />
              <FichaRow label="Justificativa" value={f.justificativa} />
              <FichaRow label="Contribuição esperada" items={f.contribuicao_esperada} />
              <FichaRow label="NÃO-ESCOPO" items={f.nao_escopo} />
              <FichaRow label="Dependências críticas" items={f.dependencias_criticas} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function FichaRow({ label, value, items }: { label: string; value?: string; items?: string[] }) {
  return (
    <div className="flex">
      <div className="w-1/4 min-w-[160px] bg-sedec-50 px-4 py-3 text-sm font-semibold text-sedec-700 border-r border-gray-200">
        {label}
      </div>
      <div className="flex-1 px-4 py-3 text-sm text-gray-700">
        {value && <p className="leading-relaxed">{value}</p>}
        {items && items.length > 0 && (
          <ul className="space-y-1.5">
            {items.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-sedec-400 mt-1">•</span>
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function FundamentacaoContent({ fund }: { fund: Fundamentacao }) {
  return (
    <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
      {fund.introducao && <p>{fund.introducao}</p>}
      {fund.itens.map(item => (
        <div key={item.id} className="bg-gray-50 rounded-lg p-4">
          <p>{item.conteudo}</p>
        </div>
      ))}
      {fund.conclusao && (
        <p className="border-l-4 border-sedec-400 pl-4 italic text-gray-600">{fund.conclusao}</p>
      )}
    </div>
  )
}

function NotaContent({ text }: { text: string }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="text-xs font-bold text-amber-700 mb-2">⚠ NOTA SOBRE ARRANJO INSTITUCIONAL</div>
      <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{text}</div>
    </div>
  )
}

// ===== OBSERVAÇÕES =====

function ObservacoesSection({ bloco, obs, obsForm, setObsForm, submitObs, sending, podecriar }: {
  bloco: string
  obs: Observacao[]
  obsForm: { bloco: string; text: string } | null
  setObsForm: (v: { bloco: string; text: string } | null) => void
  submitObs: () => void
  sending: boolean
  podecriar: boolean
}) {
  const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'em_analise') return <Clock size={14} />
    if (status === 'absorvida') return <CheckCircle size={14} />
    return <XCircle size={14} />
  }

  return (
    <div className="mt-6 pt-4 border-t border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Observações</span>
        {podecriar && (!obsForm || obsForm.bloco !== bloco) && (
          <button
            onClick={() => setObsForm({ bloco, text: '' })}
            className="flex items-center gap-1 text-xs text-sedec-500 hover:text-sedec-700 font-medium"
          >
            <MessageSquarePlus size={14} /> Adicionar observação
          </button>
        )}
        {!podecriar && (
          <span className="text-xs text-gray-400 italic">Observações desabilitadas pelo administrador</span>
        )}
      </div>

      {/* Form */}
      {podecriar && obsForm?.bloco === bloco && (
        <div className="bg-blue-50 rounded-lg p-3 mb-3">
          <textarea
            value={obsForm.text}
            onChange={e => setObsForm({ bloco, text: e.target.value })}
            placeholder="Escreva sua observação..."
            className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-sedec-400"
            rows={3}
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={() => setObsForm(null)} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5">
              Cancelar
            </button>
            <button
              onClick={submitObs}
              disabled={!obsForm.text.trim() || sending}
              className="flex items-center gap-1 text-xs btn-primary py-1.5"
            >
              <Send size={12} /> {sending ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {obs.length > 0 ? (
        <div className="space-y-2">
          {obs.map(o => {
            const st = STATUS_CONFIG[o.status] || STATUS_CONFIG.em_analise
            return (
              <div key={o.id} className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700">{o.autor_nome}</span>
                    {o.autor_setor && (
                      <span className="text-xs bg-white px-2 py-0.5 rounded text-gray-500">{o.autor_setor}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${st.bg} ${st.color}`}>
                      <StatusIcon status={o.status} /> {st.label}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(o.created_at).toLocaleDateString('pt-BR')} {new Date(o.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                <p className="text-gray-700 leading-relaxed">{o.conteudo}</p>
                {o.resposta_admin && (
                  <div className="mt-2 pt-2 border-t border-orange-200 text-xs text-gray-600 italic">
                    <span className="font-medium">Resposta:</span> {o.resposta_admin}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-xs text-gray-400 italic">Nenhuma observação para esta seção.</p>
      )}
    </div>
  )
}
