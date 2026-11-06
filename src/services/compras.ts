import { supabase } from '@/lib/supabaseClient'
import { limparCacheCatalogo } from '@/services/catalogo'
import type { Compra, NovaCompra } from '@/types'

/** Lista as compras (saídas) de um cliente, mais recentes primeiro. */
export async function listarCompras(clienteId: string): Promise<Compra[]> {
  const { data, error } = await supabase
    .from('compras')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as Compra[]).map(c => ({ ...c, valor: Number(c.valor) }))
}

export async function criarCompra(dados: NovaCompra): Promise<void> {
  const { error } = await supabase.from('compras').insert({
    cliente_id: dados.cliente_id,
    produto: dados.produto.trim(),
    valor: dados.valor,
    data: dados.data,
  })
  if (error) throw error
  limparCacheCatalogo()
}

export async function atualizarCompra(
  id: string,
  dados: Pick<Compra, 'produto' | 'valor' | 'data'>
): Promise<void> {
  const { error } = await supabase
    .from('compras')
    .update({ produto: dados.produto.trim(), valor: dados.valor, data: dados.data })
    .eq('id', id)
  if (error) throw error
  limparCacheCatalogo()
}

export async function excluirCompra(id: string): Promise<void> {
  const { error } = await supabase.from('compras').delete().eq('id', id)
  if (error) throw error
  limparCacheCatalogo()
}
