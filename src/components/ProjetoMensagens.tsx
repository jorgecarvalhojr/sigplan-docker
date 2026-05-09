'use client'

import { useEffect, useState, useRef } from 'react'
import { MessageSquare, Send, ChevronDown, ChevronUp, Check, CheckCheck, Users } from 'lucide-react'
import type { Profile } from '@/lib/types'

interface Setor {
  id: number
  codigo: string
  nome_completo: string
}

interface MensagemDisplay {
  id: number
  projeto_id: number
  autor_id: string
  conteudo: string
  created_at: string
  autor_nome: string
  autor_setor_codigo: string
  autor_setor_id: number | null
  destinatarios: { setor_id: number; codigo: string; nome_completo: string }[]
  lida_por_mim: boolean
}

interface Props {
  projetoId: number
  profile: Profile
  setoresElegiveis: Setor[]
  canSendMessage: boolean
}

export default function ProjetoMensagens({ projetoId, profile, setoresElegiveis, canSendMessage }: Props) {
  const [mensagens, setMensagens] = useState<MensagemDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [conteudo, setConteudo] = useState('')
  const [destinatarioIds, setDestinatarioIds] = useState<number[]>([])
  const [sending, setSending] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadMensagens()
  }, [projetoId])

  useEffect(() => {
    if (expanded && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [expanded, mensagens.length])

  async function loadMensagens() {
    setLoading(true)
    try {
      const res = await fetch(`/api/mensagens?projetoId=${projetoId}`)
      if (res.ok) {
        const data = await res.json()
        setMensagens(data)

        // Calculate unread: messages addressed to my sector that I haven't read
        const mySetorId = profile.setor_id
        const isAdminOrMaster = profile.role === 'admin' || profile.role === 'master'
        const unread = data.filter((m: any) => {
          if (m.autor_id === profile.id) return false
          if (m.lida_por_mim) return false
          if (isAdminOrMaster) return true
          return mySetorId && m.destinatarios.some((d: any) => d.setor_id === mySetorId)
        })
        setUnreadCount(unread.length)
      }
    } catch (err) {
      console.error('Erro ao carregar mensagens', err)
    } finally {
      setLoading(false)
    }
  }

  async function marcarComoLida(mensagemId: number) {
    try {
      await fetch('/api/mensagens/lida', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagemId })
      })
      setMensagens(prev => prev.map(m => m.id === mensagemId ? { ...m, lida_por_mim: true } : m))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Erro ao marcar como lida', err)
    }
  }

  async function marcarTodasComoLidas() {
    try {
      await fetch('/api/mensagens/lida', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projetoId, marcarTodas: true })
      })
      setMensagens(prev => prev.map(m => ({ ...m, lida_por_mim: true })))
      setUnreadCount(0)
    } catch (err) {
      console.error('Erro ao marcar todas como lidas', err)
    }
  }

  async function enviarMensagem() {
    if (!conteudo.trim()) { alert('Digite o conteúdo da mensagem.'); return }
    if (destinatarioIds.length === 0) { alert('Selecione ao menos um setor destinatário.'); return }

    setSending(true)
    try {
      const res = await fetch('/api/mensagens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projetoId, 
          conteudo: conteudo.trim(),
          destinatarioIds
        })
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Erro ao enviar')
      }

      setConteudo('')
      setDestinatarioIds([])
      await loadMensagens()
    } catch (err: any) {
      alert('Erro ao enviar mensagem: ' + err.message)
    } finally {
      setSending(false)
    }
  }

  function toggleDestinatario(setorId: number) {
    setDestinatarioIds(prev =>
      prev.includes(setorId) ? prev.filter(id => id !== setorId) : [...prev, setorId]
    )
  }

  function selectAllDestinatarios() {
    if (destinatarioIds.length === setoresElegiveis.length) {
      setDestinatarioIds([])
    } else {
      setDestinatarioIds(setoresElegiveis.map(s => s.id))
    }
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday = d.toDateString() === yesterday.toDateString()

    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    if (isToday) return `Hoje, ${time}`
    if (isYesterday) return `Ontem, ${time}`
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) + `, ${time}`
  }

  function isMessageForMe(msg: MensagemDisplay) {
    if (msg.autor_id === profile.id) return true
    if (profile.role === 'admin' || profile.role === 'master') return true
    return profile.setor_id ? msg.destinatarios.some(d => d.setor_id === profile.setor_id) : false
  }

  return (
    <div className="mb-5 bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => { setExpanded(!expanded); if (!expanded) marcarTodasComoLidas() }}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-blue-50/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <MessageSquare size={18} className="text-blue-600" />
          <span className="font-bold text-gray-800 text-sm">Mensagens do Projeto</span>
          {unreadCount > 0 && (
            <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
              {unreadCount} não lida{unreadCount > 1 ? 's' : ''}
            </span>
          )}
          <span className="text-xs text-gray-400">({mensagens.length} mensagem{mensagens.length !== 1 ? 'ns' : ''})</span>
        </div>
        {expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-blue-100">
          {/* Messages list */}
          <div className="max-h-96 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
            {loading && <p className="text-xs text-gray-400 text-center py-4">Carregando mensagens...</p>}
            {!loading && mensagens.length === 0 && (
              <p className="text-xs text-gray-400 italic text-center py-6">Nenhuma mensagem neste projeto.</p>
            )}
            {mensagens.filter(m => isMessageForMe(m)).map((msg) => {
              const isMyMessage = msg.autor_id === profile.id
              const isUnread = !msg.lida_por_mim && !isMyMessage
              return (
                <div
                  key={msg.id}
                  className={`rounded-xl p-3.5 text-sm transition-all ${
                    isMyMessage
                      ? 'bg-blue-50 border border-blue-200 ml-8'
                      : isUnread
                        ? 'bg-white border-l-4 border-l-blue-500 border border-blue-200 shadow-sm mr-8'
                        : 'bg-white border border-gray-200 mr-8'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800 text-xs">{msg.autor_nome}</span>
                      {msg.autor_setor_codigo && (
                        <span className="bg-gray-200 text-gray-600 text-[10px] font-bold px-1.5 py-0.5 rounded">
                          {msg.autor_setor_codigo}
                        </span>
                      )}
                      <span className="text-[10px] text-gray-400">{formatDate(msg.created_at)}</span>
                    </div>
                    {isUnread && (
                      <button
                        onClick={() => marcarComoLida(msg.id)}
                        className="text-blue-500 hover:text-blue-700 transition-colors shrink-0"
                        title="Marcar como lida"
                      >
                        <Check size={14} />
                      </button>
                    )}
                    {msg.lida_por_mim && !isMyMessage && (
                      <CheckCheck size={14} className="text-blue-400 shrink-0" />
                    )}
                  </div>

                  {/* Destinatários tags */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    <span className="text-[10px] text-gray-400">Para:</span>
                    {msg.destinatarios.map(d => (
                      <span key={d.setor_id} className="bg-blue-100 text-blue-700 text-[10px] font-medium px-1.5 py-0.5 rounded" title={d.nome_completo}>
                        @{d.codigo}
                      </span>
                    ))}
                  </div>

                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{msg.conteudo}</p>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Compose area */}
          {canSendMessage && (
            <div className="border-t border-blue-100 p-4 bg-white">
              {/* Destinatários selection */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                    <Users size={12} /> Destinatários
                  </label>
                  <button
                    type="button"
                    onClick={selectAllDestinatarios}
                    className="text-[10px] text-blue-600 hover:text-blue-800 underline"
                  >
                    {destinatarioIds.length === setoresElegiveis.length ? 'Desmarcar todos' : 'Selecionar todos'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {setoresElegiveis.map(setor => {
                    const selected = destinatarioIds.includes(setor.id)
                    return (
                      <button
                        key={setor.id}
                        type="button"
                        onClick={() => toggleDestinatario(setor.id)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-all font-medium ${
                          selected
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                        }`}
                        title={setor.nome_completo}
                      >
                        @{setor.codigo}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Message input */}
              <div className="flex gap-2">
                <textarea
                  value={conteudo}
                  onChange={e => setConteudo(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm text-gray-700 resize-none leading-relaxed"
                  rows={2}
                  placeholder="Digite sua mensagem..."
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault()
                      enviarMensagem()
                    }
                  }}
                />
                <button
                  onClick={enviarMensagem}
                  disabled={sending || !conteudo.trim() || destinatarioIds.length === 0}
                  className="self-end px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 text-sm font-medium"
                  title="Enviar (Ctrl+Enter)"
                >
                  <Send size={14} />
                  {sending ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Ctrl+Enter para enviar</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
