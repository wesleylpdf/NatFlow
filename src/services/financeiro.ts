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
 * Possui fallback automático caso a coluna forma_pagamento ainda não tenha sido criada no Supabase.
 */
export async function obterResumoFinanceiro(filtro: FiltroPeriodo = {}): Promise<ResumoFinanceiro> {
  const aplicarFiltroData = <T extends { gte: (campo: string, val: string) => T; lte: (campo: string, val: string) => T }>(
    query: T
  ): T => {
    if (!filtro.tudo && filtro.ano && filtro.mes) {
      const mesFormatado = String(filtro.mes).padStart(2, '0')
      const ultimoDia = new Date(filtro.ano, filtro.mes, 0).getDate()
      const ultimoDiaFormatado = String(ultimoDia).padStart(2, '0')
      const inicio = `${filtro.ano}-${mesFormatado}-01`
      const fim = `${filtro.ano}-${mesFormatado}-${ultimoDiaFormatado}`
      return query.gte('data', inicio).lte('data', fim)
    }
    return query
  }

  // 1. Consulta compras
  const queryComp = aplicarFiltroData(supabase.from('compras').select('valor, data'))
  const { data: compras, error: errComp } = await queryComp
  if (errComp) {
    console.error('[Financeiro] Erro ao buscar compras:', errComp)
    throw errComp
  }

  // 2. Consulta pagamentos (com fallback caso a coluna forma_pagamento ainda não exista)
  let listaPag: { valor: number; forma_pagamento?: string | null; data: string }[] = []

  const queryPag = aplicarFiltroData(supabase.from('pagamentos').select('valor, forma_pagamento, data'))
  const { data: pagamentos, error: errPag } = await queryPag

  if (errPag) {
    // Código 42703 = coluna não existe no PostgreSQL
    if (errPag.code === '42703') {
      console.warn('[Financeiro] Coluna forma_pagamento não encontrada, executando fallback sem ela.')
      const queryFallback = aplicarFiltroData(supabase.from('pagamentos').select('valor, data'))
      const { data: pagFallback, error: errFallback } = await queryFallback
      if (errFallback) {
        console.error('[Financeiro] Erro no fallback de pagamentos:', errFallback)
        throw errFallback
      }
      listaPag = (pagFallback || []).map(p => ({
        valor: Number(p.valor) || 0,
        data: p.data,
        forma_pagamento: 'pix',
      }))
    } else {
      console.error('[Financeiro] Erro ao buscar pagamentos:', errPag)
      throw errPag
    }
  } else {
    listaPag = (pagamentos || []).map(p => ({
      ...p,
      valor: Number(p.valor) || 0,
    }))
  }

  const listaComp = (compras || []).map(c => ({
    ...c,
    valor: Number(c.valor) || 0,
  }))

  const totalRecebido = listaPag.reduce((acc, p) => acc + p.valor, 0)
  const totalVendido = listaComp.reduce((acc, c) => acc + c.valor, 0)

  const porFormaPagamento: Record<string, number> = {
    pix: 0,
    dinheiro: 0,
    credito: 0,
    debito: 0,
    outro: 0,
  }

  for (const p of listaPag) {
    const forma = (p.forma_pagamento || 'pix').toLowerCase()
    if (forma in porFormaPagamento) {
      porFormaPagamento[forma] += p.valor
    } else {
      porFormaPagamento.outro += p.valor
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
