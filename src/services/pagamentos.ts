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
  const { error } = await supabase.from('pagamentos').insert({
    cliente_id: dados.cliente_id,
    valor: dados.valor,
    data: dados.data,
    descricao: dados.descricao?.trim() || null,
    forma_pagamento: dados.forma_pagamento || 'pix',
  })
  if (error) throw error
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
  if (error) throw error
}

export async function excluirPagamento(id: string): Promise<void> {
  const { error } = await supabase.from('pagamentos').delete().eq('id', id)
  if (error) throw error
}
