import { supabase } from '@/lib/supabaseClient'
import type { HistoricoItem } from '@/types'

/**
 * Lista os registros de auditoria mais recentes (opcionalmente filtrados por cliente),
 * com resolução automática do nome do cliente associado a cada alteração.
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

  const itens = (data as HistoricoItem[]) || []

  // Mapa de ID -> Nome do cliente
  const mapaNomes = new Map<string, string>()

  // 1. Extrai nomes de clientes já presentes no próprio histórico (inclusive de clientes excluídos)
  itens.forEach(item => {
    if (item.cliente_nome) {
      const cId = item.cliente_id || item.registro_id
      if (cId) mapaNomes.set(cId, item.cliente_nome)
    }
    if (item.tabela === 'clientes') {
      const cId = (item.cliente_id || item.registro_id || (item.dados_depois?.id as string) || (item.dados_antes?.id as string))
      const nome = (item.dados_depois?.nome as string) || (item.dados_antes?.nome as string)
      if (cId && nome) {
        mapaNomes.set(cId, nome)
      }
    }
  })

  // 2. Busca nomes dos clientes ativos do banco para IDs de compras/pagamentos ainda não resolvidos
  const idsFaltantes = new Set<string>()
  itens.forEach(item => {
    const cId = item.cliente_id || (item.dados_depois?.cliente_id as string) || (item.dados_antes?.cliente_id as string)
    if (cId && !mapaNomes.has(cId)) {
      idsFaltantes.add(cId)
    }
  })

  if (idsFaltantes.size > 0) {
    try {
      const { data: clientesData } = await supabase
        .from('clientes')
        .select('id, nome')
        .in('id', Array.from(idsFaltantes))

      clientesData?.forEach((c: { id: string; nome: string }) => {
        if (c.id && c.nome) {
          mapaNomes.set(c.id, c.nome)
        }
      })
    } catch (err) {
      console.warn('[Historico] Erro ao carregar nomes de clientes:', err)
    }
  }

  // 3. Atribui cliente_nome e cliente_id resolvidos em cada item
  return itens.map(item => {
    let cId = item.cliente_id || (item.dados_depois?.cliente_id as string) || (item.dados_antes?.cliente_id as string)
    if (!cId && item.tabela === 'clientes') {
      cId = item.registro_id || (item.dados_depois?.id as string) || (item.dados_antes?.id as string)
    }

    let nomeCliente = item.cliente_nome
    if (!nomeCliente && cId) {
      nomeCliente = mapaNomes.get(cId) || null
    }

    if (!nomeCliente && item.tabela === 'clientes') {
      nomeCliente = (item.dados_depois?.nome as string) || (item.dados_antes?.nome as string) || null
    }

    return {
      ...item,
      cliente_id: cId || null,
      cliente_nome: nomeCliente || null,
    }
  })
}
