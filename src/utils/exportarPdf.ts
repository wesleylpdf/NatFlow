import type { Cliente, Compra, Pagamento } from '@/types'
import { formatarData, formatarDataHora, formatarMoeda, obterInfoFormaPagamento, escaparHTML } from '@/utils/format'
import { calcularResumo } from '@/utils/saldo'
import { toast } from '@/utils/toast'
import { criarOverlay } from '@/components/Modal'

let promessaJsPdf: Promise<typeof import('jspdf')> | null = null

function obterJsPdf(): Promise<typeof import('jspdf')> {
  if (!promessaJsPdf) {
    promessaJsPdf = import('jspdf')
  }
  return promessaJsPdf
}

// Inicia pré-carregamento imediato em segundo plano para não consumir a ativação do usuário
if (typeof window !== 'undefined') {
  void obterJsPdf()
}

export interface OpcoesPix {
  chavePix?: string | null
  nomeProfissional?: string | null
}

export async function gerarExtratoPdf(
  cliente: Cliente,
  compras: Compra[],
  pagamentos: Pagamento[],
  opcoes?: OpcoesPix
): Promise<File> {
  const { default: jsPDF } = await obterJsPdf()
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
  })

  const { totalCompras, totalPagamentos, saldoDevedor } = calcularResumo(compras, pagamentos)
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 14
  let y = 16

  // 1. Cabeçalho estilizado
  doc.setFillColor(5, 150, 105) // emerald-600
  doc.roundedRect(margin, y, pageWidth - margin * 2, 22, 3, 3, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('NatFlow', margin + 6, y + 9)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Extrato Financeiro de Produtos e Pagamentos', margin + 6, y + 16)

  doc.setFontSize(8)
  const emissaoTexto = `Emissão: ${formatarDataHora(new Date().toISOString())}`
  doc.text(emissaoTexto, pageWidth - margin - 6, y + 16, { align: 'right' })

  y += 28

  // 2. Dados do Cliente
  doc.setTextColor(30, 41, 59) // slate-800
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Dados do Cliente', margin, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Nome: ${cliente.nome}`, margin, y)
  doc.text(`Telefone: ${cliente.telefone || 'Não informado'}`, margin + 90, y)
  y += 8

  // Linha divisória
  doc.setDrawColor(226, 232, 240)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  // Helper para verificar nova página
  const checarQuebraPagina = (espacoNecessario: number): void => {
    if (y + espacoNecessario > 280) {
      doc.addPage()
      y = 16
    }
  }

  // 3. Tabela de Produtos Comprados (Saídas)
  checarQuebraPagina(20)
  doc.setFillColor(225, 29, 72) // rose-600
  doc.circle(margin + 2, y - 1, 1.8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(225, 29, 72)
  doc.text(`Produtos Comprados (${compras.length})`, margin + 6, y)
  y += 6

  // Cabeçalho da tabela
  doc.setFillColor(248, 250, 252)
  doc.rect(margin, y - 4, pageWidth - margin * 2, 7, 'F')
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)
  doc.text('DATA', margin + 3, y)
  doc.text('PRODUTO', margin + 30, y)
  doc.text('VALOR', pageWidth - margin - 3, y, { align: 'right' })
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(15, 23, 42)

  if (compras.length === 0) {
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text('Nenhum produto registrado.', margin + 3, y)
    y += 6
  } else {
    for (const compra of compras) {
      checarQuebraPagina(8)
      doc.setFontSize(8)
      doc.text(formatarData(compra.data), margin + 3, y)
      const nomeProd = doc.splitTextToSize(compra.produto, 105)
      doc.text(nomeProd, margin + 30, y)
      doc.text(formatarMoeda(compra.valor), pageWidth - margin - 3, y, { align: 'right' })
      y += Math.max(nomeProd.length * 4.5, 6)
    }
  }

  // Subtotal de compras
  checarQuebraPagina(10)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(225, 29, 72)
  doc.text(`Subtotal Compras: ${formatarMoeda(totalCompras)}`, pageWidth - margin - 3, y, {
    align: 'right',
  })
  y += 12

  // 4. Tabela de Pagamentos Recebidos (Entradas)
  checarQuebraPagina(20)
  doc.setFillColor(5, 150, 105) // emerald-600
  doc.circle(margin + 2, y - 1, 1.8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(5, 150, 105)
  doc.text(`Pagamentos Recebidos (${pagamentos.length})`, margin + 6, y)
  y += 6

  // Cabeçalho da tabela
  doc.setFillColor(248, 250, 252)
  doc.rect(margin, y - 4, pageWidth - margin * 2, 7, 'F')
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)
  doc.text('DATA', margin + 3, y)
  doc.text('DESCRIÇÃO / FORMA', margin + 30, y)
  doc.text('VALOR', pageWidth - margin - 3, y, { align: 'right' })
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(15, 23, 42)

  if (pagamentos.length === 0) {
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text('Nenhum pagamento registrado.', margin + 3, y)
    y += 6
  } else {
    for (const pag of pagamentos) {
      checarQuebraPagina(8)
      doc.setFontSize(8)
      doc.text(formatarData(pag.data), margin + 3, y)

      const formaInfo = obterInfoFormaPagamento(pag.forma_pagamento)
      const descBase = pag.descricao ? pag.descricao : 'Pagamento'
      const descCompleta = `${descBase} (${formaInfo.label})`

      const desc = doc.splitTextToSize(descCompleta, 105)
      doc.text(desc, margin + 30, y)
      doc.text(formatarMoeda(pag.valor), pageWidth - margin - 3, y, { align: 'right' })
      y += Math.max(desc.length * 4.5, 6)
    }
  }

  // Subtotal de pagamentos
  checarQuebraPagina(10)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(5, 150, 105)
  doc.text(`Subtotal Pago: ${formatarMoeda(totalPagamentos)}`, pageWidth - margin - 3, y, {
    align: 'right',
  })
  y += 12

  // 5. Quadro Resumo do Saldo Devedor
  checarQuebraPagina(30)
  const boxWidth = pageWidth - margin * 2
  const isDevedor = saldoDevedor > 0
  const boxColor = isDevedor ? [255, 241, 242] : [240, 253, 244] // rose-50 ou emerald-50
  const borderCol = isDevedor ? [244, 63, 94] : [16, 185, 129]

  doc.setFillColor(boxColor[0], boxColor[1], boxColor[2])
  doc.setDrawColor(borderCol[0], borderCol[1], borderCol[2])
  doc.roundedRect(margin, y, boxWidth, 22, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(isDevedor ? 225 : 5, isDevedor ? 29 : 150, isDevedor ? 72 : 105)
  const rotulo = isDevedor ? 'TOTAL SALDO DEVEDOR' : saldoDevedor < 0 ? 'CRÉDITO DO CLIENTE' : 'SALDO EM DIA'
  doc.text(rotulo, margin + 6, y + 13)

  doc.setFontSize(14)
  doc.text(formatarMoeda(Math.abs(saldoDevedor)), pageWidth - margin - 6, y + 14, { align: 'right' })

  // 6. Dados para pagamento via PIX (se cadastrado)
  if (opcoes?.chavePix) {
    y += 26
    checarQuebraPagina(20)
    doc.setFillColor(241, 245, 249) // slate-100
    doc.setDrawColor(203, 213, 225) // slate-300
    doc.roundedRect(margin, y, boxWidth, 18, 2, 2, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(5, 150, 105)
    doc.text('DADOS PARA PAGAMENTO VIA PIX', margin + 6, y + 6)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(30, 41, 59)
    doc.text(`Chave PIX: ${opcoes.chavePix}`, margin + 6, y + 12)

    if (opcoes.nomeProfissional) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(100, 116, 139)
      doc.text(`Beneficiário: ${opcoes.nomeProfissional}`, pageWidth - margin - 6, y + 12, {
        align: 'right',
      })
    }
  }

  // Converte para File com lastModified (essencial para compatibilidade com WebKit / iOS Safari)
  const blob = doc.output('blob')
  const nomeArquivo = `Extrato-${cliente.nome.replace(/\s+/g, '_')}.pdf`
  return new File([blob], nomeArquivo, {
    type: 'application/pdf',
    lastModified: Date.now(),
  })
}

/**
 * Monta a mensagem textual amigável com o resumo financeiro e chave PIX
 */
export function montarTextoResumoExtrato(
  cliente: Cliente,
  compras: Compra[],
  pagamentos: Pagamento[],
  opcoes?: OpcoesPix
): string {
  const { totalCompras, totalPagamentos, saldoDevedor } = calcularResumo(compras, pagamentos)
  const formatarBRL = (val: number): string => formatarMoeda(val).replace(/\u00A0/g, ' ')

  const situacao =
    saldoDevedor > 0
      ? `Saldo devedor: *${formatarBRL(saldoDevedor)}*`
      : saldoDevedor < 0
        ? `Crédito em haver: *${formatarBRL(-saldoDevedor)}*`
        : `Conta *em dia*! (R$ 0,00)`

  let mensagemTexto =
    `Olá, *${cliente.nome}*! Segue o resumo financeiro atualizado da sua conta no *NatFlow*:\n\n` +
    `🛍️ Total de produtos comprados: *${formatarBRL(totalCompras)}*\n` +
    `💵 Total pago: *${formatarBRL(totalPagamentos)}*\n` +
    `📌 ${situacao}`

  if (saldoDevedor > 0 && opcoes?.chavePix) {
    mensagemTexto += `\n🔑 Chave PIX para pagamento: *${opcoes.chavePix}*`
    if (opcoes.nomeProfissional) {
      mensagemTexto += ` (${opcoes.nomeProfissional})`
    }
  }

  return mensagemTexto
}

/**
 * Gera e baixa o arquivo PDF do extrato no dispositivo
 */
export async function baixarExtratoPdf(
  cliente: Cliente,
  compras: Compra[],
  pagamentos: Pagamento[],
  opcoes?: OpcoesPix
): Promise<File> {
  toast.info('Gerando extrato em PDF...')
  const pdfFile = await gerarExtratoPdf(cliente, compras, pagamentos, opcoes)

  const fileUrl = URL.createObjectURL(pdfFile)
  const linkDownload = document.createElement('a')
  linkDownload.href = fileUrl
  linkDownload.download = pdfFile.name
  document.body.appendChild(linkDownload)
  linkDownload.click()
  linkDownload.remove()
  setTimeout(() => URL.revokeObjectURL(fileUrl), 5000)

  toast.success('Extrato PDF baixado com sucesso!')
  return pdfFile
}

/**
 * Compartilha o arquivo PDF diretamente pela folha nativa do celular (Android/iOS)
 * ou realiza o download caso o navegador não suporte Web Share API com arquivos.
 */
export async function compartilharExtratoPdfNativo(
  cliente: Cliente,
  compras: Compra[],
  pagamentos: Pagamento[],
  opcoes?: OpcoesPix
): Promise<boolean> {
  toast.info('Gerando extrato em PDF...')
  const pdfFile = await gerarExtratoPdf(cliente, compras, pagamentos, opcoes)

  // ATENÇÃO CRÍTICA DE COMPATIBILIDADE:
  // 1. O objeto deve conter APENAS files e title. NUNCA misturar 'text' junto com 'files',
  //    pois o Android e iOS rejeitam o compartilhamento misto de binário + texto com TypeError.
  // 2. NUNCA chamar APIs assíncronas concorrentes como clipboard antes do share,
  //    pois elas consomem a "user activation" e fazem o navigator.share falhar com NotAllowedError.
  const dadosShare: ShareData = {
    files: [pdfFile],
    title: `Extrato NatFlow - ${cliente.nome}`,
  }

  const suportaShare =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare(dadosShare)

  if (suportaShare) {
    try {
      await navigator.share(dadosShare)
      toast.success('Extrato compartilhado com sucesso!')
      return true
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') {
        // Usuário apenas cancelou o menu nativo
        return false
      }
      console.warn('[WebShare] Erro no compartilhamento nativo:', err)
      toast.warning('Não foi possível abrir o compartilhamento. Baixando arquivo...')
    }
  } else {
    toast.info('Seu navegador não suporta compartilhamento direto de arquivos. Baixando PDF...')
  }

  // Fallback: Download do PDF no aparelho/computador
  const fileUrl = URL.createObjectURL(pdfFile)
  const linkDownload = document.createElement('a')
  linkDownload.href = fileUrl
  linkDownload.download = pdfFile.name
  document.body.appendChild(linkDownload)
  linkDownload.click()
  linkDownload.remove()
  setTimeout(() => URL.revokeObjectURL(fileUrl), 5000)
  toast.success('Extrato PDF baixado!')
  return true
}

