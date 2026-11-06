import { supabase } from '@/lib/supabaseClient'
import type { NovoPagamento, Pagamento } from '@/types'

/** Lista os pagamentos (entradas) de um cliente, mais recentes primeiro. */
export async function listarPagamentos(clienteId: string): Promise<Pagamento[]> {
  const { data, error } = await supabase
    .from('pagamentos')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as Pagamento[]).map(p => ({
    ...p,
    valor: Number(p.valor),
    forma_pagamento: p.forma_pagamento || 'pix',
  }))
}

export async function criarPagamento(dados: NovoPagamento): Promise<void> {
  const payload: Record<string, unknown> = {
    cliente_id: dados.cliente_id,
    valor: dados.valor,
    data: dados.data,
    descricao: dados.descricao?.trim() || null,
  }
  if (dados.forma_pagamento) {
    payload.forma_pagamento = dados.forma_pagamento
  }

  const { error } = await supabase.from('pagamentos').insert(payload)
  if (error) {
    // Fallback caso a coluna forma_pagamento ainda não exista no Supabase
    if (error.code === '42703') {
      delete payload.forma_pagamento
      const { error: retryError } = await supabase.from('pagamentos').insert(payload)
      if (retryError) throw retryError
      return
    }
    throw error
  }
}

export async function atualizarPagamento(
  id: string,
  dados: Pick<Pagamento, 'valor' | 'data' | 'descricao'> & { forma_pagamento?: string | null }
): Promise<void> {
  const payload: Record<string, unknown> = {
    valor: dados.valor,
    data: dados.data,
    descricao: dados.descricao?.trim() || null,
  }
  if (dados.forma_pagamento !== undefined) {
    payload.forma_pagamento = dados.forma_pagamento || 'pix'
  }

  const { error } = await supabase
    .from('pagamentos')
    .update(payload)
    .eq('id', id)
  if (error) {
    // Fallback caso a coluna forma_pagamento ainda não exista no Supabase
    if (error.code === '42703') {
      delete payload.forma_pagamento
      const { error: retryError } = await supabase
        .from('pagamentos')
        .update(payload)
        .eq('id', id)
      if (retryError) throw retryError
      return
    }
    throw error
  }
}

export async function excluirPagamento(id: string): Promise<void> {
  const { error } = await supabase.from('pagamentos').delete().eq('id', id)
  if (error) throw error
}
