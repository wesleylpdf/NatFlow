import { supabase } from '@/lib/supabaseClient'
import type { Acerto, NovoAcerto, StatusAcerto } from '@/types'
import { definirDataPromessa } from '@/services/clientes'

const STORAGE_PREFIX = 'natflow_acertos_'

function obterAcertosLocais(clienteId: string): Acerto[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${clienteId}`)
      if (raw) return JSON.parse(raw) as Acerto[]
    }
  } catch {
    // storage opcional
  }
  return []
}

function salvarAcertosLocais(clienteId: string, acertos: Acerto[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`${STORAGE_PREFIX}${clienteId}`, JSON.stringify(acertos))
    }
  } catch {
    // storage opcional
  }
}

/**
 * Atualiza automaticamente a coluna data_promessa na tabela clientes
 * com base no próximo acerto pendente com a data mais próxima.
 */
export async function sincronizarProximaPromessa(
  clienteId: string,
  acertosParam?: Acerto[]
): Promise<string | null> {
  const acertos = acertosParam || (await listarAcertos(clienteId))
  const pendentes = acertos
    .filter(a => a.status === 'pendente')
    .sort((a, b) => a.data.localeCompare(b.data))

  const proximaData = pendentes.length > 0 ? pendentes[0].data : null
  try {
    await definirDataPromessa(clienteId, proximaData)
  } catch (err) {
    console.warn('[Acertos] Erro ao sincronizar data_promessa:', err)
  }
  return proximaData
}

/**
 * Lista todos os acertos combinados de um cliente, ordenados por data e criação.
 */
export async function listarAcertos(clienteId: string): Promise<Acerto[]> {
  try {
    const { data, error } = await supabase
      .from('acertos')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('data', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      // Se a tabela ainda não existir no Supabase (código 42P01), usa fallback local
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return obterAcertosLocais(clienteId)
      }
      throw error
    }

    const lista = (data as Acerto[]) || []
    salvarAcertosLocais(clienteId, lista)
    return lista
  } catch {
    return obterAcertosLocais(clienteId)
  }
}

/**
 * Cria um novo acerto combinado para o cliente.
 */
export async function criarAcerto(dados: NovoAcerto): Promise<Acerto> {
  const payload = {
    cliente_id: dados.cliente_id,
    data: dados.data,
    valor: dados.valor,
    descricao: dados.descricao?.trim() || null,
    status: 'pendente' as StatusAcerto,
  }

  try {
    const { data, error } = await supabase
      .from('acertos')
      .insert(payload)
      .select()
      .single()

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        const novo: Acerto = {
          ...payload,
          id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          created_at: new Date().toISOString(),
        }
        const locais = obterAcertosLocais(dados.cliente_id)
        locais.push(novo)
        salvarAcertosLocais(dados.cliente_id, locais)
        await sincronizarProximaPromessa(dados.cliente_id, locais)
        return novo
      }
      throw error
    }

    const criado = data as Acerto
    const locais = obterAcertosLocais(dados.cliente_id)
    locais.push(criado)
    salvarAcertosLocais(dados.cliente_id, locais)
    await sincronizarProximaPromessa(dados.cliente_id)
    return criado
  } catch (err) {
    // Fallback local se rede falhar
    const novo: Acerto = {
      ...payload,
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      created_at: new Date().toISOString(),
    }
    const locais = obterAcertosLocais(dados.cliente_id)
    locais.push(novo)
    salvarAcertosLocais(dados.cliente_id, locais)
    await sincronizarProximaPromessa(dados.cliente_id, locais)
    return novo
  }
}

/**
 * Cria múltiplos acertos (parcelamento) de uma só vez.
 */
export async function criarMultiplosAcertos(
  clienteId: string,
  itens: { data: string; valor: number; descricao?: string | null }[]
): Promise<Acerto[]> {
  const payloads = itens.map(i => ({
    cliente_id: clienteId,
    data: i.data,
    valor: i.valor,
    descricao: i.descricao?.trim() || null,
    status: 'pendente' as StatusAcerto,
  }))

  try {
    const { data, error } = await supabase
      .from('acertos')
      .insert(payloads)
      .select()

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        const criados: Acerto[] = payloads.map((p, idx) => ({
          ...p,
          id: `local_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
          created_at: new Date().toISOString(),
        }))
        const locais = obterAcertosLocais(clienteId)
        locais.push(...criados)
        salvarAcertosLocais(clienteId, locais)
        await sincronizarProximaPromessa(clienteId, locais)
        return criados
      }
      throw error
    }

    const criados = (data as Acerto[]) || []
    const locais = obterAcertosLocais(clienteId)
    locais.push(...criados)
    salvarAcertosLocais(clienteId, locais)
    await sincronizarProximaPromessa(clienteId)
    return criados
  } catch {
    const criados: Acerto[] = payloads.map((p, idx) => ({
      ...p,
      id: `local_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
      created_at: new Date().toISOString(),
    }))
    const locais = obterAcertosLocais(clienteId)
    locais.push(...criados)
    salvarAcertosLocais(clienteId, locais)
    await sincronizarProximaPromessa(clienteId, locais)
    return criados
  }
}

/**
 * Atualiza dados de um acerto existente.
 */
export async function atualizarAcerto(
  id: string,
  clienteId: string,
  dados: Partial<NovoAcerto & { status: StatusAcerto; pago_em?: string | null }>
): Promise<void> {
  const payload: Record<string, unknown> = {}
  if (dados.data !== undefined) payload.data = dados.data
  if (dados.valor !== undefined) payload.valor = dados.valor
  if (dados.descricao !== undefined) payload.descricao = dados.descricao?.trim() || null
  if (dados.status !== undefined) {
    payload.status = dados.status
    payload.pago_em = dados.status === 'pago' ? new Date().toISOString() : null
  }

  try {
    const { error } = await supabase
      .from('acertos')
      .update(payload)
      .eq('id', id)

    if (error && error.code !== '42P01') throw error
  } catch {
    // fallback
  }

  // Atualiza localmente
  const locais = obterAcertosLocais(clienteId)
  const idx = locais.findIndex(a => a.id === id)
  if (idx >= 0) {
    locais[idx] = { ...locais[idx], ...payload } as Acerto
    salvarAcertosLocais(clienteId, locais)
  }
  await sincronizarProximaPromessa(clienteId, locais)
}

/**
 * Exclui um acerto combinado.
 */
export async function excluirAcerto(id: string, clienteId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('acertos')
      .delete()
      .eq('id', id)

    if (error && error.code !== '42P01') throw error
  } catch {
    // fallback
  }

  const locais = obterAcertosLocais(clienteId).filter(a => a.id !== id)
  salvarAcertosLocais(clienteId, locais)
  await sincronizarProximaPromessa(clienteId, locais)
}

/**
 * Alterna status entre pago e pendente.
 */
export async function alternarStatusAcerto(
  id: string,
  clienteId: string,
  marcarComoPago: boolean
): Promise<void> {
  await atualizarAcerto(id, clienteId, {
    status: marcarComoPago ? 'pago' : 'pendente',
    pago_em: marcarComoPago ? new Date().toISOString() : null,
  })
}

/**
 * Abate automaticamente os acertos pendentes mais antigos quando um pagamento é registrado.
 * Retorna os acertos que foram quitados por este pagamento.
 */
export async function abaterAcertosComPagamento(
  clienteId: string,
  valorPago: number
): Promise<{ acertosQuitados: Acerto[] }> {
  if (valorPago <= 0) return { acertosQuitados: [] }

  const acertos = await listarAcertos(clienteId)
  const pendentes = acertos
    .filter(a => a.status === 'pendente')
    .sort((a, b) => a.data.localeCompare(b.data))

  if (pendentes.length === 0) return { acertosQuitados: [] }

  let saldoDisponivel = valorPago
  const quitados: Acerto[] = []

  for (const acerto of pendentes) {
    // Se o valor pago cobrir o acerto integralmente (com tolerância de centavos)
    if (saldoDisponivel >= acerto.valor - 0.05) {
      await alternarStatusAcerto(acerto.id, clienteId, true)
      saldoDisponivel -= acerto.valor
      quitados.push({ ...acerto, status: 'pago' })
    } else {
      // Se não cobrir a parcela inteira, para o abatimento
      break
    }
  }

  if (quitados.length > 0) {
    await sincronizarProximaPromessa(clienteId)
  }

  return { acertosQuitados: quitados }
}