/**
 * Envia o resumo diretamente para o WhatsApp do cliente via URL api.whatsapp.com,
 * com o texto e telefone pré-preenchidos, e baixa o PDF no dispositivo para anexar.
 */
export async function enviarExtratoWhatsApp(
  cliente: Cliente,
  compras: Compra[],
  pagamentos: Pagamento[],
  incluirPdf = true,
  opcoes?: OpcoesPix
): Promise<void> {
  const telLimpo = cliente.telefone.replace(/\D/g, '')
  if (!telLimpo || telLimpo.length < 10) {
    if (incluirPdf) {
      toast.warning('O cliente não possui telefone válido para WhatsApp. Baixando apenas o PDF...')
      await baixarExtratoPdf(cliente, compras, pagamentos, opcoes)
    } else {
      toast.warning('O cliente não possui telefone válido cadastrado para o WhatsApp.')
    }
    return
  }

  let mensagemTexto = montarTextoResumoExtrato(cliente, compras, pagamentos, opcoes)

  if (incluirPdf) {
    await baixarExtratoPdf(cliente, compras, pagamentos, opcoes)
    mensagemTexto += `\n\n📄 O arquivo PDF com o extrato detalhado de todos os itens foi baixado. Estou enviando em anexo!`
  }

  // Copia o texto para a Área de Transferência como garantia
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(mensagemTexto)
    }
  } catch {
    // clipboard opcional
  }

  const textoMsg = encodeURIComponent(mensagemTexto)
  const urlWhats = `https://api.whatsapp.com/send?phone=55${telLimpo}&text=${textoMsg}`

  window.open(urlWhats, '_blank')
  toast.success(incluirPdf ? 'PDF baixado e WhatsApp aberto com o resumo!' : 'WhatsApp aberto com o resumo!')
}

