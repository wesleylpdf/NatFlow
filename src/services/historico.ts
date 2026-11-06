import { supabase } from '@/lib/supabaseClient'
import type { HistoricoItem } from '@/types'

/**
 * Lista os registros de auditoria mais recentes (opcionalmente filtrados por cliente)
 */
export async function listarHistorico(clienteId?: string, limite = 100): Promise<HistoricoItem[]> {
  let query = supabase
    .from('historico')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limite)

  if (clienteId) {
    query = query.eq('cliente_id', clienteId)
  }

  const { data, error } = await query
  if (error) throw error
  return (data as HistoricoItem[]) || []
}
