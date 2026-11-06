import { supabase } from '@/lib/supabaseClient'
import type { ResumoFinanceiro } from '@/types'

export interface FiltroPeriodo {
  ano?: number
  mes?: number // 1 a 12
  tudo?: boolean
}

/**
 * Obtém resumo financeiro consolidado (total recebido, vendido, saldo e por forma de pagamento).
 * Permite filtrar por mês específico ou trazer todo o histórico.
 */
export async function obterResumoFinanceiro(filtro: FiltroPeriodo = {}): Promise<ResumoFinanceiro> {
  let queryPag = supabase.from('pagamentos').select('valor, forma_pagamento, data')
  let queryComp = supabase.from('compras').select('valor, data')

  if (!filtro.tudo && filtro.ano && filtro.mes) {
    const mesFormatado = String(filtro.mes).padStart(2, '0')
    const ultimoDia = new Date(filtro.ano, filtro.mes, 0).getDate()
    const ultimoDiaFormatado = String(ultimoDia).padStart(2, '0')
    const inicio = `${filtro.ano}-${mesFormatado}-01`
    const fim = `${filtro.ano}-${mesFormatado}-${ultimoDiaFormatado}`

    queryPag = queryPag.gte('data', inicio).lte('data', fim)
    queryComp = queryComp.gte('data', inicio).lte('data', fim)
  }

  const [{ data: pagamentos, error: errPag }, { data: compras, error: errComp }] = await Promise.all([
    queryPag,
    queryComp,
  ])

  if (errPag) throw errPag
  if (errComp) throw errComp

  const listaPag = pagamentos || []
  const listaComp = compras || []

  const totalRecebido = listaPag.reduce((acc, p) => acc + (Number(p.valor) || 0), 0)
  const totalVendido = listaComp.reduce((acc, c) => acc + (Number(c.valor) || 0), 0)

  const porFormaPagamento: Record<string, number> = {
    pix: 0,
    dinheiro: 0,
    credito: 0,
    debito: 0,
    outro: 0,
  }

  for (const p of listaPag) {
    const forma = (p.forma_pagamento || 'pix').toLowerCase()
    const valor = Number(p.valor) || 0
    if (forma in porFormaPagamento) {
      porFormaPagamento[forma] += valor
    } else {
      porFormaPagamento.outro += valor
    }
  }

  for (const k of Object.keys(porFormaPagamento)) {
    porFormaPagamento[k] = Math.round(porFormaPagamento[k] * 100) / 100
  }

  return {
    totalRecebido: Math.round(totalRecebido * 100) / 100,
    totalVendido: Math.round(totalVendido * 100) / 100,
    saldoPeriodo: Math.round((totalRecebido - totalVendido) * 100) / 100,
    porFormaPagamento,
    quantidadePagamentos: listaPag.length,
    quantidadeVendas: listaComp.length,
  }
}