/**
 * Abre modal com as opções de envio do extrato:
 * 1. WhatsApp com Resumo completo pré-digitado + Download do PDF
 * 2. Compartilhar Arquivo PDF nativo pelo celular (com resumo copiado para colar)
 * 3. Apenas Baixar o arquivo PDF
 */
export function abrirModalOpcoesExtrato(
  cliente: Cliente,
  compras: Compra[],
  pagamentos: Pagamento[],
  opcoes?: OpcoesPix
): void {
  const { totalCompras, totalPagamentos, saldoDevedor } = calcularResumo(compras, pagamentos)
  const telLimpo = cliente.telefone.replace(/\D/g, '')
  const temTelefone = telLimpo.length >= 10

  const overlay = criarOverlay(`
    <div class="space-y-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h3 class="text-base sm:text-lg font-black text-slate-900 dark:text-white">📄 Extrato do Cliente</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">${escaparHTML(cliente.nome)}</p>
        </div>
        <button type="button" data-fechar class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg p-1" title="Fechar">✕</button>
      </div>

      <!-- Resumo Financeiro Rápido -->
      <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-xs space-y-1.5">
        <div class="flex justify-between font-bold">
          <span class="text-slate-500 dark:text-slate-400">Total Comprado:</span>
          <span class="text-slate-900 dark:text-white font-black">${formatarMoeda(totalCompras)}</span>
        </div>
        <div class="flex justify-between font-bold">
          <span class="text-slate-500 dark:text-slate-400">Total Pago:</span>
          <span class="text-emerald-600 dark:text-emerald-400 font-black">${formatarMoeda(totalPagamentos)}</span>
        </div>
        <div class="flex justify-between font-bold pt-1.5 border-t border-slate-200 dark:border-slate-700">
          <span class="text-slate-700 dark:text-slate-300 font-extrabold">Saldo Atual:</span>
          <span class="font-black ${saldoDevedor > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}">
            ${formatarMoeda(saldoDevedor)}
          </span>
        </div>
      </div>

      <p class="text-xs text-slate-600 dark:text-slate-300 font-bold">Escolha como deseja enviar:</p>

      <div class="space-y-2">
        <!-- Opção 1: WhatsApp Direto com Texto Pré-preenchido -->
        <button type="button" id="btn-extrato-whats-direto"
          class="w-full text-left p-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-[0.99] transition flex items-start gap-3">
          <span class="text-2xl shrink-0">💬</span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <span class="font-black text-xs sm:text-sm text-emerald-800 dark:text-emerald-300">Abrir WhatsApp com Resumo</span>
              <span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 font-black uppercase">Recomendado</span>
            </div>
            <p class="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
              Abre direto na conversa de <strong>${escaparHTML(cliente.nome)}</strong> com o <strong>resumo financeiro e chave PIX já digitados</strong>, e baixa o PDF para você anexar no clipe 📎.
            </p>
            ${!temTelefone ? '<p class="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-1">⚠️ Cliente sem telefone cadastrado</p>' : ''}
          </div>
        </button>

        <!-- Opção 2: Compartilhar Arquivo PDF no Celular (Nativo) -->
        <button type="button" id="btn-extrato-share-nativo"
          class="w-full text-left p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 active:scale-[0.99] transition flex items-start gap-3">
          <span class="text-2xl shrink-0">📲</span>
          <div class="min-w-0 flex-1">
            <span class="font-black text-xs sm:text-sm text-slate-900 dark:text-white">Compartilhar Arquivo PDF (Celular)</span>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Abre a folha do celular para enviar o arquivo PDF direto para qualquer contato. <em>(O texto do resumo é copiado para você colar na conversa, pois o WhatsApp não anexa texto a PDFs nativamente).</em>
            </p>
          </div>
        </button>

        <!-- Opção 3: Baixar Apenas PDF -->
        <button type="button" id="btn-extrato-apenas-baixar"
          class="w-full text-left p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-xs font-bold text-slate-700 dark:text-slate-300 transition flex items-center gap-2.5">
          <span class="text-base">⬇️</span>
          <span>Apenas baixar arquivo PDF</span>
        </button>
      </div>
    </div>
  `)

  const fechar = (): void => overlay.remove()

  overlay.querySelector('[data-fechar]')?.addEventListener('click', fechar)
  overlay.addEventListener('click', e => {
    if (e.target === overlay) fechar()
  })

  const btnShare = overlay.querySelector<HTMLButtonElement>('#btn-extrato-share-nativo')
  btnShare?.addEventListener('click', async () => {
    btnShare.disabled = true
    btnShare.innerHTML = `
      <span class="text-2xl shrink-0 animate-spin">⏳</span>
      <div class="min-w-0 flex-1">
        <span class="font-black text-xs sm:text-sm text-slate-900 dark:text-white">Abrindo compartilhamento...</span>
        <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Gerando PDF e acionando o menu do celular...</p>
      </div>
    `
    try {
      await compartilharExtratoPdfNativo(cliente, compras, pagamentos, opcoes)
    } finally {
      fechar()
    }
  })

  const btnWhats = overlay.querySelector<HTMLButtonElement>('#btn-extrato-whats-direto')
  btnWhats?.addEventListener('click', async () => {
    btnWhats.disabled = true
    try {
      await enviarExtratoWhatsApp(cliente, compras, pagamentos, true, opcoes)
    } finally {
      fechar()
    }
  })

  const btnBaixar = overlay.querySelector<HTMLButtonElement>('#btn-extrato-apenas-baixar')
  btnBaixar?.addEventListener('click', async () => {
    btnBaixar.disabled = true
    try {
      await baixarExtratoPdf(cliente, compras, pagamentos, opcoes)
    } finally {
      fechar()
    }
  })
}

