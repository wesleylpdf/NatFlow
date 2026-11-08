import { supabase } from '@/lib/supabaseClient'
import type { Acerto, NovoAcerto, StatusAcerto } from '@/types'

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
        return novo
      }
      throw error
    }

    const criado = data as Acerto
    const locais = obterAcertosLocais(dados.cliente_id)
    locais.push(criado)
    salvarAcertosLocais(dados.cliente_id, locais)
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
        return criados
      }
      throw error
    }

    const criados = (data as Acerto[]) || []
    const locais = obterAcertosLocais(clienteId)
    locais.push(...criados)
    salvarAcertosLocais(clienteId, locais)
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
}

export interface InfoParcela {
  prefixo: string
  temParenteses: boolean
  indiceAntigo: number
  totalAntigo: number
}

export function parseDescricaoParcela(desc: string | null | undefined): InfoParcela | null {
  if (!desc) return null
  const texto = desc.trim()

  // Caso 1: "Prefixo (1/3)" ou "(1/3)"
  const matchParenteses = texto.match(/^(.*?)\s*\(\s*(\d+)\s*\/\s*(\d+)\s*\)$/i)
  if (matchParenteses) {
    return {
      prefixo: matchParenteses[1].trim(),
      temParenteses: true,
      indiceAntigo: parseInt(matchParenteses[2], 10),
      totalAntigo: parseInt(matchParenteses[3], 10),
    }
  }

  // Caso 2: "Parcela 1/3" ou "Prefixo Parcela 1/3" ou "Prefixo 1/3" ou "1/3"
  const matchBarra = texto.match(/^(.*?)\s*(\d+)\s*\/\s*(\d+)$/i)
  if (matchBarra) {
    let pref = matchBarra[1]?.trim() || ''
    // Remove palavra "Parcela" avulsa no prefixo se existir
    pref = pref.replace(/(?:^|\s+)Parcela$/i, '').trim()
    return {
      prefixo: pref,
      temParenteses: false,
      indiceAntigo: parseInt(matchBarra[2], 10),
      totalAntigo: parseInt(matchBarra[3], 10),
    }
  }

  return null
}

export function formatarDescricaoParcela(
  prefixo: string,
  temParenteses: boolean,
  indice: number,
  total: number
): string {
  if (temParenteses) {
    return prefixo ? `${prefixo} (${indice}/${total})` : `(${indice}/${total})`
  }
  if (prefixo) {
    return `${prefixo} Parcela ${indice}/${total}`
  }
  return `Parcela ${indice}/${total}`
}

/**
 * Reajusta e renumera automaticamente as parcelas restantes de um cliente
 * caso uma parcela tenha sido excluída ou o total tenha mudado.
 */
export async function reajustarDescricoesParcelas(clienteId: string): Promise<void> {
  const acertos = await listarAcertos(clienteId)
  if (acertos.length === 0) return

  // Agrupa os acertos por padrão de parcelamento identificado
  const grupos = new Map<string, { acerto: Acerto; info: InfoParcela }[]>()

  for (const a of acertos) {
    const info = parseDescricaoParcela(a.descricao)
    if (!info) continue

    const chave = `${info.prefixo}__${info.temParenteses}`
    if (!grupos.has(chave)) grupos.set(chave, [])
    grupos.get(chave)!.push({ acerto: a, info })
  }

  const locais = obterAcertosLocais(clienteId)
  let alterouLocal = false

  for (const [, itens] of grupos) {
    const novoTotal = itens.length
    // Ordena cronologicamente por data do acerto
    itens.sort((a, b) => a.acerto.data.localeCompare(b.acerto.data))

    for (let i = 0; i < itens.length; i++) {
      const { acerto, info } = itens[i]
      const novoIndice = i + 1
      const novaDesc = formatarDescricaoParcela(info.prefixo, info.temParenteses, novoIndice, novoTotal)

      if (acerto.descricao !== novaDesc) {
        acerto.descricao = novaDesc

        // Atualiza no banco
        try {
          await supabase
            .from('acertos')
            .update({ descricao: novaDesc })
            .eq('id', acerto.id)
        } catch {
          // fallback
        }

        // Atualiza no localStorage
        const idxLocal = locais.findIndex(l => l.id === acerto.id)
        if (idxLocal >= 0) {
          locais[idxLocal].descricao = novaDesc
          alterouLocal = true
        }
      }
    }
  }

  if (alterouLocal) {
    salvarAcertosLocais(clienteId, locais)
  }
}

/**
 * Exclui um acerto combinado e reajusta as parcelas restantes.
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

  // Reajusta e renumera automaticamente as parcelas restantes (ex: de 1/3 e 2/3 passam a ser 1/2 e 2/2)
  await reajustarDescricoesParcelas(clienteId)
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

  return { acertosQuitados: quitados }
}
