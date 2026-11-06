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
  return (data as Pagamento[]).map(p => ({ ...p, valor: Number(p.valor) }))
}

export async function criarPagamento(dados: NovoPagamento): Promise<void> {
  const { error } = await supabase.from('pagamentos').insert({
    cliente_id: dados.cliente_id,
    valor: dados.valor,
    data: dados.data,
    descricao: dados.descricao?.trim() || null,
  })
  if (error) throw error
}

export async function atualizarPagamento(
  id: string,
  dados: Pick<Pagamento, 'valor' | 'data' | 'descricao'>
): Promise<void> {
  const { error } = await supabase
    .from('pagamentos')
    .update({ valor: dados.valor, data: dados.data, descricao: dados.descricao?.trim() || null })
    .eq('id', id)
  if (error) throw error
}

export async function excluirPagamento(id: string): Promise<void> {
  const { error } = await supabase.from('pagamentos').delete().eq('id', id)
  if (error) throw error
}
