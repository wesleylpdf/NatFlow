import { supabase } from '@/lib/supabaseClient'
import { listarClientesComSaldo } from '@/services/clientes'
import type { Compra, Pagamento } from '@/types'
import { formatarData, formatarDataHora, formatarMoeda, hojeISO, obterInfoFormaPagamento } from '@/utils/format'
import { toast } from '@/utils/toast'

function limparCSV(valor: unknown): string {
  if (valor === null || valor === undefined) return '""'
  const str = String(valor).replace(/"/g, '""')
  return `"${str}"`
}

/**
 * Gera e baixa uma planilha completa em CSV (com UTF-8 BOM e delimitador ;)
 * contendo o resumo financeiro, todos os clientes, produtos vendidos e pagamentos recebidos.
 * Compatível diretamente com o Microsoft Excel, LibreOffice e Google Planilhas.
 */
export async function exportarBackupCompleto(): Promise<void> {
  toast.info('Coletando dados para exportação do backup...')

  const [clientes, { data: compras, error: errC }, { data: pagamentos, error: errP }] = await Promise.all([
    listarClientesComSaldo(),
    supabase.from('compras').select('*').order('data', { ascending: false }),
    supabase.from('pagamentos').select('*').order('data', { ascending: false }),
  ])

  if (errC) throw errC
  if (errP) throw errP

  const listaCompras = (compras || []) as Compra[]
  const listaPagamentos = (pagamentos || []) as Pagamento[]

  const mapaClientes = new Map<string, string>()
  for (const c of clientes) {
    mapaClientes.set(c.id, c.nome)
  }

  const totalComprado = clientes.reduce((acc, c) => acc + c.total_compras, 0)
  const totalRecebido = clientes.reduce((acc, c) => acc + c.total_pagamentos, 0)
  const saldoPendenteTotal = clientes.reduce((acc, c) => acc + Math.max(0, c.saldo_devedor), 0)

  const linhas: string[] = []

  // 1. CABEÇALHO / RESUMO GERAL
  linhas.push('========================================================================================')
  linhas.push(`"NATFLOW - BACKUP GERAL DO SISTEMA";"Gerado em: ${new Date().toLocaleString('pt-BR')}"`)
  linhas.push('========================================================================================')
  linhas.push('')
  linhas.push('"RESUMO DO SISTEMA"')
  linhas.push(`"Total de Clientes Cadastrados";${clientes.length}`)
  linhas.push(`"Total Vendido (R$)";${limparCSV(formatarMoeda(totalComprado))}`)
  linhas.push(`"Total Recebido (R$)";${limparCSV(formatarMoeda(totalRecebido))}`)
  linhas.push(`"Saldo Pendente Geral (R$)";${limparCSV(formatarMoeda(saldoPendenteTotal))}`)
  linhas.push(`"Total de Produtos/Serviços Lançados";${listaCompras.length}`)
  linhas.push(`"Total de Pagamentos Lançados";${listaPagamentos.length}`)
  linhas.push('')

  // 2. TABELA DE CLIENTES
  linhas.push('========================================================================================')
  linhas.push('"CLIENTES & SALDOS ATUAIS"')
  linhas.push('========================================================================================')
  linhas.push([
    '"ID"',
    '"Nome"',
    '"Telefone"',
    '"Total Compras (R$)"',
    '"Total Pagamentos (R$)"',
    '"Saldo Devedor (R$)"',
    '"Dias Sem Pagar"',
    '"Data Promessa / Acerto"',
    '"Último Pagamento"',
    '"Cadastrado Em"',
    '"Cadastrado Por"',
  ].join(';'))

  for (const c of clientes) {
    linhas.push([
      limparCSV(c.id),
      limparCSV(c.nome),
      limparCSV(c.telefone || 'Sem telefone'),
      limparCSV(formatarMoeda(c.total_compras)),
      limparCSV(formatarMoeda(c.total_pagamentos)),
      limparCSV(formatarMoeda(c.saldo_devedor)),
      limparCSV(c.saldo_devedor > 0 ? c.dias_atraso || 0 : 0),
      limparCSV(c.data_promessa ? formatarData(c.data_promessa) : '-'),
      limparCSV(c.ultimo_pagamento ? formatarData(c.ultimo_pagamento) : '-'),
      limparCSV(c.created_at ? formatarDataHora(c.created_at) : '-'),
      limparCSV(c.criado_por || '-'),
    ].join(';'))
  }
  linhas.push('')

  // 3. TABELA DE COMPRAS / PRODUTOS
  linhas.push('========================================================================================')
  linhas.push('"PRODUTOS VENDIDOS / SAÍDAS"')
  linhas.push('========================================================================================')
  linhas.push([
    '"Data"',
    '"Cliente"',
    '"Produto / Serviço"',
    '"Valor (R$)"',
    '"ID Compra"',
    '"Cadastrado Em"',
    '"Cadastrado Por"',
  ].join(';'))

  for (const cp of listaCompras) {
    const nomeCli = mapaClientes.get(cp.cliente_id) || 'Cliente não encontrado'
    linhas.push([
      limparCSV(formatarData(cp.data)),
      limparCSV(nomeCli),
      limparCSV(cp.produto),
      limparCSV(formatarMoeda(cp.valor)),
      limparCSV(cp.id),
      limparCSV(cp.created_at ? formatarDataHora(cp.created_at) : '-'),
      limparCSV(cp.criado_por || '-'),
    ].join(';'))
  }
  linhas.push('')

  // 4. TABELA DE PAGAMENTOS
  linhas.push('========================================================================================')
  linhas.push('"PAGAMENTOS RECEBIDOS / ENTRADAS"')
  linhas.push('========================================================================================')
  linhas.push([
    '"Data"',
    '"Cliente"',
    '"Valor Pago (R$)"',
    '"Forma de Pagamento"',
    '"Descrição / Observações"',
    '"ID Pagamento"',
    '"Cadastrado Em"',
    '"Cadastrado Por"',
  ].join(';'))

  for (const pg of listaPagamentos) {
    const nomeCli = mapaClientes.get(pg.cliente_id) || 'Cliente não encontrado'
    const forma = obterInfoFormaPagamento(pg.forma_pagamento)
    linhas.push([
      limparCSV(formatarData(pg.data)),
      limparCSV(nomeCli),
      limparCSV(formatarMoeda(pg.valor)),
      limparCSV(`${forma.icone} ${forma.label}`),
      limparCSV(pg.descricao || '-'),
      limparCSV(pg.id),
      limparCSV(pg.created_at ? formatarDataHora(pg.created_at) : '-'),
      limparCSV(pg.criado_por || '-'),
    ].join(';'))
  }

  // BOM UTF-8 (\uFEFF) para garantir abertura correta de acentos no Excel Windows
  const conteudoCSV = '\uFEFF' + linhas.join('\r\n')
  const blob = new Blob([conteudoCSV], { type: 'text/csv;charset=utf-8;' })
  const nomeArquivo = `NatFlow_Backup_${hojeISO()}.csv`

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)

  toast.success('Backup exportado com sucesso! Arquivo CSV gerado.')
}
