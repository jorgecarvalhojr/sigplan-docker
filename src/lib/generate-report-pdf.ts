import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface ReportOptions {
  reportName: string
  sections: { projeto: boolean; entregas: boolean; atividades: boolean }
}

const STATUS_LABELS: Record<string, string> = {
  aberta: 'Aberta',
  em_andamento: 'Em andamento',
  aguardando: 'Aguardando',
  resolvida: 'Resolvida',
  cancelada: 'Cancelada',
  ativo: 'Ativo',
  hibernando: 'Hibernando',
}

const PROBABILIDADE_LABELS: Record<string, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  const parts = d.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return d
}

function toSnakeCase(str: string): string {
  return str
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
}

// Colors
const PRIMARY = [31, 56, 100] as const   // #1F3864 sedec
const ACCENT = [233, 119, 36] as const    // #E97724 orange
const LIGHT_BG = [245, 247, 250] as const // light gray bg
const WHITE = [255, 255, 255] as const

export async function generateReportPDF(
  projectIds: number[],
  options: ReportOptions
): Promise<void> {
  // Fetch full project data via Local API
  const res = await fetch(`/api/dados/relatorios/projeto-completo?ids=${projectIds.join(',')}`)
  if (!res.ok) {
    const errorData = await res.json()
    throw new Error('Erro ao buscar projetos: ' + (errorData.error || res.statusText))
  }
  
  const { projetos, namesMap } = await res.json()
  
  if (!projetos || projetos.length === 0) throw new Error('Nenhum projeto encontrado.')

  // Ordenar entregas e atividades seguindo o mesmo critério do sistema
  for (const proj of projetos) {
    // Atividades: por data (mais cedo primeiro, sem data por último)
    proj.entregas?.forEach((e: any) => e.atividades?.sort((a: any, b: any) => {
      if (!a.data_prevista && !b.data_prevista) return a.id - b.id
      if (!a.data_prevista) return 1
      if (!b.data_prevista) return -1
      return a.data_prevista.localeCompare(b.data_prevista)
    }))
    // Entregas: pela data da primeira atividade (mais cedo primeiro, sem atividades por último)
    proj.entregas?.sort((a: any, b: any) => {
      const aFirst = a.atividades?.find((at: any) => at.data_prevista)?.data_prevista
      const bFirst = b.atividades?.find((at: any) => at.data_prevista)?.data_prevista
      if (!aFirst && !bFirst) return a.id - b.id
      if (!aFirst) return 1
      if (!bFirst) return -1
      return aFirst.localeCompare(bFirst)
    })
  }

  // Fetch indicadores and riscos (already included in the API response)
  const indicadoresMap: Record<number, any[]> = {}
  const riscosMap: Record<number, any[]> = {}

  for (const proj of projetos) {
    if (proj.indicadores) indicadoresMap[proj.id] = proj.indicadores
    if (proj.riscos) riscosMap[proj.id] = proj.riscos
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const marginL = 15
  const marginR = 15
  const contentW = pageW - marginL - marginR
  let y = 0

  // --- Cover page ---
  // Background band at top
  doc.setFillColor(...PRIMARY)
  doc.rect(0, 0, pageW, 80, 'F')

  // Orange accent line
  doc.setFillColor(...ACCENT)
  doc.rect(0, 80, pageW, 2, 'F')

  // Report title
  doc.setTextColor(...WHITE)
  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  const titleLines = doc.splitTextToSize(options.reportName, contentW)
  doc.text(titleLines, pageW / 2, 40, { align: 'center' })

  // Subtitle
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(200, 210, 230)
  doc.text('SIGPLAN — Sistema de Governança e Planejamento', pageW / 2, 65, { align: 'center' })

  // Date
  const now = new Date()
  const dateStr = `Gerado em ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} às ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  doc.setTextColor(100)
  doc.setFontSize(10)
  doc.text(dateStr, pageW / 2, 95, { align: 'center' })

  // Project count
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text(`${projetos.length} projeto(s) incluído(s)`, pageW / 2, 103, { align: 'center' })

  // Sections included
  const secLabels = []
  if (options.sections.projeto) secLabels.push('Informações do Projeto')
  if (options.sections.entregas) secLabels.push('Entregas')
  if (options.sections.atividades) secLabels.push('Atividades')
  doc.text(`Seções: ${secLabels.join(', ')}`, pageW / 2, 111, { align: 'center' })

  // Table of contents
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(50)
  doc.text('Projetos incluídos', marginL, 130)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80)
  let tocY = 140
  for (let i = 0; i < projetos.length; i++) {
    const setor = projetos[i].setor_lider ? `(${projetos[i].setor_lider.codigo})` : ''
    const tocText = `${i + 1}. ${projetos[i].nome} ${setor}`
    const tocLines = doc.splitTextToSize(tocText, contentW - 4)
    const blockH = tocLines.length * 5
    if (tocY + blockH > pageH - 20) {
      doc.addPage()
      tocY = 20
    }
    for (const line of tocLines) {
      doc.text(line, marginL + 2, tocY)
      tocY += 5
    }
    tocY += 2
  }

  // --- Helper functions ---
  function checkSpace(needed: number) {
    if (y + needed > pageH - 20) {
      doc.addPage()
      y = 20
    }
  }

  function addSectionHeader(text: string) {
    checkSpace(14)
    doc.setFillColor(...PRIMARY)
    doc.roundedRect(marginL, y, contentW, 10, 2, 2, 'F')
    doc.setTextColor(...WHITE)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text(text, marginL + 5, y + 7)
    y += 14
  }

  function addSubheader(text: string, color: readonly number[] = ACCENT) {
    checkSpace(12)
    doc.setFillColor(color[0], color[1], color[2])
    doc.rect(marginL, y, 3, 8, 'F')
    doc.setTextColor(50)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(text, marginL + 6, y + 6)
    y += 12
  }

  function addField(label: string, value: string | null | undefined, indent = 0) {
    if (!value) return
    const x = marginL + indent
    const availW = contentW - indent
    checkSpace(12)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(80)
    doc.text(label + ':', x, y)
    const labelW = doc.getTextWidth(label + ': ')
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(50)
    const lines = doc.splitTextToSize(value, availW - labelW - 2)
    if (lines.length === 1) {
      doc.text(lines[0], x + labelW + 1, y)
      y += 6
    } else {
      y += 5
      const textW = availW - 4
      const allLines = doc.splitTextToSize(value, textW)
      for (let li = 0; li < allLines.length; li++) {
        checkSpace(5)
        const isLast = li === allLines.length - 1
        doc.text(allLines[li], x + 4, y, isLast ? undefined : { align: 'justify', maxWidth: textW })
        y += 4.5
      }
      y += 2
    }
  }

  function addMultilineField(label: string, value: string | null | undefined, indent = 0) {
    if (!value) return
    const x = marginL + indent
    const availW = contentW - indent
    checkSpace(14)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(80)
    doc.text(label + ':', x, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(50)
    const textW = availW - 4
    const lines = doc.splitTextToSize(value, textW)
    for (let li = 0; li < lines.length; li++) {
      checkSpace(5)
      const isLast = li === lines.length - 1
      doc.text(lines[li], x + 4, y, isLast ? undefined : { align: 'justify', maxWidth: textW })
      y += 4.5
    }
    y += 2
  }

  // --- Render each project ---
  for (let pi = 0; pi < projetos.length; pi++) {
    const proj = projetos[pi]
    doc.addPage()
    y = 15

    // Project header bar
    doc.setFillColor(...PRIMARY)
    doc.roundedRect(marginL, y, contentW, 14, 2, 2, 'F')
    doc.setFillColor(...ACCENT)
    doc.rect(marginL, y + 14, contentW, 1.5, 'F')
    doc.setTextColor(...WHITE)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    const projTitle = doc.splitTextToSize(proj.nome, contentW - 10)
    doc.text(projTitle[0], marginL + 5, y + 9)
    y += 20

    // Setor lider and date
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100)
    const setorStr = proj.setor_lider ? `Setor líder: ${proj.setor_lider.codigo} — ${proj.setor_lider.nome_completo}` : ''
    if (setorStr) { doc.text(setorStr, marginL, y); y += 5 }
    if (proj.responsavel_id && namesMap[proj.responsavel_id]) {
      doc.text(`Responsável: ${namesMap[proj.responsavel_id]}`, marginL, y); y += 5
    }
    if (proj.data_inicio) {
      doc.text(`Data de início: ${formatDate(proj.data_inicio)}`, marginL, y); y += 5
    }
    if (proj.status) {
      doc.text(`Status: ${STATUS_LABELS[proj.status] || proj.status}`, marginL, y); y += 5
    }

    // Acoes estrategicas
    const acoes = proj.projeto_acoes || []
    if (acoes.length > 0) {
      const acaoNames = acoes.map((a: any) => `${a.acao_estrategica?.numero} — ${a.acao_estrategica?.nome}`).join('; ')
      const acaoText = `Ações estratégicas: ${acaoNames}`
      const acaoLines = doc.splitTextToSize(acaoText, contentW)
      for (const line of acaoLines) {
        doc.text(line, marginL, y); y += 5
      }
    }

    y += 4

    // --- Section: Projeto ---
    if (options.sections.projeto) {
      addSectionHeader('Informações do Projeto')

      addMultilineField('Descrição', proj.descricao)
      addMultilineField('Problema que resolve', proj.problema_resolve)
      addMultilineField('Causas', proj.causas)
      addMultilineField('Consequências diretas', proj.consequencias_diretas)
      addMultilineField('Objetivos', proj.objetivos)
      addField('Indicador de sucesso', proj.indicador_sucesso)

      if (proj.tipo_acao && proj.tipo_acao.length > 0) {
        addField('Tipo de ação', proj.tipo_acao.join(', '))
      }
      addMultilineField('Dependências de outros projetos', proj.dependencias_projetos)

      // Indicadores table
      const indicadores = indicadoresMap[proj.id] || []
      if (indicadores.length > 0) {
        y += 2
        addSubheader('Indicadores')
        autoTable(doc, {
          startY: y,
          margin: { left: marginL, right: marginR },
          head: [['Nome', 'Fórmula', 'Fonte', 'Periodicidade', 'Unidade', 'Meta']],
          body: indicadores.map((ind: any) => [
            ind.nome || '', ind.formula || '', ind.fonte_dados || '',
            ind.periodicidade || '', ind.unidade_medida || '', ind.meta || ''
          ]),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [...PRIMARY], textColor: [...WHITE], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [...LIGHT_BG] },
        })
        y = (doc as any).lastAutoTable.finalY + 6
      }

      // Riscos table
      const riscos = riscosMap[proj.id] || []
      if (riscos.length > 0) {
        addSubheader('Riscos')
        autoTable(doc, {
          startY: y,
          margin: { left: marginL, right: marginR },
          head: [['Natureza', 'Probabilidade', 'Medida de Resposta']],
          body: riscos.map((r: any) => [
            r.natureza || '',
            PROBABILIDADE_LABELS[r.probabilidade] || r.probabilidade || '',
            r.medida_resposta || ''
          ]),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [...PRIMARY], textColor: [...WHITE], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [...LIGHT_BG] },
        })
        y = (doc as any).lastAutoTable.finalY + 6
      }
    }

    // --- Section: Entregas ---
    const entregas = proj.entregas || []
    const INDENT_ENTREGA = 5
    const INDENT_ATIVIDADE = 14

    if (options.sections.entregas && entregas.length > 0) {
      addSectionHeader(`Entregas (${entregas.length})`)

      for (let ei = 0; ei < entregas.length; ei++) {
        const ent = entregas[ei]

        // Entrega header — colored left bar + background band
        checkSpace(14)
        doc.setFillColor(245, 247, 250)
        doc.roundedRect(marginL, y, contentW, 10, 1.5, 1.5, 'F')
        doc.setFillColor(...ACCENT)
        doc.rect(marginL, y, 3, 10, 'F')
        doc.setTextColor(50)
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.text(`${ei + 1}. ${ent.nome}`, marginL + INDENT_ENTREGA + 2, y + 7)
        y += 14

        // Entrega fields — indented under entrega
        addField('Status', STATUS_LABELS[ent.status] || ent.status, INDENT_ENTREGA)
        if (ent.motivo_status) addField('Motivo do status', ent.motivo_status, INDENT_ENTREGA)
        addMultilineField('Descrição', ent.descricao, INDENT_ENTREGA)
        addMultilineField('Critérios de aceite', ent.criterios_aceite, INDENT_ENTREGA)
        addMultilineField('Dependências críticas', ent.dependencias_criticas, INDENT_ENTREGA)
        if (ent.data_inicio) addField('Data de início', formatDate(ent.data_inicio), INDENT_ENTREGA)
        addField('Data final prevista', formatDate(ent.data_final_prevista), INDENT_ENTREGA)
        if (ent.responsavel_entrega_id && namesMap[ent.responsavel_entrega_id]) {
          addField('Responsável', namesMap[ent.responsavel_entrega_id], INDENT_ENTREGA)
        }

        // Participantes da entrega
        const parts = ent.entrega_participantes || []
        if (parts.length > 0) {
          checkSpace(20)
          autoTable(doc, {
            startY: y,
            margin: { left: marginL + INDENT_ENTREGA, right: marginR },
            head: [['Setor', 'Tipo', 'Papel']],
            body: parts.map((p: any) => [
              p.setor ? `${p.setor.codigo} — ${p.setor.nome_completo}` : '—',
              p.tipo_participante || '',
              p.papel || ''
            ]),
            styles: { fontSize: 7.5, cellPadding: 1.5 },
            headStyles: { fillColor: [100, 116, 139], textColor: [...WHITE], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [...LIGHT_BG] },
          })
          y = (doc as any).lastAutoTable.finalY + 4
        }

        // --- Atividades within entrega ---
        const atividades = ent.atividades || []
        if (options.sections.atividades && atividades.length > 0) {
          // Atividades sub-section header with line separator
          checkSpace(14)
          y += 2
          doc.setDrawColor(200)
          doc.setLineWidth(0.3)
          doc.line(marginL + INDENT_ENTREGA, y, marginL + contentW, y)
          y += 5
          doc.setFillColor(...ACCENT)
          doc.roundedRect(marginL + INDENT_ENTREGA, y, contentW - INDENT_ENTREGA, 8, 1, 1, 'F')
          doc.setFontSize(9)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(...WHITE)
          doc.text(`Atividades (${atividades.length})`, marginL + INDENT_ENTREGA + 4, y + 5.5)
          y += 12

          for (let ai = 0; ai < atividades.length; ai++) {
            const atv = atividades[ai]

            // Separator line between activities
            if (ai > 0) {
              checkSpace(8)
              doc.setDrawColor(220)
              doc.setLineWidth(0.2)
              doc.line(marginL + INDENT_ATIVIDADE, y, marginL + contentW - 5, y)
              y += 4
            }

            // Atividade name with bullet
            checkSpace(16)
            doc.setFillColor(...ACCENT)
            doc.circle(marginL + INDENT_ATIVIDADE - 3, y - 1, 1.2, 'F')
            doc.setFontSize(9)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(50)
            doc.text(atv.nome, marginL + INDENT_ATIVIDADE, y)
            y += 5.5

            // Atividade fields — further indented
            doc.setFont('helvetica', 'normal')
            if (atv.status) addField('Status', STATUS_LABELS[atv.status] || atv.status, INDENT_ATIVIDADE)
            if (atv.motivo_status) addField('Motivo do status', atv.motivo_status, INDENT_ATIVIDADE)
            if (atv.descricao) addMultilineField('Descrição', atv.descricao, INDENT_ATIVIDADE)
            if (atv.data_prevista) addField('Data prevista', formatDate(atv.data_prevista), INDENT_ATIVIDADE)
            if (atv.responsavel_atividade_id && namesMap[atv.responsavel_atividade_id]) {
              addField('Responsável', namesMap[atv.responsavel_atividade_id], INDENT_ATIVIDADE)
            }

            // Atividade participantes
            const atvParts = atv.atividade_participantes || []
            if (atvParts.length > 0) {
              checkSpace(16)
              autoTable(doc, {
                startY: y,
                margin: { left: marginL + INDENT_ATIVIDADE, right: marginR },
                head: [['Participante', 'Tipo', 'Papel']],
                body: atvParts.map((p: any) => {
                  const name = p.user ? p.user.nome : p.setor ? `${p.setor.codigo} — ${p.setor.nome_completo}` : '—'
                  return [name, p.tipo_participante || '', p.papel || '']
                }),
                styles: { fontSize: 7, cellPadding: 1.5 },
                headStyles: { fillColor: [148, 163, 184], textColor: [...WHITE], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [...LIGHT_BG] },
              })
              y = (doc as any).lastAutoTable.finalY + 4
            }
          }
        }

        // Space between entregas
        y += 6
      }
    }
  }

  // --- Page numbering on all pages ---
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(150)
    doc.text(`${i} / ${totalPages}`, pageW / 2, pageH - 8, { align: 'center' })
  }

  // --- Save ---
  const dateTimeSuffix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  const fileName = `${toSnakeCase(options.reportName)}_${dateTimeSuffix}.pdf`
  doc.save(fileName)
}
