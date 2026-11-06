import type { Cliente, Compra, Pagamento } from '@/types'
import { formatarData, formatarDataHora, formatarMoeda, obterInfoFormaPagamento } from '@/utils/format'
import { calcularResumo } from '@/utils/saldo'
import { toast } from '@/utils/toast'

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
  const { default: jsPDF } = await import('jspdf')
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

  // Converte para File
  const blob = doc.output('blob')
  const nomeArquivo = `Extrato-${cliente.nome.replace(/\s+/g, '_')}.pdf`
  return new File([blob], nomeArquivo, { type: 'application/pdf' })
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

  // 1. Tenta compartilhamento nativo no celular (Android / iOS)
  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
    try {
      await navigator.share({
        files: [pdfFile],
        title: `Extrato NatFlow - ${cliente.nome}`,
        text: `Olá! Segue o extrato financeiro detalhado de ${cliente.nome} no NatFlow.`,
      })
      toast.success('Extrato compartilhado!')
      return true
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') {
        return false // Usuário apenas cancelou o menu
      }
      console.warn('[WebShare] Erro no compartilhamento nativo:', err)
    }
  }

  // 2. Fallback: Download do PDF no aparelho/computador
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
 * Envia o resumo e o extrato PDF: prioriza a folha nativa do celular (Web Share API)
 * e faz fallback seguro baixando o PDF e abrindo o WhatsApp.
 */
export async function enviarExtratoWhatsApp(
  cliente: Cliente,
  compras: Compra[],
  pagamentos: Pagamento[],
  incluirPdf = true,
  opcoes?: OpcoesPix
): Promise<void> {
  const { totalCompras, totalPagamentos, saldoDevedor } = calcularResumo(compras, pagamentos)

  // Normaliza espaços monetários para evitar artefatos de codificação em URLs
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

  if (incluirPdf) {
    toast.info('Gerando extrato em PDF...')
    const pdfFile = await gerarExtratoPdf(cliente, compras, pagamentos, opcoes)

    // 1. No celular (Android/iOS), se suportar Web Share API com arquivos:
    // Abre a folha nativa com o arquivo PDF anexado e o texto da mensagem pré-preenchido!
    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      try {
        await navigator.share({
          files: [pdfFile],
          title: `Extrato NatFlow - ${cliente.nome}`,
          text: mensagemTexto,
        })
        toast.success('Extrato compartilhado!')
        return
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') {
          return // Usuário fechou o menu sem compartilhar
        }
        console.warn('[WebShare] Erro no compartilhamento nativo:', err)
      }
    }

    // 2. Se não suportar Web Share API (computador ou navegador limitado):
    // Baixa o PDF no dispositivo
    const fileUrl = URL.createObjectURL(pdfFile)
    const linkDownload = document.createElement('a')
    linkDownload.href = fileUrl
    linkDownload.download = pdfFile.name
    document.body.appendChild(linkDownload)
    linkDownload.click()
    linkDownload.remove()
    setTimeout(() => URL.revokeObjectURL(fileUrl), 5000)
    mensagemTexto += `\n\n📄 O arquivo PDF com o extrato detalhado de todos os itens foi gerado. Estou enviando em anexo!`
  }

  // 3. Monta link do WhatsApp com mensagem de texto
  const telLimpo = cliente.telefone.replace(/\D/g, '')
  if (!telLimpo || telLimpo.length < 10) {
    if (incluirPdf) {
      toast.warning('O PDF foi baixado, mas o cliente não possui telefone válido para WhatsApp.')
    } else {
      toast.warning('O cliente não possui telefone válido cadastrado para o WhatsApp.')
    }
    return
  }

  const textoMsg = encodeURIComponent(mensagemTexto)
  const urlWhats = `https://api.whatsapp.com/send?phone=55${telLimpo}&text=${textoMsg}`

  window.open(urlWhats, '_blank')
  toast.success(incluirPdf ? 'Extrato PDF gerado e WhatsApp aberto!' : 'WhatsApp aberto com o resumo!')
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