/**
 * Envia uma mensagem amigável e direta de lembrete de cobrança no WhatsApp com a chave PIX
 */
export function enviarLembreteCobrancaWhatsApp(
  cliente: Cliente,
  saldoDevedor: number,
  opcoes?: OpcoesPix
): void {
  const telLimpo = cliente.telefone.replace(/\D/g, '')
  if (!telLimpo || telLimpo.length < 10) {
    toast.warning('O cliente não possui telefone válido cadastrado para o WhatsApp.')
    return
  }

  const formatarBRL = (val: number): string => formatarMoeda(val).replace(/\u00A0/g, ' ')

  let msg =
    `Olá, *${cliente.nome}*! Tudo bem? 🌸\n\n` +
    `Passando para enviar o lembrete do seu saldo em aberto no *NatFlow*:\n\n` +
    `📌 Valor pendente: *${formatarBRL(saldoDevedor)}*`

  if (opcoes?.chavePix) {
    msg += `\n🔑 Chave PIX: *${opcoes.chavePix}*`
    if (opcoes.nomeProfissional) {
      msg += ` (${opcoes.nomeProfissional})`
    }
  }

  msg += `\n\nAssim que realizar o pagamento, me envie o comprovante por aqui, por favor! Qualquer dúvida, estou à disposição. Muito obrigado(a)! ✨`

  const textoMsg = encodeURIComponent(msg)
  const urlWhats = `https://api.whatsapp.com/send?phone=55${telLimpo}&text=${textoMsg}`
  window.open(urlWhats, '_blank')
  toast.success('WhatsApp aberto com lembrete de cobrança!')
}
